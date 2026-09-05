import { markNotificationsRead } from "@/app/invitaciones/actions";
import NotificationRow from "@/components/NotificationRow";
import type { Notification } from "@/lib/notifications";

/**
 * La banda de avisos, al pie del carril.
 *
 * Es una banda, y por eso se ve sin pulsar nada, todo el rato, en la columna que
 * de todas formas está en pantalla: un aviso deja de ser una interrupción y pasa
 * a ser el estado de las cosas.
 *
 * Arriba hay además una campana (`NotificationBell`) con esta misma bandeja
 * colgando, y no es una contradicción ni una segunda lista: son las mismas filas
 * (`NotificationRow`) leídas de la misma consulta. La banda es la que se mira de
 * reojo mientras se trabaja; la campana es la que se puede alcanzar desde donde
 * el ojo ya está —el canto derecho de la barra, junto al perfil— y la única
 * forma de leer los avisos en pantalla estrecha, donde esto no se pinta.
 *
 * Cada aviso guarda de qué habla y no lo que dice —proyecto, comentario, quién
 * lo provocó (migración 0006)—, así que la frase se redacta aquí. Es más código
 * que guardar el texto, y a cambio un proyecto renombrado no deja media bandeja
 * hablando de un nombre que ya no existe.
 *
 * En pantalla estrecha no se pinta. Ahí el carril es una franja horizontal bajo
 * la barra, y una lista de avisos dentro de una franja de scroll lateral no es
 * una bandeja: es un sitio donde se pierden cosas. Su sitio en el móvil todavía
 * no está decidido, y meterla a la fuerza sería decidirlo mal.
 */
export default function NotificationBand({ notifications }: { notifications: Notification[] }) {
  const unread = notifications.filter((notification) => notification.readAt === null).length;

  return (
    <section
      aria-label="Avisos"
      className="hidden min-h-0 flex-1 flex-col border-t border-soft-mist md:flex"
    >
      <header className="flex items-center gap-2 px-6 pb-2 pt-4">
        <h2 className="label-xs flex-1 text-olive-stone">Avisos</h2>

        {/* Darlos por vistos es lo único que se hace con la bandeja entera, y
            solo aparece cuando hay algo que ver: un botón que no cambia nada es
            un botón que enseña a no leer los botones. */}
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <button
              type="submit"
              title="Dar todos por vistos"
              className="label-xs text-olive-stone underline-offset-4 transition hover:text-midnight-ink hover:underline"
            >
              Visto
            </button>
          </form>
        )}
      </header>

      {notifications.length === 0 ? (
        <p className="px-6 pb-4 text-caption text-olive-stone">
          Aquí aparecerá cuando te inviten a un proyecto o te mencionen en un comentario.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
    </section>
  );
}
