"use client";

import { useActionState } from "react";
import { enterAsGuest, type GuestState } from "@/app/invitado/actions";
import CtaButton from "@/components/CtaButton";
import FormMessage from "@/components/FormMessage";

type GuestEnterFormProps = {
  /** El testigo del enlace: es lo único que acredita a quien llega. */
  token: string;
  /** Qué dice el botón. Cambia si quien abre el enlace ya tiene sesión. */
  label: string;
};

/**
 * El botón de entrar de un enlace de invitado.
 *
 * Un solo control y ningún campo: no se pide nombre, ni correo, ni contraseña.
 * El nombre y la cara los sortea el servidor (`lib/guest.ts`), y eso es todo lo
 * que hay entre recibir el enlace y estar comentando.
 *
 * Es cliente y no un formulario a secas por el error: entrar puede fallar por
 * cosas que no dependen de quien pulsa —el enlace retirado hace un minuto, las
 * altas anónimas apagadas en el proyecto de Supabase— y eso hay que decirlo
 * donde se intentó, sin perder la pantalla.
 */
export default function GuestEnterForm({ token, label }: GuestEnterFormProps) {
  const [state, formAction, pending] = useActionState<GuestState, FormData>(enterAsGuest, {});

  return (
    <form action={formAction} className="mt-10">
      <input type="hidden" name="token" value={token} />

      {state.error && <FormMessage className="mb-6">{state.error}</FormMessage>}

      <CtaButton pending={pending} className="w-full">
        {pending ? "Entrando…" : label}
      </CtaButton>
    </form>
  );
}
