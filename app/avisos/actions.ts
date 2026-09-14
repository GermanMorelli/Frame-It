"use server";

import { revalidatePath } from "next/cache";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Lo que se puede hacer con la bandeja: darla por vista, abrir un aviso, quitar
 * uno y vaciar lo ya visto.
 *
 * Vivían en `app/invitaciones/actions.ts` porque los avisos no tenían pantalla
 * propia y aquella era la más cercana. Ahora la tienen —esta—, y las acciones se
 * mudan con ella: lo que queda allí es contestar invitaciones, que es otra cosa.
 *
 * Ninguna comprueba de quién es nada, y es a propósito. Las cuatro son un UPDATE
 * o un DELETE normal contra `notifications`, sujetos a las políticas de RLS de la
 * migración 0006, que solo dejan tocar las filas propias. Una acción de servidor
 * se puede invocar con un POST a pelo, así que la única comprobación que vale es
 * la de la base; la sesión se pide aquí para no mandar consultas sin dueño, no
 * como barrera.
 *
 * Y las cuatro caducan el diseño entero y no una ruta. La banda de avisos vive en
 * el armazón y el armazón está en todas las pantallas: dar algo por visto tiene
 * que apagar también los puntos que se verían al ir a cualquier otro sitio.
 */

/**
 * Da por vistos todos los avisos de golpe.
 *
 * Es lo que hace el «Visto» de la cabecera, y no ocurre solo al abrir la bandeja:
 * abrir es mirar, y mirar no es haber leído. Si el disco desapareciera con solo
 * desplegar la campana, la única marca de qué es nuevo se perdería justo en el
 * momento en que hace falta.
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

  revalidatePath("/", "layout");
}

/**
 * Da por visto uno solo: el que se acaba de abrir.
 *
 * Antes, abrir un aviso lo borraba. Tenía su lógica —un aviso dice «mira esto», y
 * en cuanto se ha mirado ya no dice nada— pero se llevaba por delante la única
 * pista de que aquello había pasado: quien pulsaba sin querer, o iba a una
 * mención y volvía sin contestarla, se quedaba sin nada a lo que volver. Ahora se
 * marca leído y se queda en el historial, que es lo que un historial es. Quitarlo
 * sigue siendo posible, pero pasa a ser una decisión y no un efecto secundario.
 */
export async function markNotificationRead(id: string): Promise<void> {
  if (!supabaseReady || !id) return;

  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    // Volver a marcar lo ya leído movería la fecha sin que nadie lo pidiera, y
    // esa fecha es lo que distingue «visto hace un rato» de «visto ahora».
    .is("read_at", null);

  revalidatePath("/", "layout");
}

/** Quita un aviso. Solo se puede con los propios, lo dice RLS. */
export async function dismissNotification(id: string): Promise<void> {
  if (!supabaseReady || !id) return;

  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("id", id);

  revalidatePath("/", "layout");
}

/**
 * Vacía el historial de lo ya visto.
 *
 * Solo lo visto, y esa es toda la idea: lo que no se ha mirado no se puede tirar
 * sin querer con un botón que dice «vaciar». Un aviso sin ver es trabajo
 * pendiente —una invitación sin contestar, una mención sin leer—, y borrarlo de
 * una pasada sería perder algo que nadie llegó a ver. Los vistos, en cambio, ya
 * cumplieron: quedan por si acaso, y este botón es el «ya no hace falta».
 *
 * No hay confirmación en la base porque no hace falta: la pantalla dice cuántos
 * va a borrar antes de preguntarlo (`DangerButton`), y lo que se pierde es la
 * copia del aviso, no lo que contaba —el proyecto sigue en el panel y el
 * comentario, en su página.
 */
export async function clearSeenNotifications(): Promise<void> {
  if (!supabaseReady) return;

  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .not("read_at", "is", null);

  revalidatePath("/", "layout");
}
