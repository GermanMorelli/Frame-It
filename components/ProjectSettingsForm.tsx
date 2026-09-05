"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateProject, type ProjectState } from "@/app/proyectos/actions";
import CtaButton from "@/components/CtaButton";
import FormMessage from "@/components/FormMessage";
import { shake } from "@/lib/motion";
import { FIELD, FIELD_LABEL } from "@/lib/ui";

type ProjectSettingsFormProps = {
  id: string;
  /** Para refrescar esta misma pantalla después de guardar. */
  slug: string;
  name: string;
  startUrl: string;
};

/**
 * El nombre del proyecto y la página por la que se abre.
 *
 * Los dos se escribían una vez al crearlo y no se podían tocar más, y las dos
 * cosas envejecen: un sitio se muda de dominio, un proyecto se llamaba «Cliente
 * nuevo». Lo que no cambia es el slug —la dirección de esta pantalla—, porque
 * cambiarlo rompería los enlaces que ya circulan; eso lo dice la propia pantalla.
 *
 * Apilados y no en dos columnas, como el alta: son dos campos, y una fila de dos
 * los dejaría a media anchura sin ganar nada.
 */
export default function ProjectSettingsForm({ id, slug, name, startUrl }: ProjectSettingsFormProps) {
  const [state, formAction, pending] = useActionState<ProjectState, FormData>(updateProject, {});
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) shake(field.current);
  }, [state]);

  return (
    <form action={formAction} className="mt-6 max-w-[520px]" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={slug} />

      <label htmlFor="project-rename" className={FIELD_LABEL}>
        Nombre
      </label>
      <input
        ref={field}
        id="project-rename"
        name="name"
        type="text"
        maxLength={80}
        defaultValue={state.name ?? name}
        aria-invalid={state.error ? true : undefined}
        className={`mt-2 ${FIELD}`}
      />

      <label htmlFor="project-url" className={`mt-6 block ${FIELD_LABEL}`}>
        Sitio
      </label>
      <input
        id="project-url"
        name="domain"
        type="text"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.domain ?? startUrl}
        placeholder="ejemplo.com"
        className={`mt-2 font-mono ${FIELD}`}
      />

      {state.error && <FormMessage className="mt-5">{state.error}</FormMessage>}
      {state.notice && (
        <FormMessage tone="notice" className="mt-5">
          {state.notice}
        </FormMessage>
      )}

      <CtaButton pending={pending} className="mt-8">
        {pending ? "Guardando…" : "Guardar cambios"}
      </CtaButton>
    </form>
  );
}
