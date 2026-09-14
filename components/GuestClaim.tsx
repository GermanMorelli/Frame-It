"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { claimGuestAccount, type ClaimState } from "@/app/invitado/actions";
import Avatar from "@/components/Avatar";
import FormMessage from "@/components/FormMessage";
import PasswordField from "@/components/PasswordField";
import PendingBar from "@/components/PendingBar";
import type { Avatar as AvatarSpec } from "@/lib/avatar";
import { shake, useGrow } from "@/lib/motion";
import { BTN_OUTLINE_SM, BTN_QUIET, BTN_SOLID_SM, FIELD, FIELD_LABEL } from "@/lib/ui";

type GuestClaimProps = {
  /** El nombre sorteado con el que viene firmando: es lo que se queda atrás. */
  userName: string;
  userAvatar: AvatarSpec;
  /** Un invitado no tiene correo, pero el avatar lo pide para su lavado. */
  userEmail: string;
  /**
   * A dónde vuelve el enlace del correo de confirmación: la página del sitio que
   * se está comentando, no el panel. Quien se da de alta desde aquí estaba
   * trabajando, y el correo se abre media hora después en otra pestaña.
   */
  next: string;
};

/**
 * El pie de la barra de comentarios cuando quien comenta entró por un enlace: su
 * firma, y la forma de quedársela.
 *
 * Un invitado es una cuenta anónima de verdad (migración 0007) y por eso puede
 * comentar, pero no puede volver a ella: cerrada la pestaña, esa identidad no se
 * recupera desde ninguna parte. Lo que hay debajo de este botón es ponerle
 * correo y contraseña a esa misma cuenta —no crear otra—, así que los
 * comentarios que ya dejó siguen siendo suyos y pasan a firmarse con su nombre
 * de verdad, también para el resto del equipo (`lib/account.ts`).
 *
 * Está aquí y no solo en la pantalla de acceso por dónde ocurre la decisión: se
 * decide después de haber comentado, mirando lo comentado, y no antes de entrar.
 * Salir del proyecto para dar de alta significaría perder la página del sitio
 * que estaba cargada y el paso del formulario en el que estaba, así que la
 * pregunta se hace donde está la persona y se contesta sin moverla de sitio.
 *
 * El formulario va cerrado de partida: quien abrió un enlace para dejar tres
 * frases no vino a rellenar un alta, y tres campos permanentes en el pie serían
 * un formulario que se ve más que los comentarios. Lo que sí es permanente es la
 * puerta —el botón está siempre, en todas las páginas del proyecto—, que es la
 * diferencia entre poder hacerlo y encontrarlo.
 */
export default function GuestClaim({ userName, userAvatar, userEmail, next }: GuestClaimProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ClaimState, FormData>(claimGuestAccount, {});

  // Salió bien: lo que queda por decir es lo del correo, si hace falta
  // confirmarlo. El formulario ya no pinta nada ahí.
  const done = Boolean(state.notice);
  const [showForm, formBox] = useGrow(open && !done);

  const name = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);

  // Se sacude el campo que la acción acaba de rechazar, no el formulario entero:
  // el error señala dónde volver, no solo que algo salió mal. Cada respuesta es
  // un objeto nuevo, así que dos rechazos iguales son dos sacudidas.
  useEffect(() => {
    if (!state.error) return;
    const at = { name, email, password, confirm: password };
    shake(at[state.field ?? "email"].current);
  }, [state]);

  return (
    <div>
      {showForm && (
        <div ref={formBox}>
          {/* El hueco va en relleno y no en margen: `useGrow` devuelve el
              `overflow` al terminar, y un margen del primer hijo se escaparía de
              la caja justo entonces, dando un salto de alto al final. */}
          <form action={formAction} className="pb-4" noValidate>
            <input type="hidden" name="next" value={next} />

            <p className="text-caption text-olive-stone">
              Los comentarios que ya has dejado se quedan contigo: la cuenta es esta misma, con tu
              nombre y tu correo puestos.
            </p>

            <label htmlFor="claim-name" className={`${FIELD_LABEL} mt-4`}>
              Nombre
            </label>
            <input
              ref={name}
              id="claim-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={60}
              defaultValue={state.name ?? ""}
              placeholder="Con este nombre te verán"
              aria-invalid={state.error && state.field === "name" ? true : undefined}
              className={`mt-2 ${FIELD}`}
            />

            <label htmlFor="claim-email" className={`${FIELD_LABEL} mt-4`}>
              Correo
            </label>
            <input
              ref={email}
              id="claim-email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={state.email ?? ""}
              placeholder="tu@correo.com"
              aria-invalid={state.error && state.field === "email" ? true : undefined}
              className={`mt-2 ${FIELD}`}
            />

            <PasswordField
              id="password"
              label="Contraseña"
              autoComplete="new-password"
              describedBy="claim-password-hint"
              invalid={state.error !== undefined && state.field === "password"}
              inputRef={password}
              className="mt-4"
            />
            <p id="claim-password-hint" className="mt-2 text-caption text-olive-stone">
              Mínimo 8 caracteres.
            </p>

            {state.error && <FormMessage className="mt-3">{state.error}</FormMessage>}

            <div className="mt-4 flex items-center gap-4">
              {/* El botón lleno de la barra estrecha, con la misma barra de
                  espera que el de las pantallas grandes: el alta es una escritura
                  contra Supabase y puede tardar lo suyo. */}
              <button
                type="submit"
                disabled={pending}
                className={`${BTN_SOLID_SM} relative overflow-hidden`}
              >
                {pending && <PendingBar className="absolute inset-x-0 bottom-0 block h-[3px]" />}
                <span>{pending ? "Creando…" : "Crear cuenta"}</span>
              </button>
              <button type="button" onClick={() => setOpen(false)} className={BTN_QUIET}>
                Ahora no
              </button>
            </div>
          </form>
        </div>
      )}

      {/* La firma con la que está comentando. Es lo único que hay que poder
          comprobar antes de escribir, y lleva dicho que es de paso para que
          nadie se crea dentro de un equipo del que no es. */}
      <p className="flex min-w-0 items-center gap-2">
        <Avatar avatar={userAvatar} name={userName} email={userEmail} size={18} />
        <span className="label min-w-0 truncate text-olive-stone">{userName}</span>
        <span className="label-xs shrink-0 text-olive-stone">Invitado</span>
      </p>

      {done ? (
        <FormMessage tone="notice" className="mt-2">
          {state.notice}
        </FormMessage>
      ) : (
        !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`mt-3 w-full ${BTN_OUTLINE_SM}`}
          >
            Crear una cuenta
          </button>
        )
      )}
    </div>
  );
}
