import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseReady } from "./config";
import { hardened } from "./cookies";

/**
 * Nombre de las cookies de sesión de Supabase: `sb-<proyecto>-auth-token`, partido
 * en `.0`, `.1`… cuando el token no cabe en una sola. La de `-code-verifier` queda
 * fuera a propósito: existe durante el alta y no acredita nada.
 */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Comprobación optimista: ¿trae esta petición algo que parezca una sesión? Se usa
 * en el tráfico del sitio proxiado, que son cientos de peticiones por página;
 * validar cada una contra Supabase costaría un viaje de red por imagen.
 */
export function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => SESSION_COOKIE.test(cookie.name));
}

type SessionResult = {
  user: User | null;
  /** Respuesta con las cookies ya renovadas: hay que devolverla o copiarlas. */
  response: NextResponse;
};

/**
 * Renueva el token y averigua quién es el usuario. Solo se llama en las pantallas
 * de la app: un Server Component no puede escribir cookies, así que si el token
 * caduca mientras la app está abierta, este es el único sitio donde se puede dejar
 * el nuevo — sin esto la sesión se caería sola al expirar.
 */
export async function withSession(request: NextRequest): Promise<SessionResult> {
  if (!supabaseReady) return { user: null, response: NextResponse.next({ request }) };

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, hardened(options ?? {}));
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  return { user: data.user ?? null, response };
}

/** Redirección que se lleva consigo las cookies renovadas. */
export function redirectWith(request: NextRequest, path: string, carrying: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of carrying.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
