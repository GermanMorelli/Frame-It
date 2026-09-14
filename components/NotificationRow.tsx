"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useTransition } from "react";
import { dismissNotification, markNotificationRead } from "@/app/avisos/actions";
import Avatar from "@/components/Avatar";
import { relativeDate, shortDate } from "@/lib/dates";
import type { Notification, NotificationKind } from "@/lib/notifications";
import { projectPath, workspacePath } from "@/lib/routes";

/**
 * Una línea de la bandeja.
 *
 * Vive en su propio archivo porque la bandeja se mira desde tres sitios —la
 * banda del carril, el panel que cuelga de la campana y el historial de
 * `/avisos`— y una fila que se pinte tres veces se desincroniza a la primera:
 * uno de los tres se quedaría sin el punto de sin leer el día que alguien toque
 * otro. Lo que comparten es la fila, no la caja que la contiene, que es
 * justamente la parte en la que se diferencian.
 *
 * De ahí `full`. No es un segundo componente ni un segundo estilo: es la misma
 * fila vestida para la columna en la que va. En 224px el aviso es una anotación
 * al margen y se escribe en el registro pequeño; en la columna de lectura del
 * historial es lo único que hay en pantalla, así que sube a cuerpo de texto, la
 * cara crece y la fila se mete en una tarjeta. Lo que dice, a dónde lleva y qué
 * se puede hacer con ella es lo mismo en los tres sitios.
 *
 * Abrir un aviso ya no lo gasta. Antes se marcaba como visto borrándolo, y eso
 * dejaba sin rastro a quien pulsaba sin querer o volvía de una mención sin
 * contestarla. Ahora abrir lo da por visto y el aviso se queda en el historial;
 * quitarlo es la cruz, que es una decisión aparte. Lo que hay detrás nunca se
 * pierde: el proyecto sigue en el panel, la invitación sin contestar sigue en su
 * sección del carril y el comentario, en su página.
 *
 * Lleva `"use client"` por eso: hay que llamar a la acción al pulsar, y tanto la
 * banda como el historial los pinta el servidor. Es un puñado de bytes al
 * navegador —la fila ya viajaba entera para el panel de la campana, que es
 * cliente desde el principio.
 */

/** A dónde lleva cada aviso: al sitio donde se hace algo con lo que cuenta. */
export function destination(notification: Notification): string {
  if (notification.kind === "invite") return "/invitaciones";
  if (!notification.projectSlug) return "/";
  // Una mención lleva a la página comentada, no al proyecto: lo que se quiere
  // ver es el elemento del que se habla.
  if (notification.kind === "mention" && notification.pageUrl) {
    return workspacePath(notification.projectSlug, notification.pageUrl);
  }
  return projectPath(notification.projectSlug);
}

/**
 * El verbo de cada tipo. La frase se parte en dos porque el nombre del proyecto
 * va en negrita y el resto no: es lo que se busca al repasar la columna de
 * arriba abajo.
 */
const VERBS: Record<NotificationKind, string> = {
  invite: "te invitó a",
  invite_accepted: "aceptó entrar en",
  invite_declined: "no entró en",
  mention: "te mencionó en",
};

