import { isAvatarStyle, isSeed } from "@/lib/avatar";
import { ALL_WASHES } from "@/lib/author-color";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La cara de una persona, dibujada por DiceBear y servida desde aquí.
 *
 * El rodeo es el mismo que el de las miniaturas (`app/api/thumb/route.ts`) y por
 * las mismas razones: el navegador de quien mira nunca habla con el tercero, así
 * que ni su IP ni las cabeceras de su sesión se pasean por un origen ajeno; la
 * respuesta se guarda de este lado y se sirve igual a todo el equipo; y si el
 * servicio no contesta, contestamos 204 y la cara se queda en su disco de color
 * con la inicial, que es lo que había antes de que llegara la imagen.
 *
 * Lo que sí es distinto es lo que se sirve. Un avatar es un SVG, y un SVG es un
 * documento con capacidad de traer script dentro: servido desde nuestro propio
 * origen, un dibujo ajeno sería código nuestro para el navegador. Dentro de un
 * `<img>` eso no corre —de ahí `Avatar`—, pero esta dirección se puede abrir a
 * pelo en una pestaña, y ahí sí. Por eso baja con una CSP que no le deja cargar
 * ni ejecutar nada y con `nosniff`, que impide además que se reinterprete como
 * otra cosa. Es la misma precaución de siempre, aplicada al único formato de
 * imagen que no es solo imagen.
 */

/**
 * Quién dibuja. Por defecto DiceBear, que no pide credenciales y limita por
 * peticiones por segundo, no por día: con la caché de aquí abajo, un equipo
 * entero cabe de sobra. Los huecos `{style}`, `{seed}` y `{bg}` se rellenan aquí.
 *
 * `backgroundType=solid` no es un capricho: sin él algunos estilos rellenan el
 * fondo con un degradado, y el sistema no tiene degradados (DESIGN.md).
 *
 * Se cambia por otro servicio —o por una instalación propia de DiceBear, que es
 * software libre— con `AVATAR_ENDPOINT`, y se apaga del todo poniéndolo en
 * `off`, que es lo que hay que hacer si de esta instalación no debe salir ni una
 * petición. Apagado, todo el mundo se queda con su disco de color y su inicial:
 * distintos entre sí, estables, y sin tercero de por medio.
 */
const ENDPOINT =
  process.env.AVATAR_ENDPOINT ??
  "https://api.dicebear.com/10.x/{style}/svg?seed={seed}" +
    "&backgroundColor={bg}&backgroundType=solid";

const ON = ENDPOINT.trim().toLowerCase() !== "off";

/**
 * Los cuatro fondos admitidos: los tres lavados pastel del sistema y la regla de
 * pelo (`lib/author-color.ts`). No es una lista de estética sino la segunda reja
 * de la ruta —el color también acaba dentro de la URL que sale de aquí—, y de
 * paso garantiza que ningún avatar traiga un color que el sistema no tiene.
 */
const BACKGROUNDS = new Set<string>(ALL_WASHES.map((wash) => wash.hex));

/**
 * Un dibujo no cambia nunca: la misma semilla da siempre el mismo SVG. Así que
 * lo que se guarda vale mucho, y cuando alguien cambia de cara lo que cambia es
 * la dirección, no lo que hay en ella.
 */
const HIT_TTL = 7 * 24 * 60 * 60 * 1000;
/** Un fallo se recuerda poco: puede ser un pico de peticiones por segundo. */
const MISS_TTL = 60 * 1000;
/** Techo de la caché: un equipo grande y sus estilos caben, y no crece sin fin. */
const MAX_ENTRIES = 500;

/** Dibujar una cara es inmediato; si tarda esto, es que no va a llegar. */
const DRAW_TIMEOUT = 8000;

/**
 * Techo de tamaño. La mayoría de estos avatares pesa dos o tres kilobytes, pero
 * los de trazo dibujado a mano se van a doce, así que esto no es una medida de
 * lo que un avatar debería pesar —sería un filtro de estilos disfrazado— sino la
 * red que impide guardar en memoria lo que devuelva un servicio desbocado.
 */
const MAX_BYTES = 64 * 1024;

const cache = new Map<string, { svg: string | null; until: number }>();

function remember(key: string, svg: string | null) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { svg, until: Date.now() + (svg ? HIT_TTL : MISS_TTL) });
}

function blank() {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

function serve(svg: string) {
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Un SVG de fuera servido desde nuestro origen: que no pueda pedir nada ni
      // ejecutar nada, ni siquiera abierto directamente en una pestaña.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
      // Privada porque esta ruta exige sesión, y larga porque la dirección
      // describe el dibujo entero: si cambia la cara, cambia la dirección.
      "cache-control": "private, max-age=604800, immutable",
    },
  });
}

/** La petición al servicio. Null si no contestó, o si lo que trajo no vale. */
async function draw(style: string, seed: string, bg: string): Promise<string | null> {
  const url = ENDPOINT.replace("{style}", encodeURIComponent(style))
    .replace("{seed}", encodeURIComponent(seed))
    .replace("{bg}", encodeURIComponent(bg));

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(DRAW_TIMEOUT),
    });
    if (!response.ok) return null;

    // Un estilo que el servicio no conoce se contesta en JSON con su error
    // dentro: lo que decide si hay dibujo es el tipo, no el código.
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("svg")) return null;

    const svg = await response.text();
    if (svg.length > MAX_BYTES || !svg.trimStart().startsWith("<svg")) return null;

    return svg;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!ON) return blank();

  const params = new URL(request.url).searchParams;
  const style = params.get("style");
  const seed = params.get("seed");
  const bg = params.get("bg") ?? "";

  // Los tres se comprueban contra una lista cerrada antes de tocar la URL de
  // salida: esta ruta pide algo a un tercero con nuestra IP, y sin esto sería un
  // relé por el que pedirle cualquier otra cosa.
  if (!isAvatarStyle(style) || !isSeed(seed) || !BACKGROUNDS.has(bg)) return blank();

  const key = `${style}|${seed}|${bg}`;

  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) {
    return saved.svg ? serve(saved.svg) : blank();
  }

  const svg = await draw(style, seed, bg);
  remember(key, svg);
  return svg ? serve(svg) : blank();
}
