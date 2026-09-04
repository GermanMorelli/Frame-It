import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import type { Avatar as AvatarSpec } from "@/lib/avatar";
import { BTN_QUIET, PILL, PILL_ON } from "@/lib/ui";

/** Dónde está el usuario. `proyecto` es estar dentro de uno concreto. */
export type Section = "proyectos" | "cuenta" | "proyecto";

type AppShellProps = {
  active: Section;
  /** Quién está dentro: es el rótulo del acceso a su cuenta. */
  userName: string;
  /** Y su cara, que es lo que se reconoce antes de leer el rótulo. */
  userAvatar: AvatarSpec;
  userEmail?: string;
  children: ReactNode;
};

/**
 * Armazón de las pantallas de gestión: una sola barra arriba y la columna de
 * contenido centrada a 1200px.
 *
 * Antes había una barra lateral de 288px con cuatro secciones, cada una con su
 * subtítulo explicativo. Se fue entera: repetía en cada pantalla lo que solo
 * hace falta en la lista de proyectos, y el chrome ocupaba más sitio que el
 * trabajo. Los filtros de la lista viven ahora en píldoras dentro de la propia
 * lista, que es donde se usan (DESIGN.md: navegación de una sola barra, sin
 * lateral y sin mega-menú).
 */
export default function AppShell({
  active,
  userName,
  userAvatar,
  userEmail,
  children,
}: AppShellProps) {
  return (
    <>
      <header className="border-b border-soft-mist">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-6 py-4">
          {/* El logotipo entero —fichas y palabra— hace de rótulo: la barra ya
              no compone la marca juntando un símbolo con un texto, así que no
              hay dos versiones del nombre que puedan separarse. El enlace lleva
              el `aria-label` y la imagen va muda para no decirlo dos veces. */}
          <Link href="/" aria-label="Frame It — tus proyectos" className="flex items-center">
            <Logo alt="" className="h-7 w-auto" />
          </Link>

          <div className="flex items-center gap-4">
            {/* El nombre y la cara son el acceso a la cuenta: se pulsa poco,
                pero es el único sitio donde se cambia con qué firma uno los
                comentarios. La cara va aquí sin aro de color: en esta pantalla
                no hay ninguna marca sobre un sitio ajeno de la que hablar
                (DESIGN.md). */}
            <Link
              href="/cuenta"
              aria-current={active === "cuenta" ? "page" : undefined}
              title="Tu cuenta"
              className={`${active === "cuenta" ? PILL_ON : PILL} max-w-48 gap-2`}
            >
              <Avatar avatar={userAvatar} name={userName} email={userEmail} size={18} />
              <span className="truncate">{userName}</span>
            </Link>

            {/* Salir se queda en texto a propósito: es raro y no debe estar al
                lado de lo que se pulsa a diario (ley de Fitts, al revés). */}
            <form action={signOut}>
              <button type="submit" className={BTN_QUIET}>
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-12">{children}</main>
    </>
  );
}
