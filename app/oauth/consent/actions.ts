"use server";

import { redirect } from "next/navigation";
import { authorizationId, explainOAuth } from "@/lib/oauth";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isGuest } from "@/lib/user";

export type ConsentState = { error?: string };

/**
 * La respuesta a una solicitud de autorización: conceder o no conceder.
 *
 * Las dos son la misma acción y no dos porque son la misma decisión, y porque lo
 * que pasa después es idéntico: Supabase devuelve la dirección a la que hay que
 * mandar al navegador —con el código dentro si se concedió, con un
 * `error=access_denied` si no— y nosotros vamos allí. Partirlas en dos acciones
 * habría duplicado esa parte, que es la delicada.
 *
 * Cuál de las dos se pidió lo dice el botón pulsado: va con `name` y `value`, y
 * el navegador solo incluye en el envío el que se pulsó. Nada por defecto: si
 * llega un envío sin ese campo —o con otra cosa—, esto no concede.
 */
export async function decide(_previous: ConsentState, formData: FormData): Promise<ConsentState> {
  const id = authorizationId(formData.get("authorization_id"));
  const approving = formData.get("decision") === "approve";

  if (!supabaseReady) return { error: "Falta configurar Supabase en el servidor." };
  if (!id) {
    return {
      error: "Esta solicitud no lleva a ningún sitio. Vuelve a empezar desde la aplicación que te trajo.",
    };
  }

  const supabase = await createClient();

  // Quien concede tiene que ser una cuenta. Un invitado también trae sesión
  // (`lib/user.ts`), pero es una cuenta anónima que no es de nadie, sin correo y
  // a la que no se puede volver: darle a un tercero un testigo en nombre de eso
  // sería firmar un permiso que su dueño no podría ni consultar ni retirar. La
  // pantalla ya lo manda al acceso antes de llegar aquí; esto lo vuelve a mirar
  // porque una acción de servidor se invoca sola, sin pasar por la pantalla.
  const { data: current } = await supabase.auth.getUser();
  if (!current.user) return { error: "Se cerró la sesión. Entra otra vez y repite la solicitud." };
  if (isGuest(current.user)) {
    return { error: "Estás como invitado. Entra con tu cuenta para poder conceder esto." };
  }

  // `skipBrowserRedirect` porque aquí no hay navegador al que mandar: auth-js
  // solo sabe hacerlo con `window.location`, y esto corre en el servidor. La
  // dirección se la pedimos y vamos nosotros, que además es lo que deja la
  // decisión escrita en una respuesta HTTP y no en un salto de JavaScript.
  const { data, error } = approving
    ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });

  if (error) return { error: explainOAuth(error.message) };
  if (!data?.redirect_url) {
    return { error: "Supabase no dijo a dónde había que volver." };
  }

  // Fuera de la aplicación: `redirect` también acepta una dirección absoluta.
  // Esa dirección la compone Supabase con el `redirect_uri` que el cliente tiene
  // registrado, así que no es un redirector abierto —lo que llegue por la query
  // no pinta nada aquí— y por eso no pasa por `internalPath`.
  //
  // redirect lanza su propia excepción de control: no puede ir dentro de un try.
  redirect(data.redirect_url);
}
