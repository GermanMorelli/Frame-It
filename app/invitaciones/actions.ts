"use server";

import { revalidatePath } from "next/cache";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";

export type InviteResult = {
  /** Qué pasó: se aceptó, se rechazó, o ya no estaba cuando llegó la respuesta. */
  outcome?: "accepted" | "declined" | "gone";
  error?: string;
};

/**
 * Acepta o rechaza una invitación.
 *
 * Todo lo que importa ocurre dentro de `respond_invite` (migración 0006), y no
 * aquí: esa función es la que comprueba que la invitación sea tuya antes de
 * meterte en un proyecto ajeno. Una acción de servidor se puede invocar con un
 * POST a pelo, así que la única comprobación que vale es la que vive en la base.
 */
export async function respondInvite(id: string, accept: boolean): Promise<InviteResult> {
  if (!supabaseReady) return { error: "Falta configurar Supabase en el servidor." };

  const user = await getUser();
  if (!user) return { error: "Tu sesión caducó. Vuelve a entrar." };
  if (!id) return { error: "Esa invitación no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_invite", {
    p_invite: id,
    p_accept: accept,
  });

  if (error) {
    return {
      error: error.message.includes("no es tuya")
        ? "Esa invitación no es tuya."
        : "No se pudo contestar la invitación.",
    };
  }

  // Contestar cambia tres cosas y solo una está en esta pantalla: la bandeja
  // pierde una fila, el carril baja su cuenta —y el carril sale en todas— y el
  // panel gana un proyecto si se aceptó. Por eso caduca el diseño entero.
  revalidatePath("/", "layout");

  const outcome = data === "accepted" || data === "declined" ? data : "gone";
  return { outcome };
}

/**
 * Da por vistos los avisos. Se llama al abrir la bandeja y no al pulsar nada:
 * la cuenta del carril dice «hay algo que no has mirado», así que dejar de
 * contarlos es exactamente lo que significa haberlos mirado.
 */
export async function markNotificationsRead(): Promise<void> {
  if (!supabaseReady) return;

  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  // El filtro por dueño lo pone RLS (`notifications_update`); el de aquí es para
  // no reescribir filas que ya estaban leídas.
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  // La banda vive en el armazón y el armazón está en todas las pantallas, así
  // que lo que hay que dar por caducado es el diseño entero y no una ruta: dar
  // por vistos los avisos desde el panel tiene que apagar también los puntos
  // que se verían al ir a cualquier otro sitio.
  revalidatePath("/", "layout");
}

/** Quita un aviso de la bandeja. Solo se puede con los propios, lo dice RLS. */
export async function dismissNotification(id: string): Promise<void> {
  if (!supabaseReady || !id) return;

  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("id", id);

  revalidatePath("/", "layout");
}
