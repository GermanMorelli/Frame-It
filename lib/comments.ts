import type { Avatar } from "@/lib/avatar";

/**
 * Pistas para reencontrar el elemento cuando la ruta CSS deja de valer: basta con
 * que el sitio inserte un banner o un <script> en el cuerpo para que todos los
 * índices nth-child bailen y el selector apunte a otra cosa (o a nada).
 */
export type AnchorHints = {
  /** id del elemento, si tenía uno que no parezca generado en cada carga. */
  elementId: string;
  tag: string;
  classes: string[];
  /** src de una imagen o href de un enlace: lo que mejor identifica a los dos. */
  src: string;
  /** Primeras palabras del texto: la última pista cuando todo lo demás falla. */
  text: string;
};

/**
 * Un comentario tal y como lo devuelve `project_comments`. Vive en la base y no
 * en el navegador: es lo que hace que lo anotado por alguien lo vea el resto del
 * equipo, y además lo pone fuera del alcance del sitio proxiado, que corre en
 * nuestro mismo origen y podría leer cualquier localStorage nuestro.
 */
export type Comment = {
  id: string;
  /** URL exacta de la página anotada: un proyecto tiene tantas como se visiten. */
  pageUrl: string;
  /** Selector CSS del elemento anotado, relativo a body. */
  selector: string;
  hints?: AnchorHints;
  /** Etiqueta legible del elemento (tag + primeras palabras), para la lista. */
  label: string;
  /** Quién lo escribió: identidad para saber si se puede borrar. */
  authorId: string;
  /** Nombre con el que se muestra a quien lo escribió. */
  author: string;
  /** Su correo: no se enseña entero, pero de él salen su color y su lavado. */
  authorEmail: string;
  /** Con qué cara aparece: el estilo y la semilla que la dibujan. */
  authorAvatar: Avatar;
  text: string;
  /** Cuándo se dio por resuelto, o null si sigue abierto. */
  resolvedAt: string | null;
  createdAt: string;
};

/** Los comentarios de una página, para listarlos agrupados. */
export type CommentGroup = { pageUrl: string; comments: Comment[] };

/** Fecha del comentario más reciente del grupo, para ordenar las páginas. */
function lastTouched(comments: Comment[]): number {
  return comments.reduce((max, comment) => Math.max(max, Date.parse(comment.createdAt) || 0), 0);
}

/**
 * Reparte los comentarios del proyecto por página, la retocada más recientemente
 * primero. El orden dentro de cada página es el de llegada, que es el que fija la
 * numeración de las marcas sobre el sitio.
 */
export function groupByPage(comments: Comment[]): CommentGroup[] {
  const byPage = new Map<string, Comment[]>();
  for (const comment of comments) {
    const list = byPage.get(comment.pageUrl);
    if (list) list.push(comment);
    else byPage.set(comment.pageUrl, [comment]);
  }

  return [...byPage.entries()]
    .map(([pageUrl, list]) => ({ pageUrl, comments: list }))
    .sort((a, b) => lastTouched(b.comments) - lastTouched(a.comments));
}
