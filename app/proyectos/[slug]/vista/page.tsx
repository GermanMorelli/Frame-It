import { notFound, redirect } from "next/navigation";
import Workspace from "@/components/Workspace";
import { getProject, listComments } from "@/lib/projects";
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
  const comments = await listComments(project.id);

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
      isOwner={project.role === "owner"}
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
