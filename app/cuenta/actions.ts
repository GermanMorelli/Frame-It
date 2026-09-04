"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAvatarStyle, isSeed, rollSeed, HOUSE_STYLE } from "@/lib/avatar";
import { isWashId } from "@/lib/author-color";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { internalPath } from "@/lib/url";
import { AVATAR_BG, AVATAR_SEED, AVATAR_STYLE, DISPLAY_NAME } from "@/lib/user";

export type NameState = { error?: string; name?: string };

const MIN_NAME = 2;
const MAX_NAME = 60;

/**
 * Cambia el nombre con el que se firma. Va a la metadata de la cuenta; de ahí lo
 * copia a `profiles` el disparador de la migración 0002, que es lo que leen los
 * demás miembros del proyecto.
 */
export async function updateName(_previous: NameState, formData: FormData): Promise<NameState> {
  const name = String(formData.get("name") ?? "").trim();
  const next = internalPath(formData.get("next"));

  if (!supabaseReady) return { name, error: "Falta configurar Supabase en el servidor." };
  if (name.length < MIN_NAME || name.length > MAX_NAME) {
    return {
      name,
      error: `El nombre va entre ${MIN_NAME} y ${MAX_NAME} caracteres.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { [DISPLAY_NAME]: name },
  });
  if (error) return { name, error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/", "layout");
  // redirect lanza su propia excepción de control: no puede ir dentro de un try.
  redirect(next);
}

export type AvatarState = { error?: string };

/**
 * Cambia la cara. Guarda las dos piezas juntas —el estilo y la semilla— aunque
 * solo se haya tocado una: son un avatar, no dos ajustes, y escribir las dos
 * deja la fila entera coherente sin tener que leerla antes.
 *
 * Como el nombre, van a la metadata de la cuenta; de ahí las copia a `profiles`
 * el disparador de 0004, que es lo que ven los demás miembros del proyecto.
 *
 * No hay pantalla a la que volver ni redirección: el formulario está en la
 * página que ya se está mirando y lo que cambia es lo que se ve encima.
 */
export async function updateAvatar(
  _previous: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  if (!supabaseReady) return { error: "Falta configurar Supabase en el servidor." };

  const style = String(formData.get("style") ?? "");
  const asked = String(formData.get("seed") ?? "");
  const bg = String(formData.get("bg") ?? "");

  // Aquí está «otra cara»: el formulario que la pide es justo el que no manda
  // semilla, y sin semilla se sortea una. Que el sorteo ocurra en el servidor y
  // no en el navegador es lo que deja esta pantalla funcionando sin JavaScript.
  const seed = isSeed(asked) ? asked : rollSeed();

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: {
      [AVATAR_STYLE]: isAvatarStyle(style) ? style : HOUSE_STYLE,
      [AVATAR_SEED]: seed,
      // Los tres formularios mandan el fondo, así que lo que llegue vale. Uno
      // que no esté en la lista se guarda igual que uno vacío —el disparador de
      // 0005 lo deja como estaba—, y quien no lo ha elegido nunca sigue con el
      // que le toca por su correo.
      [AVATAR_BG]: isWashId(bg) ? bg : "",
    },
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // La cara sale también en la barra de arriba, que vive en el layout.
  revalidatePath("/", "layout");
  return {};
}
