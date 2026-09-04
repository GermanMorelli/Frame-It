import { errorPage, passthroughHeaders, rewriteHtml } from "@/lib/proxy";
import { TARGET_HEADER } from "@/lib/target-header";
import { displayHost, isPublicSite, normalizeDomain } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type Attempt =
  | { response: Response }
  /** `connectionFailed` distingue "no hay nadie ahí" de "tardó demasiado". */
  | { detail: string; connectionFailed: boolean };

async function load(target: string): Promise<Attempt> {
  try {
    return {
      response: await fetch(target, {
        redirect: "follow",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(20000),
      }),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      detail: timedOut
        ? "El sitio tardó más de 20 segundos en responder."
        : "No se pudo establecer la conexión con el sitio.",
      connectionFailed: !timedOut,
    };
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const proxyPath = `${origin}/api/proxy`;
  // Tras un rewrite de proxy.ts la URL que se ve aquí es la original, sin el ?url=:
  // en ese caso el destino viene en la cabecera que puso el propio proxy.
  const asked = requestUrl.searchParams.get("url") ?? request.headers.get(TARGET_HEADER);
  const target = normalizeDomain(asked);

  if (!target) {
    return new Response(
      errorPage({
        host: "la página",
        detail: "El parámetro 'url' falta o no es válido.",
        origin,
        pageUrl: "",
      }),
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  let url = target;
  let attempt = await load(url);

  // Un sitio servido en una intranet puede hablar solo en claro, así que si la
  // conexión cifrada ni siquiera se establece se reintenta en http antes de darlo
  // por caído: fallar ahí deja la vista previa sin nada que comentar.
  //
  // Solo para lo local. Un dominio de internet que no acepta conexión en el 443
  // tampoco la va a aceptar en el 80, y el reintento no arregla nada: duplica la
  // espera. Diez segundos hasta que expira el intento son ya bastante rato
  // mirando un velo blanco; veintiuno son otra cosa.
  if (
    "detail" in attempt &&
    attempt.connectionFailed &&
    url.startsWith("https://") &&
    !isPublicSite(url)
  ) {
    const plain = `http://${url.slice("https://".length)}`;
    const retry = await load(plain);
    if ("response" in retry) {
      url = plain;
      attempt = retry;
    }
  }

  if ("detail" in attempt) {
    return new Response(
      errorPage({ host: displayHost(url), detail: attempt.detail, origin, pageUrl: url }),
      { status: 502, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const { response } = attempt;
  const contentType = response.headers.get("content-type") ?? "";

  // Solo el HTML se reescribe; el resto (imágenes, CSS, JSON) pasa tal cual.
  if (!contentType.includes("text/html")) {
    const headers = passthroughHeaders(response.headers);
    return new Response(response.body, { status: response.status, headers });
  }

  const html = await response.text();
  // response.url refleja la URL final tras redirecciones: es la base correcta.
  const pageUrl = response.url || url;

  // El middleware usa esta cookie para reconducir al sitio las rutas que su
  // JavaScript construye en ejecución y que caerían en nuestro origen.
  const targetOrigin = new URL(pageUrl).origin;

  return new Response(rewriteHtml({ html, pageUrl, origin, proxyPath }), {
    status: response.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": `mk_target=${encodeURIComponent(targetOrigin)}; Path=/; SameSite=Lax`,
    },
  });
}
