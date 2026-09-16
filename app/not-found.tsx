import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { BTN_SOLID } from "@/lib/ui";

export const metadata = { title: "Página no encontrada · Frame It" };

/** Las medidas del recorte. Fijan la proporción y evitan el salto al cargar. */
const PUPPY = { width: 292, height: 531 };

/**
 * El 404 de la aplicación: una dirección que no es ninguna de nuestras pantallas.
 *
 * Aquí se llega por dos caminos distintos que a quien mira le parecen el mismo, y
 * por eso el texto no promete saber cuál fue. Uno es una ruta nuestra que no
 * existe —/proyectos a secas, /invitado sin su testigo, cualquier cosa tecleada
 * de más—. El otro sale del proxy: cuando una petición no encaja en nada y
 * tampoco hay cookie de destino que diga a qué sitio revisado pertenece, `proxy.ts`
 * la deja seguir y termina aquí. Distinguirlos en pantalla exigiría explicar el
 * proxy para que la explicación sirviera de algo.
 *
 * El hermano de esta pantalla es `app/proyectos/[slug]/not-found.tsx`, que
 * contesta a un slug que no lleva a ningún sitio: allí falta un proyecto, aquí
 * una pantalla entera.
 */
export default function NotFound() {
  return (
    <>
      {/*
        La barra de la aplicación con lo único que esta pantalla puede ofrecer.
        El logotipo está exactamente donde está siempre —pegado al canto
        izquierdo, ocupando los 64px de alto de la barra, con el relleno por
        dentro del enlace (`components/AppShell.tsx`)—, y es el mismo blanco por
        la misma razón: un canto no se puede sobrepasar, así que volver al inicio
        es lo más fácil de pulsar de la pantalla (ley de Fitts, DESIGN.md).

        No es `AppShell`: aquel pide sesión, cara y nombre para pintar el perfil
        y el carril, y aquí puede no haber nada de eso —esto se sirve estático—.
        Lo que se repite es la pieza, no el armazón.
      */}
      <header className="flex h-16 items-center border-b border-soft-mist">
        <Link
          href="/"
          aria-label="Frame It — tus proyectos"
          className="flex h-16 shrink-0 items-center pl-6 pr-5 transition hover:bg-soft-mist"
        >
          <Logo alt="" className="h-7 w-auto" />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-page flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Reveal className="w-full max-w-[560px]">
          {/*
            Muda a propósito: no cuenta nada que no digan el encabezado y el
            párrafo, y un lector de pantalla que la describiera solo retrasaría
            la frase que importa. Está recortada contra transparencia y no sobre
            su fondo blanco de estudio, que es lo que la deja caer igual sobre el
            papel y sobre la mesa apagada: un rectángulo blanco sería, con la luz
            quitada, lo más luminoso de la pantalla.
          */}
          <Image
            src="/marca/404/404.webp"
            alt=""
            width={PUPPY.width}
            height={PUPPY.height}
            priority
            className="mx-auto h-[248px] w-auto"
          />

          <h1 className="mt-10 text-balance text-heading">Parece que te has perdido</h1>
          <p className="mt-4 text-subheading">Error 404: Página no encontrada</p>
          <p className="mt-4 text-balance text-body text-olive-stone">
            Esta dirección no existe. Puede que el enlace esté mal copiado, o que lo que había
            aquí ya no exista.
          </p>

          <Link href="/" className={`mt-10 ${BTN_SOLID}`}>
            Regresar
          </Link>
        </Reveal>
      </main>
    </>
  );
}
