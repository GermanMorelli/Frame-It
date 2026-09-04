import { isWashId, type WashId } from "@/lib/author-color";

/**
 * El avatar de una persona: de qué se compone y cómo se pide.
 *
 * Hasta aquí a la gente se la reconocía por su nombre y por el color con el que
 * se perfilan sus marcas sobre el sitio revisado (`lib/author-color.ts`). Un
 * nombre hay que leerlo, y en una lista de ocho comentarios se leen los ocho
 * para dar con el de alguien. Una cara se reconoce sin leer nada, que es lo
 * mismo que hace la portada del sitio en la rejilla de proyectos.
 *
 * Las caras las dibuja DiceBear, y son deterministas: la misma semilla siempre
 * devuelve exactamente el mismo dibujo. Eso es lo que las hace servir de
 * identidad y no de adorno —tu cara es la misma en cada proyecto, en cada
 * máquina y después de recargar— y lo que permite no guardar ninguna imagen: un
 * avatar aquí son tres cadenas de texto, no un archivo.
 *
 * Nadie sube una foto, y esa también es una decisión: subir imágenes trae
 * consigo almacenamiento, recorte, moderación y un dato personal más que
 * custodiar, y todo eso para una pieza de 24px que solo tiene que decir quién es
 * quién.
 *
 * Este módulo lo comparten el servidor y el navegador, así que no lleva dentro
 * ni la dirección del servicio ni credencial alguna: solo la forma de la
 * petición. Quién dibuja de verdad se decide en `app/api/avatar/route.ts`.
 */

/**
 * Entre los que se puede elegir.
 *
 * DiceBear ofrece medio centenar, y la mayoría no cabe aquí: hay degradados,
 * sombras y volumen, que es justo lo que el sistema no tiene (DESIGN.md). Los
 * ocho de esta lista son planos y de trazo, que es como se dibuja sobre papel.
 * La lista es cerrada además por seguridad: es lo único que puede acabar en la
 * ruta de la petición al tercero.
 */
export const AVATAR_STYLES = [
  { id: "notionists-neutral", label: "Trazo" },
  { id: "lorelei-neutral", label: "Retrato" },
  { id: "open-peeps", label: "Gente" },
  { id: "big-smile", label: "Sonrisa" },
  { id: "thumbs", label: "Gota" },
  { id: "bottts-neutral", label: "Robot" },
  { id: "pixel-art-neutral", label: "Píxel" },
  { id: "shapes", label: "Formas" },
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"];

/**
 * Con el que se sale de fábrica. Es el más callado de los ocho —línea negra
 * sobre plano de color, sin relleno— y por eso el que mejor aguanta ser el
 * estilo de todo un equipo que no ha elegido nada.
 */
export const HOUSE_STYLE: AvatarStyle = "notionists-neutral";

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return AVATAR_STYLES.some((style) => style.id === value);
}

/**
 * Qué se admite como semilla. No es una validación de formulario —la semilla no
 * la escribe nadie, se sortea— sino la reja de la ruta: lo que llegue de fuera
 * se pega a una URL que sale de esta instalación, y un texto libre ahí es una
 * puerta abierta a pedirle al tercero cualquier otra cosa.
 */
const SEED_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;

export function isSeed(value: unknown): value is string {
  return typeof value === "string" && SEED_FORMAT.test(value);
}

/**
 * Lo que hace falta para dibujar a alguien: un estilo, una semilla y el lavado
 * sobre el que se dibuja.
 *
 * El fondo va en nulo mientras no se elija, y eso no significa «sin fondo» sino
 * «el que le toca»: el mismo lavado que sale de su correo, o sea el de su color
 * (`lib/author-color.ts`). Quien lo cambia está soltando esa atadura, no
 * estrenando un campo vacío, y por eso el nulo tiene que llegar entero hasta el
 * momento de pintar: lo resuelve `Avatar`, que es quien conoce a la persona.
 */
export type Avatar = { style: AvatarStyle; seed: string; bg: WashId | null };

/**
 * El avatar de una persona, con lo puesto o con lo de fábrica.
 *
 * Quien no ha elegido nada no tiene fila que consultar ni columna que rellenar:
 * su semilla es su propio identificador, que ya existe, es estable y no se
 * repite. Así una cuenta recién creada ya tiene cara —distinta de la de sus
 * compañeros— sin que nadie haya tenido que pasar por la pantalla de la cuenta,
 * y la base solo guarda algo de quien de verdad lo cambió.
 *
 * El identificador es un UUID y es lo único que viaja al servicio de dibujo, sin
 * nombre, sin correo y a través de nuestro propio servidor: para el tercero es
 * una cadena sin significado.
 */
export function avatarFor(
  id: string,
  style?: string | null,
  seed?: string | null,
  bg?: string | null,
): Avatar {
  return {
    style: isAvatarStyle(style) ? style : HOUSE_STYLE,
    seed: isSeed(seed) ? seed : id,
    bg: isWashId(bg) ? bg : null,
  };
}

/**
 * La dirección de nuestro propio avatar. `bg` es el lavado pastel sobre el que
 * se dibuja, en hexadecimal y sin almohadilla: lo elige quien lo pinta, porque
 * es el mismo color que ya hay debajo mientras la imagen no llega.
 */
export function avatarSrc(avatar: Avatar, bg: string): string {
  const params = new URLSearchParams({
    style: avatar.style,
    seed: avatar.seed,
    bg,
  });
  return `/api/avatar?${params}`;
}

/**
 * Una semilla nueva al azar: es lo que hay detrás de «otra cara». Corta a
 * propósito —diez caracteres— porque acaba en una URL que se ve y se comparte,
 * y de cara a las colisiones da igual: dos semillas iguales solo significan dos
 * personas con la misma cara, no dos identidades confundidas.
 */
export function rollSeed(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}
