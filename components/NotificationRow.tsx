"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useTransition } from "react";
import { dismissNotification } from "@/app/invitaciones/actions";
import Avatar from "@/components/Avatar";
import { relativeDate, shortDate } from "@/lib/dates";
import type { Notification } from "@/lib/notifications";
import { projectPath, workspacePath } from "@/lib/routes";

/**
 * Una línea de la bandeja.
 *
 * Vive en su propio archivo porque la bandeja se mira desde dos sitios —la banda
 * del carril y el panel que cuelga de la campana— y una fila que se pinte dos
 * veces se desincroniza a la primera: uno de los dos se quedaría sin el punto de
 * sin leer el día que alguien toque el otro. Lo que comparten es la fila, no la
 * caja que la contiene, que es justamente la parte en la que se diferencian.
 *
 * Abrir un aviso lo gasta: al irse por él se borra de la bandeja. Un aviso dice
 * «mira esto», y en cuanto se ha mirado ya no dice nada —dejarlo puesto obliga a
 * quitarlo a mano después, y una bandeja que hay que barrer detrás de uno acaba
 * siendo una bandeja que no se lee. Es lo mismo que ya hace la invitación al
 * contestarla (`respond_invite`, migración 0006), ahora para los cuatro tipos.
 * Lo que hay detrás no se pierde: el proyecto sigue en el panel, la invitación
 * sin contestar sigue en su sección del carril y el comentario, en su página.
 *
 * Lleva `"use client"` por eso: hay que llamar a la acción al pulsar, y la banda
 * la pinta el servidor. Es un puñado de bytes al navegador —la fila ya viajaba
 * entera para el panel de la campana, que es cliente desde el principio.
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

export default function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: Notification;
  /** El panel que cuelga de la campana se cierra al irse por una de sus filas. */
  onNavigate?: () => void;
}) {
  const who = notification.actor?.name || "Alguien";
  const unread = notification.readAt === null;
  // La navegación no espera al borrado, y es lo correcto: lo que se ha pedido es
  // ir a lo que cuenta el aviso, no ver desaparecer una fila. La transición está
  // para que la bandeja se vuelva a pintar sin ella cuando la acción conteste
  // —al volver de donde sea, o en el sitio si se abrió en otra pestaña.
  const [, quitando] = useTransition();

  const abrir = () => {
    quitando(() => {
      void dismissNotification(notification.id);
    });
    onNavigate?.();
  };

  // El verbo de cada tipo. La frase se parte en dos porque el nombre del
  // proyecto va en negrita y el resto no: es lo que se busca al repasar la
  // columna de arriba abajo.
  const verb =
    notification.kind === "invite"
      ? "te invitó a"
      : notification.kind === "invite_accepted"
        ? "aceptó entrar en"
        : notification.kind === "invite_declined"
          ? "no entró en"
          : "te mencionó en";

  return (
    // La fila entera es el enlace, y el botón de quitar va encima suyo en la
    // misma caja: un `form` dentro de un `a` no es HTML válido, así que se
    // colocan como hermanos y el enlace ocupa el hueco entero por debajo.
    <li className="group relative">
      <Link
        href={destination(notification)}
        onClick={abrir}
        className="flex gap-2.5 rounded-button px-3 py-2.5 pr-8 transition hover:bg-soft-mist"
      >
        {notification.actor ? (
          <Avatar
            avatar={notification.actor.avatar}
            name={notification.actor.name}
            email={notification.actor.email}
            size={22}
          />
        ) : (
          <span aria-hidden className="mt-0.5 size-[22px] shrink-0 rounded-full bg-soft-mist" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-caption leading-[1.45]">
            <strong className="font-semibold">{who}</strong> {verb}{" "}
            <strong className="font-semibold">{notification.projectName}</strong>
          </span>

          {/* De la mención se enseña lo que se escribió: es lo que decide si hay
              que ir ahora o luego, y sin ello el aviso obliga a abrir el
              proyecto para saber de qué iba. */}
          {notification.kind === "mention" && notification.commentBody && (
            <span className="mt-1 line-clamp-2 block text-caption text-olive-stone">
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
            className="mt-1.5 size-2 shrink-0 self-start rounded-full bg-lime-voltage"
          />
        )}
      </Link>

      {/* Quitar es acción de tercera fila: se queda en gris y solo se ve al
          pasar por encima de la fila, para no poner una cruz en cada línea de
          una columna que ya es estrecha. */}
      <form
        action={dismissNotification.bind(null, notification.id)}
        className="absolute right-1 top-1.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100"
      >
        <button
          type="submit"
          aria-label="Quitar este aviso"
          title="Quitar"
          className="flex size-6 items-center justify-center rounded-button text-olive-stone transition hover:bg-paper-white hover:text-midnight-ink"
        >
          <X aria-hidden size={14} strokeWidth={1.5} />
        </button>
      </form>
    </li>
  );
}
