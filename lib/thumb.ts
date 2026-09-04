/**
 * La miniatura de un sitio: cómo se pide.
 *
 * La tarjeta de un proyecto enseñaba el hostname en una franja pastel. Un
 * dominio es un identificador, no una imagen: doce tarjetas de doce clientes se
 * leen una a una, y hay que leerlas todas para dar con la que se busca. Una foto
 * de la portada se reconoce sin leer nada, que es justo lo que hace falta en una
 * rejilla.
 *
 * Aquí no hay ningún navegador sin ventana con el que sacar esa foto —añadir
 * Playwright al despliegue por una miniatura es un precio alto—, así que la saca
 * un servicio de captura y nosotros la servimos desde `/api/thumb`
 * (`app/api/thumb/route.ts`, donde vive la decisión de a quién se le pide). Ese
 * rodeo no es burocracia:
 *
 *   · El navegador nunca habla con el tercero, así que ni la sesión de quien
 *     mira ni su IP se pasean por un origen ajeno.
 *   · La respuesta se guarda de este lado y se sirve igual a todo el equipo.
 *   · Si el servicio no contesta, contestamos 204 y la tarjeta se queda en su
 *     lavado pastel. La rejilla nunca depende de que un tercero esté en pie.
 *
 * Este módulo lo comparten el servidor y el navegador, así que no lleva dentro
 * ni la dirección del servicio ni su credencial: solo la forma de la petición.
 */

/** Proporción de la miniatura: la misma en la rejilla y en la ficha del proyecto. */
export const THUMB_RATIO = 16 / 10;

/** Anchos admitidos. Cerrar la lista evita que la caché se llene de tamaños sueltos. */
const WIDTHS = [640, 800, 1200] as const;

export function thumbWidth(asked: number): number {
  return WIDTHS.find((width) => width >= asked) ?? WIDTHS[WIDTHS.length - 1];
}

/** La dirección de nuestra propia miniatura para un sitio y un ancho. */
export function thumbSrc(target: string, width: number): string {
  const params = new URLSearchParams({ url: target, w: String(thumbWidth(width)) });
  return `/api/thumb?${params}`;
}
