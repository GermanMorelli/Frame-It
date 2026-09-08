/**
 * Las piezas de chrome del sistema, en un solo sitio.
 *
 * No es un atajo para escribir menos: es lo que garantiza que el botón de
 * "Crear proyecto" y el de "Invitar" tengan el mismo alto, el mismo radio y el
 * mismo trazo. Artboard vive de dos radios y de un único par de botones —tinta
 * llena para lo importante, contorno para lo demás—; repartir esas clases por
 * doce archivos es cómo se pierde un sistema (DESIGN.md).
 *
 * Los tamaños siguen la ley de Fitts: lo que se pulsa a menudo o decide la
 * pantalla es grande y ancho; lo raro o reversible se queda en texto.
 */

/**
 * Acción importante: tinta llena y papel encima. No hay una sola por pantalla —
 * lo que decide el énfasis es si el botón hace algo que la persona vino a hacer
 * ("Crear proyecto", "Invitar"), no cuántas veces ya se haya gastado el negro.
 * Lo reversible y lo de paso se queda en `BTN_OUTLINE` (DESIGN.md).
 */
export const BTN_SOLID =
  "label inline-flex min-h-12 items-center justify-center rounded-button bg-midnight-ink px-6 py-4 text-paper-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * El mismo botón lleno, a la medida de la barra estrecha del espacio de trabajo.
 * Es una variante de tamaño y no de estilo: mismo radio, mismo registro, mismo
 * color. Existe para no mezclar `py-3` con el `py-4` de arriba, que dejaría el
 * alto del botón a merced del orden en que Tailwind emita las dos clases.
 */
export const BTN_SOLID_SM =
  "label inline-flex min-h-11 items-center justify-center rounded-button bg-midnight-ink px-5 py-3 text-paper-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * El botón lleno a la altura de un campo (54px), para las filas donde va pegado
 * a uno: el único sitio del sistema donde un botón mide lo mismo que un campo.
 * Sin `py` —el alto lo fija `min-h` y el texto lo centra el flex—, para que no
 * haya dos reglas de relleno peleándose.
 */
export const BTN_SOLID_LG =
  "label inline-flex min-h-[54px] items-center justify-center rounded-button bg-midnight-ink px-5 text-paper-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * El añadido de "Nuevo proyecto" cuando la mesa está apagada: el bloque de tinta
 * pasa a verde voltaje, con la tinta oscura encima.
 *
 * Es la única pieza del chrome que no le vale con darle la vuelta al neutro, y
 * conviene decir por qué. En claro, `BTN_SOLID` es un bloque casi negro sobre
 * papel: pesa porque es lo más oscuro de la pantalla. Al apagar la luz ese mismo
 * bloque se vuelve casi blanco sobre una mesa oscura, y entonces pesa demasiado
 * —es el único rectángulo claro y macizo de toda la vista, y grita más de lo que
 * vale la acción—. El verde pesa lo justo, y además ya significa en este sistema
 * exactamente lo que este botón hace: encender algo.
 *
 * No va dentro de `BTN_SOLID` a propósito, aunque se pudiera. Ese mismo botón es
 * también el que borra un proyecto, y el verde de esta aplicación quiere decir
 * "queda trabajo" y "esto está activo", nunca "esto es irreversible". Un verde
 * ahí sería la primera vez que el color miente. Así que esto se pide a mano,
 * botón por botón, y ahora mismo lo pide uno.
 */
export const SOLID_LIT_DARK = "dark:bg-lime-voltage dark:text-wash-ink";

/**
 * Botón encendido: verde voltaje con trazo de tinta, en la geometría de
 * `BTN_SOLID_SM` para que encender no mueva nada de sitio. Es el único lugar del
 * chrome donde el verde llena una superficie, y es lo que significa: activo.
 */
export const BTN_ON =
  "label inline-flex min-h-11 items-center justify-center rounded-button border border-midnight-ink bg-lime-voltage px-5 py-3 text-wash-ink transition disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Todo lo demás que se pulsa: contorno de tinta sobre papel. Comparte tamaño con
 * `BTN_SOLID` a propósito —cambiar el énfasis de un botón no debe cambiar su
 * alto—, así que uno puede sustituir al otro en el sitio sin que nada se mueva.
 */
export const BTN_OUTLINE =
  "label inline-flex min-h-12 items-center justify-center rounded-button border border-midnight-ink bg-paper-white px-6 py-4 text-midnight-ink transition hover:bg-soft-mist disabled:cursor-not-allowed disabled:border-soft-mist disabled:text-olive-stone disabled:hover:bg-paper-white";

/** Acción de tercera fila: sin caja, para no competir con las dos de arriba. */
export const BTN_QUIET =
  "label inline-flex min-h-8 items-center text-olive-stone underline-offset-4 transition hover:text-midnight-ink hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50";

/**
 * Píldora de filtro. Encendida se invierte: tinta llena, papel encima.
 *
 * Las tres salen de la misma caja para que midan exactamente lo mismo: el
 * conmutador deslizante (`PillSwitch`) superpone una fila sobre otra, y un
 * píxel de diferencia en el relleno descuadraría el texto encendido.
 */
const PILL_BASE =
  "label-xs inline-flex min-h-9 items-center rounded-button border border-midnight-ink px-4 transition";
export const PILL = `${PILL_BASE} bg-paper-white text-midnight-ink hover:bg-soft-mist`;
export const PILL_ON = `${PILL_BASE} bg-midnight-ink text-paper-white`;
/** La misma píldora sin relleno propio: va dentro del bloque de tinta que se desliza. */
export const PILL_LIT = `${PILL_BASE} bg-transparent text-paper-white`;

/** Insignia: dato suelto, nunca pulsable. */
export const BADGE =
  "label-xs inline-flex items-center rounded-button border border-soft-mist px-2 py-1 text-olive-stone";

/** Tarjeta: regla de pelo y 12px de radio. Jamás sombra (DESIGN.md). */
export const CARD = "rounded-card border border-soft-mist bg-paper-white";

/**
 * Campo de formulario. El foco lo pasa de regla de pelo a trazo de tinta.
 *
 * El relleno derecho va suelto y no en un `px` porque hay campos que llevan un
 * botón dentro —el ojo de la contraseña— y necesitan ceder ese lado. Separadas
 * en dos declaraciones de la misma propiedad, la variante gana siempre; con un
 * `px-4` debajo, quién gana lo decidiría el orden en que Tailwind las emita.
 */
const FIELD_BASE =
  "w-full rounded-button border border-soft-mist bg-paper-white py-3.5 pl-4 text-body outline-none transition placeholder:text-olive-stone focus:border-midnight-ink aria-invalid:border-midnight-ink aria-invalid:bg-peach-wash aria-invalid:text-wash-ink";
export const FIELD = `${FIELD_BASE} pr-4`;

/** El mismo campo con el lado derecho libre para el botón que lleva dentro. */
export const FIELD_INSET = `${FIELD_BASE} pr-12`;

/** Rótulo de un campo: el registro pequeño, en piedra de oliva. */
export const FIELD_LABEL = "label-xs block text-olive-stone";

/** Enlace dentro de un párrafo. */
export const LINK = "underline underline-offset-4 transition hover:text-olive-stone";
