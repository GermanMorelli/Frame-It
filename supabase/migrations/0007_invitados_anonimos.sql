-- Frame It · invitados anónimos
--
-- Hasta aquí para comentar hacía falta una cuenta, y para entrar en un proyecto
-- hacía falta que el dueño escribiera tu correo y que tú aceptaras. Es lo
-- correcto para un equipo, y es demasiado para lo que más se hace con esto:
-- mandarle un sitio a alguien de fuera —un cliente, un diseñador que pasa por
-- ahí— para que diga qué le parece. Esa persona no quiere una cuenta en Frame
-- It; quiere dejar tres frases y cerrar la pestaña.
--
-- Esta migración abre esa puerta:
--
--   · `project_guest_links`, un enlace por proyecto. Quien lo tiene puede
--     entrar; quien no, no. No hay correo que apuntar ni respuesta que esperar:
--     el enlace ES el permiso, y se retira borrándolo.
--   · Un papel nuevo, `guest`. Comenta y lee, y nada más: no resuelve, no
--     invita, no cambia el proyecto y no crea proyectos propios.
--   · `join_as_guest`, que convierte «tengo el enlace» en una fila de
--     pertenencia, y `guest_link_info`, que es lo único que se puede saber de un
--     proyecto antes de entrar: cómo se llama y qué sitio revisa.
--
-- La identidad del invitado la da Supabase con sus altas anónimas: una fila de
-- `auth.users` sin correo y con `is_anonymous` en el testigo. Eso es a propósito
-- y es lo que hace que esta migración sea corta: un invitado es una cuenta como
-- las demás para todo lo que ya estaba escrito —firma sus comentarios con su
-- identificador, tiene perfil, tiene cara, se le puede mencionar y RLS lo mide
-- con las mismas políticas— y lo único que hay que añadir es dónde no llega.
--
-- El nombre («Náufrago Puntual») y la cara al azar las pone la aplicación al
-- darle el alta (`lib/guest.ts`), y viajan en la metadata de la cuenta como las
-- de cualquiera: de ahí las copia a `profiles` el disparador de 0005.
--
-- Hace falta encender las altas anónimas en el panel de Supabase
-- (Authentication → Sign In / Providers → Anonymous sign-ins). Sin eso el enlace
-- de invitado devuelve el error que diga Supabase, y nada más de esto se toca.
--
-- Ejecutar después de 0006. Es idempotente: se puede repetir.

-- ─────────────────────────────────────────────────────────────────────────────
-- ¿Es esta sesión la de un invitado?
--
-- Sale del testigo y no de una tabla porque tiene que poder contestarse antes de
-- que exista fila alguna: se pregunta en la política de creación de proyectos,
-- donde todavía no hay proyecto del que ser miembro.
--
-- Un alta anónima trae el rol `authenticated`, igual que una cuenta de verdad,
-- así que TODAS las políticas ya escritas la dejan pasar. Ahí está el riesgo de
-- esta migración, y esta función es con lo que se tapa: donde un invitado no
-- debe llegar hay que decirlo, porque por omisión llega.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.is_guest_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- El papel nuevo
--
-- `guest` no es un `viewer` con otro nombre: el que solo mira no escribe, y un
-- invitado entra justamente a escribir. Y no es un `editor` porque un editor es
-- del equipo —da por resueltos los comentarios de otros, que es un juicio sobre
-- el trabajo— y quien llega por un enlace no lo es.
-- ─────────────────────────────────────────────────────────────────────────────

-- La restricción de 0001 se creó en línea con la columna, así que su nombre lo
-- puso Postgres. Se busca por lo que dice y no por cómo se llama: si el nombre
-- no fuera el que se espera, un `drop ... if exists` no encontraría nada y la
-- lista antigua seguiría rechazando `guest` sin que nada avisara.
do $$
declare vieja record;
begin
  for vieja in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.project_members'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%viewer%'
      and pg_get_constraintdef(con.oid) not like '%guest%'
  loop
    execute format('alter table public.project_members drop constraint %I', vieja.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname = 'project_members_role_check'
      and conrelid = 'public.project_members'::regclass
  ) then
    alter table public.project_members
      add constraint project_members_role_check
      check (role in ('owner', 'editor', 'viewer', 'guest'));
  end if;
