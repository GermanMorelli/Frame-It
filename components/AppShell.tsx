import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import NavRail from "@/components/NavRail";
import UserMenu from "@/components/UserMenu";
import type { Avatar as AvatarSpec } from "@/lib/avatar";

/** Dónde está el usuario. `proyecto` es estar dentro de uno concreto. */
export type Section = "proyectos" | "cuenta" | "proyecto";

type AppShellProps = {
  active: Section;
  /** Quién está dentro: es el rótulo del acceso a su cuenta. */
  userName: string;
  /** Y su cara, que es lo que se reconoce antes de leer el rótulo. */
  userAvatar: AvatarSpec;
  userEmail?: string;
  /**
   * La pantalla se lee de arriba abajo en vez de repartirse por el cristal
   * —cuenta, ajustes de un proyecto—, así que su columna se queda en los 1200px
   * de lectura. Una rejilla, en cambio, quiere el ancho.
   */
  narrow?: boolean;
  children: ReactNode;
};

/**
 * Armazón de las pantallas de gestión: barra fija arriba, carril de secciones a
 * la izquierda y el contenido ocupando lo que queda.
 *
 * Hubo aquí una barra lateral de 288px con cuatro secciones, cada una con su
 * subtítulo, y se quitó por buenas razones: repetía en cada pantalla lo que solo
 * hace falta en la lista, y el chrome ocupaba más sitio que el trabajo. Lo que
 * vuelve no es aquello. Son dos entradas sin descripción en 224px, y vuelven
 * porque lo que se pulsa a diario tiene que estar contra un canto de la pantalla
 * y no moverse: el canto convierte cada fila en un blanco que no se puede
 * sobrepasar, y quedarse quieto convierte la distancia hasta ella en una
 * constante en vez de en algo que depende del scroll (ley de Fitts, DESIGN.md).
 *
 * Esa es también la regla que ordena la barra de arriba. No hay columna centrada
 * en ella: el logotipo empieza en el píxel cero y el perfil termina en el
 * último, con el relleno por dentro de cada uno, porque un blanco a dieciséis
 * píxeles del cristal paga la distancia larga sin cobrar el canto.
 *
 * Lo que el ancho completo no puede hacer es crecer sin tope. En un monitor
 * ancho, el viaje del carril al perfil se mide en miles de píxeles y la ley se
 * da la vuelta, así que el contenido se planta en `max-w-wide` y se centra en
 * lo que sobre. En un portátil de 1440 no sobra nada: la rejilla llega al canto.
 */
export default function AppShell({
  active,
  userName,
  userAvatar,
  userEmail,
  narrow = false,
  children,
}: AppShellProps) {
  return (
    <>
      {/* Por encima del carril (`z-30` sobre `z-20`): los dos están pegados y el
          que manda es el de arriba, del que cuelga el panel del perfil. */}
      <header className="sticky top-0 z-30 border-b border-soft-mist bg-paper-white">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* El logotipo entero —fichas y palabra— hace de rótulo: la barra ya
              no compone la marca juntando un símbolo con un texto, así que no
              hay dos versiones del nombre que puedan separarse. El enlace lleva
              el `aria-label` y la imagen va muda para no decirlo dos veces.

              Ocupa el alto entero de la barra y llega al canto izquierdo, así
              que volver al inicio es el blanco más fácil de la pantalla: 64px de
              alto contra un borde que el puntero no puede pasar de largo. */}
          <Link
            href="/"
            aria-label="Frame It — tus proyectos"
            className="flex h-16 shrink-0 items-center pl-6 pr-5 transition hover:bg-soft-mist"
          >
            <Logo alt="" className="h-7 w-auto" />
          </Link>

          <UserMenu
            name={userName}
            avatar={userAvatar}
            email={userEmail}
            active={active === "cuenta"}
          />
        </div>
      </header>

      {/* En pantalla estrecha el carril se tumba, así que la fila se apila. */}
      <div className="flex flex-1 flex-col md:flex-row">
        <NavRail active={active} />

        {/* `min-w-0` para que la rejilla pueda encoger: sin él, una tarjeta con
            un dominio largo empujaría la columna y sacaría scroll horizontal. */}
        <main className="min-w-0 flex-1">
          <div
            className={`mx-auto w-full px-6 py-10 md:px-8 md:py-12 ${
              narrow ? "max-w-page" : "max-w-wide"
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
