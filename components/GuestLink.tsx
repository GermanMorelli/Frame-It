"use client";

import { useEffect, useRef, useState } from "react";
import { createGuestLink, revokeGuestLink } from "@/app/proyectos/actions";
import DangerButton from "@/components/DangerButton";
import { BTN_SOLID_SM, FIELD } from "@/lib/ui";

type GuestLinkProps = {
  projectId: string;
  /** Para refrescar la pantalla del proyecto al crear o retirar el enlace. */
  slug: string;
  /** La dirección entera, o null si el proyecto todavía no tiene enlace. */
  url: string | null;
};

/** Cuánto se queda puesto el acuse de «copiado» antes de volver al rótulo. */
const ACK = 2500;

/**
 * El enlace de invitado de un proyecto: crearlo, copiarlo y retirarlo.
 *
 * La dirección llega entera desde el servidor y no se compone aquí con
 * `location.origin`: así el campo trae el valor bueno en el HTML, se puede
 * seleccionar y copiar a mano sin que haya llegado un solo script, y no hay un
 * primer pintado con media dirección puesta.
 *
 * Copiar es lo que se viene a hacer a esta tarjeta, así que se lleva el bloque
 * de tinta; retirar el enlace se queda en el registro callado, que es donde vive
 * lo irreversible (ley de Fitts al revés, DESIGN.md). Y el acuse de recibo es el
 * propio rótulo del botón: el portapapeles no se ve, así que si nada cambiara en
 * la pantalla no habría forma de saber si el clic sirvió de algo.
 */
export default function GuestLink({ projectId, slug, url }: GuestLinkProps) {
  const field = useRef<HTMLInputElement>(null);
  /** `manual` es el navegador que no deja escribir en el portapapeles. */
  const [copied, setCopied] = useState<"no" | "yes" | "manual">("no");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const input = field.current;
    if (!input) return;

    try {
      await navigator.clipboard.writeText(input.value);
      setCopied("yes");
    } catch {
      // Sin permiso de portapapeles —o en un origen sin https— no se puede
      // copiar por código. Se deja el texto seleccionado, que es lo que
      // convierte el fallo en un Ctrl+C.
      input.select();
      setCopied("manual");
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied("no"), ACK);
  }

  if (!url) {
    return (
      <form action={createGuestLink} className="mt-4">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="slug" value={slug} />
        <button type="submit" className={`w-full ${BTN_SOLID_SM}`}>
          Crear enlace
        </button>
      </form>
    );
  }

  return (
    <div className="mt-4">
      <label className="sr-only" htmlFor="enlace-invitado">
        Enlace de invitado
      </label>
      <input
        ref={field}
        id="enlace-invitado"
        type="text"
        readOnly
        value={url}
        spellCheck={false}
        // Al entrar en el campo queda seleccionado: con teclado, copiar es una
        // tecla y no un recorrido de flechas por cincuenta caracteres.
        onFocus={(event) => event.currentTarget.select()}
        className={`${FIELD} font-mono text-caption`}
      />

      <div className="mt-3 flex items-center gap-4">
        <button type="button" onClick={copy} className={`flex-1 ${BTN_SOLID_SM}`}>
          {copied === "yes" ? "Copiado" : copied === "manual" ? "Cópialo tú" : "Copiar enlace"}
        </button>

        <form action={revokeGuestLink}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="slug" value={slug} />
          <DangerButton
            confirm="¿Retirar el enlace? Deja de valer para siempre, y quien ya entró se queda dentro hasta que lo saques de la lista."
          >
            Retirar
          </DangerButton>
        </form>
      </div>

      {/* Solo cuando el navegador no dejó copiar: lo demás lo dice el botón. */}
      {copied === "manual" && (
        <p role="status" className="mt-2 text-caption text-olive-stone">
          Tu navegador no deja copiar desde aquí. Ya está seleccionado: pulsa Ctrl+C.
        </p>
      )}
    </div>
  );
}
