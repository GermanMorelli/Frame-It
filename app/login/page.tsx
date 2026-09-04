import AuthForm from "@/components/AuthForm";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";
import { supabaseReady } from "@/lib/supabase/config";
import { internalPath } from "@/lib/url";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrar · Frame It" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = internalPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const failureParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const failure = typeof failureParam === "string" ? failureParam : null;

  return (
    <main className="mx-auto flex w-full max-w-page flex-1 items-center justify-center px-6 py-16">
      <Reveal className="w-full max-w-[460px]">
        {/* Aquí el logotipo es el título: la palabra ya está dibujada dentro,
            y repetirla debajo en tipografía de display sería decir el nombre dos
            veces en el primer palmo de la pantalla. El `alt` lo deja siendo un
            encabezado de verdad para quien no ve la imagen. */}
        <h1>
          <Logo className="h-16 w-auto" />
        </h1>
        <p className="mt-8 text-subheading text-olive-stone">
          Comenta el sitio de tu cliente sobre la página misma, y que lo vea todo el equipo.
        </p>

        {supabaseReady ? <AuthForm next={next} failure={failure} /> : <MissingConfig />}
      </Reveal>
    </main>
  );
}

/**
 * Sin credenciales no hay nada que intentar. Se dicen los nombres exactos de las
 * variables para que arrancarlo no requiera buscar en la documentación.
 */
function MissingConfig() {
  return (
    <section className="mt-10 rounded-card bg-peach-wash p-6">
      <h2 className="text-subheading">Falta configurar Supabase</h2>
      <p className="mt-2 text-body">
        Crea un archivo <span className="font-mono text-[15px]">.env.local</span> en la raíz del
        proyecto con las credenciales (Supabase → Project Settings → API) y reinicia{" "}
        <span className="font-mono text-[15px]">npm run dev</span>:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-button bg-paper-white p-4 font-mono text-caption">
        NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co{"\n"}
        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi…
      </pre>
    </section>
  );
}
