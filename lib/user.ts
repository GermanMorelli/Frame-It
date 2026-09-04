import type { User } from "@supabase/supabase-js";
import { avatarFor, type Avatar } from "@/lib/avatar";

/** Clave con la que se guarda el nombre en la metadata de la cuenta. */
export const DISPLAY_NAME = "display_name";

/**
 * Y las dos con las que se guarda la cara. Van en la metadata por lo mismo que
 * el nombre: quien tiene la sesión se dibuja a sí mismo sin consultar la base.
 * De ahí las copia a `profiles` el disparador de 0004, que es de donde las leen
 * los demás miembros del proyecto.
 */
export const AVATAR_STYLE = "avatar_style";
export const AVATAR_SEED = "avatar_seed";
export const AVATAR_BG = "avatar_bg";

/**
 * Cómo se firma algo cuando no hay nombre puesto.
 *
 * Nunca se enseña la dirección entera: además de ser un dato personal de más en
 * una pantalla que puede ver todo el equipo, un correo completo se lee peor que
 * un nombre. Se queda en lo de antes de la arroba, que ya identifica a alguien.
 */
export function asName(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  const at = text.indexOf("@");
  return at > 0 ? text.slice(0, at) : text;
}

/**
 * Con qué nombre aparece alguien en la interfaz. El nombre se pide al crear la
 * cuenta y viaja en la metadata, así que para quien tiene la sesión no hace falta
 * consultar la base.
 */
export function displayName(user: User | null | undefined): string {
  if (!user) return "";
  const name = user.user_metadata?.[DISPLAY_NAME];
  if (typeof name === "string" && name.trim()) return name.trim();
  return asName(user.email);
}

/** Cuentas anteriores a que el alta pidiera nombre: conviene que se pongan uno. */
export function hasName(user: User | null | undefined): boolean {
  const name = user?.user_metadata?.[DISPLAY_NAME];
  return typeof name === "string" && name.trim().length > 0;
}

/** Un texto de la metadata, o null si no hay nada que valga. */
function metaText(user: User | null | undefined, key: string): string | null {
  const value = user?.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Con qué cara aparece alguien. Sin haber elegido nada sale la de fábrica, que
 * ya es distinta para cada cuenta: la semilla es su propio identificador
 * (`lib/avatar.ts`).
 */
export function userAvatar(user: User | null | undefined): Avatar {
  return avatarFor(
    user?.id ?? "",
    metaText(user, AVATAR_STYLE),
    metaText(user, AVATAR_SEED),
    metaText(user, AVATAR_BG),
  );
}
