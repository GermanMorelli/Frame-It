"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { internalPath } from "@/lib/url";
import { DISPLAY_NAME } from "@/lib/user";

export type AuthMode = "signin" | "signup";

export type AuthState = {
  error?: string;
  notice?: string;
  /** Lo ya escrito, para no obligar a teclearlo otra vez tras un fallo. */
  email?: string;
  name?: string;
  mode?: AuthMode;
};

const MIN_PASSWORD = 8;
const MIN_NAME = 2;
const MAX_NAME = 60;

/**
 * Los mensajes de Supabase vienen en inglés y en su jerga. Se traducen los que un
 * usuario puede provocar; el resto se muestra tal cual, que decir "algo falló" a
 * secas deja a cualquiera sin saber qué hacer.
 */
function explain(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (text.includes("email not confirmed")) return "Confirma el correo antes de entrar.";
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Ya hay una cuenta con ese correo. Entra en su lugar.";
  }
  if (text.includes("signups not allowed")) return "El proyecto de Supabase tiene el alta desactivada.";
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un momento y vuelve a probar.";
  }
  if (text.includes("password")) return `Contraseña no válida: ${message}`;
  return `No se pudo completar: ${message}`;
}

export async function authenticate(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const mode: AuthMode = formData.get("mode") === "signup" ? "signup" : "signin";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const next = internalPath(formData.get("next"));
  const echo: AuthState = { email, name, mode };

  if (!supabaseReady) {
    return { ...echo, error: "Falta configurar Supabase en el servidor." };
  }
  if (!email.includes("@") || email.length < 5) {
    return { ...echo, error: "Escribe un correo válido." };
  }
  if (password.length < MIN_PASSWORD) {
    return { ...echo, error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` };
  }
  if (mode === "signup" && (name.length < MIN_NAME || name.length > MAX_NAME)) {
    return { ...echo, error: `Escribe tu nombre (entre ${MIN_NAME} y ${MAX_NAME} caracteres).` };
  }

  const supabase = await createClient();

  if (mode === "signup") {
    // El nombre va en la metadata de la cuenta; un disparador lo copia a la
    // tabla profiles, que es de donde lo leen los demás miembros del proyecto.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { [DISPLAY_NAME]: name } },
    });
    if (error) return { ...echo, error: explain(error.message) };
    // Con la confirmación por correo activada, el alta no deja sesión abierta.
    if (!data.session) {
      return {
        ...echo,
        notice: `Cuenta creada. Te enviamos un correo a ${email} para confirmarla; al abrir el enlace entrarás directo.`,
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ...echo, error: explain(error.message) };
  }

  // Las páginas leen la sesión en el servidor: sin esto seguirían viendo la anterior.
  revalidatePath("/", "layout");
  // redirect lanza su propia excepción de control: no puede ir dentro de un try.
  redirect(next);
}
