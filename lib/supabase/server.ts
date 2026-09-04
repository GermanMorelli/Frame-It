import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL, supabaseReady } from "./config";
import { hardened } from "./cookies";

/**
 * Cliente de Supabase para el servidor: Server Components, Server Actions y route
 * handlers. La sesión vive en cookies httpOnly y nunca en el navegador.
 *
 * Esto no es una preferencia de estilo. El sitio proxiado corre en NUESTRO origen
 * (lo exige `allow-same-origin` en el iframe), así que su JavaScript podría leer
 * cualquier sesión guardada en localStorage o en una cookie accesible por script.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, hardened(options ?? {}));
          }
        } catch {
          // Un Server Component no puede escribir cookies. No es un problema: el
          // refresco del token lo hace proxy.ts antes de llegar aquí.
        }
      },
    },
  });
}

/** Usuario de la petición, validado contra Supabase. Null si no hay sesión. */
export async function getUser(): Promise<User | null> {
  if (!supabaseReady) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
