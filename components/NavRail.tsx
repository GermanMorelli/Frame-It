import Link from "next/link";
import type { Section } from "@/components/AppShell";

/**
 * Los destinos de la aplicación. Son dos, y son los que hay: la lista de
 * proyectos —donde vive todo el trabajo— y la cuenta. Un carril no se rellena
 * con secciones inventadas para que parezca lleno; lo que le da sentido es que
 * el destino de siempre esté a la misma distancia desde cualquier pantalla.
 */
const ITEMS: { href: string; label: string; on: Section[] }[] = [
  // Estar dentro de un proyecto sigue siendo estar en Proyectos: el carril dice
  // en qué parte de la aplicación estás, no en qué URL.
  { href: "/", label: "Proyectos", on: ["proyectos", "proyecto"] },
  { href: "/cuenta", label: "Tu cuenta", on: ["cuenta"] },
];

/**
 * El carril de navegación: la columna fija de la izquierda.
 *
 * Cada entrada llega hasta el canto izquierdo de la ventana. El relleno va
 * dentro del enlace y no en la columna, así que el puntero se detiene contra el
 * cristal y no puede pasarse de largo: un canto es un blanco de ancho infinito,
 * y es la única razón por la que una barra lateral gana a una fila de arriba
 * para lo que se pulsa a diario (ley de Fitts). Cada fila mide 48px de alto por
 * los 224 de la columna, así que el blanco es de sobra alcanzable sin apuntar.
 *
 * Se queda pegada al hacer scroll por lo mismo que la barra de arriba: si la
 * navegación se va con la página, la distancia hasta ella deja de ser una
 * constante y pasa a depender de cuánto se haya bajado.
 *
 * En pantalla estrecha no hay canto izquierdo que aprovechar —no sobra ancho
 * para una columna—, así que la misma lista se tumba en una franja bajo la
 * barra: el mismo orden, los mismos rótulos y el mismo indicador, que baja del
 * costado al pie de cada entrada.
 */
export default function NavRail({ active }: { active: Section }) {
  return (
    <nav
      aria-label="Secciones"
      className="sticky top-16 z-20 shrink-0 self-start border-b border-soft-mist bg-paper-white md:h-[calc(100dvh-4rem)] md:w-56 md:border-b-0 md:border-r"
    >
      <ul className="flex overflow-x-auto md:flex-col md:overflow-x-visible md:py-4">
        {ITEMS.map((item) => {
          const on = item.on.includes(active);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`label relative flex min-h-12 items-center px-6 transition ${
                  on
                    ? "text-midnight-ink"
                    : "text-olive-stone hover:bg-soft-mist hover:text-midnight-ink"
                }`}
              >
                {/* El verde voltaje como indicador de selección, que es para lo
                    que el sistema lo reserva. No se rellena la fila de tinta:
                    224 por 48 de casi negro serían la mancha más grande de una
                    pantalla que es papel, y el carril no es lo importante de
                    ninguna vista (DESIGN.md). */}
                {on && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-1 bg-lime-voltage md:inset-y-0 md:right-auto md:bottom-auto md:h-auto md:w-1"
                  />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
