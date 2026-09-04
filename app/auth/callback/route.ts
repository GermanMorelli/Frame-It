import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { internalPath } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Vuelta del enlace de confirmación del correo. Supabase manda una cosa o la otra
 * según cómo esté configurado el proyecto y la plantilla del correo:
 * `?code=` (flujo PKCE) o `?token_hash=&type=` (enlace de verificación directo).
 * Se atienden las dos para no depender de esa configuración.
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

  return NextResponse.redirect(new URL(next, request.url));
}
