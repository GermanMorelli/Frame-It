/**
 * Colores con los que se distingue a cada persona sobre la página revisada.
 *
 * Son contornos que caen encima de un sitio ajeno, del que no se sabe nada: van
 * saturados y separados entre sí para que se distingan tanto sobre fondo claro
 * como oscuro, y para que dos autores no se confundan de un vistazo. Por eso
 * esta lista no es la paleta del sistema —que es tinta, papel y un verde— sino
 * datos: identidad, no chrome.
 */
const PALETTE = [
  "#AAFF00", // verde voltaje, el acento de la casa
  "#2F6BFF", // azul
  "#E5007D", // magenta
  "#FF7A00", // naranja
  "#00C2A8", // turquesa
  "#7A5CFF", // violeta
  "#FF3B30", // rojo
  "#FFC400", // ámbar
];

/** Sin nada de lo que tirar no se inventa identidad: piedra de oliva. */
const UNKNOWN = "#838976";

/**
 * Los tres lavados pastel del sistema, cada uno dicho de las dos maneras en que
 * hace falta: como clase de Tailwind, para pintar una superficie, y en
 * hexadecimal, para lo que viaja dentro de una URL —el fondo que se le pide al
 * servicio de avatares—. Estuvieron un tiempo en dos listas paralelas que había
 * que mantener en el mismo orden; una sola tabla no puede descuadrarse.
 *
 * Los valores son los tokens de `app/globals.css`, y ahí es donde se cambian.
 */
export const WASHES = [
  { id: "peach", label: "Durazno", class: "bg-peach-wash", hex: "ffe4c3" },
  { id: "sky", label: "Cielo", class: "bg-sky-wash", hex: "cbedff" },
  { id: "mint", label: "Menta", class: "bg-mint-wash", hex: "caf3aa" },
] as const;

/**
 * Y el neutro, que no es un lavado de categoría sino la regla de pelo: es lo que
 * sale cuando no hay de qué tirar, y también la opción de quien no quiere color.
 */
export const NO_WASH = {
  id: "mist",
  label: "Niebla",
  class: "bg-soft-mist",
  hex: "e6e7e4",
} as const;

/** Los cuatro juntos: es entre lo que se elige el fondo de un avatar. */
export const ALL_WASHES = [...WASHES, NO_WASH];

export type Wash = (typeof ALL_WASHES)[number];
export type WashId = Wash["id"];

export function isWashId(value: unknown): value is WashId {
  return ALL_WASHES.some((wash) => wash.id === value);
}

/** El lavado que lleva ese nombre. El neutro si no lleva ninguno. */
export function washById(id: WashId | null | undefined): Wash {
  return ALL_WASHES.find((wash) => wash.id === id) ?? NO_WASH;
}

/** Hash estable: el mismo texto da el mismo número en cualquier máquina. */
function hash(key: string | undefined | null): number | null {
  const text = (key ?? "").trim().toLowerCase();
  if (!text) return null;

  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }
  return value;
}

/**
 * Color estable a partir de un texto: el mismo dato siempre da el mismo color,
 * en cualquier máquina y después de recargar.
 */
export function stringColor(key: string | undefined | null): string {
  const value = hash(key);
  return value === null ? UNKNOWN : PALETTE[value % PALETTE.length];
}

/**
 * El color de una persona sale de su propio correo, no de un azar: así lleva
 * siempre el mismo, en cualquier equipo y en cualquier proyecto.
 */
export function authorColor(author: string | undefined | null): string {
  return stringColor(author);
}

/**
 * Lavado pastel estable a partir de un texto. Es lo que da variedad a la rejilla
 * de proyectos sin meter ni una sombra ni un degradado, y sale del slug para que
 * un proyecto lleve siempre el mismo color: se reconoce por el color antes de
 * leer el nombre. Para una persona la clave es su correo, igual que su color.
 */
export function washOf(key: string | undefined | null): Wash {
  const value = hash(key);
  return value === null ? NO_WASH : WASHES[value % WASHES.length];
}

/** Su clase, que es lo que pinta una superficie. */
export function washFor(key: string | undefined | null): string {
  return washOf(key).class;
}

/**
 * Y el mismo lavado en hexadecimal, para el fondo que se le pide al servicio de
 * avatares: la imagen cae encima del lavado que ya está puesto, así que los dos
 * tienen que salir de la misma cuenta o se vería el canto al llegar.
 */
export function washHex(key: string | undefined | null): string {
  return washOf(key).hex;
}
