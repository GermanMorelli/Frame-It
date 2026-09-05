"use client";

/**
 * El par de aceptar y rechazar.
 *
 * Van juntos en un componente porque son una sola decisión, y porque lo que los
 * distingue tiene que estar hecho de una vez: son dos blancos contiguos, del
 * mismo tamaño y con la misma forma, y uno de los dos te mete en un proyecto
 * ajeno mientras el otro lo tira. Justo el reparto que la ley de Fitts castiga.
 *
 * Lo que los separa es el color, y solo al acercarse: en reposo son dos
 * contornos grises, porque una fila de la bandeja con un botón rojo permanente
 * se lee como un problema y aquí no hay ninguno —hay una pregunta—. Al pasar por
 * encima, cada uno se enciende con lo suyo: menta y verde hoja el sí, rosa y
 * tinta roja el no (DESIGN.md). Encendido, el que la mano ha elegido es el único
 * con color en toda la fila, así que no hace falta leer para saber cuál es.
 *
 * Y por eso los rótulos van en `aria-label` y no debajo: dos palabras bajo dos
 * discos harían la fila el doble de alta para decir lo que el color ya dice, y
 * quien no ve el color los oye igual.
 */

const BASE =
  "flex size-11 shrink-0 items-center justify-center rounded-button border text-body transition disabled:cursor-not-allowed disabled:opacity-40";

/** El no. Rosa de fondo y tinta roja, las dos cosas solo bajo el puntero. */
const NO = `${BASE} border-soft-mist text-olive-stone hover:border-rose-ink hover:bg-rose-wash hover:text-rose-ink focus-visible:border-rose-ink focus-visible:bg-rose-wash focus-visible:text-rose-ink`;

/** Y el sí, sobre el lavado de menta que el sistema ya tenía. */
const YES = `${BASE} border-soft-mist text-olive-stone hover:border-leaf-ink hover:bg-mint-wash hover:text-leaf-ink focus-visible:border-leaf-ink focus-visible:bg-mint-wash focus-visible:text-leaf-ink`;

type YesNoProps = {
  /** Qué se acepta o se rechaza, para quien lo oye en vez de verlo. */
  what: string;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
};

export default function YesNo({ what, busy, onYes, onNo }: YesNoProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* Rechazar va primero por lo mismo que «Cancelar» va a la izquierda de
          «Guardar»: el orden de lectura deja lo que se hace normalmente al
          final, que es donde para la mano. */}
      <button
        type="button"
        onClick={onNo}
        disabled={busy}
        aria-label={`Rechazar ${what}`}
        title="Rechazar"
        className={NO}
      >
        <span aria-hidden>✕</span>
      </button>

      <button
        type="button"
        onClick={onYes}
        disabled={busy}
        aria-label={`Aceptar ${what}`}
        title="Aceptar"
        className={YES}
      >
        <span aria-hidden>✓</span>
      </button>
    </div>
  );
}
