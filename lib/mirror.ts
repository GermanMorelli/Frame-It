/**
 * Prefijo bajo el que se sirve el sitio revisado. Todo lo que cuelgue de aquí es
 * tráfico ajeno; el guion bajo lo aparta del espacio de nombres de la app y de
 * cualquier ruta que el sitio pueda tener.
 */
export const MIRROR_PREFIX = "/_sitio";

/**
 * El documento proxiado NO puede servirse en `/api/proxy?url=…`: el navegador
 * resuelve contra la URL del documento todo lo que el JavaScript del sitio pide
 * en ejecución, y ahí `import("./_app/x.js")` acaba en `/api/_app/x.js`. Un sitio
 * de SvelteKit, que arranca justo así, se queda sin hidratar y solo se ve lo que
 * vino del servidor.
 *
 * La solución es servirlo en una ruta que calque la del sitio:
 * `/_sitio/https/ejemplo.com/blog/post`. Con eso, todo lo que el sitio resuelva
 * por su cuenta —imports relativos, y el `new URL("..", location)` con el que
 * SvelteKit deduce su base— cae donde caería en el original, solo que en nuestro
 * origen, y el middleware lo reconduce.
 */
export function mirrorPath(target: string): string {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    // Sin URL válida no hay ruta que calcar: por la puerta de siempre, que
    // responde con la página de error.
    return `/api/proxy?url=${encodeURIComponent(target)}`;
  }
  const scheme = url.protocol.replace(":", "");
  return `${MIRROR_PREFIX}/${scheme}/${url.host}${url.pathname}${url.search}`;
}

/** El camino de vuelta: de la ruta calcada a la URL real. Null si no es una. */
export function mirrorTarget(pathname: string, search: string): string | null {
  if (!pathname.startsWith(`${MIRROR_PREFIX}/`)) return null;

  const parts = pathname.slice(MIRROR_PREFIX.length + 1).split("/");
  const scheme = parts[0];
  const host = parts[1];
  if ((scheme !== "https" && scheme !== "http") || !host) return null;

  try {
    return new URL(`${scheme}://${host}/${parts.slice(2).join("/")}${search}`).toString();
  } catch {
    return null;
  }
}
