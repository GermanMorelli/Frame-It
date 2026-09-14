"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkCredentials, claimGuest, type AuthField } from "@/lib/account";
import { guestAvatar, guestName } from "@/lib/guest";
import { workspacePath } from "@/lib/routes";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { internalPath } from "@/lib/url";
import { AVATAR_BG, AVATAR_SEED, AVATAR_STYLE, DISPLAY_NAME, isGuest } from "@/lib/user";

export type GuestState = { error?: string };

/** El testigo tal y como lo reparte la base: 32 hexadecimales, ni uno más. */
const TOKEN = /^[a-f0-9]{32}$/;

/**
 * Los errores de Supabase que un invitado puede provocar, dichos en castellano.
 * El primero es el que se va a ver en una instalación recién puesta: las altas
 * anónimas vienen apagadas de fábrica y hay que encenderlas en el panel.
 */
function explain(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("anonymous") && (text.includes("disabled") || text.includes("not enabled"))) {
    return "El proyecto de Supabase tiene las altas anónimas desactivadas, así que este enlace no puede abrirse. Enciéndelas en Authentication → Sign In / Providers.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Demasiadas entradas seguidas desde aquí. Espera un momento y vuelve a probar.";
  }
  if (text.includes("captcha")) {
    return "El proyecto de Supabase pide captcha para las altas, y esta pantalla no lo tiene puesto.";
  }
  return message;
}

/**
 * Entrar en un proyecto por un enlace de invitado.
 *
 * Son dos pasos y ninguno se puede saltar: primero se le da una identidad a
 * quien llega —una cuenta anónima de Supabase con su nombre y su cara sorteados
 * (`lib/guest.ts`)—, y después esa identidad se hace miembro del proyecto con
 * `join_as_guest`, que es quien comprueba el testigo. El orden importa: la
 * función de la base mira `auth.uid()`, así que sin sesión no hay a quién meter.
 *
 * Que esto lo haga un clic y no la propia carga de la página tampoco es un
 * detalle: cada visita crea una cuenta, y las vistas previas de enlaces de
 * WhatsApp, Slack o un correo abren la dirección por su cuenta. Sin el clic, un
 * enlace pegado en un chat de veinte personas dejaría veinte invitados dentro
 * antes de que nadie lo hubiera abierto.
 *
 * Quien ya tenga sesión —el dueño probando su propio enlace, un compañero que lo
 * recibió de rebote— no estrena identidad: entra con la suya, y la base le deja
 * el papel que ya tuviera (migración 0007).
 */
export async function enterAsGuest(
  _previous: GuestState,
  formData: FormData,
): Promise<GuestState> {
  const token = String(formData.get("token") ?? "");

  if (!supabaseReady) return { error: "Falta configurar Supabase en el servidor." };
  if (!TOKEN.test(token)) return { error: "Ese enlace no es válido." };

  // Un solo cliente para las dos cosas, y es obligado: el alta deja la sesión
  // dentro de esta instancia, y pedir otra leería las cookies de la petición,
  // que todavía son las de antes de entrar.
  const supabase = await createClient();
  const { data: current } = await supabase.auth.getUser();

  if (!current.user) {
    const avatar = guestAvatar();
    const { error } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          // Las cuatro llaves de siempre: el disparador del alta las copia a
          // `profiles`, que es de donde las leen los demás miembros.
          [DISPLAY_NAME]: guestName(),
          [AVATAR_STYLE]: avatar.style,
          [AVATAR_SEED]: avatar.seed,
          [AVATAR_BG]: avatar.bg,
        },
      },
    });
    if (error) return { error: explain(error.message) };
  }

  const { data, error } = await supabase.rpc("join_as_guest", { p_token: token });
  if (error) return { error: explain(error.message) };

  const project = (data as { slug: string; start_url: string }[] | null)?.[0];
  if (!project) return { error: "Ese enlace ya no vale. Pídele otro a quien te lo mandó." };

  // Las pantallas leen la sesión en el servidor: sin esto seguirían viendo la
  // anterior, que era ninguna.
  revalidatePath("/", "layout");
  // Directo a la página por la que se abre el proyecto: un invitado no viene a
  // ver un panel, viene a comentar el sitio. `redirect` lanza su propia
  // excepción de control, así que no puede ir dentro de un try.
  redirect(workspacePath(project.slug, project.start_url));
}

/** Lo que devuelve el alta desde la barra de comentarios. */
export type ClaimState = {
  error?: string;
  /** Qué campo hay que corregir: el formulario marca ese y no otro. */
  field?: AuthField;
  /** Salió bien y hace falta confirmar el correo: se dice sin perder la página. */
  notice?: string;
  /** Lo ya escrito, para no teclearlo otra vez tras un fallo. La contraseña no. */
  name?: string;
  email?: string;
};

/**
 * Quedarse con la cuenta desde la propia barra de comentarios.
 *
 * Es la misma operación que hace el acceso cuando quien lo abre es un invitado
 * (`lib/account.ts`), y está aquí además de allí por dónde ocurre: quien está
 * comentando no debería tener que salir del proyecto —perdiendo la página del
 * sitio que tenía cargada, el paso del formulario en el que estaba y lo que
 * llevara escrito— para ponerle correo a su cuenta. La decisión de quedarse
 * llega justo después de comentar, y ahí es donde tiene que estar el formulario.
 *
 * No redirige a ninguna parte: se revalida y la propia barra vuelve a pintarse
 * ya sin el cartel de invitado. Lo único que cambia de sitio es el correo de
 * confirmación, si el proyecto de Supabase lo pide, y eso se dice aquí mismo.
 */
export async function claimGuestAccount(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = internalPath(formData.get("next"));
  const echo: ClaimState = { name, email };

  if (!supabaseReady) return { ...echo, error: "Falta configurar Supabase en el servidor." };

  const wrong = checkCredentials({ email, password, name });
  if (wrong) return { ...echo, ...wrong };

  const supabase = await createClient();
  const { data: current } = await supabase.auth.getUser();

  // Sin sesión no hay nada que reclamar, y con una cuenta de verdad tampoco:
  // esto solo convierte al anónimo en quien ya era. El formulario no se le
  // ofrece a nadie más, así que llegar aquí es que la sesión cambió por debajo.
  if (!current.user) return { ...echo, error: "Se perdió la sesión. Vuelve a abrir el enlace." };
  if (!isGuest(current.user)) return { ...echo, error: "Esta sesión ya tiene cuenta." };

  const claimed = await claimGuest(supabase, { name, email, password, next });
  if (claimed.error) return { ...echo, error: claimed.error, field: claimed.field };

  // La barra lee la sesión en el servidor: sin esto seguiría diciendo «Invitado»
  // y firmando con el nombre sorteado hasta la siguiente recarga a mano.
  revalidatePath("/", "layout");

  return claimed.confirming
    ? {
        notice: `Listo. Te enviamos un correo a ${email}: ábrelo para confirmar la cuenta. Lo que has comentado ya es tuyo.`,
      }
    : { notice: "Listo. Lo que has comentado ya es tuyo." };
}
