"use client";

import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import { DURATION, EASE, STAGGER } from "@/lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Retraso de salida, para escalonar la columna contra el fondo del hero. */
  delay?: number;
};

/**
 * Entrada escalonada de una columna de contenido: cada hijo directo sube unos
 * píxeles y aparece, en el orden en que se lee.
 *
 * El estado inicial (invisible) lo pone `globals.css` y no este componente: el
 * HTML del servidor ya está pintado cuando React hidrata, así que ocultarlo
 * desde JS daría un parpadeo. Ver la regla `[data-reveal]` allí.
 */
export default function Reveal({ children, className, delay = 0.05 }: RevealProps) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;

    const context = gsap.matchMedia();

    context.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        gsap.utils.toArray<HTMLElement>(container.children),
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION.reveal,
          ease: EASE.out,
          stagger: STAGGER,
          delay,
          // El transform sobra en cuanto termina; la opacidad no, porque la
          // hoja de estilos la seguiría dejando en 0.
          clearProps: "transform",
        },
      );
    });

    return () => context.revert();
  }, [delay]);

  return (
    <div ref={root} data-reveal className={className}>
      {children}
    </div>
  );
}
