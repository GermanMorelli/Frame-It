"use client";

import Link from "next/link";
import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";
import { PILL, PILL_LIT, PILL_ON } from "@/lib/ui";

export type PillOption = {
  key: string;
  label: string;
  /** Con dirección la píldora navega; sin ella, avisa a quien la puso. */
  href?: string;
};

type PillSwitchProps = {
  options: PillOption[];
  /** Cuál está encendida. */
  active: string;
  onSelect?: (key: string) => void;
  /** Pestañas cuando las opciones cambian lo que hay debajo sin cambiar de página. */
  role?: "tablist";
  /** Nombre del grupo. En el caso de navegación lo lleva el `nav` de fuera. */
  label?: string;
  className?: string;
};

/**
 * La fila de píldoras del sistema, con la tinta encendida moviéndose de una a
 * otra en vez de apagarse aquí y aparecer allá.
 *
 * El propósito es decir *qué cambió*. Los filtros de proyectos navegan a otra
 * URL y la rejilla se rehace sin más; las dos pestañas de acceso cambian los
 * campos del formulario. En ambos casos lo que se pulsa está en un canto de la
 * pantalla y lo que cambia está en el centro, así que el salto de la tinta es lo
 * que ata una cosa con la otra: se ve de dónde a dónde se ha ido.
 *
 * Cómo está hecho: dos filas idénticas superpuestas. Abajo, las píldoras de
 * contorno con el texto en tinta. Encima, un bloque de tinta que recorta una
 * copia de la misma fila escrita en papel. Mover el bloque descubre el texto
 * blanco justo donde hay tinta debajo, sin que ningún color tenga que animarse y
 * sin que los dos textos puedan desincronizarse: es un recorte, no dos tweens.
 *
 * Sin JavaScript la capa de arriba se queda invisible y la píldora activa se
 * lleva el relleno de tinta ella misma (`PILL_ON`), que es como estaba antes.
 * Encender algo nunca puede depender de que una animación llegue a ejecutarse.
 *
 * Que la píldora de abajo se apague al colocarse el bloque lo hacen una marca en
 * el DOM (`data-lit`) y una regla de `globals.css`, y no un estado de React: el
 * bloque se coloca midiendo, o sea después del primer render, y apagarla con
 * estado costaría un render de más en cada montaje.
 */
export default function PillSwitch({
  options,
  active,
  onSelect,
  role,
  label,
  className = "",
}: PillSwitchProps) {
  const root = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLSpanElement>(null);
  const lit = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const shape = options.map((option) => option.key).join(" ");

  // En el efecto de layout, que React vacía antes de pintar: el relevo entre la
  // píldora rellena y el bloque de tinta ocurre dentro del mismo fotograma.
  useLayoutEffect(() => {
    const row = root.current;
    const block = ink.current;
    const copy = lit.current;
    if (!row || !block || !copy) return;

    const target = row.querySelector<HTMLElement>(`[data-pill="${CSS.escape(active)}"]`);
    if (!target) return;

    row.dataset.lit = "";

    // Se sigue también el eje vertical y se le fija el ancho a la copia: si la
    // fila cabe en dos líneas, la de arriba tiene que partirse por el mismo
    // sitio que la de abajo, o el texto encendido no caería sobre su píldora.
    const box = {
      x: target.offsetLeft,
      y: target.offsetTop,
      width: target.offsetWidth,
      height: target.offsetHeight,
    };
    gsap.set(copy, { width: row.offsetWidth });

    // La primera colocación no es un movimiento: nadie ha pulsado nada todavía.
    if (!placed.current || reducedMotion()) {
      placed.current = true;
      gsap.set(block, { ...box, autoAlpha: 1 });
      gsap.set(copy, { x: -box.x, y: -box.y });
      return;
    }

    const move = { duration: DURATION.slide, ease: EASE.move, overwrite: true };
    gsap.to(block, { ...box, ...move });
    gsap.to(copy, { x: -box.x, y: -box.y, ...move });
  }, [active, shape]);

  function pill(option: PillOption, layer: "base" | "lit") {
    const on = option.key === active;

    // La capa recortada es pintura: ni se pulsa, ni se lee, ni se tabula.
    if (layer === "lit") {
      return (
        <span key={option.key} className={PILL_LIT}>
          {option.label}
        </span>
      );
    }

    const classes = on ? PILL_ON : PILL;

    if (option.href) {
      return (
        <Link
          key={option.key}
          data-pill={option.key}
          href={option.href}
          aria-current={on ? "page" : undefined}
          className={classes}
        >
          {option.label}
        </Link>
      );
    }

    return (
      <button
        key={option.key}
        data-pill={option.key}
        type="button"
        role={role === "tablist" ? "tab" : undefined}
        aria-selected={role === "tablist" ? on : undefined}
        onClick={() => onSelect?.(option.key)}
        className={classes}
      >
        {option.label}
      </button>
    );
  }

  return (
    <div
      ref={root}
      role={role}
      aria-label={label}
      className={`relative flex flex-wrap gap-1 ${className}`}
    >
      {options.map((option) => pill(option, "base"))}

      <span
        ref={ink}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 overflow-hidden rounded-button bg-midnight-ink"
      >
        <span ref={lit} className="absolute left-0 top-0 flex flex-wrap gap-1">
          {options.map((option) => pill(option, "lit"))}
        </span>
      </span>
    </div>
  );
}
