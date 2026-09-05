import ProjectCard from "@/components/ProjectCard";
import type { Project } from "@/lib/projects";

type ProjectGridProps = {
  projects: Project[];
  /** Quién mira: decide qué proyectos son suyos y cuáles le han compartido. */
  userId: string;
};

/**
 * La rejilla de proyectos: tres columnas de tarjetas, cada una con la portada de
 * su sitio sobre su lavado pastel estable.
 *
 * Aquí no hay más que la rejilla; la tarjeta y su menú viven en `ProjectCard`.
 * Esta separación es la que deja que la lista se siga armando en el servidor —los
 * proyectos se leen con la sesión puesta— mientras solo lo que de verdad necesita
 * un clic derecho viaja al navegador.
 */
export default function ProjectGrid({ projects, userId }: ProjectGridProps) {
  return (
    // La cuarta columna entra a 1536px, que es justo donde el contenido llega a
    // su tope (`max-w-wide`). Sin ella, ensanchar la columna solo engordaría
    // tres tarjetas hasta 520px: lo que se quiere es ver más proyectos de una
    // vez, no tarjetas más grandes.
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} userId={userId} />
      ))}
    </ul>
  );
}
