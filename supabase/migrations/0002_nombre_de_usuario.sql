-- Markup · nombre de usuario
--
-- El alta pide un nombre y lo guarda en la metadata de la cuenta. Aquí se copia a
-- `profiles`, que es la tabla que la aplicación sí puede leer: `auth.users` no es
-- accesible, así que sin esta copia nadie podría ver el nombre de los demás.
--
-- Ejecutar después de 0001. También es idempotente.

-- Alta de cuenta: perfil con nombre, e invitaciones pendientes cobradas.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        -- Un alta posterior no debería borrar un nombre ya puesto.
        display_name = coalesce(excluded.display_name, public.profiles.display_name);

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

-- Cambiar el nombre o el correo más adelante también tiene que reflejarse.
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
         )
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of raw_user_meta_data, email on auth.users
for each row execute function public.sync_profile();

-- Cuentas creadas antes de que el alta pidiera nombre: se recoge el que tengan.
update public.profiles p
   set display_name = coalesce(
         nullif(btrim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), ''),
         p.display_name
       )
  from auth.users u
 where u.id = p.id;
