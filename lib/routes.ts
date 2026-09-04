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
