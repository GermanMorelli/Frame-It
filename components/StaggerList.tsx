"use client";

import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import { DURATION, EASE, STAGGER } from "@/lib/motion";

type StaggerListProps = {
  children: ReactNode;
  /**
   * Cuando esto cambia, la lista vuelve a entrar. Es el filtro elegido: dos
   * listas distintas tienen que verse llegar como dos listas distintas.
   */
  replay?: string;
  className?: string;
};

/**
 * Entrada escalonada de una lista que se pinta en el servidor.
 *
 * La rejilla de proyectos sigue siendo HTML sin estado —esto la envuelve, no la
 * sustituye—, y lo que aporta es la respuesta a un cambio de filtro. Pulsar
 * «Tuyos» navega a otra URL y la rejilla se rehace en el sitio: si la lista
 * resultante se parece a la anterior, el cambio pasa desapercibido y parece que
 * el filtro no funcionó. Entrando otra vez, la lista se presenta.
 *
 * El escalonado se reparte en un tramo fijo en vez de sumar por tarjeta: con
 * treinta proyectos, 75 ms cada uno serían dos segundos y medio de espera para
 * ver el último.
 */
export default function StaggerList({ children, replay, className }: StaggerListProps) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;

    const context = gsap.matchMedia();

    context.add("(prefers-reduced-motion: no-preference)", () => {
      const items = gsap.utils.toArray<HTMLElement>(container.querySelectorAll("li"));
      if (items.length === 0) return;

      gsap.fromTo(
        items,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION.reveal,
          ease: EASE.out,
          stagger: { amount: Math.min(items.length * STAGGER, 0.5) },
          // El transform sobra en cuanto termina; la opacidad no, porque la
          // hoja de estilos la seguiría dejando en 0.
          clearProps: "transform",
        },
      );
    });

    return () => context.revert();
  }, [replay]);

  return (
    <div ref={root} data-stagger className={className}>
      {children}
    </div>
  );
}
