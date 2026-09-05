import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import NewProjectForm from "@/components/NewProjectForm";
import NewProjectPanel from "@/components/NewProjectPanel";
import PillSwitch from "@/components/PillSwitch";
import ProjectGrid from "@/components/ProjectGrid";
import StaggerList from "@/components/StaggerList";
import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/supabase/server";
import { LINK } from "@/lib/ui";
import { displayName, hasName, userAvatar } from "@/lib/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Proyectos · Frame It" };

/** Las tres listas que se pueden mirar. Son las píldoras de filtro. */
const VISTAS = {
  todos: { href: "/", label: "Todos", empty: "Todavía no hay ningún proyecto." },
  mios: { href: "/?ver=mios", label: "Tuyos", empty: "Todavía no has creado ninguno." },
  compartidos: {
    href: "/?ver=compartidos",
    label: "Compartidos",
    empty: "Nadie te ha invitado a un proyecto todavía.",
  },
} satisfies Record<string, { href: string; label: string; empty: string }>;

type Vista = keyof typeof VISTAS;

export default async function Home({ searchParams }: PageProps<"/">) {
  // El proxy ya corta el paso sin sesión; esto lo vuelve a comprobar contra
  // Supabase, que es lo que de verdad acredita al usuario.
  const user = await getUser();
  if (!user) redirect("/login?next=%2F");

  const params = await searchParams;
  const asked = Array.isArray(params.ver) ? params.ver[0] : params.ver;
  const vista: Vista = asked === "mios" || asked === "compartidos" ? asked : "todos";

  const all = await listProjects();
  const projects =
    vista === "mios"
      ? all.filter((project) => project.ownerId === user.id)
      : vista === "compartidos"
        ? all.filter((project) => project.ownerId !== user.id)
        : all;

  // Sin nada creado, dar de alta es lo único que hay que hacer aquí: el
  // formulario es la pantalla, no un panel que haya que ir a buscar.
  if (all.length === 0) {
    return (
      <AppShell
        active="proyectos"
        userName={displayName(user)}
        userAvatar={userAvatar(user)}
        userEmail={user.email}
        narrow
      >
        <div className="max-w-[460px] py-8">
          <h1 className="text-heading">Tu primer proyecto</h1>
          <p className="mt-4 text-body text-olive-stone">
            Dinos qué sitio vas a revisar. Se abrirá dentro de Frame It y podrás comentar cualquier
            elemento de cualquiera de sus páginas.
          </p>
          <NewProjectForm autoFocus />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      active="proyectos"
      userName={displayName(user)}
      userAvatar={userAvatar(user)}
      userEmail={user.email}
    >
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-heading">Proyectos</h1>
          <p className="mt-4 max-w-[52ch] text-body text-olive-stone">
            Cada proyecto es un sitio que revisas: sus páginas y lo que el equipo ha comentado sobre
            ellas.
          </p>
        </div>

        <NewProjectPanel />
      </header>

      {!hasName(user) && (
        <p className="mt-10 rounded-card bg-peach-wash px-4 py-3 text-body">
          Firmas como <strong className="font-semibold">{displayName(user)}</strong> porque tu
          cuenta no tiene nombre.{" "}
          <Link href="/cuenta" className={LINK}>
            Ponle uno
          </Link>
          .
        </p>
      )}

      {/* El landmark es del `nav`; la fila de píldoras solo se pinta a sí misma
          y mueve la tinta encendida de una a otra al cambiar de lista. */}
      <nav aria-label="Filtrar proyectos">
        <PillSwitch
          options={Object.entries(VISTAS).map(([key, item]) => ({
            key,
            label: item.label,
            href: item.href,
          }))}
          active={vista}
          className="mt-10"
        />
      </nav>

      <div className="mt-6">
        {projects.length === 0 ? (
          <p className="text-body text-olive-stone">{VISTAS[vista].empty}</p>
        ) : (
          // La rejilla sigue pintándose en el servidor: esto la envuelve para
          // que la lista se presente al llegar y, sobre todo, al cambiar de
          // filtro —dos listas parecidas no se distinguirían de otra forma.
          <StaggerList replay={vista}>
            <ProjectGrid projects={projects} userId={user.id} />
          </StaggerList>
        )}
      </div>
    </AppShell>
  );
}
