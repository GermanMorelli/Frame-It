import { avatarFor, type Avatar } from "@/lib/avatar";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { asName } from "@/lib/user";

/**
 * La bandeja: invitaciones que esperan respuesta y avisos de lo que ha pasado.
 *
 * Las dos cosas se leen aquí y no en `lib/projects.ts` porque no son de un
 * proyecto: son de una persona. Un aviso puede hablar de un proyecto en el que
 * todavía no estás —justo el caso de una invitación— y por eso sus dos funciones
 * de la base van en SECURITY DEFINER, filtrando a mano por quien pregunta
 * (migración 0006). Eso también es la razón de que no haya aquí ninguna
 * comprobación de permisos: la que vale está dentro de la base.
 */

/** Lo que puede decir un aviso. La frase la redacta la interfaz, no la base. */
export type NotificationKind = "invite" | "invite_accepted" | "invite_declined" | "mention";

/** Quien provocó el aviso, cuando su cuenta sigue existiendo. */
export type Actor = {
  id: string;
  name: string;
  email: string;
  avatar: Avatar;
};

export type Notification = {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  /** Nulo mientras no se ha mirado la bandeja: es lo que lleva la cuenta. */
  readAt: string | null;
  /** El proyecto del que habla. Null si lo borraron entre medias. */
  projectId: string | null;
  projectName: string;
  projectSlug: string;
  /** El comentario, cuando es una mención: sirve para llevar hasta él. */
  commentId: string | null;
  commentBody: string;
  pageUrl: string;
  actor: Actor | null;
};

/** Una invitación vista desde el lado de quien la recibe. */
export type PendingInvite = {
  id: string;
  projectId: string;
  projectName: string;
  siteHost: string;
  /** Con qué podrá hacer: comentar o solo mirar. */
  role: "editor" | "viewer";
  createdAt: string;
  /** Quién invitó. Null si esa cuenta se dio de baja. */
  inviter: Actor | null;
};

/** Las filas de gente vienen siempre con las mismas seis columnas. */
type ActorRow = {
  id: string | null;
  name: string | null;
  email: string | null;
  style: string | null;
  seed: string | null;
  bg: string | null;
};

function toActor(row: ActorRow): Actor | null {
  if (!row.id) return null;
  return {
    id: row.id,
    // Sin nombre puesto se firma con lo de antes de la arroba, como en el resto.
    name: row.name?.trim() || asName(row.email),
    email: row.email ?? "",
    // Y sin cara elegida sale la de fábrica, que ya es propia de cada cuenta.
    avatar: avatarFor(row.id, row.style, row.seed, row.bg),
  };
}

type InviteRow = {
  id: string;
  project_id: string;
  project_name: string;
  site_host: string;
  role: string;
  created_at: string;
  inviter_id: string | null;
  inviter_name: string | null;
  inviter_email: string | null;
  inviter_avatar_style: string | null;
  inviter_avatar_seed: string | null;
  inviter_avatar_bg: string | null;
};

/** Las invitaciones dirigidas a quien tiene la sesión, sin contestar todavía. */
export async function listMyInvites(): Promise<PendingInvite[]> {
  if (!supabaseReady) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_invites");
  if (error || !data) return [];

  return (data as InviteRow[]).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    siteHost: row.site_host,
    role: row.role === "viewer" ? "viewer" : "editor",
    createdAt: row.created_at,
    inviter: toActor({
      id: row.inviter_id,
      name: row.inviter_name,
      email: row.inviter_email,
      style: row.inviter_avatar_style,
      seed: row.inviter_avatar_seed,
      bg: row.inviter_avatar_bg,
    }),
  }));
}

type NotificationRow = {
  id: string;
  kind: string;
  created_at: string;
  read_at: string | null;
  project_id: string | null;
  project_name: string | null;
  project_slug: string | null;
  comment_id: string | null;
  comment_body: string | null;
  page_url: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_avatar_style: string | null;
  actor_avatar_seed: string | null;
  actor_avatar_bg: string | null;
};

function asKind(value: string): NotificationKind {
  return value === "invite" ||
    value === "invite_accepted" ||
    value === "invite_declined" ||
    value === "mention"
    ? value
    : "mention";
}

/**
 * La bandeja de quien tiene la sesión, lo último primero.
 *
 * El tope va bajo a propósito: esto se pide en todas las pantallas para pintar
 * la banda del carril, y una banda es lo último que debe costar una consulta
 * grande. Lo que no cabe no se pierde —sigue en la tabla—, simplemente no se
 * enseña en una columna de 224px.
 */
export async function listNotifications(limit = 12): Promise<Notification[]> {
  if (!supabaseReady) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_notifications", { p_limit: limit });
  if (error || !data) return [];

  return (data as NotificationRow[]).map((row) => ({
    id: row.id,
    kind: asKind(row.kind),
    createdAt: row.created_at,
    readAt: row.read_at,
    projectId: row.project_id,
    // Un proyecto borrado deja el aviso sin nombre: se dice así en vez de
    // pintar un hueco, que se leería como un fallo de carga.
    projectName: row.project_name ?? "un proyecto que ya no está",
    projectSlug: row.project_slug ?? "",
    commentId: row.comment_id,
    commentBody: row.comment_body ?? "",
    pageUrl: row.page_url ?? "",
    actor: toActor({
      id: row.actor_id,
      name: row.actor_name,
      email: row.actor_email,
      style: row.actor_avatar_style,
      seed: row.actor_avatar_seed,
      bg: row.actor_avatar_bg,
    }),
  }));
}

/** Cuántos avisos sin mirar. Es la cifra que lleva la sección en el carril. */
export function unreadCount(notifications: Notification[]): number {
  return notifications.filter((notification) => notification.readAt === null).length;
}
