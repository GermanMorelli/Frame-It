import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cancelInvite, deleteProject, removeMember } from "@/app/proyectos/actions";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import DangerButton from "@/components/DangerButton";
import InviteForm from "@/components/InviteForm";
import SiteThumb from "@/components/SiteThumb";
import { washFor } from "@/lib/author-color";
import { groupByPage } from "@/lib/comments";
import { plural, shortDate } from "@/lib/dates";
import {
  getProject,
  listComments,
  listInvites,
  listMembers,
  type ProjectRole,
} from "@/lib/projects";
import { projectPath, workspacePath } from "@/lib/routes";
import { getUser } from "@/lib/supabase/server";
import { BADGE, BTN_SOLID } from "@/lib/ui";
import { displayName, userAvatar } from "@/lib/user";
import { pageLabel } from "@/lib/url";

export const dynamic = "force-dynamic";

/** Cómo se dice cada papel en pantalla. */
const ROLES: Record<ProjectRole, string> = {
  owner: "Dueño",
  editor: "Comenta",
  viewer: "Solo mira",
};

/** El enlace que se estira sobre toda su tarjeta: el blanco es la fila entera. */
const STRETCHED = "after:absolute after:inset-0 after:content-['']";

/**
 * Los ajustes de un proyecto: por dónde se abre, quién está dentro y cómo se
 * borra.
 *
 * Aquí no se leen comentarios. Antes esta pantalla los volcaba todos, uno a uno
 * y con su texto entero, debajo de la página a la que pertenecen: era lo mismo
 * que enseña la barra del espacio de trabajo, pero lejos de la página de la que
 * hablan y sin poder ir a su elemento. Ahora solo se dice cuántos hay en cada
 * página y se abre por ahí, que es lo único que se puede hacer con un comentario
 * desde fuera del sitio.
 */
