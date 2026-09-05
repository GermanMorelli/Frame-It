import Link from "next/link";
import { LayoutGrid, Mail, type LucideIcon } from "lucide-react";
import type { Section } from "@/components/AppShell";
import NotificationBand from "@/components/NotificationBand";
import type { Notification } from "@/lib/notifications";

/**
 * Los destinos de la aplicación. Son dos: la lista de proyectos, donde vive todo
 * el trabajo, y las invitaciones, que son lo único que otra persona puede poner
 * en tu pantalla sin que tú hagas nada. Un carril no se rellena con secciones
 * inventadas para que parezca lleno; lo que le da sentido es que el destino de
 * siempre esté a la misma distancia desde cualquier pantalla.
 *
 * Aquí hubo también una entrada de cuenta, y se fue porque estaba dos veces: el
 * menú del perfil, arriba a la derecha, ya lleva a los ajustes y a salir. Dos
 * caminos a lo mismo en la misma pantalla no son el doble de fácil, son una
 * decisión de más antes de pulsar.
 *
 * Cada destino lleva su icono, y los dos son de la misma familia: contorno de
 * trazo fino, sin relleno, dibujados sobre la misma retícula. Es la única forma
 * de que dos iconos se lean como un juego y no como dos dibujos: lo que los
 * hermana no es el tema, es el grosor de la línea.
 *
 * La rejilla dice «tus proyectos» porque es literalmente lo que hay al otro
 * lado, la misma retícula de tarjetas; el sobre dice «invitaciones» porque una
 * invitación es lo único de la aplicación que alguien te manda. Ninguno de los
 * dos intenta ser ingenioso: un icono de navegación se reconoce de reojo o no
 * sirve para nada.
 */
const ITEMS: { href: string; label: string; icon: LucideIcon; on: Section[] }[] = [
  // Estar dentro de un proyecto sigue siendo estar en Proyectos: el carril dice
  // en qué parte de la aplicación estás, no en qué URL.
  { href: "/", label: "Proyectos", icon: LayoutGrid, on: ["proyectos", "proyecto"] },
  { href: "/invitaciones", label: "Invitaciones", icon: Mail, on: ["invitaciones"] },
];

type NavRailProps = {
  active: Section;
  /** Cuántas esperan respuesta. Es la cifra que lleva la sección. */
  pendingInvites: number;
  notifications: Notification[];
};

/**
 * El carril de navegación: la columna fija de la izquierda.
 *
 * Arriba se navega y abajo se mira lo que ha pasado. Las dos mitades no son lo
 * mismo y por eso están separadas por una regla: la de arriba es donde se decide
 * ir a un sitio, y la de abajo es donde se entera uno de que hay un sitio al que
 * ir. La segunda ocupa lo que sobre, que en una pantalla de portátil es casi
 * todo: una bandeja que solo enseña dos filas obliga a hacer scroll para saber
 * si hay una tercera, y entonces ya no es una banda, es un panel encogido.
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
 * costado al pie de cada entrada. La banda no baja con ella y se queda oculta,
 * por lo que explica `NotificationBand`.
 */
export default function NavRail({ active, pendingInvites, notifications }: NavRailProps) {
  return (
    <nav
      aria-label="Secciones"
      className="sticky top-16 z-20 shrink-0 self-start border-b border-soft-mist bg-paper-white md:flex md:h-[calc(100dvh-4rem)] md:w-56 md:flex-col md:border-b-0 md:border-r"
    >
      <ul className="flex overflow-x-auto md:flex-col md:overflow-x-visible md:py-4">
        {ITEMS.map((item) => {
          const on = item.on.includes(active);
          const Icon = item.icon;
          const waiting = item.href === "/invitaciones" ? pendingInvites : 0;

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`label relative flex min-h-12 items-center gap-2 px-6 transition ${
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

                {/* Dieciocho píxeles y trazo de 1.5: al lado de un rótulo de
                    interfaz, un icono más gordo pesa más que la palabra que
                    acompaña, y el carril no es lo importante de ninguna vista.
                    Va mudo —el rótulo está ahí mismo— y hereda el color, así que
                    apagado es piedra de oliva y encendido es tinta, sin una
                    segunda regla que mantener. */}
                <Icon aria-hidden size={18} strokeWidth={1.5} className="shrink-0" />

                <span className="flex-1">{item.label}</span>

                {/* La cuenta va en el mismo disco verde con que se numeran los
                    comentarios: en esta aplicación un disco de verde voltaje
                    significa siempre lo mismo, que es «esto te queda por hacer».
                    Sin invitaciones no hay disco: un cero no es un aviso. */}
                {waiting > 0 && (
                  <span
                    aria-label={`${waiting} sin contestar`}
                    className="label-xs flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-voltage text-midnight-ink"
                  >
                    {waiting}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <NotificationBand notifications={notifications} />
    </nav>
  );
}
