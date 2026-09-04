import { THUMB_RATIO, thumbWidth } from "@/lib/thumb";
import { isPublicSite, normalizeDomain } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La foto de la portada de un sitio, para la tarjeta de su proyecto.
 *
 * Todo lo que puede salir mal aquí —el sitio no existe, el servicio de captura
 * está caído, se acabó la cuota del día— sale por la misma puerta: un 204 sin
 * cuerpo. La miniatura es información de apoyo, y una tarjeta sin foto sigue
 * siendo una tarjeta; una que enseñe el icono de imagen rota, no.
 *
 * La sesión ya la exige el proxy antes de que se llegue hasta aquí: sin esa
 * comprobación esto sería un servicio de capturas abierto a cuenta de quien pague
 * el servidor.
 */

/**
 * Quién saca la foto. Por defecto Microlink, que devuelve la imagen ya hecha y no
 * pide credenciales; su plan gratuito va por decenas de capturas al día por IP,
 * que es poco pero da de sobra con la caché de aquí abajo —y cuando se agota, la
 * tarjeta se queda en su lavado, que es un final digno.
 *
 * Se cambia por otro servicio con `THUMBNAIL_ENDPOINT` —los huecos `{url}`, `{w}`
 * y `{h}` se rellenan aquí— y se apaga del todo poniéndolo en `off`, que es lo
 * que hay que hacer si las direcciones revisadas no pueden salir de la
 * instalación. Si el sitio a revisar es privado, apagarlo no cuesta nada: nunca
 * hubo foto que enseñar, porque el servicio tampoco lo alcanza.
 *
 * (El anterior era mShots de WordPress.com. Dejó de servir a quien no es de
 * casa: hoy contesta 403 a todo. Se queda escrito para que nadie vuelva a él
 * pensando que sigue siendo la opción gratuita obvia.)
 *
 * Esto vive en el servidor y no en `lib/thumb.ts` a propósito: la plantilla de
 * otro servicio puede llevar una clave dentro, y este archivo no viaja al
 * navegador.
 */
const ENDPOINT =
  process.env.THUMBNAIL_ENDPOINT ??
  "https://api.microlink.io/?url={url}&screenshot=true&meta=false&embed=screenshot.url" +
    "&viewport.width={w}&viewport.height={h}&viewport.deviceScaleFactor=1";

const ON = ENDPOINT.trim().toLowerCase() !== "off";

/** Cuánto vale una foto antes de volver a pedirla. Un sitio no cambia cada hora. */
const HIT_TTL = 12 * 60 * 60 * 1000;
/**
 * Y cuánto se recuerda un fallo. Existe para no aporrear al servicio desde las
 * doce tarjetas de la rejilla cuando algo va mal: sin esto, una cuota agotada se
 * traduciría en doce peticiones más cada vez que alguien recarga el panel.
 */
const MISS_TTL = 60 * 1000;
/** Techo de la caché en memoria: se tira lo más viejo antes que crecer sin fin. */
const MAX_ENTRIES = 200;

/** Sacar una foto de una página entera lleva su tiempo; se le da, pero no infinito. */
const CAPTURE_TIMEOUT = 25000;

/**
 * Por debajo de esto no es una captura. No es una medida fina —una página en
 * blanco pesa poco de verdad—, sino el suelo bajo el cual solo caben el píxel
 * transparente y el icono de error con que algunos servicios contestan cuando no
 * pueden fotografiar: cosas que no hay que enseñar como si fueran el sitio.
 */
const MIN_BYTES = 2000;

type Shot = { body: ArrayBuffer; type: string };

const cache = new Map<string, { shot: Shot | null; until: number }>();

function remember(key: string, shot: Shot | null) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { shot, until: Date.now() + (shot ? HIT_TTL : MISS_TTL) });
}

function blank() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

function serve({ body, type }: Shot) {
  return new Response(body, {
    headers: {
      "content-type": type,
      // Privada: esto se sirve por una ruta que exige sesión, así que no debe
      // quedarse guardado en ninguna caché compartida del camino.
      "cache-control": "private, max-age=21600",
    },
  });
}

/** La petición al servicio. Null si no contestó, o si lo que trajo no vale. */
async function capture(target: string, width: number): Promise<Shot | null> {
  const url = ENDPOINT.replace("{url}", encodeURIComponent(target))
    .replace("{w}", String(width))
    .replace("{h}", String(Math.round(width / THUMB_RATIO)));

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT),
    });
    if (!response.ok) return null;

    // Un servicio que no puede con el encargo contesta su error en JSON, con un
    // 200 por delante: lo que decide si hay foto es el tipo, no el código.
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const body = await response.arrayBuffer();
    if (body.byteLength < MIN_BYTES) return null;

    return { body, type };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!ON) return blank();

  const params = new URL(request.url).searchParams;
  const target = normalizeDomain(params.get("url"));
  // Un sitio de desarrollo no lo puede ver nadie de fuera: ni se pregunta.
  if (!target || !isPublicSite(target)) return blank();

  const width = thumbWidth(Number(params.get("w")) || 800);
  const key = `${width}|${target}`;

  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) {
    return saved.shot ? serve(saved.shot) : blank();
  }

  const shot = await capture(target, width);
  remember(key, shot);
  return shot ? serve(shot) : blank();
}
