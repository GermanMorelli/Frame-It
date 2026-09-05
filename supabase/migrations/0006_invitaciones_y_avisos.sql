-- Frame It · invitaciones que se aceptan y bandeja de avisos
--
-- Hasta aquí invitar a alguien con cuenta lo metía en el proyecto en el acto:
-- `invite_member` insertaba la pertenencia y ya está. Funcionaba, pero es una
-- puerta que se abre desde fuera —de un día para otro te aparece en el panel un
-- sitio ajeno que no pediste, con tu nombre firmando dentro— y no hay forma de
-- decir que no. Esta migración le pone picaporte por dentro:
--
--   · Toda invitación queda pendiente, tenga cuenta o no quien la recibe. Lo
--     único que cambia según eso es si se le puede avisar ya (`invited_user`).
--   · `respond_invite` es la puerta: acepta o rechaza, y en las dos avisa a
--     quien invitó, que es lo que hoy no se entera de nada.
--   · Una tabla de avisos, `notifications`. Es una bandeja y no un registro:
--     guarda a qué se refiere cada aviso —proyecto, comentario, quién lo
--     provocó— y no el texto, que lo escribe la interfaz. Así un proyecto
--     renombrado no deja avisos hablando de un nombre que ya no existe.
--   · Menciones. Un comentario puede señalar a miembros del proyecto
--     (`comments.mentions`), y un disparador convierte eso en avisos.
--
-- El disparador de altas cambia con ellas: darse de alta ya no cobra las
-- invitaciones pendientes. Las ata a la cuenta recién hecha y las deja donde
-- estaban, esperando respuesta, que es de lo que va todo esto.
--
-- Ejecutar después de 0005. Es idempotente: se puede repetir.

-- ─────────────────────────────────────────────────────────────────────────────
-- Columnas nuevas
-- ─────────────────────────────────────────────────────────────────────────────

-- A quién va, cuando esa persona ya tiene cuenta. El correo se queda igual: es
-- lo que se escribió al invitar, y es lo único que hay cuando todavía no la
-- tiene. Las dos cosas conviven porque contestan a preguntas distintas —«a qué
-- dirección» y «a qué cuenta»— y solo la segunda sirve para avisar.
alter table public.project_invites
  add column if not exists invited_user uuid references auth.users (id) on delete cascade;

-- Invitaciones que ya estaban cuando esta columna no existía.
update public.project_invites i
   set invited_user = p.id
  from public.profiles p
 where lower(p.email) = lower(i.email)
   and i.invited_user is null;

create index if not exists project_invites_user_idx on public.project_invites (invited_user);

-- A quién señala un comentario. Un array y no una tabla aparte: se escribe una
-- vez con el comentario, se lee siempre con él y nunca se consulta al revés
-- («dame las menciones de fulano»), que es lo único que pediría una tabla.
alter table public.comments
  add column if not exists mentions uuid[] not null default '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- La bandeja
