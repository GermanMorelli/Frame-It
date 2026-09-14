-- Frame It · historial de avisos
--
-- Hasta aquí un aviso se gastaba al abrirlo: la fila de la bandeja llevaba a lo
-- que contaba y, de paso, se borraba de la base. Era barato —la bandeja nunca
-- crecía y no había nada que barrer— y a cambio no quedaba rastro de nada. Quien
-- pulsaba un aviso sin querer, o miraba una mención y volvía sin contestarla, se
-- quedaba sin la única pista de que aquello había pasado.
--
-- Esta migración no cambia la tabla: lo que cambia es la aplicación, que a partir
-- de ahora marca leído en vez de borrar (`app/avisos/actions.ts`). Con eso, la
-- tabla que ya guardaba los avisos pasa a ser también su historial, y aquí solo
-- hace falta lo que un historial necesita y una bandeja de doce filas no:
--
--   · Paginar. `my_notifications` se queda corta con un solo tope: la banda del
--     carril pide las últimas doce y la pantalla de historial pide de treinta en
--     treinta, empezando donde lo dejó la página anterior.
--   · Contar. La pantalla tiene que decir cuántos hay en total y cuántos sin ver
--     para saber si hay página siguiente y si merece la pena ofrecer vaciarlos.
--
-- Borrar no necesita función: la política `notifications_delete` de 0006 ya deja
-- a cada quien borrar los suyos, así que tanto quitar uno como vaciar los vistos
-- son DELETE normales sujetos a RLS, y eso es exactamente lo que se quiere —que
-- el permiso lo decida la base y no la acción de servidor, que se puede invocar
-- con un POST a pelo.
--
-- Ejecutar después de 0007. Es idempotente: se puede repetir.

-- ─────────────────────────────────────────────────────────────────────────────
-- La bandeja, ahora paginable
--
-- Sigue en SECURITY DEFINER por lo mismo que en 0006, que no ha cambiado: cuando
-- te invitan a un proyecto todavía no eres miembro y RLS no te deja leer ni su
-- nombre, así que el aviso no podría decir de qué habla. El filtro a mano por
-- `auth.uid()` es el que sustituye a la política.
--
-- El desplazamiento se acota igual que el tope. Un `offset` que llegue del
-- navegador es un número cualquiera, y aquí los números cualesquiera se recortan
-- en vez de hacer fallar la consulta: una página de más devuelve una lista vacía,
-- que es lo que de verdad hay allí.
-- ─────────────────────────────────────────────────────────────────────────────

-- La firma cambia, así que la de un solo argumento se va. Si se quedara, una
-- llamada con solo `p_limit` sería ambigua y Postgres la rechazaría.
drop function if exists public.my_notifications(int);
drop function if exists public.my_notifications(int, int);

create or replace function public.my_notifications(p_limit int default 20, p_offset int default 0)
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
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Las dos cifras del historial
--
-- Esta sí va en SECURITY INVOKER —o sea, sin nada: es lo de fábrica—, y la
-- diferencia con la de arriba importa. Contar no necesita leer proyectos ajenos,
-- solo filas propias de `notifications`, y esas la política `notifications_select`
-- ya las deja ver. Donde RLS basta, RLS manda; el filtro explícito por
-- `auth.uid()` está para que la consulta use el índice del buzón y no para
-- sustituir a la política.
--
-- Las dos salen de un solo recorrido. Son la misma tabla y el mismo dueño, y
-- pedirlas por separado serían dos viajes para pintar una línea de cabecera.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.my_notification_counts()
returns table (total bigint, unread bigint)
language sql
stable
set search_path = ''
as $$
  select
    count(*),
    count(*) filter (where n.read_at is null)
  from public.notifications n
  where n.user_id = (select auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────────────────────────────────────

grant execute on function
  public.my_notifications(int, int),
  public.my_notification_counts()
to authenticated;
