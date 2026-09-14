import Link from "next/link";
import GuestEnterForm from "@/components/GuestEnterForm";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";
import { BTN_OUTLINE } from "@/lib/ui";
import { displayName, isGuest } from "@/lib/user";

export const dynamic = "force-dynamic";

/** El testigo tal y como lo reparte la base: 32 hexadecimales, ni uno más. */
const TOKEN = /^[a-f0-9]{32}$/;

/** Nombre del proyecto y sitio que revisa. Null si el enlace no vale. */
async function linkInfo(token: string): Promise<{ name: string; siteHost: string } | null> {
  if (!supabaseReady || !TOKEN.test(token)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guest_link_info", { p_token: token });
  const row = (data as { project_name: string; site_host: string }[] | null)?.[0];
  if (error || !row) return null;

  return { name: row.project_name, siteHost: row.site_host };
}

/**
 * La pantalla de un enlace de invitado: la única de la aplicación que se abre
 * sin cuenta y sin sesión.
 *
 * Aquí no se pide nada. Se dice a qué proyecto se está entrando —su nombre y el
 * sitio que revisa, que es todo lo que se puede saber sin ser miembro
 * (`guest_link_info`)—, se dice qué va a pasar, y se pone un botón. Lo que hay
 * detrás de ese botón es una cuenta anónima con un nombre y una cara sorteados,
 * y conviene decirlo antes y no después: quien deja un comentario tiene derecho
 * a saber con qué firma.
 *
 * La hechura es la del acceso y la del proyecto que no existe: columna estrecha,
 * el logotipo arriba y el texto centrado en la ventana. No lleva el armazón de la
 * aplicación —ni carril de secciones, ni avisos, ni menú de cuenta— porque nada
 * de eso existe todavía para quien está mirando esto.
 */
export default async function GuestLinkPage({ params }: PageProps<"/invitado/[token]">) {
  const { token } = await params;

  const [link, user] = await Promise.all([linkInfo(token), getUser()]);

  // Un testigo que no lleva a ningún sitio. Se dice lo mismo tanto si el enlace
  // nunca existió como si se retiró hace un minuto: distinguirlos convertiría
  // esta pantalla en una forma de averiguar qué proyectos hay al otro lado.
  if (!link) {
    return (
      <main className="mx-auto flex w-full max-w-page flex-1 items-center justify-center px-6 py-16">
        <Reveal className="w-full max-w-[460px]">
          <Logo alt="" className="h-10 w-auto" />
          <h1 className="mt-8 text-heading">Este enlace ya no vale</h1>
          <p className="mt-5 text-subheading text-olive-stone">
            Puede que se haya retirado, que el proyecto se haya borrado o que la dirección esté mal
            copiada. Pídele otro a quien te lo mandó.
          </p>

          <Link href="/login" className={`mt-10 ${BTN_OUTLINE}`}>
            Entrar con una cuenta
          </Link>
        </Reveal>
      </main>
    );
  }

  // Quien ya tiene sesión no estrena identidad de invitado: entra con su nombre,
  // y la base le deja el papel que ya tuviera en el proyecto. Decirlo aquí evita
  // la sorpresa de firmar como «Bruma Curiosa» teniendo cuenta.
  const identified = user !== null && !isGuest(user);

  return (
    <main className="mx-auto flex w-full max-w-page flex-1 items-center justify-center px-6 py-16">
      <Reveal className="w-full max-w-[460px]">
        <Logo alt="" className="h-10 w-auto" />

        <p className="label-xs mt-8 text-olive-stone">Te invitan a comentar</p>
        <h1 className="mt-2 text-heading">{link.name}</h1>
        <p className="mt-2 font-mono text-body text-olive-stone">{link.siteHost}</p>

        <p className="mt-8 text-body text-olive-stone">
          Se abre el sitio dentro de Frame It y puedes comentar cualquier elemento de cualquiera de
          sus páginas. Lo que dejes lo ve el equipo del proyecto.
        </p>

        {identified ? (
          <p className="mt-4 text-body text-olive-stone">
            Entras con tu cuenta, así que firmarás como{" "}
            <strong className="font-semibold text-midnight-ink">{displayName(user)}</strong>.
          </p>
        ) : (
          <p className="mt-4 text-body text-olive-stone">
            No hace falta cuenta ni contraseña. Se te pone un nombre y una cara al azar —algo como
            «Náufrago Puntual»— y con eso firmas tus comentarios.
          </p>
        )}

        <GuestEnterForm token={token} label={identified ? "Entrar" : "Entrar y comentar"} />

        {!identified && (
          <p className="mt-6 text-caption text-olive-stone">
            Si prefieres firmar con tu nombre,{" "}
            <Link href="/login" className="underline underline-offset-4">
              entra con una cuenta
            </Link>{" "}
            y vuelve a abrir este enlace.
          </p>
        )}
      </Reveal>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<"/invitado/[token]">) {
  const { token } = await params;
  const link = await linkInfo(token);
  return {
    title: link ? `Comentar ${link.name} · Frame It` : "Invitación · Frame It",
    // Un enlace de invitado es una credencial: lo que no debe pasar es que
    // acabe en un buscador y entre por ahí quien no lo recibió.
    robots: { index: false, follow: false },
  };
}
