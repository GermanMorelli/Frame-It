import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AvatarForm from "@/components/AvatarForm";
import NameForm from "@/components/NameForm";
import { getUser } from "@/lib/supabase/server";
import { BTN_OUTLINE } from "@/lib/ui";
import { internalPath } from "@/lib/url";
import { displayName, hasName, isGuest, userAvatar } from "@/lib/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu cuenta · Frame It" };

export default async function AccountPage({ searchParams }: PageProps<"/cuenta">) {
  const user = await getUser();
  if (!user) redirect("/login?next=%2Fcuenta");

  // Un invitado no tiene cuenta que ajustar: ni correo con el que invitarle, ni
  // nombre que ponerse —el suyo lo sorteó el servidor al entrar— ni contraseña
  // con la que volver. La raíz le devuelve a su proyecto.
  if (isGuest(user)) redirect("/");

  const params = await searchParams;
  const next = internalPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const puesto = hasName(user);
  const name = displayName(user);

  return (
    <AppShell
      active="cuenta"
      userName={name}
      userAvatar={userAvatar(user)}
      userEmail={user.email}
      narrow
    >
      {/*
        Dos columnas y no una: lo que se escribe —el nombre, el correo con el que
        te invitan— se lee en una columna estrecha, y la cara no se escribe, se
        mira. Sus dos rejillas de ocho, estilo y fondo, quieren el ancho que a un
        campo de texto le sobra, así que se van al lado en vez de quedarse debajo
        empujando el correo fuera de la primera pantalla. Apiladas por debajo de
        `lg`, que ahí no hay hueco al lado y el orden de lectura vuelve a mandar.
      */}
      <div className="grid gap-16 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-x-20">
        <div className="max-w-[460px]">
          <h1 className="text-heading">Tu cuenta</h1>
          <p className="mt-4 text-body text-olive-stone">
            {puesto
              ? "Tu nombre es lo que ve el resto del equipo en cada comentario tuyo."
              : "Tu cuenta todavía no tiene nombre, así que ahora firmas con la parte inicial de tu correo."}
          </p>

          <NameForm current={puesto ? name : ""} next={next} />

          <section className="mt-16">
            <h2 className="label-xs text-olive-stone">Correo</h2>
            <p className="mt-2 font-mono text-body">{user.email}</p>
            <p className="mt-2 text-caption text-olive-stone">
              Es con el que te invitan a los proyectos de otros. No se enseña entero a nadie más.
            </p>
          </section>

          <Link href={next} className={`mt-16 ${BTN_OUTLINE}`}>
            ← Volver
          </Link>
        </div>

        {/* Arranca a la altura del titular, no de la primera línea de texto: la
            columna de al lado es otra cosa, y empezar las dos en el mismo canto
            de arriba es lo que lo dice sin una regla de por medio. */}
        <section className="lg:max-w-[560px]">
          <h2 className="text-subheading">Tu cara</h2>
          <p className="mt-3 text-body text-olive-stone">
            Sale junto a tu nombre en cada comentario. Nadie sube una foto: se dibuja sola a partir
            de tu cuenta, y puedes cambiarla cuando quieras.
          </p>

          <AvatarForm current={userAvatar(user)} name={name} email={user.email ?? ""} />
        </section>
      </div>
    </AppShell>
  );
}
