"use client";

import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "@/app/login/actions";
import PendingBar from "@/components/PendingBar";
import { BTN_OUTLINE } from "@/lib/ui";

type GoogleButtonProps = {
  /** A dónde volver cuando Google devuelva; acompaña al viaje entero. */
  next: string;
  className?: string;
};

/**
 * La otra puerta del acceso: entrar con la cuenta de Google.
 *
 * Va de contorno y no de tinta llena a propósito. Lo importante de esta pantalla
 * es el formulario —es donde está todo el mundo que ya tiene cuenta aquí— y dos
 * botones llenos uno encima de otro serían dos acciones principales, que es no
 * tener ninguna (DESIGN.md). Contorno y tinta miden lo mismo, así que esto no
 * es un botón más pequeño: es el mismo botón diciendo que es la segunda opción.
 *
 * Es un formulario suyo y no un botón dentro del de arriba porque manda a otra
 * parte —a Google— y no tiene nada que validar: ni correo, ni contraseña, ni
 * modo. Por eso tampoco usa `useActionState` como aquel; la espera la da
 * `useFormStatus`, que solo sabe del formulario que tiene encima, y de ahí que
 * el botón viva en su propio componente.
 */
export default function GoogleButton({ next, className = "" }: GoogleButtonProps) {
  return (
    <form action={signInWithGoogle} className={className}>
      <input type="hidden" name="next" value={next} />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${BTN_OUTLINE} relative w-full gap-3 overflow-hidden`}
    >
      {pending && <PendingBar className="absolute inset-x-0 bottom-0 block h-[3px]" />}
      <GoogleMark />
      <span>{pending ? "Abriendo Google…" : "Continuar con Google"}</span>
    </button>
  );
}

/**
 * La «G» de Google, con sus cuatro colores y sus trazados tal cual.
 *
 * Es la única marca ajena de la aplicación y por eso no se redibuja ni se tiñe
 * de la tinta del sistema: un logotipo de otro se usa como es o no se usa, y
 * además los colores son lo que hace que se reconozca de un vistazo. Al ir en
 * `fill` fijo se lee igual con la luz encendida y apagada, que es lo que se
 * quiere de ella.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