end
$$;

/**
 * Quién puede dejar un comentario: el equipo que edita, y los invitados.
 *
 * Va aparte de `is_editor` en vez de ensancharla, y es la única forma de que la
 * base siga distinguiendo las dos cosas: comentar y dar por resuelto pasaban por
 * la misma pregunta porque hasta ahora eran la misma gente. Ya no.
 */
create or replace function public.can_comment(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'editor', 'guest')
  );
$$;

-- Comentar y responder pasan a mirar esa pregunta. Leer no cambia —un invitado
-- es miembro, y `is_member` ya lo dice— y resolver tampoco: sigue en
-- `is_editor`, que es lo que deja fuera al invitado (`set_comment_resolved`).
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
with check (public.can_comment(project_id) and author_id = (select auth.uid()));

drop policy if exists comment_replies_insert on public.comment_replies;
create policy comment_replies_insert on public.comment_replies for insert to authenticated
with check (
  public.can_comment(public.project_of_comment(comment_id))
  and author_id = (select auth.uid())
);

-- Un invitado no crea proyectos. Sin esta línea sí podría: la política solo pide
-- firmar como uno mismo, y una sesión anónima también es uno mismo. Sería una
-- cuenta sin correo, sin forma de volver a entrar y sin nadie que la reclame.
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
with check (owner_id = (select auth.uid()) and not public.is_guest_session());

-- ─────────────────────────────────────────────────────────────────────────────
-- El enlace
--
-- Uno por proyecto (el índice único de abajo), y el testigo es la única
-- credencial: quien lo tiene entra. Por eso no se numera ni se deriva de nada
-- —sale de `gen_random_uuid`, o sea de 122 bits que no se adivinan— y por eso
-- retirarlo es borrar la fila: un enlace revocado que siguiera existiendo es una
-- puerta cerrada con la llave puesta.
--
-- Borrarlo no echa a quien ya entró. Son dos cosas distintas —«que no entre más
-- gente» y «que se vaya esta»— y la segunda se hace en la lista del equipo,
-- persona por persona, que es donde se ve a quién se está echando.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.project_guest_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_guest_links_token_format') then
    alter table public.project_guest_links
      add constraint project_guest_links_token_format check (token ~ '^[a-f0-9]{32}$');
  end if;
end
$$;

create unique index if not exists project_guest_links_project_key
  on public.project_guest_links (project_id);

alter table public.project_guest_links enable row level security;

