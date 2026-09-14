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

/** Un trozo del texto de un comentario: o es una mención, o no lo es. */
export type TextPart = { text: string; mention: boolean };

/** Para meter un nombre dentro de una expresión regular sin que la rompa. */
function quote(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parte el texto de un comentario en lo que es mención y lo que no.
 *
 * Vive aquí, y no donde se pinta, porque el mismo texto se pinta en dos sitios
 * que no se parecen en nada: la lista de la columna, que es React, y el globo
 * que sale al pasar el cursor por encima de una marca, que es un script dentro
 * de una página ajena y no puede importar nada de esta aplicación
 * (`lib/annotator.ts`). Si cada uno buscara las menciones por su cuenta, serían
 * dos reglas distintas para la misma frase, y la de allí se quedaría atrás.
 *
 * Se resuelve al pintar y contra la lista de gente del proyecto, no contra lo
 * que se guardó: así una mención a quien ya no está en el equipo se lee como el
 * texto que es, sin resaltar un nombre que ya no lleva a ninguna parte.
 */
export function splitMentions(text: string, names: string[]): TextPart[] {
  if (!text) return [];
  const usable = names.filter(Boolean);
  if (usable.length === 0) return [{ text, mention: false }];

  // Los largos primero: con "Ana" antes que "Ana María", la primera se comería
  // media mención de la segunda y dejaría el apellido suelto fuera.
  const ordered = [...usable].sort((a, b) => b.length - a.length).map(quote);
  const pattern = new RegExp(`@(?:${ordered.join("|")})`, "g");

  const parts: TextPart[] = [];
  let from = 0;
  for (const found of text.matchAll(pattern)) {
    const at = found.index;
    if (at > from) parts.push({ text: text.slice(from, at), mention: false });
    parts.push({ text: found[0], mention: true });
    from = at + found[0].length;
  }

  if (parts.length === 0) return [{ text, mention: false }];
  if (from < text.length) parts.push({ text: text.slice(from), mention: false });
  return parts;
}
