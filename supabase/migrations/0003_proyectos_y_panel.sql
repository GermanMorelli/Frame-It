-- Markup · proyectos y panel
--
-- Hasta aquí los comentarios vivían en el localStorage del navegador y la app no
-- usaba las tablas de 0001: se entraba escribiendo un dominio y lo anotado no
-- salía de esa máquina. Esta migración pone en pie lo que faltaba para que el
-- panel funcione:
--
--   · `slug`, la URL con la que se identifica un proyecto (/proyectos/<slug>).
--   · `start_url`, la página por la que se abre el espacio de trabajo.
--   · Funciones de lectura para el panel, que resuelven de una consulta lo que
--     si no serían cuatro por proyecto.
--   · `invite_member`, que distingue entre alguien que ya tiene cuenta (se hace
--     miembro en el acto) y alguien que no (queda invitado, y la invitación se
--     cobra sola al darse de alta, por el disparador de 0001).
--
-- Ejecutar después de 0001 y 0002. Es idempotente: se puede repetir.

-- ─────────────────────────────────────────────────────────────────────────────
-- Columnas nuevas
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.projects add column if not exists slug text;
alter table public.projects add column if not exists start_url text;

-- ─────────────────────────────────────────────────────────────────────────────
-- El slug
--
-- El nombre del proyecto se convierte en una ruta legible ("Tienda Ludika" →
-- "tienda-ludika"). Es único en toda la instalación y no solo por dueño: un
-- proyecto se comparte con gente de fuera, y si dos personas tuvieran cada una
-- su "tienda", /proyectos/tienda no sabría a cuál de las dos llevar a quien es
-- miembro de ambas.
--
-- Cuando el nombre ya está cogido no se numera (-2, -3): eso delataría cuántos
-- proyectos ajenos se llaman igual. Se añade un sufijo corto al azar.
-- ─────────────────────────────────────────────────────────────────────────────

/** Texto a ruta: sin acentos, en minúsculas y con guiones por separador. */
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          translate(
            lower(btrim(coalesce(p_text, ''))),
            'áàäâãéèëêíìïîóòöôõúùüûñç·',
            'aaaaaeeeeiiiiooooouuuunc-'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '-'
      ),
      ''
    ),
    'proyecto'
  );
$$;

/**
 * Slug libre a partir de un nombre. Va en SECURITY DEFINER porque tiene que ver
 * TODOS los proyectos para saber si uno está cogido, y RLS solo deja ver los
 * propios: sin esto repartiría slugs ya usados por otra persona.
 */
create or replace function public.unique_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := left(public.slugify(p_name), 40);
  candidato text;
  intento int := 0;
begin
  base := btrim(base, '-');
  if base = '' then base := 'proyecto'; end if;

  candidato := base;
  while exists (select 1 from public.projects p where p.slug = candidato) loop
    intento := intento + 1;
    candidato := base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
    -- Salvaguarda: veinte sufijos al azar seguidos ocupados no pasa, pero un
    -- bucle infinito dentro de un INSERT dejaría la conexión colgada.
    exit when intento > 20;
  end loop;

  return candidato;
end;
$$;

/** Los dos campos que la aplicación puede no traer: se rellenan aquí. */
create or replace function public.projects_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.unique_slug(new.name);
  end if;
  if new.start_url is null or btrim(new.start_url) = '' then
    new.start_url := 'https://' || new.site_host;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_defaults on public.projects;
create trigger projects_defaults
before insert on public.projects
for each row execute function public.projects_defaults();

-- Proyectos anteriores a esta migración. Fila a fila y no en un solo UPDATE: en
-- una única sentencia todas las llamadas verían la tabla como estaba al empezar,
-- y dos proyectos con el mismo nombre se llevarían el mismo slug.
do $$
declare fila record;
begin
  for fila in select id, name from public.projects where slug is null or btrim(slug) = '' loop
    update public.projects set slug = public.unique_slug(fila.name) where id = fila.id;
  end loop;
end
$$;

update public.projects
   set start_url = 'https://' || site_host
 where start_url is null or btrim(start_url) = '';

create unique index if not exists projects_slug_key on public.projects (slug);

