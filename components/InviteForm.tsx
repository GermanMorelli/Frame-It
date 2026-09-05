"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteMember, type TeamState } from "@/app/proyectos/actions";
import FormMessage from "@/components/FormMessage";
import { shake } from "@/lib/motion";
import { BTN_SOLID_LG, FIELD, FIELD_LABEL } from "@/lib/ui";

type InviteFormProps = {
  projectId: string;
  /** Para refrescar la pantalla del proyecto tras invitar. */
  slug: string;
};

/**
 * Invitar a un compañero. No hace falta que tenga cuenta: si la tiene, le llega
 * la invitación a su bandeja; si no, queda apuntada y le aparece en cuanto se dé
 * de alta con ese correo. Entrar lo decide siempre esa persona, aceptándola.
 */
export default function InviteForm({ projectId, slug }: InviteFormProps) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(inviteMember, {});
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) shake(field.current);
  }, [state]);

  return (
    // El formulario se mide a sí mismo (`@container`) y no a la ventana: dentro
    // de la columna del equipo la tarjeta no llega a 400px por ancha que sea la
    // pantalla, y un corte por ventana lo ponía en fila ahí dentro —el campo del
    // correo se encogía hasta desaparecer y su rótulo acababa montado encima del
    // de al lado—. Lo que decide si se apila es el hueco que hay, no el que hay
    // en el cristal.
    <form action={formAction} className="@container mt-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-col gap-4 @md:flex-row @md:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="invite-email" className={FIELD_LABEL}>
            Correo
          </label>
          <input
            ref={field}
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.email ?? ""}
            placeholder="companero@correo.com"
            aria-invalid={state.error ? true : undefined}
            className={`mt-2 ${FIELD}`}
          />
        </div>

        {/* El papel y el botón viajan juntos en las dos medidas: apilado, son la
            segunda fila; en línea, los dos últimos huecos de la primera. */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-40 flex-1 @md:w-44 @md:flex-none">
            <label htmlFor="invite-role" className={FIELD_LABEL}>
              Puede
            </label>
            <select id="invite-role" name="role" defaultValue="editor" className={`mt-2 ${FIELD}`}>
              <option value="editor">Comentar</option>
              <option value="viewer">Solo mirar</option>
            </select>
          </div>

          {/* Lleno de tinta, como "Crear proyecto": invitar es de lo que se viene
              a hacer a esta pantalla, y lo importante se pinta en negro aunque el
              "Abrir espacio de trabajo" de arriba también lo esté (DESIGN.md). A
              la altura del campo que tiene al lado, no a la del botón suelto.
              `shrink-0` porque es lo único de la fila que no se puede estrechar:
              si cede, cede el texto. */}
          <button type="submit" disabled={pending} className={`shrink-0 ${BTN_SOLID_LG}`}>
            {pending ? "Invitando…" : "Invitar"}
          </button>
        </div>
      </div>

      {state.error && <FormMessage className="mt-4">{state.error}</FormMessage>}
      {state.notice && (
        <FormMessage tone="notice" className="mt-4">
          {state.notice}
        </FormMessage>
      )}
    </form>
  );
}
