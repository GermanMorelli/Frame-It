"use client";

import { useActionState } from "react";
import { updateAvatar, type AvatarState } from "@/app/cuenta/actions";
import Avatar from "@/components/Avatar";
import FormMessage from "@/components/FormMessage";
import { ALL_WASHES, washOf } from "@/lib/author-color";
import { AVATAR_STYLES, type Avatar as AvatarSpec } from "@/lib/avatar";
import { BTN_QUIET, FIELD_LABEL } from "@/lib/ui";

type AvatarFormProps = {
  /** La cara puesta ahora mismo. */
  current: AvatarSpec;
  /** Para el disco de color y la inicial de debajo, como en todas partes. */
  name: string;
  email: string;
};

/** La caja de cada opción: el mismo tamaño para una cara y para un color. */
const TILE = "flex w-full flex-col items-center gap-1 rounded-card border p-2 transition";
const TILE_ON = `${TILE} border-midnight-ink`;
const TILE_OFF = `${TILE} border-transparent hover:border-soft-mist`;

/**
 * Elegir cara: el estilo, la semilla y el fondo.
 *
 * Cada opción de estilo es tu propia cara dibujada así, no la muestra de otra
 * persona: lo que hay que decidir es cuál de las ocho eres tú, y con un ejemplo
 * ajeno habría que elegir a ciegas y comprobar después. Los fondos, en cambio,
 * son discos de color pelados: lo que se elige ahí es el color, la cara ya se ve
 * arriba entera, y ocho caras más solo para enseñar cuatro colores serían ocho
 * dibujos que pedir por un dato que un disco dice mejor.
 *
 * No hay botón de guardar: pulsar una opción es guardarla. Es un cambio visible
 * al instante, reversible con otro clic y sin nada que perder si uno se
 * equivoca, o sea lo contrario de lo que merece una confirmación.
 *
 * Son tres formularios y no uno con tres grupos de botones porque lo que los
 * distingue es qué mandan, no qué se pulsó: cada uno lleva escondidas las dos
 * piezas que no cambia, y la tercera la pone el botón pulsado. El de «otra cara»
 * es el que no manda semilla, y esa ausencia es justo la petición. Así lo que
 * decide la acción es su propio contenido, y la pantalla funciona sin JavaScript.
 */
export default function AvatarForm({ current, name, email }: AvatarFormProps) {
  const [state, formAction, pending] = useActionState<AvatarState, FormData>(updateAvatar, {});

  // El fondo que se ve ahora mismo: el elegido, o el que le toca por su correo
  // mientras no haya elegido ninguno. Es el que sale marcado abajo, así que
  // pulsarlo no cambia nada de lo que se ve —solo deja de ser el que le tocaba.
  const bg = current.bg ?? washOf(email || name).id;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-4">
        <Avatar avatar={current} name={name} email={email} size={64} />

        <form action={formAction}>
          {/* Sin semilla: es lo que pide una nueva. Las otras dos piezas viajan,
              que otra cara es otra cara y no otro estilo ni otro color. */}
          <input type="hidden" name="style" value={current.style} />
          <input type="hidden" name="bg" value={bg} />
          <p className="text-body">Así te ve tu equipo.</p>
          {/* En el registro callado porque se pulsa hasta dar con una, no una vez. */}
          <button type="submit" disabled={pending} className={BTN_QUIET}>
            Otra cara ↻
          </button>
        </form>
      </div>

      <form action={formAction} className="mt-8">
        {/* La misma cara y el mismo color, dibujados de otra manera. */}
        <input type="hidden" name="seed" value={current.seed} />
        <input type="hidden" name="bg" value={bg} />

        <p className={FIELD_LABEL}>Estilo</p>
        <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {AVATAR_STYLES.map((style) => {
            const chosen = style.id === current.style;
            return (
              <li key={style.id}>
                <button
                  type="submit"
                  name="style"
                  value={style.id}
                  disabled={pending}
                  aria-pressed={chosen}
                  className={`${chosen ? TILE_ON : TILE_OFF} disabled:opacity-60`}
                >
                  {/* Sobre el fondo puesto, no sobre uno de muestra: la opción
                      tiene que enseñar lo que va a pasar al pulsarla. */}
                  <Avatar
                    avatar={{ ...current, style: style.id }}
                    name={name}
                    email={email}
                    size={40}
                  />
                  <span
                    className={`label-xs truncate ${chosen ? "text-midnight-ink" : "text-olive-stone"}`}
                  >
                    {style.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </form>

      <form action={formAction} className="mt-8">
        {/* La misma cara, sobre otro color. */}
        <input type="hidden" name="seed" value={current.seed} />
        <input type="hidden" name="style" value={current.style} />

        <p className={FIELD_LABEL}>Fondo</p>
        <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ALL_WASHES.map((wash) => {
            const chosen = wash.id === bg;
            return (
              <li key={wash.id}>
                <button
                  type="submit"
                  name="bg"
                  value={wash.id}
                  disabled={pending}
                  aria-pressed={chosen}
                  className={`${chosen ? TILE_ON : TILE_OFF} disabled:opacity-60`}
                >
                  {/* Un disco pelado, del tamaño de una cara: lo que se compara
                      aquí son cuatro colores, y una cara encima de cada uno los
                      taparía justo donde se miran. */}
                  <span aria-hidden className={`size-10 rounded-full ${wash.class}`} />
                  <span
                    className={`label-xs truncate ${chosen ? "text-midnight-ink" : "text-olive-stone"}`}
                  >
                    {wash.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </form>

      {state.error && <FormMessage className="mt-4">{state.error}</FormMessage>}
    </div>
  );
}
