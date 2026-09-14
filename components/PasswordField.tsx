"use client";

import { Eye, EyeClosed } from "lucide-react";
import { useState } from "react";
import { FIELD_INSET, FIELD_LABEL } from "@/lib/ui";

type PasswordFieldProps = {
  /** Identificador del campo; también es el `name` con el que se envía. */
  id: string;
  /** Rótulo visible sobre el campo. */
  label: string;
  /**
   * Qué contraseña es para el gestor del navegador: `current-password` cuando se
   * entra, `new-password` cuando se crea o se repite. No es cosmético — de esto
   * depende que ofrezca la guardada o proponga una nueva.
   */
  autoComplete: "current-password" | "new-password";
  /** Id de la nota que explica el campo, si la hay. */
  describedBy?: string;
  /** Marca el campo como el rechazado: trazo de tinta y fondo de melocotón. */
  invalid?: boolean;
  /** Un campo a medio cerrar sigue siendo un campo, y se enviaría con el resto. */
  disabled?: boolean;
  /** Hueco por encima. Va en la caja y no en el rótulo: ver `AuthForm`. */
  className?: string;
  /** Para que el formulario pueda sacudir el campo que acaba de rechazar. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

/**
 * Campo de contraseña con el ojo que la descubre.
 *
 * El ojo va dentro del campo, sin caja propia: el campo ya es la caja, y
 * dibujarle otra encima sería un segundo borde donde el sistema tiene uno
 * (DESIGN.md). Se queda en piedra de oliva —el registro de los iconos
 * secundarios— y sube a tinta al pasar por encima, que es cómo se anuncia que
 * se puede pulsar sin gritar más que el propio campo.
 *
 * El párpado es el estado, no una etiqueta que haya que leer: cerrado mientras
 * la contraseña está oculta, abierto cuando se ve. Aun así lleva `aria-pressed`
 * y un rótulo que cambia, porque un dibujo no se lee en voz alta.
 *
 * El tipo del `input` se cambia en vez de pintar el texto: es la única forma de
 * que el valor siga siendo el mismo campo para el gestor de contraseñas y para
 * el formulario. Cada campo lleva su propio ojo y su propio estado — descubrir
 * uno no descubre el de al lado.
 */
export default function PasswordField({
  id,
  label,
  autoComplete,
  describedBy,
  invalid,
  disabled,
  className = "",
  inputRef,
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);

  return (
    <div className={className}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {/* El ancla del ojo. `relative` va aquí y no en la caja de fuera para que
          el botón se mida contra el campo: así ocupa su alto exacto y el área
          de pulsación llega hasta los dos bordes. */}
      <div className="relative mt-2">
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          className={FIELD_INSET}
        />
        <button
          type="button"
          onClick={() => setShown((visible) => !visible)}
          disabled={disabled}
          aria-controls={id}
          aria-pressed={shown}
          aria-label={shown ? "Ocultar la contraseña" : "Ver la contraseña"}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-button text-olive-stone transition hover:text-midnight-ink disabled:cursor-not-allowed"
        >
          {shown ? (
            <Eye aria-hidden size={18} strokeWidth={1.5} />
          ) : (
            <EyeClosed aria-hidden size={18} strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
}
