import Link from "next/link";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";
import { BTN_SOLID } from "@/lib/ui";

export const metadata = { title: "Proyecto no encontrado · Frame It" };

/**
 * Un slug que no lleva a ningún sitio. Se dice lo mismo tanto si el proyecto no
 * existe como si existe y no eres de él: distinguirlos convertiría esta pantalla
 * en una forma de averiguar qué proyectos tienen los demás.
 */
export default function ProjectNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-page flex-1 items-center justify-center px-6 py-16">
      <Reveal className="w-full max-w-[460px]">
        {/* Muda: el encabezado que viene debajo es el que dice de qué va la
            pantalla, y el logotipo aquí solo firma de quién es. */}
        <Logo alt="" className="h-10 w-auto" />
        <h1 className="mt-8 text-heading">Aquí no hay proyecto</h1>
        <p className="mt-5 text-subheading text-olive-stone">
          Esa dirección no lleva a ninguno de los tuyos. Puede que se haya borrado, que el enlace
          esté mal copiado, o que nadie te haya invitado todavía.
        </p>

        <Link href="/" className={`mt-10 ${BTN_SOLID}`}>
          Ver tus proyectos
        </Link>
      </Reveal>
    </main>
  );
}
