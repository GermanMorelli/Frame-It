import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, supabaseReady } from "./config";

/**
 * El único cliente de Supabase que corre en el navegador, y corre sin sesión.
 *
 * Eso no es un descuido: es la condición para que exista. La sesión de esta
 * aplicación vive en cookies httpOnly a propósito (`lib/supabase/cookies.ts`),
 * porque el sitio revisado se sirve desde NUESTRO origen —lo exige
 * `allow-same-origin` en el iframe (`components/SitePreview.tsx`)— y su
 * JavaScript puede alcanzar `window.parent` y leer lo que haya aquí. Un token de
 * usuario en esta capa no sería un token de la aplicación: sería un token en
 * manos del sitio que se está revisando, que es de quien menos se sabe.
 *
 * Con la clave pública a secas no hay nada que llevarse. Todas las políticas de
 * la base son `to authenticated`, así que sin sesión no devuelven ni una fila.
 * Lo único que esta llave abre es el canal de presencia, que es justo para lo
 * que está aquí.
 *
 * El precio, dicho entero: ese canal es público. Quien conozca el identificador
 * del proyecto puede escuchar quién lo está mirando. Por eso por el canal no
 * viaja nada personal —ni correos, ni comentarios, ni la sesión de nadie—, solo
 * el nombre y la cara con la que ya se firma cada comentario (`lib/live.ts`).
 * Cerrarlo de verdad exige canales privados, y esos vuelven a pedir un token de
 * usuario aquí abajo: la puerta que este archivo existe para no abrir.
 */
let client: SupabaseClient | null = null;

export function realtimeClient(): SupabaseClient | null {
  if (!supabaseReady) return null;
  if (client) return client;

  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    // Las tres apagadas dicen lo mismo de tres maneras: aquí no hay sesión que
    // guardar, que refrescar ni que recoger de la URL. Con `persistSession` en
    // falso el cliente tampoco toca el almacenamiento del navegador, que es
    // legible por el sitio proxiado.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // La presencia manda un mensaje al entrar, otro al cambiar de página y otro
    // al salir. Cuatro por segundo es techo de sobra para eso, y es lo que
    // impide que un bucle en esta capa se convierta en factura.
    realtime: { params: { eventsPerSecond: 4 } },
  });

  return client;
}
