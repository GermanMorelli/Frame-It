"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteMember, type TeamState } from "@/app/proyectos/actions";
import FormMessage from "@/components/FormMessage";
import { shake } from "@/lib/motion";
import { BTN_OUTLINE_LG, FIELD, FIELD_LABEL } from "@/lib/ui";

type InviteFormProps = {
  projectId: string;
  /** Para refrescar la pantalla del proyecto tras invitar. */
  slug: string;
};

/**
 * Invitar a un compañero. No hace falta que tenga cuenta: si la tiene entra al
 * momento, y si no queda apuntado y entra solo en cuanto se dé de alta con ese
 * correo (lo hace un disparador de la base, no la aplicación).
 */
export default function InviteForm({ projectId, slug }: InviteFormProps) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(inviteMember, {});
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) shake(field.current);
  }, [state]);

  return (
    <form action={formAction} className="mt-6" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
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

        <div>
          <label htmlFor="invite-role" className={FIELD_LABEL}>
            Puede
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="editor"
            className={`mt-2 sm:w-44 ${FIELD}`}
          >
            <option value="editor">Comentar</option>
            <option value="viewer">Solo mirar</option>
          </select>
        </div>

        {/* De contorno y no de tinta: la acción principal de esta pantalla es
            abrir el espacio de trabajo, y el sistema admite un solo botón lleno
            por vista (DESIGN.md). */}
        <button type="submit" disabled={pending} className={BTN_OUTLINE_LG}>
          {pending ? "Invitando…" : "Invitar"}
        </button>
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
