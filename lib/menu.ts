"use client";

import { useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";

/** Lo que ARIA llama una entrada de menú, que es lo que el teclado recorre. */
const ITEMS = '[role="menuitem"]';

function itemsOf(panel: HTMLElement | null): HTMLElement[] {
  return Array.from(panel?.querySelectorAll<HTMLElement>(ITEMS) ?? []);
}

/**
 * El teclado de un menú: arriba, abajo, las dos de extremo y Escape.
 *
 * Vive aquí y no dentro de un componente porque la aplicación tiene dos menús
 * —el de una tarjeta de proyecto y el del perfil— que se colocan de maneras
 * distintas (uno cuelga del puntero por un portal, el otro del botón que lo
 * abre) pero se recorren igual. Lo que comparten es el recorrido, no la caja;
 * separarlo es lo que evita que uno de los dos se quede sin la vuelta al
 * principio el día que alguien toque el otro.
 */
export function useMenuKeys(panel: RefObject<HTMLElement | null>, onClose: () => void) {
  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        // Se para aquí: si no, un menú abierto dentro de algo que también
        // escucha Escape cerraría las dos cosas de una tecla.
        event.stopPropagation();
        onClose();
        return;
      }

      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();

      const items = itemsOf(panel.current);
      if (items.length === 0) return;

      const here = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : // El recorrido da la vuelta: en una lista de dos, bajar desde la
              // última es el camino más corto hasta la primera.
              (here + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;

      items[next].focus();
    },
    [panel, onClose],
  );
}

/**
 * El foco entra en el menú al abrirse. Sin esto, quien lo abrió con el teclado
 * se queda en el botón y su primera flecha no tendría desde dónde contar.
 */
export function useMenuFocus(panel: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    itemsOf(panel.current)[0]?.focus();
  }, [panel, open]);
}

/**
 * Pulsar fuera cierra. Se escucha en captura porque dentro del panel hay
 * controles que se comen el evento, y sin esto un clic en el propio menú
 * cerraría lo que se está usando.
 *
 * Aquí no se cierra al hacer scroll, a diferencia del menú de una tarjeta: ese
 * cuelga de unas coordenadas y se quedaría flotando lejos de lo que lo abrió.
 * Este va anclado a un botón de la barra fija, así que se mueve con ella.
 */
export function useDismiss(
  root: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    function onPointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && root.current && !root.current.contains(target)) onClose();
    }

    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [root, open, onClose]);
}
