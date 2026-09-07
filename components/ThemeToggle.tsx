"use client";

import gsap from "gsap";
import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { gleam, shine, swap } from "@/lib/motion";
import { applyTheme, currentTheme, serverTheme, watchTheme, type Theme } from "@/lib/theme";

/**
 * Apagar y encender la luz de la mesa. Va a la izquierda de la campana.
 *
 * Comparte con ella la caja entera —el alto de la barra, el mismo relleno, el
 * mismo gris al pasar por encima y un icono de veintiocho píxeles a trazo de
 * uno y medio—, así que los tres controles del canto derecho se leen como una
 * sola pieza y no como tres cosas pegadas. Y va en ese orden porque el canto
 * derecho es un blanco de ancho infinito y ahí tiene que estar lo que se pulsa
 * a diario: la cuenta primero, luego los avisos, y el tema al final, que es lo
 * que se toca una vez y no se vuelve a mirar (ley de Fitts, DESIGN.md).
 *
 * Los dos iconos están siempre en el DOM, uno encima del otro en la misma celda
 * de una rejilla. No es por comodidad: el cambio de tema es un relevo —uno se va
 * girando por un lado mientras el otro entra por el contrario— y para cruzarse
 * tienen que existir a la vez. Cuál de los dos se ve lo decide el CSS a partir
 * del atributo del `<html>`, no este componente, y esa es la parte importante:
 * el guion de `lib/theme.ts` pone ese atributo antes del primer pintado, así que
 * quien vuelve en oscuro ve la luna desde el primer fotograma. Si la visibilidad
 * saliera del estado de React, vería el sol hasta que la página hidratara.
 *
 * Lo único que este componente necesita saber es el rótulo, que es lo que un
 * lector de pantalla oye y lo único que el CSS no puede decir. No lo guarda: lo
 * lee del atributo con `useSyncExternalStore`, porque aquí el DOM es el original
 * y React el espejo —el guion de arranque escribe ese atributo antes de que React
 * exista—, y una copia en estado sería una segunda versión de la misma verdad,
 * siempre un render por detrás. Al hidratar se parte del claro, que es lo que
 * mandó el servidor, y React reconcilia solo.
 */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(watchTheme, currentTheme, serverTheme);
  const sun = useRef<SVGSVGElement>(null);
  const moon = useRef<SVGSVGElement>(null);
  const hover = useRef<gsap.core.Timeline | null>(null);

  const dark = theme === "dark";

  useEffect(() => {
    return () => {
      hover.current?.kill();
    };
  }, []);

  // Se rearma en cada entrada, igual que la campana: pasar dos veces seguidas
  // mata la primera vuelta en lugar de sumarse a ella, que es lo que dejaría el
  // icono parado a mitad de giro.
  const greet = useCallback(() => {
    hover.current?.kill();
    hover.current = currentTheme() === "dark" ? gleam(moon.current) : shine(sun.current);
  }, []);

  const toggle = useCallback(() => {
    // Se pregunta al DOM y no al estado: el atributo es la única fuente: puede
    // haberlo puesto el guion de arranque, sin que este componente se enterara.
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";

    // La vuelta de saludo se corta antes del relevo. Estaba girando el icono que
    // ahora se va, y un `clearProps` suyo llegando tarde borraría el transform
    // que el relevo acaba de escribir sobre el que entra.
    hover.current?.kill();
    hover.current = null;

    // Primero el tema —el CSS ya deja al nuevo icono visible y al viejo no— y
    // después la animación, que mientras dura escribe la opacidad en el style y
    // gana a las dos reglas. Al limpiar, lo que queda debajo ya es lo correcto.
    // Del rótulo no hay que ocuparse: escribir el atributo despierta al
    // observador, y ese es el único camino por el que este botón se entera.
    applyTheme(next);
    swap(
      next === "dark" ? sun.current : moon.current,
      next === "dark" ? moon.current : sun.current,
      next === "dark",
    );
  }, []);

  return (
    <button
      type="button"
      // El rótulo dice lo que va a pasar al pulsar, no en qué estado se está.
      // Y no lleva `aria-pressed`: un botón de dos estados con nombre fijo
      // ("Modo oscuro" + pulsado/sin pulsar) y un botón que se renombra son dos
      // formas correctas de decir esto, pero juntas se anuncian como
      // «cambiar a modo oscuro, alternar, no pulsado», que es la que confunde.
      // Aquí manda el nombre, que es lo que sirve igual a quien no ve el dibujo.
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={toggle}
      onPointerEnter={greet}
      onFocus={greet}
      className="group relative flex h-16 shrink-0 items-center px-4 text-midnight-ink transition hover:bg-soft-mist"
    >
      {/*
        Una sola celda de rejilla con los dos iconos dentro. Se apilan sin
        `absolute` para que la caja siga midiendo veintiocho píxeles por sí sola:
        sacarlos del flujo dejaría el botón sin contenido y con el ancho del
        relleno.
      */}
      <span className="relative grid place-items-center">
        {/*
          El color llega con el puntero y se va con él. En reposo los dos son de
          la tinta de la campana, que es la vecina, porque la barra en reposo es
          monocroma y un icono coloreado ahí se leería como un aviso. Al rozarlo
          el sol se va al dorado y la luna al azul claro: es la recompensa del
          gesto, no un estado.

          Se transiciona `colors` y nada más — `transition` a secas incluiría el
          transform, y entonces el navegador y GSAP animarían lo mismo a la vez,
          cada uno con su curva.
        */}
        <Sun
          ref={sun}
          data-theme-icon="sun"
          aria-hidden
          size={28}
          strokeWidth={1.5}
          className="col-start-1 row-start-1 transition-colors group-hover:text-sun-gold group-focus-visible:text-sun-gold"
        />
        <Moon
          ref={moon}
          data-theme-icon="moon"
          aria-hidden
          size={28}
          strokeWidth={1.5}
          className="col-start-1 row-start-1 transition-colors group-hover:text-moon-glow group-focus-visible:text-moon-glow"
        />
      </span>
    </button>
  );
}
