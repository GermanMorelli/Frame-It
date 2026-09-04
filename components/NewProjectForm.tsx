"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProject, type ProjectState } from "@/app/proyectos/actions";
import CtaButton from "@/components/CtaButton";
import FormMessage from "@/components/FormMessage";
import { shake } from "@/lib/motion";
import { FIELD, FIELD_LABEL } from "@/lib/ui";

type NewProjectFormProps = {
  /** El campo se enfoca al montar: sirve al abrirse el panel del rincón. */
  autoFocus?: boolean;
};

/**
 * Alta de un proyecto: un nombre y el sitio que se va a revisar. La dirección
 * (/proyectos/<slug>) la reparte la base a partir del nombre; aquí no se pide,
 * que sería un campo más para algo que casi nunca se querría cambiar.
 *
 * Los campos van apilados y no en dos columnas porque el mismo formulario se usa
 * suelto en la pantalla vacía y dentro del panel del rincón, que es estrecho.
 */
export default function NewProjectForm({ autoFocus = false }: NewProjectFormProps) {
  const [state, formAction, pending] = useActionState<ProjectState, FormData>(createProject, {});
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) shake(field.current);
  }, [state]);

  return (
    <form action={formAction} className="mt-8" noValidate>
      <label htmlFor="project-name" className={FIELD_LABEL}>
        Nombre
      </label>
      <input
        ref={field}
        id="project-name"
        name="name"
        type="text"
        autoFocus={autoFocus}
        maxLength={80}
        defaultValue={state.name ?? ""}
        placeholder="Tienda de Ludika"
        aria-invalid={state.error ? true : undefined}
        className={`mt-2 ${FIELD}`}
      />

      <label htmlFor="project-domain" className={`mt-6 ${FIELD_LABEL}`}>
        Sitio
      </label>
      <input
        id="project-domain"
        name="domain"
        type="text"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.domain ?? ""}
        placeholder="ejemplo.com"
        className={`mt-2 ${FIELD}`}
      />

      {state.error && <FormMessage className="mt-5">{state.error}</FormMessage>}

      <CtaButton pending={pending} className="mt-8 w-full">
        {pending ? "Creando…" : "Crear proyecto"}
      </CtaButton>
    </form>
  );
}
