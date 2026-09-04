"use client";

import { useLayoutEffect, useRef } from "react";
import { grow } from "@/lib/motion";

type AnnouncementBarProps = {
  message: string;
  href?: string;
  action?: string;
};

/**
 * Franja de aviso, a ancho completo y sin radio, siempre arriba del todo.
 *
 * Va sobre durazno, que es la superficie de aviso del sistema: el sistema no
 * tiene rojo ni amarillo de alarma, así que lo que llama la atención es la
 * superficie, con la tinta encima a contraste máximo (DESIGN.md).
 *
 * Se abre ocupando su alto en vez de aparecer puesta. Esta franja llega a mitad
 * de sesión —la página se salió del proxy, un comentario perdió su elemento— y
 * empuja hacia abajo la barra y la vista previa enteras. Apareciendo de golpe, lo
 * que se ve es que todo se movió; abriéndose, se ve qué lo movió. Solo la
 * entrada: cuando el problema se arregla no hay nada que anunciar, y una franja
 * que se cierra despacio retrasaría la vuelta a la normalidad.
 */
export default function AnnouncementBar({ message, href, action }: AnnouncementBarProps) {
  const bar = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => grow(bar.current), []);

  return (
    <div ref={bar} className="w-full shrink-0 bg-peach-wash px-5 py-2.5">
      <p className="text-body">
        {message}
        {href && action && (
          <>
            {" "}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {action} →
            </a>
          </>
        )}
      </p>
    </div>
  );
}