-- Cosa del dueño, y de nadie más. El invitado no lo lee: lo trae escrito en la
-- dirección, y lo que se puede saber del proyecto sin entrar lo contesta
-- `guest_link_info`, que es una función y no una fila.
drop policy if exists project_guest_links_all on public.project_guest_links;
create policy project_guest_links_all on public.project_guest_links for all to authenticated
using (public.is_owner(project_id)) with check (public.is_owner(project_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Entrar
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que se puede saber de un proyecto teniendo el enlace y todavía no la
 * entrada: su nombre y el sitio que revisa. Es lo que hace que la pantalla de
 * bienvenida pueda decir a dónde se entra en vez de pedir un clic a ciegas.
 *
 * SECURITY DEFINER porque quien pregunta aún no es miembro —ni cuenta, muchas
 * veces— y la política de lectura de `projects` pide pertenencia. Sin fila que
 * corresponda al testigo devuelve cero filas, que es lo que la pantalla lee como
 * «este enlace ya no vale». No dice nada más: ni cuántos comentarios hay, ni
 * quién está dentro, ni si el proyecto existió alguna vez.
 */
create or replace function public.guest_link_info(p_token text)
returns table (project_name text, site_host text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, p.site_host
  from public.project_guest_links l
  join public.projects p on p.id = l.project_id
  where l.token = p_token;
$$;

/**
 * Convierte «tengo el enlace» en una fila de pertenencia.
 *
 * SECURITY DEFINER porque hace lo que quien llama no puede hacer por su cuenta:
 * darse de alta como miembro de un proyecto que no es suyo. Lo que lo autoriza
 * es el testigo, que se comprueba en la primera mitad, y nada más: el papel no
 * se acepta por parámetro —sería el agujero entero— sino que es siempre `guest`.
 *
 * Quien ya está dentro con su propio papel no lo pierde por abrir un enlace de
 * invitado: el `do nothing` deja la fila que había. Así el dueño puede probar su
 * propio enlace sin degradarse a invitado de su propio proyecto.
 */
create or replace function public.join_as_guest(p_token text)
returns table (slug text, start_url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  quien uuid := (select auth.uid());
  enlace public.project_guest_links;
begin
  if quien is null then
    raise exception 'Hace falta una sesión, aunque sea de invitado.';
  end if;

  select * into enlace from public.project_guest_links l where l.token = p_token;
  if not found then
    raise exception 'Ese enlace ya no vale.';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (enlace.project_id, quien, 'guest')
  on conflict (project_id, user_id) do nothing;

  return query
    select p.slug, p.start_url from public.projects p where p.id = enlace.project_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- El equipo, con los invitados al final
--
-- Mismo tipo de vuelta que en 0005, así que basta con reescribir el cuerpo. Lo
-- que cambia es el orden: el dueño primero, el equipo después y los invitados al
-- final. Una lista de tres personas y once invitados los enseñaba por medio,
-- revueltos con el equipo por orden de llegada, y ahí lo que se busca es siempre
-- a la gente que decide.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.project_team(p_project uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  email text,
  avatar_style text,
  avatar_seed text,
  avatar_bg text,
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.user_id, m.role, pr.display_name, pr.email,
         pr.avatar_style, pr.avatar_seed, pr.avatar_bg, m.created_at
  from public.project_members m
  left join public.profiles pr on pr.id = m.user_id
  where m.project_id = p_project
  -- `false` va antes que `true`, así que «no es invitado» ordena primero.
  order by (m.role = 'owner') desc, (m.role = 'guest'), m.created_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Crear proyecto
--
-- Entera otra vez (0003) con una línea más: un invitado no crea proyectos. La
-- política de arriba ya lo impide, pero esta función va en SECURITY DEFINER y
-- salta RLS, así que aquí el permiso hay que comprobarlo a mano.
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
  if public.is_guest_session() then
    raise exception 'Un invitado no puede crear proyectos.';
  end if;

  insert into public.projects (owner_id, name, site_host, start_url)
  values (quien, btrim(p_name), lower(btrim(p_site_host)), btrim(p_start_url))
  returning * into creado;

  return creado;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
--
-- `guest_link_info` es lo único de todo el esquema que puede llamar quien no
-- tiene sesión: es lo que pinta la pantalla de bienvenida del enlace, que por
-- definición se abre sin cuenta. Contesta dos textos de un proyecto, y solo si
-- se acierta un testigo de 32 caracteres.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon;

grant select, insert, delete on public.project_guest_links to authenticated;
revoke all on public.project_guest_links from anon;

-- Por omisión, Postgres concede EXECUTE de toda función nueva a PUBLIC, o sea
-- también a `anon`. Aquí se quita y se reparte a mano: lo de dentro se pide con
-- sesión, y sin ella solo se puede preguntar por un enlace.
revoke all on function
  public.is_guest_session(), public.can_comment(uuid),
  public.guest_link_info(text), public.join_as_guest(text)
from anon, authenticated;

grant execute on function
  public.is_guest_session(), public.can_comment(uuid),
  public.guest_link_info(text), public.join_as_guest(text)
to authenticated;

grant execute on function public.guest_link_info(text) to anon;
