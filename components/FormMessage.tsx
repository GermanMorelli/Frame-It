"use client";

import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";

type FormMessageProps = {
  children: ReactNode;
  /** Lo que hay que corregir va sobre durazno; lo que solo informa, en oliva. */
  tone?: "error" | "notice";
  id?: string;
  className?: string;
};

/**
 * Mensaje de validación de un formulario. Entra desde arriba en menos de un
 * tercio de segundo: el tiempo justo para que la vista lo siga hasta donde
 * aparece, en vez de encontrárselo ya puesto.
 *
 * El sistema no tiene rojo, así que el error se dice con superficie y no con
 * color de texto: durazno detrás y tinta encima, que es la pareja de máximo
 * contraste que hay. El texto sigue diciendo qué pasa, que es lo que de verdad
 * lo hace legible para todo el mundo.
 */
export default function FormMessage({
  children,
  tone = "error",
  id,
  className = "",
}: FormMessageProps) {
  const message = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;

    gsap.fromTo(
      message.current,
      { opacity: 0, y: -6 },
      {
        opacity: 1,
        y: 0,
        duration: DURATION.message,
        ease: EASE.out,
        clearProps: "transform",
      },
    );
  }, [children]);

  return (
    <p
      ref={message}
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={`text-body ${
        tone === "error"
          ? "rounded-button bg-peach-wash px-3 py-2 text-midnight-ink"
          : "text-olive-stone"
      } ${className}`}
    >
      {children}
    </p>
  );
}
