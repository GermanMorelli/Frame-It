"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateName, type NameState } from "@/app/cuenta/actions";
import CtaButton from "@/components/CtaButton";
import FormMessage from "@/components/FormMessage";
import { shake } from "@/lib/motion";
import { FIELD, FIELD_LABEL } from "@/lib/ui";

type NameFormProps = {
  /** Nombre actual, si lo hay. */
  current: string;
  /** A dónde volver al guardar: la pantalla desde la que se llegó. */
  next: string;
};

export default function NameForm({ current, next }: NameFormProps) {
  const [state, formAction, pending] = useActionState<NameState, FormData>(updateName, {});
  const field = useRef<HTMLInputElement>(null);

  // Cada respuesta de la acción es un objeto nuevo, así que dos rechazos
  // seguidos con el mismo texto siguen siendo dos sacudidas.
  useEffect(() => {
    if (state.error) shake(field.current);
  }, [state]);

  return (
    <form action={formAction} className="mt-8" noValidate>
      <input type="hidden" name="next" value={next} />

      <label htmlFor="name" className={FIELD_LABEL}>
        Nombre
      </label>
      <input
        ref={field}
        id="name"
        name="name"
        type="text"
        autoFocus
        autoComplete="name"
        maxLength={60}
        defaultValue={state.name ?? current}
        placeholder="Con este nombre te verán en los comentarios"
        aria-invalid={state.error ? true : undefined}
        className={`mt-2 ${FIELD}`}
      />

      {state.error && <FormMessage className="mt-4">{state.error}</FormMessage>}

      <CtaButton pending={pending} className="mt-8 w-full">
        {pending ? "Guardando…" : "Guardar nombre"}
      </CtaButton>
    </form>
  );
}
