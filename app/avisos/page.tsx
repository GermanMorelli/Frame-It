import Link from "next/link";
import { redirect } from "next/navigation";
import { BellOff } from "lucide-react";
import { clearSeenNotifications, markNotificationsRead } from "@/app/avisos/actions";
import AppShell from "@/components/AppShell";
import DangerButton from "@/components/DangerButton";
import NotificationRow from "@/components/NotificationRow";
import { plural } from "@/lib/dates";
import { listNotifications, notificationCounts } from "@/lib/notifications";
import { getUser } from "@/lib/supabase/server";
import { BTN_OUTLINE_SM, BTN_QUIET } from "@/lib/ui";
import { displayName, isGuest, userAvatar } from "@/lib/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Avisos · Frame It" };

/**
 * Cuántos avisos por página.
 *
 * Treinta y no doce, que es lo que enseña la banda del carril: allí el aviso es
 * una anotación al margen de lo que se está haciendo y lo que importa es lo
 * último; aquí se viene a buscar algo, y buscar es recorrer. Y treinta y no cien
 * porque una página que no se acaba nunca es lo mismo que no tener páginas: si
 * la lista no cabe en dos o tres pantallas, nadie llega al final.
 */
const PER_PAGE = 30;

/** La página pedida, contando desde uno. Lo que no sea un número es la primera. */
function askedPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(page) && page > 1 ? page : 1;
}

/** La dirección de una página del historial. La primera no lleva parámetro. */
function pagePath(page: number): string {
  return page <= 1 ? "/avisos" : `/avisos?p=${page}`;
}

/**
 * El historial de avisos.
 *
 * Esta pantalla existe porque abrir un aviso dejó de borrarlo. Antes la bandeja
 * se vaciaba sola: lo que se miraba desaparecía, y lo que quedaba eran las doce
 * últimas filas de la banda del carril y nada más. Era cómodo mientras todo iba
 * bien y no dejaba nada cuando no: quien pulsaba sin querer, o iba a una mención
 * y volvía sin contestarla, se quedaba sin la única pista de que aquello había
 * pasado. Ahora los avisos se quedan, y esto es dónde se los mira enteros.
 *
 * Y si se quedan, hay que poder tirarlos. Son las dos mitades de la misma
 * decisión: un historial sin escoba acaba siendo un cajón. Se puede quitar uno
 * —la cruz de cada fila— o vaciar de una vez todo lo ya visto, que es lo único
 * que se vacía en bloque. Lo que no se ha mirado no se tira sin querer con un
 * botón que dice «vaciar»: eso es trabajo pendiente, y quien lo quiera fuera lo
 * quita uno a uno.
 *
 * Las filas son las mismas que la banda y la campana (`NotificationRow`), en su
 * talla grande. No es otra lista: es la misma, sin el tope de doce.
 */
