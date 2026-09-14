"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkCredentials,
  claimGuest,
  explain,
  type AuthField,
} from "@/lib/account";
import { requestOrigin } from "@/lib/origin";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { internalPath } from "@/lib/url";
import { DISPLAY_NAME, isGuest } from "@/lib/user";

export type AuthMode = "signin" | "signup";

/** Qué campo señala el error. El formulario sacude ese y no otro. */
export type { AuthField };

export type AuthState = {
  error?: string;
  notice?: string;
  /**
   * Dónde volver a mirar. Un error de contraseña que marca el correo manda a
   * corregir lo que estaba bien, y eso es peor que no marcar nada.
   */
  field?: AuthField;
  /**
   * Lo ya escrito, para no obligar a teclearlo otra vez tras un fallo. Las
   * contraseñas no: se vuelven a teclear, no viajan de vuelta al navegador.
   */
  email?: string;
  name?: string;
  mode?: AuthMode;
};

export async function authenticate(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const mode: AuthMode = formData.get("mode") === "signup" ? "signup" : "signin";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const next = internalPath(formData.get("next"));
  const echo: AuthState = { email, name, mode };

  if (!supabaseReady) {
    return { ...echo, error: "Falta configurar Supabase en el servidor." };
  }

  const creating = mode === "signup";
  const wrong = checkCredentials({
    email,
    password,
    // Al entrar no se pide ni nombre ni repetición: no son campos vacíos, es
    // que ese formulario no los tiene.
    name: creating ? name : undefined,
    confirm: creating ? confirm : undefined,
  });
  if (wrong) return { ...echo, ...wrong };

  const supabase = await createClient();

  if (creating) {
    // Quien llega aquí con una sesión de invitado no está creando una cuenta:
    // está quedándose con la que ya tiene. Dar de alta otra le dejaría los
    // comentarios firmados a nombre de un anónimo al que ya no podría volver
    // (`lib/account.ts`).
    const { data: current } = await supabase.auth.getUser();
    if (current.user && isGuest(current.user)) {
      const claimed = await claimGuest(supabase, { name, email, password, next });
      if (claimed.error) return { ...echo, error: claimed.error, field: claimed.field };

      revalidatePath("/", "layout");
      if (claimed.confirming) {
        return {
          ...echo,
          notice: `Cuenta creada y lo que has comentado ya es tuyo. Te enviamos un correo a ${email} para confirmarlo; hasta entonces sigues firmando como invitado.`,
        };
      }
      redirect(next);
    }

    // El nombre va en la metadata de la cuenta; un disparador lo copia a la
    // tabla profiles, que es de donde lo leen los demás miembros del proyecto.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { [DISPLAY_NAME]: name },
        // A dónde vuelve el enlace del correo de confirmación.
        //
        // Sin esto, Supabase lo compone con la Site URL del panel, que es un
        // valor y solo uno: quien se dé de alta desde otro sitio recibe un
        // enlace que lleva a donde no está —el caso de siempre es darse de alta
        // en producción y acabar en un localhost que no existe para esa persona.
        // Se manda el host por el que de verdad se entró (`lib/origin.ts`), que
        // es lo mismo que ya se hace con el enlace de invitado.
        //
        // El `next` viaja dentro para que confirmar el correo no pierda a dónde
        // se iba: quien llegó al alta desde una pantalla cerrada (`?next=`,
        // proxy.ts) entra por el enlace y aterriza ahí, no en el panel.
        //
        // Supabase solo respeta esta dirección si está en la lista de Redirect
        // URLs del proyecto; si no está, se cae a la Site URL sin avisar.
        emailRedirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) return { ...echo, ...explain(error.message) };
    // Con la confirmación por correo activada, el alta no deja sesión abierta.
    if (!data.session) {
      return {
        ...echo,
        notice: `Cuenta creada. Te enviamos un correo a ${email} para confirmarla; al abrir el enlace entrarás directo.`,
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ...echo, ...explain(error.message) };
  }

  // Las páginas leen la sesión en el servidor: sin esto seguirían viendo la anterior.
  revalidatePath("/", "layout");
  // redirect lanza su propia excepción de control: no puede ir dentro de un try.
  redirect(next);
}
