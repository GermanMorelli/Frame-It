import { avatarFor, type Avatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { supabaseReady } from "@/lib/supabase/config";
import type { AnchorHints, Comment } from "@/lib/comments";
import { asName } from "@/lib/user";

/** viewer lee; editor comenta y responde; owner además invita y borra. */
export type ProjectRole = "owner" | "editor" | "viewer";

/** Un proyecto con sus cuentas, tal y como lo pinta el panel. */
export type Project = {
  id: string;
  name: string;
  /** Trozo de URL con el que se llega al proyecto: /proyectos/<slug>. */
  slug: string;
  siteHost: string;
  /** Página por la que se abre el espacio de trabajo. */
  startUrl: string;
  ownerId: string;
  /** Papel de quien pregunta dentro del proyecto. */
  role: ProjectRole;
  createdAt: string;
  commentCount: number;
  /** Comentarios sin resolver: es la cifra que dice si queda trabajo. */
  openCount: number;
  pageCount: number;
  memberCount: number;
  lastActivity: string;
};

export type Member = {
  userId: string;
  role: ProjectRole;
  name: string;
  email: string;
  avatar: Avatar;
  joinedAt: string;
};

/** Invitación que todavía no se ha cobrado: quien la recibió no tiene cuenta. */
export type Invite = {
  id: string;
  email: string;
  role: Exclude<ProjectRole, "owner">;
  createdAt: string;
};

type SummaryRow = {
  id: string;
  name: string;
  slug: string;
  site_host: string;
  start_url: string;
  owner_id: string;
  role: string | null;
  created_at: string;
  comment_count: number;
  open_count: number;
  page_count: number;
  member_count: number;
  last_activity: string;
};

function asRole(value: string | null | undefined): ProjectRole {
  return value === "owner" || value === "viewer" ? value : "editor";
}

function toProject(row: SummaryRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    siteHost: row.site_host,
    startUrl: row.start_url,
    ownerId: row.owner_id,
    role: asRole(row.role),
    createdAt: row.created_at,
    commentCount: Number(row.comment_count),
    openCount: Number(row.open_count),
    pageCount: Number(row.page_count),
    memberCount: Number(row.member_count),
    lastActivity: row.last_activity,
  };
}

/**
 * Los proyectos de quien tiene la sesión, propios y compartidos, con la actividad
 * más reciente primero. Lo que se ve lo decide RLS, no esta consulta.
 */
export async function listProjects(): Promise<Project[]> {
  if (!supabaseReady) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_summaries", {
    p_slug: null,
  });
  if (error || !data) return [];
  return (data as SummaryRow[]).map(toProject);
}

/** Un proyecto por su slug. Null si no existe o si no se es miembro: para quien
 * pregunta las dos cosas son la misma, y así no se puede sondear qué slugs hay. */
export async function getProject(slug: string): Promise<Project | null> {
  if (!supabaseReady || !slug) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_summaries", {
    p_slug: slug,
  });
  const rows = (data ?? []) as SummaryRow[];
  if (error || rows.length === 0) return null;
  return toProject(rows[0]);
}

export async function listMembers(projectId: string): Promise<Member[]> {
  if (!supabaseReady) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_team", {
    p_project: projectId,
  });
  if (error || !data) return [];

  type Row = {
    user_id: string;
    role: string;
    display_name: string | null;
    email: string | null;
    avatar_style: string | null;
    avatar_seed: string | null;
    avatar_bg: string | null;
    joined_at: string;
  };

  return (data as Row[]).map((row) => ({
    userId: row.user_id,
    role: asRole(row.role),
    // Sin nombre puesto se firma con lo de antes de la arroba, como en el resto.
    name: row.display_name?.trim() || asName(row.email),
    email: row.email ?? "",
    // Y sin cara elegida sale la de fábrica, que ya es propia de cada cuenta.
    avatar: avatarFor(row.user_id, row.avatar_style, row.avatar_seed, row.avatar_bg),
    joinedAt: row.joined_at,
  }));
}

/** Invitaciones pendientes. Solo las ve el dueño: lo dice la política de RLS. */
export async function listInvites(projectId: string): Promise<Invite[]> {
  if (!supabaseReady) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_invites")
    .select("id, email, role, created_at")
    .eq("project_id", projectId)
    .order("created_at");
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: row.role === "viewer" ? "viewer" : "editor",
    createdAt: row.created_at as string,
  }));
}

/** Todos los comentarios del proyecto, de todas sus páginas y de todo el equipo. */
export async function listComments(projectId: string): Promise<Comment[]> {
  if (!supabaseReady) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_comments", {
    p_project: projectId,
  });
  if (error || !data) return [];

  type Row = {
    id: string;
    page_url: string;
    selector: string;
    hints: AnchorHints | null;
    label: string;
    body: string;
    author_id: string;
    author_name: string | null;
    author_email: string | null;
    author_avatar_style: string | null;
    author_avatar_seed: string | null;
    author_avatar_bg: string | null;
    resolved_at: string | null;
    created_at: string;
  };

  return (data as Row[]).map((row) => ({
    id: row.id,
    pageUrl: row.page_url,
    selector: row.selector,
    hints: row.hints ?? undefined,
    label: row.label,
    authorId: row.author_id,
    author: row.author_name?.trim() || asName(row.author_email),
    authorEmail: row.author_email ?? "",
    authorAvatar: avatarFor(
      row.author_id,
      row.author_avatar_style,
      row.author_avatar_seed,
      row.author_avatar_bg,
    ),
    text: row.body,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  }));
}
