/**
 * Credenciales del proyecto de Supabase.
 *
 * El panel de Supabase ha ido cambiando el nombre de la clave pública, así que se
 * aceptan las dos formas: sirve la que traiga el proyecto sin renombrar nada.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/**
 * Sin credenciales no se puede autenticar a nadie. En lugar de reventar en cada
 * petición, la app lo dice en la pantalla de acceso y no deja pasar.
 */
export const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_KEY);
