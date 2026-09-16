"use client";

import { useActionState, useState } from "react";
import { decide, type ConsentState } from "@/app/oauth/consent/actions";
import CtaButton from "@/components/CtaButton";
import FormMessage from "@/components/FormMessage";
import PendingBar from "@/components/PendingBar";
import { BTN_OUTLINE } from "@/lib/ui";

type ConsentFormProps = {
  /** La solicitud que se contesta. Viaja en el envío porque la acción no ve la URL. */
  authorizationId: string;
  /** Quién pide, para decirlo en el botón que concede. */
  client: string;
};

/**
 * Los dos botones de la pantalla de consentimiento.
 *
 * Un solo formulario para las dos respuestas: son la misma decisión, y lo que
 * las distingue es el `value` del botón pulsado (`app/oauth/consent/actions.ts`).
 * El navegador manda uno y solo uno, así que esto sigue funcionando sin
 * JavaScript, que aquí importa más que en el resto de la aplicación: esta
 * pantalla se abre desde fuera y es el único sitio donde se puede contestar.
 *
 * Es cliente por el error. Conceder puede fallar por cosas que no dependen de
 * quien pulsa —la solicitud caducada mientras se leía, el servidor OAuth apagado
 * en el panel— y eso hay que decirlo aquí sin perder la pantalla: no hay a dónde
 * volver, porque el camino de vuelta lo da justo esta acción.
 *
 * El registro es el del acceso: conceder va de tinta llena porque es a lo que se
 * viene, y rechazar de contorno, que mide exactamente lo mismo (`lib/ui.ts`), no
 * menos. Rechazar va primero por lo mismo que en `YesNo`: el orden de lectura
 * deja al final lo que la mano busca.
 */
export default function ConsentForm({ authorizationId, client }: ConsentFormProps) {
  const [state, formAction, pending] = useActionState<ConsentState, FormData>(decide, {});

  // Cuál de los dos se pulsó, solo para que el que anuncie la espera sea ese.
  // `useActionState` da una sola espera para el formulario entero, y sin esto
  // los dos botones dirían a la vez que están haciendo algo.
  const [chosen, setChosen] = useState<"approve" | "deny" | null>(null);

  return (
    <form action={formAction} className="mt-10">
      <input type="hidden" name="authorization_id" value={authorizationId} />

      {state.error && <FormMessage className="mb-6">{state.error}</FormMessage>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Deny busy={pending} mine={chosen === "deny"} onClick={() => setChosen("deny")} />

        <CtaButton
          pending={pending}
          name="decision"
          value="approve"
          onClick={() => setChosen("approve")}
          className="w-full sm:flex-1"
        >
          {pending && chosen === "approve" ? "Concediendo…" : `Permitir a ${client}`}
        </CtaButton>
      </div>
    </form>
  );
}

/**
 * El no. Se dibuja a mano en vez de reusar `CtaButton` porque va de contorno, y
 * de eso no hay componente compartido: el mismo caso que el botón de Google
 * (`components/GoogleButton.tsx`), que también se pinta con `BTN_OUTLINE`.
 */
function Deny({ busy, mine, onClick }: { busy: boolean; mine: boolean; onClick: () => void }) {
  return (
    <button
      type="submit"
      name="decision"
      value="deny"
      onClick={onClick}
      disabled={busy}
      className={`${BTN_OUTLINE} relative w-full overflow-hidden sm:flex-1`}
    >
      {busy && mine && <PendingBar className="absolute inset-x-0 bottom-0 block h-[3px]" />}
      <span>{busy && mine ? "Rechazando…" : "No permitir"}</span>
    </button>
  );
}
