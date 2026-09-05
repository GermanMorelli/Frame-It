"use client";

import gsap from "gsap";
import { Bell } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { markNotificationsRead } from "@/app/invitaciones/actions";
import NotificationRow from "@/components/NotificationRow";
import { useDismiss } from "@/lib/menu";
import { DURATION, EASE, reducedMotion, ring } from "@/lib/motion";
import type { Notification } from "@/lib/notifications";

/**
 * La campana de la barra, a la izquierda del chip del perfil.
 *
 * Comparte caja con el perfil a propósito: el mismo alto de barra, el mismo
 * relleno por dentro y el mismo gris al pasar por encima, así que los dos se
 * leen como una sola pieza en el canto derecho y no como dos cosas pegadas. El
 * icono mide lo que la cara —veintiocho píxeles—, que es lo que hace falta para
 * que ninguno de los dos parezca el ayudante del otro.
 *
 * Lo que cuelga es la misma bandeja que la banda del carril, con las mismas
 * filas (`NotificationRow`). No es una segunda lista: es la misma lista a la que
 * se puede llegar desde donde el ojo ya está mirando cuando la barra le dice que
 * hay algo. Y es la única forma de leerla en pantalla estrecha, donde el carril
 * se tumba y la banda no se pinta.
 *
 * No se dan por vistos al abrir. Abrir es mirar, y mirar no es haber leído: si
 * el disco desapareciera con solo desplegar, la única marca de qué es nuevo se
 * perdería justo en el momento en que hace falta. Lo hace el «Visto» de la
 * cabecera, igual que en la banda.
 */
export default function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const icon = useRef<SVGSVGElement>(null);
  const swing = useRef<gsap.core.Timeline | null>(null);

  const unread = notifications.filter((notification) => notification.readAt === null).length;

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  // Estable, para que el oyente de puntero no se dé de baja y de alta en cada
  // render. Igual que en el menú del perfil, pulsar fuera no devuelve el foco al
  // botón: se va donde se haya pulsado.
  const dismiss = useCallback(() => close(false), [close]);
  useDismiss(root, open, dismiss);

  // La sacudida se dispara al entrar el puntero y se rearma cada vez: si alguien
  // pasa por encima dos veces seguidas, la segunda mata a la primera en vez de
  // sumarse a ella, que es lo que dejaría la campana torcida a media rotación.
  const shake = useCallback(() => {
    swing.current?.kill();
    swing.current = ring(icon.current);
  }, []);

  useEffect(() => {
    return () => {
      swing.current?.kill();
    };
  }, []);

  // Cae los mismos seis píxeles que el panel del perfil, que es su vecino: dos
  // paneles que salen del mismo canto de la barra tienen que entrar igual.
  useEffect(() => {
    if (!open || reducedMotion()) return;
    const tween = gsap.fromTo(
      panel.current,
      { opacity: 0, y: -6 },
      { opacity: 1, y: 0, duration: DURATION.message, ease: EASE.out, clearProps: "transform" },
    );
    return () => {
      tween.kill();
    };
  }, [open]);

  // Escape en toda la pieza y no solo en el panel: quien lo abre con el teclado
  // se queda con el foco en la campana, y ahí un oyente colgado del panel no
  // llegaría a enterarse de la tecla.
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (!open || event.key !== "Escape") return;
      // Se para aquí: si no, un Escape cerraría también lo que haya escuchando
      // por debajo.
      event.stopPropagation();
      close();
    },
    [open, close],
  );

  return (
    <div ref={root} onKeyDown={onKeyDown} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Avisos — ${unread} sin ver` : "Avisos"}
        onClick={() => setOpen((previous) => !previous)}
        onPointerEnter={shake}
        onFocus={shake}
        className={`relative flex h-16 items-center px-4 transition ${
          open ? "bg-soft-mist text-midnight-ink" : "text-midnight-ink hover:bg-soft-mist"
        }`}
      >
        {/* El icono va en su propia caja para que la sacudida gire solo la
            campana: el disco de la cuenta es hermano suyo y no hijo, así que se
            queda quieto mientras aquella se mueve. */}
        <span className="relative flex items-center justify-center">
          <Bell ref={icon} aria-hidden size={28} strokeWidth={1.5} />

          {/* El mismo disco de verde voltaje del carril, que en esta aplicación
              significa siempre lo mismo: esto te queda por hacer. Sin avisos sin
              ver no hay disco — un cero no es un aviso (DESIGN.md). */}
          {unread > 0 && (
            <span
              aria-hidden
              className="label-xs absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-voltage px-1 text-midnight-ink"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-midnight-ink bg-paper-white p-1"
        >
          <header className="flex items-center gap-2 px-3 pb-2 pt-2">
            <h2 className="label-xs flex-1 text-olive-stone">Avisos</h2>

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
            <p className="border-t border-soft-mist px-3 pb-3 pt-3 text-caption text-olive-stone">
              Aquí aparecerá cuando te inviten a un proyecto o te mencionen en un comentario.
            </p>
          ) : (
            // Tope de alto y scroll propio: la bandeja no tiene límite de filas y
            // un panel que crezca sin freno acaba saliéndose de la ventana por
            // abajo, que es donde no hay forma de alcanzarlo.
            <ul className="max-h-[min(28rem,60dvh)] overflow-y-auto border-t border-soft-mist pt-1">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onNavigate={() => close(false)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
