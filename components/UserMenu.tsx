"use client";

import Link from "next/link";
import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import Avatar from "@/components/Avatar";
import type { Avatar as AvatarSpec } from "@/lib/avatar";
import { useDismiss, useMenuFocus, useMenuKeys } from "@/lib/menu";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";

type UserMenuProps = {
  name: string;
  avatar: AvatarSpec;
  email?: string;
  /** El usuario está en su pantalla de cuenta: el acceso se marca como actual. */
  active: boolean;
};

const ITEM =
  "label flex min-h-11 w-full items-center rounded-button px-3 text-left transition hover:bg-soft-mist";

/**
 * Salir no se pinta en rojo —el sistema no tiene rojo— ni se hace más grande: se
 * queda en piedra de oliva y solo se enciende bajo el puntero, y lo que enciende
 * es durazno, que es la superficie de aviso (DESIGN.md).
 */
const ITEM_QUIT = `${ITEM} text-olive-stone hover:bg-peach-wash hover:text-midnight-ink`;

/**
 * Quién está dentro, y todo lo que se hace con esa cuenta.
 *
 * Antes eran dos cosas pegadas en el canto de la barra: una píldora con el
 * nombre y, a su lado, un "Salir" en texto quieto. Dos blancos contiguos y
 * pequeños, uno de los cuales termina la sesión —justo el reparto que la ley de
 * Fitts castiga, porque lo que separa a los dos es menos que el error del
 * puntero. Ahora hay un solo blanco, más alto y más ancho, y lo que era el
 * segundo baja al fondo de un menú: dos pulsaciones para salir, que es lo
 * correcto para algo que se hace una vez al día y no se puede deshacer.
 *
 * El blanco llega hasta el canto derecho de la ventana. El relleno vive dentro
 * del botón, no en la barra que lo contiene, así que el puntero se detiene
 * contra el borde de la pantalla y no puede pasarse: un canto es un blanco de
 * ancho infinito, y dejarlo a dieciséis píxeles pagaría la distancia sin cobrar
 * la ventaja. Por eso tampoco lleva trazo en reposo —un contorno pegado al
 * cristal se lee como un recorte—; el trazo de tinta llega al abrirse, que es
 * cuando el botón tiene que decir que es él quien sostiene el panel.
 */
export default function UserMenu({ name, avatar, email, active }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useDismiss(root, open, () => close(false));
  useMenuFocus(panel, open);
  const onKeyDown = useMenuKeys(panel, close);

  // Cae desde arriba los mismos seis píxeles que el menú de una tarjeta: el
  // panel aparece lejos de donde estaba el ojo, y el recorrido corto dice de
  // qué botón ha salido (DESIGN.md).
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

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tu cuenta — ${name}`}
        onClick={() => setOpen((previous) => !previous)}
        className={`label flex h-16 max-w-[15rem] items-center gap-2.5 border-y border-l border-r-0 py-2 pl-4 pr-6 transition ${
          open
            ? "border-midnight-ink bg-paper-white text-midnight-ink"
            : "border-transparent hover:bg-soft-mist"
        }`}
      >
        {/* Veintiocho píxeles y no dieciocho: la cara es lo que se reconoce
            antes de leer el rótulo, y aquí es además la mitad del blanco. Sigue
            sin ser un blanco propio —no se puede pulsar por su cuenta ni tiene
            título—, va dentro del botón que ya lo es (DESIGN.md). */}
        <Avatar avatar={avatar} name={name} email={email} size={28} />
        <span className="hidden min-w-0 truncate sm:block">{name}</span>
        <span
          aria-hidden
          className={`text-caption text-olive-stone transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={panel}
          role="menu"
          aria-label="Tu cuenta"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="absolute right-4 top-full z-40 mt-2 w-64 rounded-card border border-midnight-ink bg-paper-white p-1"
        >
          {/* Quién eres, con la cara al tamaño en que se mira y no al que
              acompaña: el menú se abre para hacer algo con esta cuenta, así que
              lo primero que dice es cuál. No se pulsa —es el rótulo del panel,
              no una de sus salidas—, y por eso no lleva `menuitem`. */}
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <Avatar avatar={avatar} name={name} email={email} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-body">{name}</span>
              {email && (
                <span className="block truncate font-mono text-caption text-olive-stone" title={email}>
                  {email}
                </span>
              )}
            </span>
          </div>

          {/* La única regla del panel: separa quién eres de lo que puedes hacer. */}
          <div className="border-t border-soft-mist pt-1">
            <Link
              href="/cuenta"
              role="menuitem"
              aria-current={active ? "page" : undefined}
              onClick={() => close(false)}
              className={ITEM}
            >
              Ajustes
            </Link>

            {/* Un `form` entre el menú y su entrada rompería la cadena que ARIA
                espera (menu › menuitem): `role="none"` lo hace transparente sin
                quitarlo, que es lo que envía la acción de servidor. */}
            <form action={signOut} role="none">
              <button type="submit" role="menuitem" className={ITEM_QUIT}>
                Salir
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