alter table public.projects alter column slug set not null;
alter table public.projects alter column start_url set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_slug_format') then
    alter table public.projects
      add constraint projects_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_start_url_len') then
    alter table public.projects
      add constraint projects_start_url_len check (char_length(start_url) between 1 and 2048);
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Crear proyecto
--
-- Va por función y no por INSERT directo por el RETURNING: la fila de
-- pertenencia la crea un disparador AFTER INSERT (0001), así que en el momento
-- en que la política de lectura de `projects` mira si soy miembro, todavía puedo
-- no serlo, y la fila recién creada volvería vacía. En SECURITY DEFINER ese
-- problema no existe. El dueño no se acepta por parámetro: sale de la sesión.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.create_project(
  p_name text,
  p_start_url text,
  p_site_host text
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  quien uuid := (select auth.uid());
  creado public.projects;
begin
  if quien is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;

  insert into public.projects (owner_id, name, site_host, start_url)
  values (quien, btrim(p_name), lower(btrim(p_site_host)), btrim(p_start_url))
  returning * into creado;

  return creado;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lecturas del panel
--
-- Van en SECURITY INVOKER (lo de por defecto): RLS se sigue aplicando dentro,
-- así que cada quien ve exactamente sus proyectos. Existen para ahorrar viajes,
-- no para saltarse permisos.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.project_summaries();
drop function if exists public.project_summaries(text);

/** Los proyectos de quien pregunta, con sus cuentas. Con `p_slug`, solo uno. */
create or replace function public.project_summaries(p_slug text default null)
returns table (
  id uuid,
  name text,
  slug text,
  site_host text,
  start_url text,
  owner_id uuid,
  role text,
  created_at timestamptz,
  comment_count bigint,
  open_count bigint,
  page_count bigint,
  member_count bigint,
  last_activity timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.site_host,
    p.start_url,
    p.owner_id,
    (
      select m.role
      from public.project_members m
      where m.project_id = p.id and m.user_id = (select auth.uid())
    ) as role,
    p.created_at,
    coalesce(c.total, 0) as comment_count,
    coalesce(c.abiertos, 0) as open_count,
    coalesce(c.paginas, 0) as page_count,
    coalesce(e.miembros, 0) as member_count,
    -- GREATEST ignora los nulos: un proyecto sin comentarios se ordena por su
    -- fecha de creación en lugar de caer al final de la lista.
    greatest(p.created_at, c.ultimo) as last_activity
  from public.projects p
  left join lateral (
    select
      count(*) as total,
      count(*) filter (where cm.resolved_at is null) as abiertos,
      count(distinct cm.page_url) as paginas,
      max(cm.created_at) as ultimo
    from public.comments cm
    where cm.project_id = p.id
  ) c on true
  left join lateral (
    select count(*) as miembros
    from public.project_members m
    where m.project_id = p.id
  ) e on true
  where p_slug is null or p.slug = p_slug
  order by greatest(p.created_at, c.ultimo) desc;
$$;

/** El equipo de un proyecto, con el nombre de cada quien. El dueño primero. */
create or replace function public.project_team(p_project uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  email text,
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.user_id, m.role, pr.display_name, pr.email, m.created_at
  from public.project_members m
  left join public.profiles pr on pr.id = m.user_id
  where m.project_id = p_project
  order by (m.role = 'owner') desc, m.created_at;
$$;

/**
 * Los comentarios de un proyecto, con quién los escribió. El nombre se trae de
 * `profiles` de una vez: la barra lateral lo enseña en cada tarjeta, y pedirlo
 * aparte sería una consulta por autor.
 */
create or replace function public.project_comments(p_project uuid)
returns table (
  id uuid,
  page_url text,
  selector text,
  hints jsonb,
  label text,
  body text,
  author_id uuid,
  author_name text,
  author_email text,
  resolved_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id, c.page_url, c.selector, c.hints, c.label, c.body,
    c.author_id, pr.display_name, pr.email, c.resolved_at, c.created_at
  from public.comments c
  left join public.profiles pr on pr.id = c.author_id
  where c.project_id = p_project
  order by c.created_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Invitar a un compañero
--
-- SECURITY DEFINER porque hay que mirar en auth.users, que la aplicación no
-- puede leer. El permiso se comprueba a mano en la primera línea: saltarse RLS
-- es justo lo que hace peligrosa una función así.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.invite_member(
  p_project uuid,
  p_email text,
  p_role text default 'editor'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  correo text := lower(btrim(coalesce(p_email, '')));
  quien uuid;
begin
  if not public.is_owner(p_project) then
    raise exception 'Solo el dueño del proyecto puede invitar.';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'El rol tiene que ser editor o viewer.';
  end if;
  if position('@' in correo) < 2 then
    raise exception 'Ese correo no es válido.';
  end if;

  select u.id into quien from auth.users u where lower(u.email) = correo limit 1;

  -- Ya tiene cuenta: entra en el proyecto ahora mismo, sin pasar por invitación.
  if quien is not null then
    insert into public.project_members (project_id, user_id, role)
    values (p_project, quien, p_role)
    on conflict (project_id, user_id) do update
      set role = excluded.role
      -- Al dueño no se le cambia el papel por invitarse a sí mismo.
      where project_members.role <> 'owner';

    delete from public.project_invites
     where project_id = p_project and lower(email) = correo;

    return 'member';
  end if;

  -- No la tiene: queda apuntado. El disparador de 0001 lo hace miembro en cuanto
  -- se dé de alta con ese mismo correo.
  insert into public.project_invites (project_id, email, role, invited_by)
  values (p_project, correo, p_role, (select auth.uid()))
  on conflict (project_id, email) do update set role = excluded.role;

  return 'invited';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────────────────────────────────────

grant execute on function
  public.create_project(text, text, text),
  public.project_summaries(text),
  public.project_team(uuid),
  public.project_comments(uuid),
  public.invite_member(uuid, text, text)
to authenticated;

-- `slugify` y `unique_slug` no se conceden: son piezas internas del disparador, y
-- la segunda contesta si existe un slug ajeno. Dentro de una función SECURITY
-- DEFINER el permiso se mira contra su dueño, así que el alta sigue funcionando.
revoke all on function public.slugify(text), public.unique_slug(text) from authenticated, anon;
