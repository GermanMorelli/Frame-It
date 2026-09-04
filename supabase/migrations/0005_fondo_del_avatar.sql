-- Markup · el fondo del avatar
--
-- El avatar de 0004 se dibuja sobre el lavado pastel que sale del correo de cada
-- quien, el mismo del que sale su color. Es un buen reparto —da variedad sin que
-- nadie decida nada, y ata la cara al color de sus marcas— pero es un reparto,
-- no una elección. Esta migración añade la tercera pieza del avatar, que es la
-- única de las tres que se ve sin mirar de cerca: el fondo.
--
-- Los fondos posibles son los cuatro del sistema (los tres lavados de categoría
-- y la regla de pelo), así que elegir aquí no es abrir un selector de color: es
-- escoger entre superficies que la aplicación ya usa en otros sitios.
--
-- Nula otra vez, y por lo mismo que las otras dos: null no es «sin fondo» sino
-- «el que le toca». Quien elige uno suelta esa atadura; quien no ha entrado
-- nunca a esta pantalla sigue teniendo la cara que ya tenía.
--
-- Ejecutar después de 0004. Es idempotente: se puede repetir.

-- ─────────────────────────────────────────────────────────────────────────────
-- Columna nueva
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists avatar_bg text;

-- La lista buena de fondos es la de `lib/author-color.ts`; aquí solo se cierra
-- el formato, como con el estilo. Lo que de verdad decide qué color se le pide
-- al servicio es la lista cerrada de la ruta, no lo que haya en esta tabla.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_bg_format') then
    alter table public.profiles
      add constraint profiles_avatar_bg_format
      check (avatar_bg is null or avatar_bg ~ '^[a-z]{1,20}$');
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- De la metadata al perfil
--
-- Los dos disparadores otra vez enteros, con la tercera pieza. Se reescriben
-- completos porque `create or replace` sustituye el cuerpo entero.
-- ─────────────────────────────────────────────────────────────────────────────

/** Alta de cuenta: perfil con nombre y cara, e invitaciones pendientes cobradas. */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_style, avatar_seed, avatar_bg)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_style', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_seed', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_bg', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        -- Un alta posterior no debería borrar lo que ya estaba puesto.
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        avatar_style = coalesce(excluded.avatar_style, public.profiles.avatar_style),
        avatar_seed = coalesce(excluded.avatar_seed, public.profiles.avatar_seed),
        avatar_bg = coalesce(excluded.avatar_bg, public.profiles.avatar_bg);

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
         ),
         avatar_bg = coalesce(
           nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_bg', '')), ''),
           avatar_bg
         )
   where id = new.id;
  return new;
end;
$$;

-- Cuentas que ya hubieran elegido fondo antes de existir la columna. No las hay,
-- pero la migración tiene que poder correrse sobre cualquier estado.
update public.profiles p
   set avatar_bg = coalesce(
         nullif(btrim(coalesce(u.raw_user_meta_data ->> 'avatar_bg', '')), ''),
         p.avatar_bg
       )
  from auth.users u
 where u.id = p.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lecturas del panel
--
-- Las dos que traen gente, otra vez tiradas y creadas: cambia su tipo de vuelta,
-- y eso `create or replace` no lo puede hacer.
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
  author_avatar_bg text,
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
    pr.avatar_style, pr.avatar_seed, pr.avatar_bg,
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