export default function NotificationRow({
  notification,
  onNavigate,
  full = false,
}: {
  notification: Notification;
  /** El panel que cuelga de la campana se cierra al irse por una de sus filas. */
  onNavigate?: () => void;
  /** La talla del historial: cuerpo de texto, cara grande y tarjeta propia. */
  full?: boolean;
}) {
  const who = notification.actor?.name || "Alguien";
  const unread = notification.readAt === null;
  // Ni la navegación ni la marca esperan la una a la otra, y es lo correcto: lo
  // que se ha pedido es ir a lo que cuenta el aviso, no ver cambiar una fila. La
  // transición está para que la bandeja se vuelva a pintar con la marca puesta
  // cuando la acción conteste —al volver de donde sea, o en el sitio si se abrió
  // en otra pestaña.
  const [, marcando] = useTransition();

  const abrir = () => {
    // Lo ya visto no se vuelve a marcar: sería un viaje a la base para escribir
    // lo que ya está escrito, y movería la fecha de lectura sin que nadie lo
    // pidiera.
    if (!unread) return;
    marcando(() => {
      void markNotificationRead(notification.id);
    });
  };

  return (
    // La fila entera es el enlace, y el botón de quitar va encima suyo en la
    // misma caja: un `form` dentro de un `a` no es HTML válido, así que se
    // colocan como hermanos y el enlace ocupa el hueco entero por debajo.
    <li
      className={`group relative ${
        full ? "rounded-card border border-soft-mist bg-paper-white" : ""
      }`}
    >
      <Link
        href={destination(notification)}
        onClick={() => {
          abrir();
          onNavigate?.();
        }}
        className={
          full
            ? "flex gap-4 rounded-card px-4 py-4 pr-12 transition hover:bg-soft-mist"
            : "flex gap-2.5 rounded-button px-3 py-2.5 pr-8 transition hover:bg-soft-mist"
        }
      >
        {notification.actor ? (
          <Avatar
            avatar={notification.actor.avatar}
            name={notification.actor.name}
            email={notification.actor.email}
            size={full ? 40 : 22}
          />
        ) : (
          // Quien lo provocó se dio de baja. El aviso sigue contando lo que
          // contaba, así que se pinta el hueco de su cara y no se borra la fila.
          <span
            aria-hidden
            className={`shrink-0 rounded-full bg-soft-mist ${
              full ? "size-10" : "mt-0.5 size-[22px]"
            }`}
          />
        )}

        <span className="min-w-0 flex-1">
          <span className={full ? "block text-body" : "block text-caption leading-[1.45]"}>
            <strong className="font-semibold">{who}</strong> {VERBS[notification.kind]}{" "}
            <strong className="font-semibold">{notification.projectName}</strong>
          </span>

          {/* De la mención se enseña lo que se escribió: es lo que decide si hay
              que ir ahora o luego, y sin ello el aviso obliga a abrir el
              proyecto para saber de qué iba. */}
          {notification.kind === "mention" && notification.commentBody && (
            <span
              className={`mt-1 line-clamp-2 block break-words text-olive-stone ${
                full ? "text-body" : "text-caption"
              }`}
            >
              {notification.commentBody}
            </span>
          )}

          <span
            className="label-xs mt-1 block text-olive-stone"
            title={shortDate(notification.createdAt)}
          >
            {relativeDate(notification.createdAt)}
          </span>
        </span>

        {/* Sin mirar todavía. Un punto y no una fila resaltada: lo que hay que
            distinguir es cuáles son nuevos, no separar la columna en dos
            bloques de color (DESIGN.md). */}
        {unread && (
          <span
            aria-label="Sin ver"
            className={`shrink-0 self-start rounded-full bg-lime-voltage ${
              full ? "mt-2 size-2.5" : "mt-1.5 size-2"
            }`}
          />
        )}
      </Link>

      {/* Quitar. En la banda y en la campana es acción de tercera fila —gris, y
          solo al pasar por encima— para no poner una cruz en cada línea de una
          columna que ya es estrecha. En el historial se queda puesta: allí
          borrar no es un accidente que haya que esconder, es la mitad de para
          lo que se entra.

          El gris es el mismo en los dos sitios. El sistema tiene una superficie
          para decir que no —el rosa—, y está reservada para rechazar una
          invitación y para salir (DESIGN.md): quitar un aviso no es ninguna de
          las dos, y pintarlo de rosa sería la primera vez que ese color
          significa otra cosa. Al pasar por encima se aclara a papel, que es lo
          que le devuelve el contorno sobre la fila, que para entonces ya está
          gris. */}
      <form
        action={dismissNotification.bind(null, notification.id)}
        className={`absolute transition ${
          full
            ? "right-3 top-3"
            : "right-1 top-1.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100"
        }`}
      >
        <button
          type="submit"
          aria-label={`Quitar el aviso de ${who}`}
          title="Quitar"
          className={`flex items-center justify-center rounded-button text-olive-stone transition hover:bg-paper-white hover:text-midnight-ink ${
            full ? "size-8" : "size-6"
          }`}
        >
          <X aria-hidden size={full ? 16 : 14} strokeWidth={1.5} />
        </button>
      </form>
    </li>
  );
}
