import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AvatarForm from "@/components/AvatarForm";
import NameForm from "@/components/NameForm";
import { getUser } from "@/lib/supabase/server";
import { BTN_OUTLINE } from "@/lib/ui";
import { internalPath } from "@/lib/url";
import { displayName, hasName, userAvatar } from "@/lib/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu cuenta · Frame It" };

export default async function AccountPage({ searchParams }: PageProps<"/cuenta">) {
  const user = await getUser();
  if (!user) redirect("/login?next=%2Fcuenta");

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
      <div className="max-w-[460px]">
        <h1 className="text-heading">Tu cuenta</h1>
        <p className="mt-4 text-body text-olive-stone">
          {puesto
            ? "Tu nombre es lo que ve el resto del equipo en cada comentario tuyo."
            : "Tu cuenta todavía no tiene nombre, así que ahora firmas con la parte inicial de tu correo."}
        </p>

        <NameForm current={puesto ? name : ""} next={next} />

        <section className="mt-16">
          <h2 className="text-subheading">Tu cara</h2>
          <p className="mt-3 text-body text-olive-stone">
            Sale junto a tu nombre en cada comentario. Nadie sube una foto: se dibuja sola a partir
            de tu cuenta, y puedes cambiarla cuando quieras.
          </p>

          <AvatarForm current={userAvatar(user)} name={name} email={user.email ?? ""} />
        </section>

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
    </AppShell>
  );
}
