"use client";

import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { authenticate, type AuthMode, type AuthState } from "@/app/login/actions";
import CtaButton from "@/components/CtaButton";
import FormMessage from "@/components/FormMessage";
import PillSwitch from "@/components/PillSwitch";
import { collapse, grow, shake } from "@/lib/motion";
import { FIELD, FIELD_LABEL } from "@/lib/ui";

type AuthFormProps = {
  /** A dónde volver tras entrar; lo pone el proxy cuando corta el paso. */
  next: string;
  /** Fallo que llega de vuelta del enlace de confirmación, si hubo. */
  failure: string | null;
};

export default function AuthForm({ next, failure }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, {});

  // El estado devuelve siempre el correo escrito: sirve para saber si ya hubo un
  // intento y dejar de mostrar el error que venía en la URL.
  const attempted = state.email !== undefined;
  const error = state.error ?? (attempted ? undefined : failure ?? undefined);
  const creating = mode === "signup";
  const field = useRef<HTMLInputElement>(null);

  // Se sacude el campo que queda marcado como inválido, no el formulario
  // entero: el error señala dónde volver, no solo que algo salió mal.
  useEffect(() => {
    if (state.error) shake(field.current);
  }, [state]);

  // Crear cuenta pide una línea más, y esa línea empuja hacia abajo el botón que
  // el dedo ya tenía apuntado. Abriéndose se ve de dónde sale el empujón; de
  // golpe, lo que se ve es que el botón se movió solo.
  //
  // `mounted` no es lo mismo que `creating`: al cerrarse, el campo tiene que
  // seguir en el DOM hasta que termine de encogerse.
  const [mounted, setMounted] = useState(false);
  const nameBox = useRef<HTMLDivElement>(null);
  const open = useRef(false);

  useEffect(() => {
    if (creating) {
      // Ya montado quiere decir que se está cerrando ahora mismo: se le da la
      // vuelta al tween en vez de montar un segundo campo.
      if (open.current) grow(nameBox.current);
      else setMounted(true);
      return;
    }
    if (!open.current) return;
    collapse(nameBox.current, () => {
      open.current = false;
      setMounted(false);
    });
  }, [creating]);

  useLayoutEffect(() => {
    if (!mounted) return;
    open.current = true;
    grow(nameBox.current);
  }, [mounted]);

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

      <form action={formAction} className="mt-8" noValidate>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />

        {mounted && (
          // El hueco hasta el campo siguiente va en el relleno de la caja y no
          // en el margen del campo: el margen de un hijo se escaparía de la caja
          // al devolverle el `overflow`, y el alto daría un salto al final.
          <div ref={nameBox} className="pb-6">
            <label htmlFor="name" className={FIELD_LABEL}>
              Nombre
            </label>
            <input
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
              className={`mt-2 ${FIELD}`}
            />
          </div>
        )}

        <label htmlFor="email" className={FIELD_LABEL}>
          Correo
        </label>
        <input
          ref={field}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email ?? ""}
          placeholder="tu@correo.com"
          aria-invalid={error ? true : undefined}
          className={`mt-2 ${FIELD}`}
        />

        <label htmlFor="password" className={`mt-6 ${FIELD_LABEL}`}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          aria-describedby={creating ? "password-hint" : undefined}
          className={`mt-2 ${FIELD}`}
        />
        {creating && (
          <p id="password-hint" className="mt-2 text-caption text-olive-stone">
            Mínimo 8 caracteres.
          </p>
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
    </div>
  );
}
