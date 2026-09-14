import type { SupabaseClient } from "@supabase/supabase-js";
import { requestOrigin } from "@/lib/origin";
import { DISPLAY_NAME } from "@/lib/user";

/**
 * Lo que comparten las dos formas de acabar con una cuenta: el alta normal
 * (`app/login/actions.ts`) y la de quien ya estaba dentro comentando como
 * invitado (`app/invitado/actions.ts`, y el mismo formulario del acceso).
 *
 * Vive aparte porque si no vivirían dos veces las mismas reglas —cuántos
 * caracteres tiene una contraseña, qué dice Supabase cuando el correo ya está
 * cogido— y el día que una cambiara, la otra pantalla seguiría diciendo lo de
 * antes. Aquí están las reglas y ahí quedan los formularios.
 */

/** Qué campo señala el error. El formulario sacude ese y no otro. */
export type AuthField = "name" | "email" | "password" | "confirm";

export const MIN_PASSWORD = 8;
export const MIN_NAME = 2;
export const MAX_NAME = 60;

/**
 * Los mensajes de Supabase vienen en inglés y en su jerga. Se traducen los que un
 * usuario puede provocar; el resto se muestra tal cual, que decir "algo falló" a
 * secas deja a cualquiera sin saber qué hacer.
 *
 * Cada uno dice además a qué campo mira, para que el formulario sacuda el que
 * hay que corregir. Lo que no se sabe atribuir se queda en el correo, que es el
 * primero del formulario y desde donde se recorre el resto.
 */
export function explain(message: string): { error: string; field: AuthField } {
  const text = message.toLowerCase();
  const at = (error: string, field: AuthField = "email") => ({ error, field });

  if (text.includes("invalid login credentials")) return at("Correo o contraseña incorrectos.");
  if (text.includes("email not confirmed")) return at("Confirma el correo antes de entrar.");
  if (
    text.includes("already registered") ||
    text.includes("already been registered") ||
    text.includes("already exists") ||
    text.includes("email_exists")
  ) {
    return at("Ya hay una cuenta con ese correo. Entra en su lugar.");
  }
  if (text.includes("signups not allowed")) {
    return at("El proyecto de Supabase tiene el alta desactivada.");
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return at("Demasiados intentos seguidos. Espera un momento y vuelve a probar.");
  }
  if (text.includes("password")) return at(`Contraseña no válida: ${message}`, "password");
  return at(`No se pudo completar: ${message}`);
}

/**
 * Lo que hay que corregir antes de molestar a Supabase.
 *
 * `name` y `confirm` se comprueban solo si se mandan: al entrar no hay ninguno
 * de los dos, y al crear cuenta —desde el acceso o desde la barra de
 * comentarios— van los dos. `undefined` quiere decir «este formulario no lo
 * pide», no «llegó vacío».
 *
 * Se comprueba en el servidor y no solo en el navegador porque estas acciones
 * son una entrada pública: no pueden fiarse de que el formulario haya hecho su
 * parte.
 */
export function checkCredentials(input: {
  email: string;
  password: string;
  name?: string;
  confirm?: string;
}): { error: string; field: AuthField } | null {
  const { email, password, name, confirm } = input;

  if (name !== undefined && (name.length < MIN_NAME || name.length > MAX_NAME)) {
    return {
      field: "name",
      error: `Escribe tu nombre (entre ${MIN_NAME} y ${MAX_NAME} caracteres).`,
    };
  }
  if (!email.includes("@") || email.length < 5) {
    return { field: "email", error: "Escribe un correo válido." };
  }
  if (password.length < MIN_PASSWORD) {
    return {
      field: "password",
      error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`,
    };
  }
  // Escribirla dos veces es lo que convierte un dedo torcido en un aviso y no en
  // una cuenta con una contraseña que nadie sabe.
  if (confirm !== undefined && confirm !== password) {
    return { field: "confirm", error: "Las dos contraseñas no coinciden." };
  }
  return null;
}

/** Cómo acabó el intento de quedarse con la cuenta de invitado. */
export type ClaimResult = {
  error?: string;
  field?: AuthField;
  /**
   * El correo está puesto pero todavía sin confirmar: la cuenta existe y la
   * contraseña ya vale, pero hasta que se abra el enlace del correo se sigue
   * firmando como invitado. Es lo que hay que decirle a quien acaba de darse de
   * alta, y lo único que distingue un proyecto de Supabase con confirmación de
   * uno sin ella.
   */
  confirming?: boolean;
};

/**
 * Convierte al invitado en dueño de su cuenta sin cambiarlo de persona.
 *
 * Esta es la pieza entera, y lo que la hace valer es lo que NO hace: no crea una
 * cuenta nueva. Un alta normal (`signUp`) daría otra fila de `auth.users`, con
 * otro identificador, y los comentarios firmados hasta ese momento seguirían
 * siendo del invitado —que además ya no tendría sesión con la que volver—. Lo
 * que se hace es ponerle correo y contraseña a la cuenta anónima que ya está
 * dentro: mismo `auth.users.id`, mismas filas de `comments.author_id`, misma
 * pertenencia al proyecto. Lo comentado pasa a ser suyo porque nunca dejó de
 * serlo; lo que cambia es que ahora puede volver a esa identidad.
 *
 * El nombre viaja en la metadata como en cualquier alta, y el disparador de 0002
 * lo copia a `profiles`: el comentario que firmaba «Náufrago Puntual» pasa a
 * firmar con su nombre en cuanto esto vuelve, también para el resto del equipo.
 * La cara sorteada se la queda —ya es la suya en esa conversación—, y puede
 * cambiarla en su cuenta como cualquiera.
 *
 * Las dos cosas van en una sola llamada a propósito: `updateUser` aplica la
 * contraseña en el acto y deja el correo pendiente de confirmar si el proyecto
 * de Supabase lo pide, y pedir la contraseña por separado para una cuenta que
 * todavía no tiene correo es justo el caso que GoTrue puede rechazar.
 */
export async function claimGuest(
  supabase: SupabaseClient,
  { name, email, password, next }: { name: string; email: string; password: string; next: string },
): Promise<ClaimResult> {
  const { data, error } = await supabase.auth.updateUser(
    { email, password, data: { [DISPLAY_NAME]: name } },
    {
      // A dónde vuelve el enlace del correo, por el host por el que de verdad se
      // entró (`lib/origin.ts`): sin esto Supabase lo compone con la Site URL del
      // panel, que es un valor y solo uno. El `next` lleva de vuelta a la página
      // que se estaba comentando, que es de donde no habría que haberse movido.
      emailRedirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  );
  if (error) return explain(error.message);

  // Con la confirmación por correo activada, el correo no se escribe todavía en
  // la cuenta: se queda en el cambio pendiente y `email` sigue vacío. Eso es lo
  // que distingue «ya está» de «te hemos mandado un correo», y es lo que hay que
  // decir sin adivinar cómo está configurado el proyecto de Supabase.
  return { confirming: (data.user?.email ?? "") !== email };
}
