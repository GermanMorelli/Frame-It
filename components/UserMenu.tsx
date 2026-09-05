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

/**
 * La caja de una entrada del menú, sin lo que enciende: eso lo pone cada una.
 * Dos `hover:bg-*` en la misma clase no se resuelven por el orden en que se
 * escriben —tienen la misma especificidad, así que gana la que Tailwind emita
 * más abajo en la hoja—, y encadenar el rosa detrás del gris dejaba el gris.
 */
const ITEM_BASE =
  "label flex min-h-11 w-full items-center rounded-button px-3 text-left transition";

const ITEM = `${ITEM_BASE} hover:bg-soft-mist`;

/**
 * Salir no se hace más grande ni se pinta en reposo: se queda en piedra de oliva
 * como las demás salidas del panel. Lo que cambia es lo que enciende bajo el
 * puntero —el lavado de rosa y su tinta, o sea el par del "no" (DESIGN.md)—,
 * porque el color llega cuando el puntero ya está encima y solo entonces hay algo
 * que advertir: esta es la única entrada del menú que termina la sesión.
 */
const ITEM_QUIT = `${ITEM_BASE} text-olive-stone hover:bg-rose-wash hover:text-rose-ink`;

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
 * la ventaja.
 *
 * Y por eso no lleva trazo, ni en reposo ni abierto, aunque el sistema sea de
 * contornos: un contorno pegado al cristal se lee como un recorte, y su regla de
 * abajo caería justo encima de la de la barra —dos líneas de un píxel a un píxel
 * la una de la otra, que es lo que se ve como un borde mal hecho. Lo que dice
 * que está abierto es que se queda relleno, o sea el mismo gris del puntero
 * pero sin el puntero: el botón se queda pulsado mientras su panel esté ahí.
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

  // Estable, para que el oyente de puntero no se dé de baja y de alta en cada
  // render. Pulsar fuera no devuelve el foco al botón: el foco se va donde se
  // haya pulsado, que es lo que la persona acaba de decir que quiere mirar.
  const dismiss = useCallback(() => close(false), [close]);
  useDismiss(root, open, dismiss);
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
        className={`label flex h-16 max-w-[15rem] items-center gap-2.5 pl-4 pr-6 transition ${
          open ? "bg-soft-mist text-midnight-ink" : "hover:bg-soft-mist"
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