export default async function AvisosPage({ searchParams }: PageProps<"/avisos">) {
  // El proxy ya corta el paso sin sesión; esto lo vuelve a comprobar contra
  // Supabase, que es lo que de verdad acredita al usuario.
  const user = await getUser();
  if (!user) redirect("/login?next=%2Favisos");

  // A un invitado no se le avisa de nada: no tiene panel, no se le puede invitar
  // y no está en ningún equipo que pueda mencionarle. La raíz le devuelve a su
  // proyecto, que es lo único que vino a hacer.
  if (isGuest(user)) redirect("/");

  const page = askedPage((await searchParams).p);

  // Las cifras y la página van juntas: el total es lo que dice si hay siguiente,
  // y sin él la última página tendría un botón que lleva a una lista vacía.
  const [counts, notifications] = await Promise.all([
    notificationCounts(),
    listNotifications(PER_PAGE, (page - 1) * PER_PAGE),
  ]);

  const pages = Math.max(1, Math.ceil(counts.total / PER_PAGE));
  // Una página inventada a mano en la barra de direcciones devuelve vacío. No es
  // un error —no falta nada, es que allí no hay nada—, así que se vuelve a la
  // primera en vez de enseñar un hueco con paginador.
  if (page > pages && counts.total > 0) redirect("/avisos");

  return (
    // Sin `narrow`: la misma caja que Invitaciones, y por lo mismo. Los dos
    // anchos se centran en lo que sobra, así que una pantalla en la columna de
    // 1200 y otra en la de 1600 empiezan en píxeles distintos, y al saltar de
    // una a otra desde el carril el titular daba un brinco lateral. Aquí no hay
    // texto largo que pida la columna estrecha: hay una lista, y la lista se
    // planta sola.
    <AppShell
      active="avisos"
      userName={displayName(user)}
      userAvatar={userAvatar(user)}
      userEmail={user.email}
    >
      {/* El mismo titular que Proyectos e Invitaciones, con la misma hechura: la
          fila que se reparte a lo ancho, el nombre de la sección, la línea que
          dice de qué van las cosas que hay en ella y, a la derecha, lo que se
          hace con la lista entera. Va haya avisos o no: es lo que dice dónde
          está quien acaba de llegar sin tener que volver a mirar el carril. */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-heading">Avisos</h1>
          <p className="mt-4 max-w-[52ch] text-body text-olive-stone">
            {counts.total === 0
              ? "Todo lo que te pase en los proyectos se queda apuntado aquí."
              : counts.unread > 0
                ? `${plural(counts.total, "aviso guardado", "avisos guardados")}, ${counts.unread} sin ver.`
                : `${plural(counts.total, "aviso guardado", "avisos guardados")}. Los has visto todos.`}
          </p>
        </div>

        {/* Las dos acciones de la lista entera, en el orden de lo que se hace
            antes: primero se da por visto, y solo después tiene sentido tirar lo
            visto. La de tirar se queda en el registro callado aunque sea la que
            se vino a buscar —lo irreversible no debe ser el blanco más fácil de
            la pantalla (ley de Fitts, aplicada al revés)— y lo que la hace
            visible es que dice cuántos se lleva, no su tamaño. */}
        {counts.total > 0 && (
          <div className="flex flex-wrap items-center gap-4">
            {counts.unread > 0 && (
              <form action={markNotificationsRead}>
                <button type="submit" className={BTN_OUTLINE_SM}>
                  Dar todos por vistos
                </button>
              </form>
            )}

            {counts.seen > 0 && (
              <form action={clearSeenNotifications}>
                <DangerButton
                  confirm={`Se van a borrar ${plural(counts.seen, "aviso ya visto", "avisos ya vistos")}. Los que no has mirado se quedan. ¿Seguimos?`}
                >
                  Vaciar lo visto ({counts.seen})
                </DangerButton>
              </form>
            )}
          </div>
        )}
      </header>

      {notifications.length === 0 ? (
        <NoAvisos />
      ) : (
        <>
          <ul className="mt-6 grid max-w-page gap-2">
            {notifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} full />
            ))}
          </ul>

          {/* Anterior y siguiente, y ninguna cifra de página que pulsar. Un
              historial se recorre hacia atrás desde lo último: nadie sabe qué
              había en la página cuatro, así que una fila de números sería una
              fila de blancos que no dicen a dónde llevan. Lo que sí hace falta
              es saber por dónde se va, y eso lo dice el rótulo de en medio. */}
          {pages > 1 && (
            <nav
              aria-label="Páginas del historial"
              className="mt-8 flex max-w-page items-center justify-between gap-4"
            >
              {page > 1 ? (
                <Link href={pagePath(page - 1)} className={BTN_QUIET}>
                  ← Más recientes
                </Link>
              ) : (
                <span />
              )}

              <span className="label-xs text-olive-stone">
                Página {page} de {pages}
              </span>

              {page < pages ? (
                <Link href={pagePath(page + 1)} className={BTN_QUIET}>
                  Más antiguos →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </AppShell>
  );
}

/**
 * El historial vacío, con la misma hechura que el de Invitaciones y por las
 * mismas razones: la frase sola en el eje del cristal, el titular arriba
 * haciendo de rótulo y sitio de sobra alrededor, porque el vacío se dice con
 * aire. Quien llega aquí y no tiene nada no necesita un párrafo sobre cómo
 * funcionarían los avisos si los tuviera; necesita saber en un vistazo que ha
 * mirado y estaba vacío.
 *
 * La campana tachada es el mismo objeto que lleva la barra de arriba, apagada, y
 * sale del mismo juego de iconos que todo lo demás. Va en piedra de oliva y con
 * el trazo bajado a 1.5: a 96px el grosor de siempre se convierte en un dibujo
 * que pesa más que la frase.
 */
function NoAvisos() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
      <p className="text-heading text-olive-stone">Parece que no hay nada por aquí</p>
      <BellOff aria-hidden size={96} strokeWidth={1.5} className="text-olive-stone" />
    </div>
  );
}
