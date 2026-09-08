import { notFound, redirect } from "next/navigation";
import Workspace from "@/components/Workspace";
import { getProject, listComments, listMembers } from "@/lib/projects";
import { workspacePath } from "@/lib/routes";
import { getUser } from "@/lib/supabase/server";
import { displayHost, normalizeDomain } from "@/lib/url";
import { displayName, userAvatar } from "@/lib/user";

export const dynamic = "force-dynamic";

/** La página por la que se abre: la pedida, y si no vale, la del proyecto. */
function target(project: { startUrl: string }, url: string | string[] | undefined) {
  return normalizeDomain(Array.isArray(url) ? url[0] : url) ?? project.startUrl;
}

export default async function WorkspacePage({
  params,
  searchParams,
}: PageProps<"/proyectos/[slug]/vista">) {
  const { slug } = await params;
  const { url } = await searchParams;

  // El proxy ya corta el paso sin sesión; esto lo vuelve a comprobar contra
  // Supabase, que es lo que de verdad acredita al usuario.
  const user = await getUser();
  if (!user) {
    const asked = Array.isArray(url) ? url[0] : url;
    redirect(`/login?next=${encodeURIComponent(workspacePath(slug, asked))}`);
  }

  // Null tanto si el proyecto no existe como si no eres miembro: son lo mismo
  // desde fuera, y así esta pantalla no sirve para averiguar qué slugs hay.
  const project = await getProject(slug);
  if (!project) notFound();

  const page = target(project, url);
  // El equipo va con los comentarios porque la columna lo necesita para las
  // menciones: la lista de la arroba tiene que estar puesta antes de que se
  // escriba la arroba, y pedirla entonces sería una espera a mitad de frase.
  const [comments, members] = await Promise.all([
    listComments(project.id),
    listMembers(project.id),
  ]);

  return (
    <Workspace
      project={{ id: project.id, name: project.name, slug: project.slug }}
      url={page}
      initialComments={comments}
      userId={user.id}
      userName={displayName(user)}
      userAvatar={userAvatar(user)}
      userEmail={user.email ?? ""}
      canEdit={project.role !== "viewer"}
      // Dar por resuelto es del equipo: cerrar el comentario de otro es un
      // juicio sobre el trabajo, y quien entró por un enlace de invitado no lo
      // hace. La base tampoco le dejaría (`set_comment_resolved`, migración
      // 0007); esto es para no ofrecerle un botón que va a fallar.
      canResolve={project.role === "owner" || project.role === "editor"}
      isOwner={project.role === "owner"}
      // Y para no ofrecerle tampoco lo que hay fuera de esta pantalla: un
      // invitado no tiene panel de proyectos ni cuenta que ajustar.
      isGuest={project.role === "guest"}
      // Sin uno mismo: mencionarse sería escribirse un aviso a la propia
      // bandeja, y la base tampoco lo mandaría.
      members={members.filter((member) => member.userId !== user.id)}
    />
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/proyectos/[slug]/vista">) {
  const { slug } = await params;
  const { url } = await searchParams;
  const project = await getProject(slug);
  if (!project) return { title: "Frame It" };
  const page = target(project, url);
  return { title: `${displayHost(page)} · ${project.name} · Frame It` };
}
