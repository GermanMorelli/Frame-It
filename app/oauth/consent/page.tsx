import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import ConsentForm from "@/components/ConsentForm";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { authorizationId, describeScopes, explainOAuth } from "@/lib/oauth";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";
import { BTN_OUTLINE, LINK } from "@/lib/ui";
import { displayHost } from "@/lib/url";
import { displayName, isGuest } from "@/lib/user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dar permiso · Frame It",
  // La dirección de una solicitud lleva su identificador dentro y es de un solo
  // uso: lo que no debe pasar es que acabe en un buscador. Mismo motivo que el
  // enlace de invitado.
  robots: { index: false, follow: false },
};

/**
 * La pantalla de consentimiento del servidor OAuth de Supabase.
 *
 * Aquí llega alguien mandado por Supabase, que a su vez lo manda una aplicación
 * de fuera: quiere un testigo para entrar en Frame It EN NOMBRE de quien está
 * mirando esto. Supabase no tiene pantalla propia para preguntarlo —la ruta se
 * declara en Authentication → OAuth Server, campo Authorization Path—, así que
 * la decisión se toma aquí y en ningún otro sitio.
 *
 * Lo que se dice es lo único que hace que esto sea un consentimiento y no un
 * trámite: quién pide, con qué cuenta entraría, qué se lleva y a dónde vuelve.
 * En ese orden, y antes de los botones.
 *
 * La hechura es la del acceso y la del enlace de invitado: columna estrecha, el
 * logotipo arriba, nada del armazón de la aplicación. Quien abre esto viene de
 * otra parte y va a volver a otra parte; el carril de secciones y la bandeja de
 * avisos aquí serían salidas que invitan a dejar la pregunta sin contestar.
 */
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const params = await searchParams;
  const id = authorizationId(params.authorization_id);
  const user = await getUser();

  // Sin cuenta no hay nada que conceder, y un invitado no tiene cuenta: es una
  // sesión anónima que no es de nadie y a la que no se puede volver
  // (`lib/user.ts`). Los dos van al acceso con la solicitud a cuestas para
  // volver aquí después. A quien no trae sesión ninguna ya lo manda allí el
  // proxy (`proxy.ts`); esto cubre al invitado, que sí la trae.
  if (!user || isGuest(user)) {
    const back = id ? `/oauth/consent?authorization_id=${id}` : "/oauth/consent";
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  if (!supabaseReady) {
    return (
      <Problem title="Falta configurar Supabase">
        Sin credenciales en el servidor no hay con qué contestar esto.
      </Problem>
    );
  }

  // Sin identificador no hay solicitud: o se escribió esta dirección a mano, o
  // el panel tiene la Site URL guardada con barra final y Supabase compuso
  // `//oauth/consent`, que no es esta ruta.
  if (!id) {
    return (
      <Problem title="Aquí no hay ninguna solicitud">
        Esta pantalla solo tiene sentido cuando te trae una aplicación que pide permiso. Empieza
        desde allí.
      </Problem>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);

  if (error || !data) {
    return (
      <Problem title="Esta solicitud ya no vale">
        {error ? explainOAuth(error.message) : "Vuelve a empezar desde la aplicación que te trajo."}
      </Problem>
    );
  }

  // Dos respuestas distintas por el mismo sitio: si esto ya se concedió antes,
  // Supabase no manda los detalles sino la dirección de vuelta con el código ya
  // dentro. Entonces no hay nada que preguntar, y no se pregunta.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const { client, scope, redirect_uri } = data;
  const scopes = describeScopes(scope);

  return (
    <main className="mx-auto flex w-full max-w-page flex-1 items-center justify-center px-6 py-16">
      <Reveal className="w-full max-w-[460px]">
        {/*
          El logotipo es el de Frame It, y el de quien pide no se dibuja en
          ninguna parte aunque la solicitud traiga un `logo_uri`. Dos razones, y
          las dos pesan más que lo bonito: esa imagen la elige quien registró la
          aplicación, así que puede ser la marca de cualquiera —justo en la única
          pantalla donde una marca prestada sirve para algo—, y pedirla a su
          servidor le cuenta a un tercero quién está leyendo esto y cuándo. Quien
          pide se identifica con su nombre y su dominio, en texto.
        */}
        <Logo alt="" className="h-10 w-auto" />

        <p className="label-xs mt-8 text-olive-stone">Te piden permiso</p>
        <h1 className="mt-2 text-heading">{client.name}</h1>
        {client.uri && (
          // A propósito sin enlace: desde una pantalla de consentimiento, un
          // enlace al sitio que eligió quien pide es media suplantación hecha.
          // El dominio se lee y se comprueba; no se pulsa.
          <p className="mt-2 font-mono text-body text-olive-stone">{displayHost(client.uri)}</p>
        )}

        <p className="mt-8 text-body text-olive-stone">
          Quiere entrar en Frame It como{" "}
          <strong className="font-semibold text-midnight-ink">{displayName(user)}</strong>
          {user.email ? ` (${user.email})` : ""}. Si lo permites, podrá:
        </p>

        {scopes.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {scopes.map((s) => (
              <li key={s.id} className="flex gap-3 text-body">
                <span aria-hidden className="text-olive-stone">
                  ·
                </span>
                {s.text ? (
                  <span>{s.text}</span>
                ) : (
                  // Un permiso que aquí no se sabe explicar sale con su nombre
                  // técnico y dicho como lo que es: algo sin traducir, no algo
                  // sin importancia.
                  <span className="text-olive-stone">
                    Un permiso llamado <span className="font-mono text-midnight-ink">{s.id}</span>,
                    que define quien lo pide.
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-body">
            No pide ningún permiso concreto: solo comprobar que tienes cuenta aquí.
          </p>
        )}

        <p className="mt-8 text-caption text-olive-stone">
          Al contestar volverás a{" "}
          <span className="font-mono text-midnight-ink">{displayHost(redirect_uri)}</span>, que es la
          dirección que esa aplicación tiene registrada.
        </p>

        <ConsentForm authorizationId={data.authorization_id} client={client.name} />

        <p className="mt-6 text-caption text-olive-stone">
          Lo que concedas se puede retirar cuando quieras desde{" "}
          <Link href="/cuenta" className={LINK}>
            tu cuenta
          </Link>
          .
        </p>
      </Reveal>
    </main>
  );
}

/**
 * Cuando no hay nada que preguntar: la solicitud no llegó, ya no vale, o el
 * servidor OAuth está apagado. Se dice qué pasó y se ofrece la única salida que
 * hay desde aquí, que es la aplicación: al sitio de quien pedía no se puede
 * mandar a nadie, porque sin una solicitud válida no hay dirección de vuelta que
 * se pueda dar por buena.
 */
function Problem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-page flex-1 items-center justify-center px-6 py-16">
      <Reveal className="w-full max-w-[460px]">
        <Logo alt="" className="h-10 w-auto" />
        <h1 className="mt-8 text-heading">{title}</h1>
        <p className="mt-5 text-subheading text-olive-stone">{children}</p>

        <Link href="/" className={`mt-10 ${BTN_OUTLINE}`}>
          Ir a Frame It
        </Link>
      </Reveal>
    </main>
  );
}
