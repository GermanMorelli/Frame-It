/**
 * Direcciones internas de la aplicación. Viven aparte de `lib/projects.ts` a
 * propósito: aquel módulo abre un cliente de Supabase de servidor, y la barra
 * lateral del espacio de trabajo, que es de cliente, también necesita construir
 * la ruta de un proyecto.
 */

/** Un proyecto se identifica por su slug: /proyectos/<slug>. */
export function projectPath(slug: string): string {
  return `/proyectos/${encodeURIComponent(slug)}`;
}

/** Su espacio de trabajo, opcionalmente abierto por una página concreta. */
export function workspacePath(slug: string, url?: string): string {
  const base = `${projectPath(slug)}/vista`;
  return url ? `${base}?url=${encodeURIComponent(url)}` : base;
}

/**
 * La entrada de un enlace de invitado. Es la única ruta de la aplicación que se
 * abre sin sesión y sin cuenta, así que el testigo va en la propia dirección: no
 * hay nada más con lo que acreditarse. Va bajo un prefijo con nombre propio como
 * /proyectos y por lo mismo —cada ruta que se reclama se le quita al sitio
 * revisado, que comparte origen con la app (`proxy.ts`).
 */
export function guestPath(token: string): string {
  return `/invitado/${encodeURIComponent(token)}`;
}
