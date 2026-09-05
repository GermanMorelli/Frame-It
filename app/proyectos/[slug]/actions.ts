"use server";

import { revalidatePath } from "next/cache";
import type { AnchorHints, Comment } from "@/lib/comments";
import { projectPath } from "@/lib/routes";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";
import { displayName, userAvatar } from "@/lib/user";

const MAX_BODY = 4000;

export type CommentResult = { comment?: Comment; error?: string };
export type ActionResult = { ok?: true; error?: string };

type NewComment = {
  projectId: string;
  /** Slug del proyecto: solo para refrescar su pantalla, no para autorizar. */
  slug: string;
  pageUrl: string;
  selector: string;
  hints: AnchorHints;
  label: string;
  text: string;
  /**
   * A quién señala. Viaja como identificadores y no como nombres para que
   * cambiarse el nombre mañana no deshaga la mención de ayer. Que esta lista sea
   * de gente del proyecto lo comprueba la base, no esto: el disparador que
   * reparte los avisos filtra por pertenencia (migración 0006).
   */
  mentions: string[];
};

/**
 * Guarda un comentario del proyecto.
 *
 * Quién puede escribir en cuál proyecto lo decide RLS (`comments_insert`: hay que
 * ser editor o dueño, y firmar con la propia identidad), no esta función: una
 * acción de servidor se puede invocar con un POST a pelo, así que el permiso
 * tiene que vivir donde no se le pueda dar la vuelta.
 */
export async function createComment(input: NewComment): Promise<CommentResult> {
  if (!supabaseReady) return { error: "Falta configurar Supabase en el servidor." };

  const user = await getUser();
  if (!user) return { error: "Tu sesión caducó. Vuelve a entrar." };

  const text = input.text.trim();
  if (!text) return { error: "El comentario está vacío." };
  if (text.length > MAX_BODY)
    return { error: `El comentario no puede pasar de ${MAX_BODY} caracteres.` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      project_id: input.projectId,
      author_id: user.id,
      page_url: input.pageUrl,
      selector: input.selector,
      hints: input.hints,
      label: input.label,
      body: text,
      mentions: input.mentions,
    })
    .select("id, page_url, selector, hints, label, body, resolved_at, created_at")
    .single();

  if (error || !data) return { error: error?.message ?? "No se pudo guardar el comentario." };

  // La pantalla del proyecto lista los comentarios; la del espacio de trabajo se
  // actualiza sola con lo que devuelve esto, y refrescarla recargaría el iframe.
  revalidatePath(projectPath(input.slug));

  return {
    comment: {
      id: data.id as string,
      pageUrl: data.page_url as string,
      selector: data.selector as string,
      hints: (data.hints as AnchorHints) ?? undefined,
      label: data.label as string,
      authorId: user.id,
      author: displayName(user),
      authorEmail: user.email ?? "",
      // La tarjeta que aparece en la columna es esta misma, sin releer nada de la
      // base: la cara del autor tiene que venir aquí o el comentario recién
      // escrito sería el único de la lista sin ella.
      authorAvatar: userAvatar(user),
      text: data.body as string,
      resolvedAt: (data.resolved_at as string | null) ?? null,
      createdAt: data.created_at as string,
    },
  };
}

/** Borra un comentario. Solo lo dejan pasar quien lo escribió y el dueño. */
export async function deleteComment(id: string, slug: string): Promise<ActionResult> {
  if (!supabaseReady) return { error: "Falta configurar Supabase en el servidor." };

  const user = await getUser();
  if (!user) return { error: "Tu sesión caducó. Vuelve a entrar." };

  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(projectPath(slug));
  return { ok: true };
}

/**
 * Da por resuelto (o reabre) un comentario. Va por función de la base y no por
 * UPDATE: cualquiera que pueda editar debería poder cerrar el comentario de otro
 * sin poder reescribirle el texto, y eso una política de UPDATE no lo separa.
 */
export async function setResolved(
  id: string,
  slug: string,
  resolved: boolean,
): Promise<ActionResult & { resolvedAt?: string | null }> {
  if (!supabaseReady) return { error: "Falta configurar Supabase en el servidor." };

  const user = await getUser();
  if (!user) return { error: "Tu sesión caducó. Vuelve a entrar." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_comment_resolved", {
    p_comment: id,
    p_resolved: resolved,
  });
  if (error) return { error: error.message };

  revalidatePath(projectPath(slug));
  return {
    ok: true,
    resolvedAt: (data as { resolved_at?: string | null } | null)?.resolved_at ?? null,
  };
}
