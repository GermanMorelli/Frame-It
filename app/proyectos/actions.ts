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
  /** Lo que salió bien, cuando la pantalla se queda donde está. */
  notice?: string;
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
 * Cambia el nombre y la página por la que se abre. Quién puede lo decide RLS: la
 * política de cambio de `projects` solo pasa para el dueño, así que aquí no se
 * comprueba el papel a mano —se comprueba que la fila haya vuelto—.
 *
 * El slug no se toca. Se reparte una vez al crear el proyecto y desde entonces
 * es la dirección de esta pantalla: cambiarlo al renombrar rompería los enlaces
 * que ya circulan por ahí —los del panel, los de un correo, los de un aviso— a
 * cambio de nada que se vea.
 */
export async function updateProject(
  _previous: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  const echo: ProjectState = { name, domain };

  const user = await session();
  if (!user) return { ...echo, error: "Tu sesión caducó. Vuelve a entrar." };
  if (!id) return { ...echo, error: "No llegó qué proyecto cambiar." };

  if (name.length < MIN_NAME || name.length > MAX_NAME) {
    return { ...echo, error: `El nombre va entre ${MIN_NAME} y ${MAX_NAME} caracteres.` };
  }

  const startUrl = normalizeDomain(domain);
  if (!startUrl) {
    return { ...echo, error: "Escribe un dominio válido, por ejemplo: ejemplo.com" };
  }

  const supabase = await createClient();
  // El `select` no es para leer: es lo que distingue "cambiado" de "RLS no dejó
  // pasar la fila". Sin él, un UPDATE que no toca nada vuelve sin error y la
  // pantalla diría que guardó algo que no guardó.
  const { data, error } = await supabase
    .from("projects")
    .update({ name, start_url: startUrl, site_host: displayHost(startUrl) })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ...echo, error: explain(error.message) };
  if (!data) return { ...echo, error: "No tienes permiso para cambiar este proyecto." };

  // El nombre y la portada salen también en el panel y en la bandeja de avisos.
  revalidatePath("/");
  revalidatePath(projectPath(slug));
  return { name, domain: startUrl, notice: "Guardado." };
}

/**
 * Borra el proyecto entero, con sus comentarios. Quién puede lo decide RLS: la
 * política de borrado de `projects` solo pasa para el dueño.
 *
 * Y hay que escribir el nombre. La pregunta del navegador que había antes se
 * contesta con la barra espaciadora sin leerla; esto no se puede hacer sin
 * mirar. La comprobación se repite aquí y no solo en el diálogo porque una
 * acción de servidor se puede invocar con un POST a pelo: el candado tiene que
 * estar de este lado.
 */
export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const typed = String(formData.get("name") ?? "").trim();
  const user = await session();
  if (!user || !id) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name, slug").eq("id", id).maybeSingle();
  // Sin fila no hay nada que borrar: o no existe o no se es miembro, y para
  // quien pregunta las dos cosas son la misma.
  if (!data) redirect("/");

  // Mayúsculas y espacios de los lados no cuentan: lo que se comprueba es que
  // se haya escrito el nombre, no que se sepa dónde tiene los acentos el turno.
  if (typed.toLowerCase() !== String(data.name).trim().toLowerCase()) {
    redirect(projectPath(String(data.slug)));
  }

  await supabase.from("projects").delete().eq("id", id);

  revalidatePath("/");
  redirect("/");
}

/**
 * Invita por correo. La invitación queda pendiente siempre: entrar en un
 * proyecto ajeno lo decide quien entra, no quien invita (migración 0006). Lo
 * único que cambia según si esa persona ya tiene cuenta es cuándo se entera —al
 * momento, en su bandeja, o al darse de alta con ese correo.
 */
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
        ? `${email} ya estaba en el proyecto.`
        : data === "notified"
          ? `Invitación mandada a ${email}. Entrará en cuanto la acepte.`
          : `${email} queda invitado. Le aparecerá para aceptar en cuanto cree su cuenta con ese correo.`,
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
