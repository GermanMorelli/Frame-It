import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La barra final de la ruta calcada no es decorativa: el navegador resuelve
  // `./_app/x.js` contra la carpeta del documento, y quitarla en un 308 —lo que
  // Next hace por su cuenta— sube un nivel de más y saca al sitio de su espejo.
  // El destino manda: la ruta se sirve tal y como está en el sitio original.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
