-- Markup · estructura inicial
--
-- Modelo: un proyecto es un sitio que se revisa. A un proyecto se invita gente,
-- y cada comentario cuelga de un proyecto y apunta a un elemento de una página.
-- Quien no es miembro no ve nada: todo el control está en las políticas de RLS,
-- no en la aplicación, porque la clave anon viaja al navegador y no acredita nada.
--
-- Ejecutar entero en Supabase → SQL Editor. Es idempotente: se puede repetir.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────────────────────

-- Espejo mínimo de auth.users. Hace falta porque auth.users no es legible desde
-- la aplicación, y sin esto no se puede mostrar quién escribió cada comentario.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Host del sitio que se revisa ("ludika.me"): agrupa todas sus páginas.
  site_host text not null check (char_length(site_host) between 1 and 253),
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- viewer lee; editor comenta y responde; owner además invita y borra.
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Invitación a alguien que todavía no tiene cuenta. Al darse de alta con ese
-- correo, el disparador de más abajo la convierte en pertenencia y la borra.
create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  -- URL exacta de la página anotada, ya sin redirecciones.
  page_url text not null check (char_length(page_url) between 1 and 2048),
  -- Ruta CSS del elemento y pistas para reencontrarlo si la ruta deja de valer.
  selector text not null,
  hints jsonb not null default '{}'::jsonb,
  -- Etiqueta legible del elemento (tag + primeras palabras), para la lista.
  label text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Índices: las consultas reales son "los comentarios de esta página" y
-- "los proyectos de esta persona".
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists comments_page_idx on public.comments (project_id, page_url, created_at);
create index if not exists comments_pending_idx on public.comments (project_id) where resolved_at is null;
create index if not exists comment_replies_idx on public.comment_replies (comment_id, created_at);
create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_invites_email_idx on public.project_invites (lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- Funciones de pertenencia
--
-- Van en SECURITY DEFINER a propósito: si una política de `projects` consultara
-- `project_members` y la de `project_members` consultara `projects`, Postgres
-- entraría en recursión infinita. Estas saltan RLS y cortan el ciclo.
-- `search_path` vacío obliga a nombrar los esquemas y evita secuestros de nombre.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.is_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_editor(p_project uuid)
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
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.is_owner(p_project uuid)
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
      and m.role = 'owner'
  );
$$;

/** Proyecto al que pertenece un comentario, para las políticas de las respuestas. */
create or replace function public.project_of_comment(p_comment uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.project_id from public.comments c where c.id = p_comment;
$$;

/** ¿Comparto algún proyecto con esta persona? Decide qué perfiles puedo ver. */
create or replace function public.shares_project(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Disparadores
-- ─────────────────────────────────────────────────────────────────────────────

/** Alta de cuenta: se crea su perfil y se cobran las invitaciones pendientes. */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

/**
 * Quien crea un proyecto entra como miembro dueño. Sin esta fila no podría ni
 * ver lo que acaba de crear: la política de lectura pregunta por pertenencia.
 */
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
after insert on public.projects
for each row execute function public.handle_new_project();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at
before update on public.comments
for each row execute function public.touch_updated_at();

-- Cuentas que ya existían antes de esta migración: se les crea el perfil.
insert into public.profiles (id, email)
select u.id, coalesce(u.email, '') from auth.users u
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
alter table public.comments enable row level security;
alter table public.comment_replies enable row level security;

-- Perfiles: el propio, y el de quien comparte proyecto conmigo.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.shares_project(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Proyectos: los ve quien es miembro; los crea cualquiera para sí; los cambia el dueño.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
using (public.is_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
using (public.is_owner(id)) with check (public.is_owner(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated
using (public.is_owner(id));

-- Miembros: la lista la ve el equipo; la toca el dueño. Salirse puede uno mismo.
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
using (public.is_member(project_id));

drop policy if exists project_members_write on public.project_members;
create policy project_members_write on public.project_members for insert to authenticated
with check (public.is_owner(project_id));

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members for update to authenticated
using (public.is_owner(project_id)) with check (public.is_owner(project_id));

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members for delete to authenticated
using (public.is_owner(project_id) or user_id = (select auth.uid()));

-- Invitaciones: cosa del dueño. El invitado no las lee: las cobra al darse de alta.
drop policy if exists project_invites_all on public.project_invites;
create policy project_invites_all on public.project_invites for all to authenticated
using (public.is_owner(project_id)) with check (public.is_owner(project_id));

-- Comentarios: los lee todo el proyecto; los escribe quien puede editar; el
-- texto solo lo cambia quien lo escribió (o el dueño, para poder limpiar).
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
using (public.is_member(project_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
with check (public.is_editor(project_id) and author_id = (select auth.uid()));

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
using (author_id = (select auth.uid()) or public.is_owner(project_id))
with check (author_id = (select auth.uid()) or public.is_owner(project_id));

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
using (author_id = (select auth.uid()) or public.is_owner(project_id));

-- Respuestas: mismo criterio, mirando el proyecto del comentario padre.
drop policy if exists comment_replies_select on public.comment_replies;
create policy comment_replies_select on public.comment_replies for select to authenticated
using (public.is_member(public.project_of_comment(comment_id)));

drop policy if exists comment_replies_insert on public.comment_replies;
create policy comment_replies_insert on public.comment_replies for insert to authenticated
with check (
  public.is_editor(public.project_of_comment(comment_id))
  and author_id = (select auth.uid())
);

drop policy if exists comment_replies_delete on public.comment_replies;
create policy comment_replies_delete on public.comment_replies for delete to authenticated
using (
  author_id = (select auth.uid())
  or public.is_owner(public.project_of_comment(comment_id))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dar por resuelto
--
-- Va por función y no por política: cualquiera que pueda editar debería poder
-- marcar resuelto el comentario de otro, pero no reescribirle el texto. Con una
-- política de UPDATE no se puede separar una cosa de la otra.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_comment_resolved(p_comment uuid, p_resolved boolean)
returns public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.comments;
begin
  select * into target from public.comments where id = p_comment;
  if not found then
    raise exception 'El comentario no existe.';
  end if;
  if not public.is_editor(target.project_id) then
    raise exception 'Sin permiso para cambiar este comentario.';
  end if;

  update public.comments
     set resolved_at = case when p_resolved then now() else null end,
         resolved_by = case when p_resolved then (select auth.uid()) else null end
   where id = p_comment
   returning * into target;

  return target;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo cuentas identificadas. Sin sesión no se toca nada, aunque la
-- clave anon sea pública.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.projects, public.project_members, public.project_invites,
  public.comments, public.comment_replies
to authenticated;

grant select, update on public.profiles to authenticated;

revoke all on
  public.profiles, public.projects, public.project_members, public.project_invites,
  public.comments, public.comment_replies
from anon;

grant execute on function
  public.is_member(uuid), public.is_editor(uuid), public.is_owner(uuid),
  public.project_of_comment(uuid), public.shares_project(uuid),
  public.set_comment_resolved(uuid, boolean)
to authenticated;
