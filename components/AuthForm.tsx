"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { authenticate, type AuthField, type AuthMode, type AuthState } from "@/app/login/actions";
import CtaButton from "@/components/CtaButton";
import FormMessage from "@/components/FormMessage";
import GoogleButton from "@/components/GoogleButton";
import PasswordField from "@/components/PasswordField";
import PillSwitch from "@/components/PillSwitch";
import { shake, useGrow } from "@/lib/motion";
import { googleReady } from "@/lib/supabase/config";
import { FIELD, FIELD_LABEL } from "@/lib/ui";

type AuthFormProps = {
  /** A dónde volver tras entrar; lo pone el proxy cuando corta el paso. */
  next: string;
  /** Fallo que llega de vuelta del enlace de confirmación, si hubo. */
  failure: string | null;
  /**
   * Con qué nombre sorteado está comentando quien abre esto, si es un invitado.
   * Null para todos los demás, que es el caso normal.
   *
   * No es decoración: para un invitado este formulario no crea una cuenta, le
   * pone correo y contraseña a la que ya tiene —la misma fila, los mismos
   * comentarios (`lib/account.ts`)—, y eso hay que decirlo con el nombre delante
   * para que se reconozca en ello. Y cambia lo que el formulario ofrece primero:
   * llega a crear cuenta, no a entrar en una que no tiene.
   */
  guestName?: string | null;
};