--
-- Sin texto dentro a propósito. Un aviso guarda de qué habla y la interfaz
-- redacta la frase al pintarla, así que renombrar un proyecto o cambiarse el
-- nombre no deja media bandeja mintiendo. Lo que sí se guarda es el momento en
-- que se leyó: `read_at` nulo es lo que hace que la sección lleve una cuenta.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- A quién se avisa.
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invite', 'invite_accepted', 'invite_declined', 'mention')),
  -- De qué proyecto habla. Al borrarse el proyecto se va el aviso: ya no lleva
  -- a ninguna parte, y una bandeja llena de callejones sin salida es peor que
  -- una bandeja vacía.
  project_id uuid references public.projects (id) on delete cascade,
  -- Y de qué comentario, cuando es una mención.
  comment_id uuid references public.comments (id) on delete cascade,
  -- Quién lo provocó. `set null` porque el aviso sigue teniendo sentido sin
  -- ella: lo que pasó, pasó, aunque esa cuenta ya no esté.
  actor_id uuid references auth.users (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- La consulta real es «mi bandeja, lo último primero». La parcial de sin leer es
-- la que resuelve la cuenta del carril, que se pide en todas las pantallas.
create index if not exists notifications_inbox_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notifications enable row level security;

-- La bandeja es de quien la recibe y de nadie más. No hay política de INSERT:
-- los avisos los escriben las funciones de más abajo, que van en SECURITY
-- DEFINER. Si la aplicación pudiera insertarlos, cualquiera con la clave anon
-- podría llenarle la bandeja a otro.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
using (user_id = (select auth.uid()));

-- Las invitaciones dejan de ser cosa solo del dueño: ahora hay que contestarlas,
-- así que quien las recibe tiene que poder verlas. Sigue sin poder tocarlas —se
-- contestan por `respond_invite`, que es lo que decide qué pasa con cada una.
drop policy if exists project_invites_all on public.project_invites;

-- La condición mira `invited_user` y no el correo, y no es un atajo: una
-- política corre con los permisos de quien pregunta, y `auth.users` no es
-- legible desde la aplicación, así que comparar correos aquí daría un permiso
-- denegado en vez de una fila. Tampoco hace falta: una invitación mandada a un
-- correo sin cuenta no la puede leer nadie porque no hay nadie, y en cuanto esa
-- cuenta existe el disparador del alta le pone `invited_user` (más abajo).
drop policy if exists project_invites_select on public.project_invites;
create policy project_invites_select on public.project_invites for select to authenticated
using (public.is_owner(project_id) or invited_user = (select auth.uid()));

drop policy if exists project_invites_write on public.project_invites;
create policy project_invites_write on public.project_invites for insert to authenticated
with check (public.is_owner(project_id));

drop policy if exists project_invites_update on public.project_invites;
create policy project_invites_update on public.project_invites for update to authenticated
using (public.is_owner(project_id)) with check (public.is_owner(project_id));

-- Retirar una invitación puede el dueño; rechazarla, quien la recibió.
drop policy if exists project_invites_delete on public.project_invites;
create policy project_invites_delete on public.project_invites for delete to authenticated
using (public.is_owner(project_id) or invited_user = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Invitar
--
-- Ya no mete a nadie en ningún sitio: apunta y avisa. Sigue en SECURITY DEFINER
-- porque tiene que mirar auth.users para saber si ese correo tiene cuenta, y el
-- permiso se comprueba a mano en la primera línea.
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
  quien uuid := (select auth.uid());
  destino uuid;
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

  select u.id into destino from auth.users u where lower(u.email) = correo limit 1;

  -- Ya está dentro: invitar otra vez no es un error, pero tampoco hace nada.
  if destino is not null and exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = destino
  ) then
    return 'member';
  end if;

  insert into public.project_invites (project_id, email, role, invited_by, invited_user)
  values (p_project, correo, p_role, quien, destino)
  on conflict (project_id, email) do update
    set role = excluded.role,
        invited_by = excluded.invited_by,
        invited_user = coalesce(excluded.invited_user, public.project_invites.invited_user);

  -- Solo se puede avisar a una cuenta. A quien todavía no la tiene se le ata la
  -- invitación al darse de alta (`handle_new_user`), y es entonces cuando le
  -- aparece en la bandeja.
  if destino is not null then
    insert into public.notifications (user_id, kind, project_id, actor_id)
    select destino, 'invite', p_project, quien
    -- Reinvitar no apila avisos: el que ya está sigue sirviendo, y duplicarlo
    -- sería una bandeja que crece cada vez que alguien cambia el rol.
    where not exists (
      select 1 from public.notifications n
      where n.user_id = destino and n.kind = 'invite' and n.project_id = p_project
    );
    return 'notified';
  end if;

  return 'invited';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contestar
--
-- SECURITY DEFINER porque hace tres cosas que quien contesta no puede hacer por
-- su cuenta: darse de alta como miembro de un proyecto que todavía no es suyo,
-- borrar una invitación y escribir en la bandeja de otro. Que la invitación sea
-- suya se comprueba en la primera mitad, y sin eso no pasa nada de lo demás.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.respond_invite(p_invite uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  quien uuid := (select auth.uid());
  correo text;
  inv public.project_invites;
begin
  if quien is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;

  select lower(u.email) into correo from auth.users u where u.id = quien;
  select * into inv from public.project_invites where id = p_invite;

  -- Que no esté es lo normal si se contesta dos veces desde dos pestañas, así
  -- que no es una excepción: es que ya no hay nada que hacer.
  if not found then
    return 'gone';
  end if;

  if inv.invited_user is distinct from quien and lower(inv.email) is distinct from correo then
    raise exception 'Esa invitación no es tuya.';
  end if;

  if p_accept then
    insert into public.project_members (project_id, user_id, role)
    values (inv.project_id, quien, inv.role)
    on conflict (project_id, user_id) do nothing;
  end if;

  delete from public.project_invites where id = inv.id;

  -- El aviso que traía aquí ya no lleva a ninguna parte: lo que decía —«tienes
  -- una invitación»— acaba de dejar de ser verdad.
  delete from public.notifications
   where user_id = quien and kind = 'invite' and project_id = inv.project_id;

  -- Y quien invitó se entera, que es lo que antes no pasaba. Invitarse a uno
  -- mismo no se avisa: ya lo sabe.
  if inv.invited_by is not null and inv.invited_by <> quien then
    insert into public.notifications (user_id, kind, project_id, actor_id)
    values (
      inv.invited_by,
      case when p_accept then 'invite_accepted' else 'invite_declined' end,
      inv.project_id,
      quien
    );
  end if;

  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lecturas de la bandeja
--
-- Estas dos van en SECURITY DEFINER, y es la excepción a lo que hacen las demás
-- lecturas del panel. La razón es el caso que da sentido a todo esto: cuando te
-- invitan a un proyecto todavía no eres miembro, así que RLS no te deja leer ni
-- su nombre. Una invitación que no puede decir a qué proyecto es no se puede
-- contestar. Las dos filtran a mano por `auth.uid()` en la única cláusula que
-- importa, así que no enseñan más que lo dirigido a quien pregunta.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.my_invites();

/** Las invitaciones que esperan mi respuesta, con quién las mandó. */
create or replace function public.my_invites()
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  site_host text,
  role text,
  created_at timestamptz,
  inviter_id uuid,
  inviter_name text,
  inviter_email text,
  inviter_avatar_style text,
  inviter_avatar_seed text,
  inviter_avatar_bg text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id, i.project_id, p.name, p.site_host, i.role, i.created_at,
    i.invited_by, pr.display_name, pr.email,
    pr.avatar_style, pr.avatar_seed, pr.avatar_bg
  from public.project_invites i
  join public.projects p on p.id = i.project_id
  left join public.profiles pr on pr.id = i.invited_by
  where i.invited_user = (select auth.uid())
     or lower(i.email) = (select lower(u.email) from auth.users u where u.id = (select auth.uid()))
  order by i.created_at desc;
$$;

drop function if exists public.my_notifications(int);

/** Mi bandeja, lo último primero, con todo lo que hace falta para redactarla. */
create or replace function public.my_notifications(p_limit int default 20)
returns table (
  id uuid,
  kind text,
  created_at timestamptz,
  read_at timestamptz,
  project_id uuid,
  project_name text,
  project_slug text,
  comment_id uuid,
  comment_body text,
  page_url text,
  actor_id uuid,
  actor_name text,
  actor_email text,
  actor_avatar_style text,
  actor_avatar_seed text,
  actor_avatar_bg text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id, n.kind, n.created_at, n.read_at,
    n.project_id, p.name, p.slug,
    n.comment_id, c.body, c.page_url,
    n.actor_id, pr.display_name, pr.email,
    pr.avatar_style, pr.avatar_seed, pr.avatar_bg
  from public.notifications n
  left join public.projects p on p.id = n.project_id
  left join public.comments c on c.id = n.comment_id
  left join public.profiles pr on pr.id = n.actor_id
  where n.user_id = (select auth.uid())
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Menciones
--
-- El aviso no lo escribe la aplicación sino un disparador, y eso es a propósito:
-- el comentario se guarda con un INSERT normal contra `comments`, sujeto a RLS,
-- y lo que decide a quién se avisa es la fila que acabó entrando. Si la
-- aplicación mandara los avisos por su cuenta, un POST a pelo podría avisar a
-- gente sin dejar comentario ninguno.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.notify_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El filtro por pertenencia es el que importa: `mentions` viene del navegador
  -- y podría traer cualquier identificador. Señalar a quien no está en el
  -- proyecto no avisa a nadie.
  insert into public.notifications (user_id, kind, project_id, comment_id, actor_id)
  select m.user_id, 'mention', new.project_id, new.id, new.author_id
  from public.project_members m
  where m.project_id = new.project_id
    and m.user_id = any (new.mentions)
    -- Mencionarse a uno mismo no se avisa: acabas de escribirlo.
    and m.user_id <> new.author_id;

  return new;
end;
$$;

drop trigger if exists comments_notify_mentions on public.comments;
create trigger comments_notify_mentions
after insert on public.comments
for each row execute function public.notify_mentions();

-- ─────────────────────────────────────────────────────────────────────────────
-- Alta de cuenta
--
-- Entera otra vez, con el único cambio que trae esta migración: las invitaciones
-- pendientes ya no se cobran solas. Se atan a la cuenta recién creada y quedan
-- esperando, y de cada una sale un aviso. Quien se da de alta encuentra su
-- bandeja con lo que le habían mandado, en vez de un panel con proyectos ajenos
-- que nunca aceptó.
-- ─────────────────────────────────────────────────────────────────────────────

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
    update public.project_invites
       set invited_user = new.id
     where lower(email) = lower(new.email)
       and invited_user is null;

    insert into public.notifications (user_id, kind, project_id, actor_id)
    select new.id, 'invite', i.project_id, i.invited_by
    from public.project_invites i
    where i.invited_user = new.id;
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────────────────────────────────────

grant select, update, delete on public.notifications to authenticated;
revoke all on public.notifications from anon;
-- Sin INSERT ni para `authenticated`: los avisos solo los escriben las funciones.
revoke insert on public.notifications from authenticated;

grant execute on function
  public.invite_member(uuid, text, text),
  public.respond_invite(uuid, boolean),
  public.my_invites(),
  public.my_notifications(int)
to authenticated;
