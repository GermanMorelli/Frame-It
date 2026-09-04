/**
 * Endurece las cookies de sesión antes de escribirlas.
 *
 * @supabase/ssr las deja con `httpOnly: false` porque su cliente de navegador tiene
 * que leerlas. Aquí la sesión solo se toca en el servidor, y dejarla accesible por
 * script sería regalarla: el sitio proxiado corre en NUESTRO mismo origen (lo exige
 * `allow-same-origin` en el iframe), así que su JavaScript podría leer
 * `document.cookie` y quedarse con el token.
 */
export function hardened<T extends object>(options: T) {
  return {
    ...options,
    httpOnly: true,
    // En producción la app va por https; en local, marcarlas seguras impediría enviarlas.
    secure: process.env.NODE_ENV === "production",
  };
}
