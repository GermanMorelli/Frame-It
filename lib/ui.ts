/**
 * Las piezas de chrome del sistema, en un solo sitio.
 *
 * No es un atajo para escribir menos: es lo que garantiza que el botón de
 * "Crear proyecto" y el de "Invitar" tengan el mismo alto, el mismo radio y el
 * mismo trazo. Artboard vive de dos radios y de un único par de botones
 * (contorno primero, tinta llena después); repartir esas clases por doce
 * archivos es cómo se pierde un sistema (DESIGN.md).
 *
 * Los tamaños siguen la ley de Fitts: lo que se pulsa a menudo o decide la
 * pantalla es grande y ancho; lo raro o reversible se queda en texto.
 */

/** Acción principal de la pantalla. Una por vista, y llena de tinta. */
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
 * Botón encendido: verde voltaje con trazo de tinta, en la geometría de
 * `BTN_SOLID_SM` para que encender no mueva nada de sitio. Es el único lugar del
 * chrome donde el verde llena una superficie, y es lo que significa: activo.
 */
export const BTN_ON =
  "label inline-flex min-h-11 items-center justify-center rounded-button border border-midnight-ink bg-lime-voltage px-5 py-3 text-midnight-ink transition disabled:cursor-not-allowed disabled:opacity-40";

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
 * Botón de contorno a la altura de un campo (54px), para las filas donde va
 * pegado a uno. Sin `py`: el alto lo fija `min-h` y el texto lo centra el flex,
 * así no hay dos reglas de relleno peleándose.
 */
export const BTN_OUTLINE_LG =
  "label inline-flex min-h-[54px] items-center justify-center rounded-button border border-midnight-ink bg-paper-white px-5 text-midnight-ink transition hover:bg-soft-mist disabled:cursor-not-allowed disabled:border-soft-mist disabled:text-olive-stone disabled:hover:bg-paper-white";

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

/** Campo de formulario. El foco lo pasa de regla de pelo a trazo de tinta. */
export const FIELD =
  "w-full rounded-button border border-soft-mist bg-paper-white px-4 py-3.5 text-body outline-none transition placeholder:text-olive-stone focus:border-midnight-ink aria-invalid:border-midnight-ink aria-invalid:bg-peach-wash";

/** Rótulo de un campo: el registro pequeño, en piedra de oliva. */
export const FIELD_LABEL = "label-xs block text-olive-stone";

/** Enlace dentro de un párrafo. */
export const LINK = "underline underline-offset-4 transition hover:text-olive-stone";
