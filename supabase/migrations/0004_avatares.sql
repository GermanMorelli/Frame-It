-- Markup · avatares
--
-- A la gente se la reconocía por su nombre y por el color de sus marcas sobre el
-- sitio revisado. Un nombre hay que leerlo; una cara no. Esta migración guarda
-- con qué cara aparece cada quien.
--
-- Un avatar aquí no es un archivo: es un estilo y una semilla. El dibujo lo hace
-- DiceBear, que es determinista —la misma semilla da siempre el mismo dibujo—,
-- así que no hay nada que subir, que recortar, que moderar ni que custodiar. Dos
-- columnas de texto bastan, y encima pueden ir vacías: quien no ha elegido nada
-- se dibuja con el estilo de la casa y con su propio identificador por semilla
-- (`lib/avatar.ts`). O sea que una cuenta ya tiene cara antes de que su dueño
-- sepa que puede cambiarla, y la base solo guarda algo de quien de verdad la
-- cambió.
--
-- Como el nombre, el avatar vive primero en la metadata de la cuenta —de donde
-- lo lee quien tiene la sesión sin consultar nada— y de ahí lo copia a
-- `profiles` el mismo disparador de 0002, que es lo que leen los demás.
--
-- Ejecutar después de 0003. Es idempotente: se puede repetir.

-- ─────────────────────────────────────────────────────────────────────────────
-- Columnas nuevas
--
-- Nulas las dos, y no con un valor por defecto: null no significa «sin avatar»
-- sino «el de fábrica», que la aplicación sabe calcular. Rellenarlas de oficio
-- congelaría hoy una decisión —cuál es el estilo de la casa— que mañana se
-- cambia en una constante.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists avatar_style text;
alter table public.profiles add column if not exists avatar_seed text;

-- La lista buena de estilos es la de `lib/avatar.ts`; estas restricciones no la
-- repiten —quedaría desfasada al añadir uno— sino que solo cierran el formato.
-- Lo que de verdad decide qué se le pide al servicio es la lista cerrada de la
-- ruta, no lo que haya en esta tabla.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_style_format') then
    alter table public.profiles
      add constraint profiles_avatar_style_format
      check (avatar_style is null or avatar_style ~ '^[a-z0-9-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_seed_format') then
    alter table public.profiles
      add constraint profiles_avatar_seed_format
      check (avatar_seed is null or avatar_seed ~ '^[A-Za-z0-9_-]{1,64}$');
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- De la metadata al perfil
--
-- Los dos disparadores de 0002, con el avatar añadido. Se reescriben enteros
-- porque `create or replace` sustituye el cuerpo completo.
-- ─────────────────────────────────────────────────────────────────────────────

/** Alta de cuenta: perfil con nombre y cara, e invitaciones pendientes cobradas. */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_style, avatar_seed)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_style', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_seed', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        -- Un alta posterior no debería borrar lo que ya estaba puesto.
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        avatar_style = coalesce(excluded.avatar_style, public.profiles.avatar_style),
        avatar_seed = coalesce(excluded.avatar_seed, public.profiles.avatar_seed);

  if new.email is not null then
    insert into public.project_members (project_id, user_id, role)
    select i.project_id, new.id, i.role
    from public.project_invites i
    where lower(i.email) = lower(new.email)
    on conflict (project_id, user_id) do nothing;

    delete from public.project_invites where lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;

/** Cambiar el nombre, el correo o la cara más adelante también tiene que reflejarse. */
create or replace function public.sync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = coalesce(new.email, email),
         display_name = coalesce(
           nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
           display_name
         ),
         avatar_style = coalesce(
           nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_style', '')), ''),
           avatar_style
         ),
         avatar_seed = coalesce(
           nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_seed', '')), ''),
           avatar_seed
         )
   where id = new.id;
  return new;
end;
$$;

-- Cuentas que ya hubieran elegido cara antes de existir estas columnas. No las
-- hay, pero la migración tiene que poder correrse sobre cualquier estado.
update public.profiles p
   set avatar_style = coalesce(
         nullif(btrim(coalesce(u.raw_user_meta_data ->> 'avatar_style', '')), ''),
         p.avatar_style
       ),
       avatar_seed = coalesce(
         nullif(btrim(coalesce(u.raw_user_meta_data ->> 'avatar_seed', '')), ''),
         p.avatar_seed
       )
  from auth.users u
 where u.id = p.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lecturas del panel
--
-- Las dos que traen gente devuelven ahora también su cara. Va en la misma
-- consulta que el nombre, por lo mismo: pedirla aparte sería una consulta por
-- persona en una lista donde salen todas a la vez.
--
-- Cambia el tipo de vuelta, así que hay que tirarlas antes: `create or replace`
-- no puede cambiar la forma de un `returns table`.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.project_team(uuid);

/** El equipo de un proyecto, con el nombre y la cara de cada quien. El dueño primero. */
create or replace function public.project_team(p_project uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  email text,
  avatar_style text,
  avatar_seed text,
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.user_id, m.role, pr.display_name, pr.email,
         pr.avatar_style, pr.avatar_seed, m.created_at
  from public.project_members m
  left join public.profiles pr on pr.id = m.user_id
  where m.project_id = p_project
  order by (m.role = 'owner') desc, m.created_at;
$$;

drop function if exists public.project_comments(uuid);

/**
 * Los comentarios de un proyecto, con quién los escribió: su nombre, su correo y
 * su cara. La columna de comentarios enseña los tres en cada tarjeta.
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
  author_avatar_style text,
  author_avatar_seed text,
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
    c.author_id, pr.display_name, pr.email,
    pr.avatar_style, pr.avatar_seed,
    c.resolved_at, c.created_at
  from public.comments c
  left join public.profiles pr on pr.id = c.author_id
  where c.project_id = p_project
  order by c.created_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
--
-- Se vuelven a conceder porque las dos funciones se han tirado y creado de nuevo,
-- y con ellas se fueron los suyos.
-- ─────────────────────────────────────────────────────────────────────────────

grant execute on function
  public.project_team(uuid),
  public.project_comments(uuid)
to authenticated;
