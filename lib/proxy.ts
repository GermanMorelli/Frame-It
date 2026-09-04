import { annotatorScript } from "./annotator";

/** Cabeceras del origen que no deben reenviarse: impedirían el embebido o mienten sobre el cuerpo. */
const STRIPPED_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie",
]);

export function passthroughHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!STRIPPED_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

type RewriteOptions = {
  html: string;
  /** URL final tras redirecciones: base para resolver rutas relativas. */
  pageUrl: string;
  origin: string;
  proxyPath: string;
};

/**
 * Prepara el HTML de terceros para vivir dentro de nuestro iframe:
 * quita las CSP declaradas en <meta>, ancla las rutas relativas al sitio original
 * con <base> e inyecta el script de anotación.
 */
export function rewriteHtml({ html, pageUrl, origin, proxyPath }: RewriteOptions): string {
  let out = html;

  // Una CSP en <meta> sobrevive al filtrado de cabeceras y bloquearía el script inyectado.
  out = out.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");

  // Deliberadamente NO se inyecta <base>. Apuntarlo al dominio remoto haría que
  // history.pushState("/") resolviera a otro origen y lanzara SecurityError; routers
  // como React Router capturan ese fallo y recurren a location.assign(), que sacaría
  // el iframe del proxy. En su lugar se absolutizan las URLs una a una.
  out = out.replace(/<base[^>]*>/gi, "");
  out = absolutizeUrls(out, pageUrl);

  const script = `<script>${annotatorScript({ origin, proxyPath, pageUrl })}</script>`;
  // Va en <head>, no al final del documento: el anotador debe estar en pie antes de
  // que el sitio pinte para avisar al padre de que ya hay algo que ver. Cerrando por
  // el final, además, un `</body>` dentro de una cadena de JavaScript se tragaría el
  // script. El charset lo fija la cabecera, así que desplazar el <meta> no estorba.
  const head = out.match(/<head[^>]*>/i);
  // Reemplazo por función: en la forma de cadena, un "$&" del script inyectado
  // tendría significado propio y se sustituiría por otra cosa.
  if (head) {
    out = out.replace(head[0], () => head[0] + script);
  } else if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, () => script + "</body>");
  } else {
    out = script + out;
  }

  return out;
}

/** Esquemas que no son rutas resolubles y deben dejarse intactos. */
const NON_RESOLVABLE = /^(#|data:|blob:|javascript:|mailto:|tel:|about:|\{\{|\{)/i;

/** Atributos cuyo valor es una única URL. */
const URL_ATTRIBUTES = new Set(["href", "src", "action", "poster", "data-src", "formaction"]);

/**
 * El valor leído del HTML ya viene escapado. Hay que decodificarlo antes de
 * resolverlo, o al volver a escaparlo un `&amp;` acabaría como `&amp;amp;` y
 * rompería URLs con query string (las de load.php de MediaWiki, por ejemplo).
 * `&amp;` se decodifica el último para no revivir entidades dobles.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function toAbsolute(value: string, base: string): string {
  const trimmed = decodeEntities(value).trim();
  if (!trimmed || NON_RESOLVABLE.test(trimmed)) return value;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return value;
  }
}

/** srcset es una lista "url descriptor, url descriptor". */
function absolutizeSrcset(value: string, base: string): string {
  return value
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      if (!parts[0]) return entry;
      parts[0] = toAbsolute(parts[0], base);
      return parts.join(" ");
    })
    .join(", ");
}

/**
 * Reescribe las URLs relativas del documento a absolutas contra el sitio original.
 * Se recorre etiqueta a etiqueta para no tocar el contenido de <script>, donde una
 * sustitución ciega corrompería cadenas de JavaScript o JSON embebido.
 */
function absolutizeUrls(html: string, base: string): string {
  let out = html.replace(/<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (tag, name: string, attrs: string) => {
    if (!attrs) return tag;

    const rewritten = attrs.replace(
      /(\s)([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g,
      (match, space: string, attr: string, _quoted: string, double?: string, single?: string) => {
        const value = double ?? single ?? "";
        const lower = attr.toLowerCase();

        if (lower === "srcset" || lower === "imagesrcset") {
          return `${space}${attr}="${escapeAttribute(absolutizeSrcset(value, base))}"`;
        }
        if (URL_ATTRIBUTES.has(lower)) {
          return `${space}${attr}="${escapeAttribute(toAbsolute(value, base))}"`;
        }
        if (lower === "style") {
          return `${space}${attr}="${escapeAttribute(absolutizeCssUrls(value, base))}"`;
        }
        return match;
      },
    );

    return `<${name}${rewritten}>`;
  });

  // Las url() de los <style> embebidos resolverían contra nuestro proxy, no contra el sitio.
  out = out.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs: string, css: string) => {
    return `<style${attrs}>${absolutizeCssUrls(css, base)}</style>`;
  });

  return out;
}

function absolutizeCssUrls(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote: string, value: string) => {
    const absolute = toAbsolute(value, base);
    return absolute === value ? match : `url(${quote}${absolute}${quote})`;
  });
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

type ErrorPageOptions = {
  host: string;
  detail: string;
  origin: string;
  /** URL que se intentó cargar; vacía si ni siquiera era válida. */
  pageUrl: string;
};

/** Página de error servida dentro del iframe, con los colores del sistema. */
export function errorPage({ host, detail, origin, pageUrl }: ErrorPageOptions): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>No disponible</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#ffffff;font-family:system-ui,ui-sans-serif,sans-serif;color:#0d1400">
  <div style="max-width:460px;padding:0 32px">
    <p style="font-size:19px;letter-spacing:-0.44px;font-weight:600;margin:0">No se pudo cargar ${escapeHtml(host)}</p>
    <p style="font-size:16px;letter-spacing:0.5px;color:#838976;margin:16px 0 0">${escapeHtml(detail)}</p>
  </div>
  <script>${errorBeacon({ origin, pageUrl, detail })}</script>
</body></html>`;
}

/**
 * La página de error no lleva anotador, pero sí contesta al ping: sin esto el
 * espacio de trabajo se quedaría sin respuesta y concluiría que el sitio se salió
 * del proxy, un diagnóstico que no describe lo ocurrido.
 */
function errorBeacon({ origin, pageUrl, detail }: Omit<ErrorPageOptions, "host">): string {
  return `(function () {
  var ORIGIN = ${js(origin)};
  var PAGE = ${js(pageUrl)};
  var DETAIL = ${js(detail)};
  function send(msg) { msg.source = "frameit-frame"; parent.postMessage(msg, ORIGIN); }
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    var data = e.data;
    if (data && data.source === "frameit-parent" && data.type === "ping") send({ type: "pong", url: PAGE });
  });
  send({ type: "load-error", detail: DETAIL, url: PAGE });
})();`;
}

/** Literal JavaScript seguro dentro de un <script>: `</script>` no puede cerrarlo. */
function js(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
