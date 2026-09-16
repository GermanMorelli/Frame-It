import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { adoptProviderName } from "@/lib/account";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { internalPath } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Vuelta de todo lo que sale de aquí y entra por el navegador: el enlace de
 * confirmación del correo y el consentimiento de Google (`app/login/actions.ts`).
 * Los dos acaban en lo mismo —una sesión abierta y un sitio al que ir— y por eso
 * comparten ruta.
 *
 * Lo que llega en la dirección no es siempre igual: el consentimiento de Google
 * vuelve con `?code=` (flujo PKCE), y el enlace del correo con eso o con
 * `?token_hash=&type=` según cómo esté configurado el proyecto y la plantilla.
 * Se atienden las dos formas para no depender de esa configuración.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = internalPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const denied = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const toLogin = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, request.url));

  if (denied) return toLogin(denied);
  if (!supabaseReady) return toLogin("Falta configurar Supabase en el servidor.");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return toLogin(error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return toLogin(error.message);
  } else {
    return toLogin("El enlace de confirmación llegó incompleto.");
  }

  // Quien entra por Google no ha escrito su nombre en ningún sitio: viene en lo
  // que manda Google y hay que pasarlo a donde la aplicación lo lee
  // (`lib/account.ts`). No toca nada si la cuenta ya tiene nombre, que es el
  // caso del enlace del correo y el de cualquier acceso posterior.
  await adoptProviderName(supabase);

  return NextResponse.redirect(new URL(next, request.url));
}
