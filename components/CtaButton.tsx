"use client";

import gsap from "gsap";
import { useRef, type ReactNode } from "react";
import PendingBar from "@/components/PendingBar";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";
import { BTN_SOLID } from "@/lib/ui";

type CtaButtonProps = {
  children: ReactNode;
  /** La acción está en vuelo: el botón se bloquea y aparece la barra de espera. */
  pending?: boolean;
  className?: string;
};

/**
 * La acción principal de una pantalla: tinta llena, papel encima, 8px de radio
 * (DESIGN.md). Sale una vez por vista; lo demás va de contorno.
 *
 * Los tres formularios lo comparten para que el hundido al pulsar y la espera se
 * sientan iguales en toda la aplicación. Mientras espera, lo que se mueve es una
 * barra de verde voltaje a lo largo del canto inferior: color plano y el mismo
 * que marca cualquier otro estado activo del sistema.
 *
 * La transición CSS se limita a la opacidad: `transition` a secas incluye el
 * transform, y entonces el navegador y GSAP animarían la misma propiedad a la
 * vez, cada uno con su curva.
 */
export default function CtaButton({ children, pending = false, className = "" }: CtaButtonProps) {
  const button = useRef<HTMLButtonElement>(null);

  function press(scale: number) {
    if (reducedMotion()) return;

    gsap.to(button.current, {
      scale,
      duration: scale < 1 ? DURATION.press : DURATION.release,
      ease: scale < 1 ? EASE.out : EASE.release,
    });
  }

  return (
    <button
      ref={button}
      type="submit"
      disabled={pending}
      onPointerDown={() => press(0.985)}
      onPointerUp={() => press(1)}
      onPointerLeave={() => press(1)}
      className={`${BTN_SOLID} relative overflow-hidden ${className}`}
    >
      {pending && <PendingBar className="absolute inset-x-0 bottom-0 block h-[3px]" />}
      <span>{children}</span>
    </button>
  );
}
