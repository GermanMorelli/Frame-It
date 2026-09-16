import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La barra final de la ruta calcada no es decorativa: el navegador resuelve
  // `./_app/x.js` contra la carpeta del documento, y quitarla en un 308 —lo que
  // Next hace por su cuenta— sube un nivel de más y saca al sitio de su espejo.
  // El destino manda: la ruta se sirve tal y como está en el sitio original.
  skipTrailingSlashRedirect: true,

  async headers() {
    return [
      {
        // La pantalla de consentimiento no se deja meter en un marco ajeno.
        //
        // Es la única de la aplicación donde un clic concede algo a un tercero,
        // o sea el blanco exacto del clickjacking: un sitio cualquiera la carga
        // invisible encima de otra cosa y lo que se pulsa es «Permitir». El
        // resto de la aplicación no lleva esto porque no le hace falta —lo que
        // se pulsa ahí es reversible y es de uno—, y ponerlo en todas las rutas
        // se lo pondría también al sitio proxiado, que vive en este mismo origen
        // y que sí tiene que poder ir dentro de un iframe: es de lo que va Frame
        // It (`proxy.ts`).
        //
        // Las dos cabeceras dicen lo mismo a propósito: `frame-ancestors` es la
        // que manda en los navegadores de hoy, y la antigua queda para los que
        // no la miran.
        source: "/oauth/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