export default async function ProjectPage({ params }: PageProps<"/proyectos/[slug]">) {
  const { slug } = await params;

  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(projectPath(slug))}`);

  // Null tanto si el proyecto no existe como si existe y no eres miembro: para
  // quien pregunta son la misma cosa, y así el panel no sirve para sondear slugs.
  const project = await getProject(slug);
  if (!project) notFound();

  const owner = project.role === "owner";
  const [members, comments, invites] = await Promise.all([
    listMembers(project.id),
    listComments(project.id),
    owner ? listInvites(project.id) : Promise.resolve([]),
  ]);

  const groups = groupByPage(comments);

  return (
    <AppShell
      active="proyecto"
      userName={displayName(user)}
      userAvatar={userAvatar(user)}
      userEmail={user.email}
    >
      <header>
        <p className="label-xs text-olive-stone">Proyecto</p>
        <h1 className="mt-2 text-heading">{project.name}</h1>
        <p className="mt-2 text-subheading text-olive-stone">{project.siteHost}</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {project.openCount > 0 && (
            <span className="label-xs rounded-button bg-lime-voltage px-2 py-1">
              {project.openCount} sin resolver
            </span>
          )}
          <span className={BADGE}>{plural(project.commentCount, "comentario", "comentarios")}</span>
          <span className={BADGE}>{plural(project.memberCount, "persona", "personas")}</span>
          <span className={BADGE}>Eres {ROLES[project.role].toLowerCase()}</span>
        </div>

        {/* La portada del sitio, y también el blanco más grande de la pantalla:
            va al mismo sitio que el botón de abajo. Enseñarla aquí no es adorno
            —confirma de un vistazo que el proyecto apunta a la página que se
            cree, que es lo que un dominio escrito no llega a decir. */}
        <Link
          href={workspacePath(project.slug, project.startUrl)}
          aria-label={`Abrir ${project.siteHost}`}
          tabIndex={-1}
          className="mt-8 block max-w-[520px] overflow-hidden rounded-card border border-soft-mist transition hover:border-midnight-ink"
        >
          <SiteThumb url={project.startUrl} wash={washFor(project.slug)} width={1200} />
        </Link>

        {/* La acción de siempre, y la única llena de tinta: todo lo que se hace
            de verdad con un proyecto pasa por abrirlo (ley de Fitts). */}
        <Link href={workspacePath(project.slug, project.startUrl)} className={`mt-6 ${BTN_SOLID}`}>
          Abrir espacio de trabajo
        </Link>
        <p
          className="mt-3 truncate font-mono text-caption text-olive-stone"
          title={project.startUrl}
        >
          {project.startUrl}
        </p>
      </header>

      <section className="mt-16">
        <h2 className="text-subheading">Páginas comentadas</h2>

        {groups.length === 0 ? (
          <p className="mt-3 max-w-[60ch] text-body text-olive-stone">
            Todavía ninguna. Abre el espacio de trabajo y haz clic sobre cualquier elemento de la
            página para dejar el primer comentario.
          </p>
        ) : (
          <>
            <p className="mt-3 max-w-[60ch] text-body text-olive-stone">
              Cada una abre el espacio de trabajo por donde están sus comentarios.
            </p>

            <ul className="mt-6 grid gap-2">
              {groups.map((group) => {
                const abiertos = group.comments.filter(
                  (comment) => comment.resolvedAt === null,
                ).length;

                return (
                  <li
                    key={group.pageUrl}
                    className="relative flex items-center justify-between gap-4 rounded-card border border-soft-mist px-4 py-4 transition hover:border-midnight-ink"
                  >
                    <p className="min-w-0 truncate font-mono text-body" title={group.pageUrl}>
                      <Link href={workspacePath(project.slug, group.pageUrl)} className={STRETCHED}>
                        {pageLabel(group.pageUrl)}
                      </Link>
                    </p>
                    <span className="flex shrink-0 items-center gap-2">
                      {abiertos > 0 && (
                        <span className="label-xs rounded-button bg-lime-voltage px-2 py-1">
                          {abiertos} sin resolver
                        </span>
                      )}
                      <span className="label-xs text-olive-stone">
                        {group.comments.length} en total
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-subheading">Equipo</h2>
        <p className="mt-3 max-w-[60ch] text-body text-olive-stone">
          Quien está en el proyecto ve todos sus comentarios, los suyos y los de los demás.
        </p>

        <ul className="mt-6 divide-y divide-soft-mist border-y border-soft-mist">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-4 py-4">
              <span className="flex min-w-0 items-center gap-3">
                {/* Aquí la cara sí lleva aro, y el aro es el color con el que se
                    ve a esta persona sobre la página revisada. Antes eran dos
                    cosas —un cuadradito de color y un nombre—; ahora es una
                    sola que dice quién es y de qué color son sus marcas. */}
                <Avatar
                  avatar={member.avatar}
                  name={member.name}
                  email={member.email}
                  size={32}
                  ring
                />
                <span className="min-w-0">
                  <span className="block truncate text-body">
                    {member.name}
                    {member.userId === user.id && " (tú)"}
                  </span>
                  <span className="label-xs block text-olive-stone">{ROLES[member.role]}</span>
                </span>
              </span>

              {/* Al dueño no se le puede echar: el proyecto se quedaría sin nadie
                  que pueda invitar ni borrarlo. Para eso está borrar el proyecto. */}
              {member.role !== "owner" && (owner || member.userId === user.id) && (
                <form action={removeMember}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <input type="hidden" name="slug" value={project.slug} />
                  <DangerButton
                    confirm={
                      member.userId === user.id
                        ? `¿Salir de «${project.name}»? Dejarás de ver sus comentarios.`
                        : `¿Sacar a ${member.name} de «${project.name}»?`
                    }
                  >
                    {member.userId === user.id ? "Salir" : "Sacar"}
                  </DangerButton>
                </form>
              )}
            </li>
          ))}
        </ul>

        {invites.length > 0 && (
          <div className="mt-8">
            <h3 className="label-xs text-olive-stone">Invitaciones sin cobrar</h3>
            <p className="mt-2 text-caption text-olive-stone">
              Entran al proyecto en cuanto creen su cuenta con ese correo.
            </p>
            <ul className="mt-3 divide-y divide-soft-mist border-y border-soft-mist">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-body">{invite.email}</span>
                    <span className="label-xs block text-olive-stone">
                      {invite.role === "viewer" ? "Solo mira" : "Comenta"} ·{" "}
                      {shortDate(invite.createdAt)}
                    </span>
                  </span>
                  <form action={cancelInvite}>
                    <input type="hidden" name="id" value={invite.id} />
                    <input type="hidden" name="slug" value={project.slug} />
                    <DangerButton confirm={`¿Retirar la invitación de ${invite.email}?`}>
                      Retirar
                    </DangerButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}

        {owner ? (
          <InviteForm projectId={project.id} slug={project.slug} />
        ) : (
          <p className="mt-6 text-caption text-olive-stone">
            Solo quien creó el proyecto puede invitar a más gente.
          </p>
        )}
      </section>

      {owner && (
        // Lo irreversible vive en su propia superficie de aviso: es eso lo que lo
        // separa del resto de la pantalla, no un botón más grande ni más rojo —el
        // sistema no tiene rojo— (DESIGN.md).
        <section className="mt-16 rounded-card bg-peach-wash p-6">
          <h2 className="text-subheading">Borrar el proyecto</h2>
          <p className="mt-2 max-w-[60ch] text-body">
            Se lleva por delante {plural(project.commentCount, "comentario", "comentarios")} y deja
            fuera a {plural(project.memberCount - 1, "persona", "personas")}. No se puede deshacer.
          </p>
          <form action={deleteProject} className="mt-4">
            <input type="hidden" name="id" value={project.id} />
            <DangerButton
              confirm={`¿Borrar «${project.name}» y todos sus comentarios? Esto no se puede deshacer.`}
            >
              Borrar «{project.name}»
            </DangerButton>
          </form>
        </section>
      )}
    </AppShell>
  );
}

export async function generateMetadata({ params }: PageProps<"/proyectos/[slug]">) {
  const { slug } = await params;
  const project = await getProject(slug);
  return {
    title: project ? `${project.name} · Ajustes · Frame It` : "Proyecto · Frame It",
  };
}
