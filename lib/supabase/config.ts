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

/**
 * Si se enseña el botón de entrar con Google.
 *
 * Está apagado porque el proyecto de Supabase todavía no tiene el proveedor
 * activado, y un botón que lleva a una página de error en inglés es peor que no
 * tener botón: `signInWithOAuth` no hace petición de red —solo compone la
 * dirección— así que el fallo no se puede cazar en la acción de servidor y sale
 * en crudo, ya fuera de la aplicación, sin forma de volver.
 *
 * El código está entero y funciona; lo único que falta es configuración. Para
 * encenderlo hay que poner esto en `true` y, antes, dejar listas cuatro cosas:
 *
 *   1. Google Cloud Console: un OAuth Client ID de tipo Web, con la dirección de
 *      Supabase —no la de esta app— en Authorized redirect URIs:
 *      https://<proyecto>.supabase.co/auth/v1/callback
 *   2. Supabase → Sign In / Providers → Google: el Client ID y el Client Secret.
 *      Solo con los IDs vale para One Tap, y esta aplicación no usa One Tap.
 *   3. Supabase → URL Configuration → Redirect URLs: las dos direcciones de
 *      vuelta, la de local y la de producción, porque el destino se compone con
 *      el host por el que se entró de verdad (`lib/origin.ts`). Si falta una,
 *      Supabase se cae a la Site URL sin avisar.
 *   4. Supabase → Sign In / Providers → Manual linking: encendido. Sin eso, un
 *      invitado que entre por Google abre una cuenta NUEVA y pierde lo que
 *      llevaba comentado, que es el único fallo del acceso sin arreglo después
 *      (`app/login/actions.ts`).
 *
 * Y en Google Cloud, publicar la pantalla de consentimiento a Production: en
 * Testing solo entran los correos listados a mano, que es un muro justo para la
 * gente a la que se le quiere poner fácil.
 */
export const googleReady: boolean = false;