export default function AuthForm({ next, failure, guestName = null }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(guestName ? "signup" : "signin");
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, {});

  // El estado devuelve siempre el correo escrito: sirve para saber si ya hubo un
  // intento y dejar de mostrar el error que venía en la URL.
  const attempted = state.email !== undefined;
  const error = state.error ?? (attempted ? undefined : failure ?? undefined);
  const creating = mode === "signup";

  // Se marca y se sacude el campo que el formulario acaba de rechazar, no el
  // formulario entero: el error señala dónde volver, no solo que algo salió mal.
  // Lo que llega sin campo —el fallo del enlace de confirmación— se atribuye al
  // correo, que es por donde se empieza a releer.
  const name = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLInputElement>(null);
  const marked: AuthField | undefined = error ? state.field ?? "email" : undefined;

  // Cada respuesta de la acción es un objeto nuevo, así que dos rechazos
  // seguidos con el mismo texto siguen siendo dos sacudidas.
  useEffect(() => {
    if (!state.error) return;
    const at = { name, email, password, confirm };
    shake(at[state.field ?? "email"].current);
  }, [state]);

  // Crear cuenta pide dos líneas más, y esas líneas empujan hacia abajo el botón
  // que el dedo ya tenía apuntado. Abriéndose se ve de dónde sale el empujón; de
  // golpe, lo que se ve es que el botón se movió solo.
  //
  // Son dos bloques y no uno porque van en sitios distintos del formulario: el
  // nombre antes del correo, y la repetición de la contraseña justo debajo de la
  // contraseña, que es donde se compara.
  const [showName, nameBox] = useGrow(creating);
  const [showRepeat, repeatBox] = useGrow(creating);

  return (
    <div className="mt-10">
      {/* Las dos formas de entrar son las píldoras de filtro del sistema: la
          encendida se invierte a tinta llena (DESIGN.md). La tinta salta de una
          a otra, que es lo que anuncia que el formulario de abajo va a cambiar. */}
      <PillSwitch
        role="tablist"
        label="Acceso"
        options={[
          { key: "signin", label: "Entrar" },
          { key: "signup", label: "Crear cuenta" },
        ]}
        active={mode}
        onSelect={(key) => setMode(key as AuthMode)}
      />

      {/* Lo que le pasa a lo ya comentado, dicho en las dos direcciones: quien
          se queda con su cuenta de invitado se lo lleva todo, y quien entra con
          otra cuenta distinta lo deja atrás. Lo segundo es lo que no se puede
          descubrir después, así que se avisa antes de escribir la contraseña. */}
      {guestName && (
        <p className="mt-6 text-caption text-olive-stone">
          {creating ? (
            <>
              Lo que has comentado como{" "}
              <strong className="font-semibold text-midnight-ink">{guestName}</strong> pasa a tu
              cuenta y se firma con el nombre que pongas aquí.
            </>
          ) : (
            <>
              Si entras con otra cuenta, lo comentado como{" "}
              <strong className="font-semibold text-midnight-ink">{guestName}</strong> se queda con
              el invitado. Para llevártelo, crea la cuenta desde aquí.
            </>
          )}
        </p>
      )}

      <form action={formAction} className="mt-8" noValidate>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />

        {showName && (
          <div ref={nameBox} className="pb-6">
            <label htmlFor="name" className={FIELD_LABEL}>
              Nombre
            </label>
            <input
              ref={name}
              id="name"
              name="name"
              type="text"
              // Deshabilitado mientras se cierra: un campo a medio encoger sigue
              // siendo un campo, y se enviaría con el formulario.
              disabled={!creating}
              autoComplete="name"
              maxLength={60}
              defaultValue={state.name ?? ""}
              placeholder="Con este nombre te verán en los comentarios"
              aria-invalid={marked === "name" ? true : undefined}
              className={`mt-2 ${FIELD}`}
            />
          </div>
        )}

        <label htmlFor="email" className={FIELD_LABEL}>
          Correo
        </label>
        <input
          ref={email}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email ?? ""}
          placeholder="tu@correo.com"
          aria-invalid={marked === "email" ? true : undefined}
          className={`mt-2 ${FIELD}`}
        />

        <PasswordField
          id="password"
          label="Contraseña"
          autoComplete={creating ? "new-password" : "current-password"}
          describedBy={creating ? "password-hint" : undefined}
          invalid={marked === "password"}
          inputRef={password}
          className="mt-6"
        />

        {showRepeat && (
          // La nota del mínimo entra aquí dentro y no como línea suelta: aparece
          // y desaparece con el mismo interruptor que el campo de abajo, así que
          // le toca el mismo crecimiento y no un salto propio.
          <div ref={repeatBox}>
            <p id="password-hint" className="pt-2 text-caption text-olive-stone">
              Mínimo 8 caracteres.
            </p>
            <PasswordField
              id="confirm"
              label="Repite la contraseña"
              autoComplete="new-password"
              disabled={!creating}
              invalid={marked === "confirm"}
              inputRef={confirm}
              className="pt-6"
            />
          </div>
        )}

        {error && <FormMessage className="mt-6">{error}</FormMessage>}

        {state.notice && (
          <FormMessage tone="notice" className="mt-6">
            {state.notice}
          </FormMessage>
        )}

        <CtaButton pending={pending} className="mt-8 w-full">
          {pending ? (creating ? "Creando…" : "Entrando…") : creating ? "Crear cuenta" : "Entrar"}
        </CtaButton>
      </form>

      {/* Google entero —la regla, el botón y su letra pequeña— o nada. La «o» sin
          nada debajo sería una puerta que no está, y el aviso al invitado habla
          de un botón que no puede ver. Se enciende en `lib/supabase/config.ts`,
          donde está apuntado lo que hay que dejar listo en los dos paneles. */}
      {googleReady && (
        <>
          {/* Google va fuera del formulario y no dentro: es otro formulario —manda a
              otra parte y no valida nada de lo de arriba— y un formulario dentro de
              otro no es HTML válido. La regla con la «o» en medio es lo que dice que
              son dos caminos al mismo sitio y no un paso después del otro. */}
          <div className="mt-8 flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-soft-mist" />
            <span className="label-xs text-olive-stone">o</span>
            <span className="h-px flex-1 bg-soft-mist" />
          </div>

          <GoogleButton next={next} className="mt-8" />

          {/* Para un invitado este botón tampoco abre otra cuenta: le cuelga la
              identidad de Google a la que ya tiene, como hace el formulario con el
              correo (`app/login/actions.ts`). Se dice, porque lo que está en juego
              —lo que lleva comentado— es justo lo que no se recupera si se equivoca
              de puerta. */}
          {guestName && (
            <p className="mt-4 text-caption text-olive-stone">
              Con Google también te quedas con lo comentado: se le añade a esta misma cuenta.
            </p>
          )}
        </>
      )}
    </div>
  );
}
