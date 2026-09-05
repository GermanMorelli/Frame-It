import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import InviteList from "@/components/InviteList";
import { listMyInvites } from "@/lib/notifications";
import { getUser } from "@/lib/supabase/server";
import { displayName, userAvatar } from "@/lib/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invitaciones · Frame It" };

/**
 * Las invitaciones que esperan respuesta.
 *
 * Esta pantalla existe porque invitar dejó de meter a nadie en ningún sitio
 * (migración 0006). Antes, a quien ya tenía cuenta le aparecía el proyecto en el
 * panel sin más, mezclado con los suyos y firmando dentro con su nombre. Ahora
 * hay una puerta, y esto es el picaporte por dentro.
 *
 * La lista se lee otra vez aquí y no se hereda del armazón, que ya la pidió para
 * la cuenta del carril. Son dos consultas en la misma petición, y es lo correcto:
 * el armazón necesita cuántas hay y esta pantalla necesita cuáles son, y atarlas
 * obligaría a que todas las pantallas cargasen con lo que solo usa una.
 */
export default async function InvitacionesPage() {
  // El proxy ya corta el paso sin sesión; esto lo vuelve a comprobar contra
  // Supabase, que es lo que de verdad acredita al usuario.
  const user = await getUser();
  if (!user) redirect("/login?next=%2Finvitaciones");

  const invites = await listMyInvites();

  return (
    // Sin `narrow`, que es lo que usa Proyectos. Los dos anchos se centran en lo
    // que sobra, así que una pantalla en la columna de 1200 y otra en la de 1600
    // empiezan en píxeles distintos: al saltar del carril de una a la otra, el
    // titular daba un brinco lateral. Lo que pide la columna estrecha es el
    // texto largo, y aquí no hay: hay una lista, y la lista se planta sola.
    <AppShell
      active="invitaciones"
      userName={displayName(user)}
      userAvatar={userAvatar(user)}
      userEmail={user.email}
    >
      {/* El mismo titular que Proyectos, con la misma hechura: la fila que se
          reparte a lo ancho, el nombre de la sección y debajo la línea que dice
          de qué van las cosas que hay en ella. Las dos secciones del carril se
          abren igual porque son lo mismo —una lista de sitios ajenos— y una que
          se titulara distinto se leería como otra parte de la aplicación.

          Aquí la fila no lleva nada a la derecha: en Proyectos ese hueco es el
          botón de crear uno, y las invitaciones no se crean desde dentro, llegan.
          El titular va tenga la bandeja algo o no: es lo que dice dónde está
          quien acaba de llegar sin tener que volver a mirar el carril. */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-heading">Invitaciones</h1>
          <p className="mt-4 max-w-[52ch] text-body text-olive-stone">
            Cuando alguien te invite a un proyecto, lo verás aquí.
          </p>
        </div>
      </header>

      <InviteList invites={invites} />
    </AppShell>
  );
}
