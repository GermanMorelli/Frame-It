/** Host de la propia máquina o de la red local, donde casi nunca hay https. */
function isLocalHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".local")) return true;
  if (hostname === "[::1]") return true;
  return /^(?:10\.|127\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname);
}

/**
 * Normaliza lo que el usuario escribe en el input a una URL absoluta http(s).
 * Devuelve null si la entrada no es un dominio utilizable.
 */
export function normalizeDomain(input: string | undefined | null): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const hasProtocol = /^https?:\/\//i.test(raw);

  let url: URL;
  try {
    url = new URL(hasProtocol ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  // Solo tráfico web: bloquea javascript:, data:, file:, etc.
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname;
  if (!host) return null;
  const local = isLocalHost(host);
  if (!local && !host.includes(".")) return null;
  // Un punto final o inicial deja un hostname inválido tipo ".com" o "sitio."
  if (host.startsWith(".") || host.endsWith(".")) return null;

  // Un servidor de desarrollo no suele tener certificado: dar https por supuesto
  // dejaría la vista previa en un error de conexión, sin nada que comentar.
  if (!hasProtocol && local) url.protocol = "http:";

  return url.toString();
}

/** Hostname legible para mostrar en la UI, sin el "www.". */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Nombre de una página para la lista de comentarios: host más ruta, sin la barra final. */
export function pageLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return displayHost(url) + path;
  } catch {
    return url;
  }
}

/**
 * Ruta interna a la que volver tras iniciar sesión. Cualquier cosa que no empiece
 * por una sola barra se descarta: con un host ajeno esto sería un redirector abierto.
 */
export function internalPath(value: unknown): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

/**
 * Si el sitio es alcanzable desde fuera de esta máquina. Lo pregunta el
 * generador de miniaturas: un servicio de captura vive en internet y no puede
 * ver `localhost:3000` ni una IP de la red de casa, así que pedirle una foto de
 * eso es una espera de veinte segundos para acabar en el mismo hueco gris. Y,
 * sobre todo, no hay por qué contarle a nadie el nombre de una intranet.
 */
export function isPublicSite(url: string): boolean {
  try {
    return !isLocalHost(new URL(url).hostname);
  } catch {
    return false;
  }
}
