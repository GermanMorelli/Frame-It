"use client";

import type { ReactNode } from "react";
import { BTN_QUIET } from "@/lib/ui";

type DangerButtonProps = {
  children: ReactNode;
  /** Lo que se pregunta antes de seguir. Sin respuesta afirmativa no se envía. */
  confirm: string;
  className?: string;
};

/**
 * Envío de un formulario que destruye algo. La confirmación es del navegador a
 * propósito: es la única que no se puede pintar por detrás de otra cosa, y esto
 * borra comentarios de gente que no está delante de la pantalla.
 *
 * Va en el registro callado, sin caja: es lo contrario de un blanco fácil. Lo
 * irreversible no debe estar a un píxel de lo que se pulsa a diario (ley de
 * Fitts, aplicada al revés); lo que lo hace visible es el sitio donde vive —una
 * tarjeta de durazno, la superficie de aviso del sistema—, no su tamaño.
 *
 * Sin JavaScript el formulario sigue enviándose: la acción de servidor vuelve a
 * comprobar el permiso, así que la pregunta es cortesía, no la barrera.
 */
export default function DangerButton({ children, confirm, className = "" }: DangerButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className={`${BTN_QUIET} ${className}`}
    >
      {children}
    </button>
  );
}
