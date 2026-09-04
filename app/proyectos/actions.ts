"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";
import { projectPath } from "@/lib/routes";
import { displayHost, normalizeDomain } from "@/lib/url";

const MIN_NAME = 2;
const MAX_NAME = 80;

export type ProjectState = {
  error?: string;
  /** Lo ya escrito, para no obligar a teclearlo otra vez tras un fallo. */
  name?: string;
  domain?: string;
};

export type TeamState = {
  error?: string;
  notice?: string;
  email?: string;
};

/**
 * Todas las acciones vuelven a comprobar la sesión aunque el proxy ya corte el
 * paso: una acción de servidor se puede invocar con un POST a pelo, sin pasar por
 * la pantalla que la ofrece.
 */
async function session() {
  if (!supabaseReady) return null;
  return getUser();
}

/** Los errores de Postgres llegan en inglés y con el nombre de la restricción. */
function explain(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("solo el dueño")) return message;
  if (text.includes("projects_name_check")) return `El nombre va entre ${MIN_NAME} y ${MAX_NAME} caracteres.`;
  if (text.includes("duplicate key")) return "Ya existe algo con ese valor.";
  if (text.includes("row-level security") || text.includes("permission denied")) {
    return "No tienes permiso para hacer eso en este proyecto.";
  }
  return message;
}

/**
 * Crea un proyecto y lleva a él. El slug lo reparte la base (`unique_slug`): es
 * la única que puede ver si uno ya está cogido por alguien de fuera del equipo.
 */
export async function createProject(
  _previous: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  const echo: ProjectState = { name, domain };

  const user = await session();
  if (!user) return { ...echo, error: "Tu sesión caducó. Vuelve a entrar." };

  if (name.length < MIN_NAME || name.length > MAX_NAME) {
    return { ...echo, error: `El nombre va entre ${MIN_NAME} y ${MAX_NAME} caracteres.` };
  }

  const startUrl = normalizeDomain(domain);
  if (!startUrl) {
    return { ...echo, error: "Escribe un dominio válido, por ejemplo: ejemplo.com" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_project", {
    p_name: name,
    p_start_url: startUrl,
    p_site_host: displayHost(startUrl),
  });

  if (error) return { ...echo, error: explain(error.message) };

  const slug = (data as { slug?: string } | null)?.slug;
  if (!slug) return { ...echo, error: "El proyecto se creó, pero no llegó su dirección." };

  revalidatePath("/");
  // redirect lanza su propia excepción de control: no puede ir dentro de un try.
  redirect(projectPath(slug));
}

/**
 * Borra el proyecto entero, con sus comentarios. Quién puede lo decide RLS: la
 * política de borrado de `projects` solo pasa para el dueño.
 */
export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await session();
  if (!user || !id) redirect("/");

  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", id);

  revalidatePath("/");
  redirect("/");
}

/** Invita por correo. Si esa persona ya tiene cuenta, entra sin pasar por buzón. */
export async function inviteMember(_previous: TeamState, formData: FormData): Promise<TeamState> {
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const role = formData.get("role") === "viewer" ? "viewer" : "editor";
  const echo: TeamState = { email };

  const user = await session();
  if (!user) return { ...echo, error: "Tu sesión caducó. Vuelve a entrar." };
  if (!email.includes("@") || email.length < 5) {
    return { ...echo, error: "Escribe un correo válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_member", {
    p_project: projectId,
    p_email: email,
    p_role: role,
  });

  if (error) return { ...echo, error: explain(error.message) };

  revalidatePath(projectPath(slug));
  return {
    notice:
      data === "member"
        ? `${email} ya tenía cuenta: ahora es parte del proyecto.`
        : `${email} queda invitado. Entrará al proyecto en cuanto cree su cuenta con ese correo.`,
  };
}

/** Saca a alguien del proyecto, o sale uno mismo. Las dos cosas las deja RLS. */
export async function removeMember(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const user = await session();
  if (!user || !projectId || !userId) redirect("/");

  const supabase = await createClient();
  await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  // Quien se sale deja de ver el proyecto: quedarse en su pantalla daría un vacío.
  if (userId === user.id) {
    revalidatePath("/");
    redirect("/");
  }

  revalidatePath(projectPath(slug));
}

/** Retira una invitación que todavía no se ha cobrado. */
export async function cancelInvite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const user = await session();
  if (!user || !id) return;

  const supabase = await createClient();
  await supabase.from("project_invites").delete().eq("id", id);

  revalidatePath(projectPath(slug));
}
