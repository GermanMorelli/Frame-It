"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import NewProjectForm from "@/components/NewProjectForm";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";
import { BTN_OUTLINE, BTN_SOLID } from "@/lib/ui";

/**
 * El botón de la cabecera y el panel que despliega.
 *
 * Con proyectos ya creados, el formulario de alta deja de ser lo que se viene a
 * hacer: se guarda aquí y la pantalla la ocupa la rejilla. El panel no lleva
 * sombra —el sistema no tiene ninguna—; lo que lo separa del papel es el trazo
 * de tinta de 1px y los 12px de radio de cualquier otra tarjeta (DESIGN.md).
 *
 * No hace falta cerrarlo al terminar: crear un proyecto lleva a su pantalla.
 */
export default function NewProjectPanel() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Escape y clic fuera, las dos salidas que se esperan de algo que flota. El
  // puntero se escucha en captura: dentro del panel hay campos que se comen el
  // evento, y sin esto un clic en el formulario cerraría lo que está usando.
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && root.current && !root.current.contains(target)) setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || reducedMotion()) return;
    gsap.fromTo(
      panel.current,
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: DURATION.message, ease: EASE.out, clearProps: "transform" },
    );
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      {/* Cerrado es la acción principal de la pantalla, así que va lleno de
          tinta. Abierto pasa a contorno: el momento de tinta se lo lleva el
          "Crear proyecto" de dentro, y el sistema admite uno por vista. */}
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls="nuevo-proyecto"
        className={open ? BTN_OUTLINE : BTN_SOLID}
      >
        {open ? "Cerrar" : "Nuevo proyecto"}
      </button>

      {open && (
        <div
          ref={panel}
          id="nuevo-proyecto"
          className="absolute right-0 top-full z-20 mt-3 w-[min(26rem,80vw)] rounded-card border border-midnight-ink bg-paper-white p-6"
        >
          <h2 className="text-subheading">Nuevo proyecto</h2>
          <p className="mt-2 text-body text-olive-stone">
            Se abrirá por esa dirección y desde ahí puedes navegar por el sitio.
          </p>
          <NewProjectForm autoFocus />
        </div>
      )}
    </div>
  );
}
