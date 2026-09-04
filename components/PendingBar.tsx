"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

type PendingBarProps = {
  /** Dónde y de qué tamaño va la pista. El barrido se ajusta a lo que mida. */
  className?: string;
  /** Con pista visible cuando va suelta; sin ella cuando cae sobre otra cosa. */
  track?: boolean;
};

/**
 * Lo que dice «esto está en camino»: una barra de verde voltaje barriendo un
 * canto.
 *
 * Hay una sola forma de esperar en toda la aplicación —el botón que acaba de
 * enviarse y el sitio del cliente que todavía no ha cargado— y es esta. Que se
 * repita es el punto: una espera reconocible se lee sin pensar, y dos maneras
 * distintas de decir lo mismo se leen como dos cosas distintas.
 *
 * No mide el progreso porque no hay progreso que medir: ni la acción de servidor
 * ni el sitio ajeno dicen por dónde van. Lo que promete es actividad, no avance,
 * y por eso el recorrido es continuo y no una barra que se llena.
 */
export default function PendingBar({ className = "", track = false }: PendingBarProps) {
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;

    const tween = gsap.fromTo(
      bar.current,
      { xPercent: -100 },
      { xPercent: 300, duration: 1.15, ease: "power1.inOut", repeat: -1 },
    );

    return () => {
      tween.kill();
    };
  }, []);

  return (
    <span
      aria-hidden
      className={`pointer-events-none overflow-hidden ${track ? "bg-soft-mist" : ""} ${className}`}
    >
      <span ref={bar} className="block h-full w-1/3 bg-lime-voltage" />
    </span>
  );
}
