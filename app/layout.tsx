import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// El sistema tiene dos registros y una sola familia de pago: Vend Sans, que
// DESIGN.md sustituye por Inter. El cuerpo se queda en system-ui, así que no hay
// segunda descarga. Inter es variable: fijar `weight` pediría instancias
// estáticas que gstatic no sirve (404); el peso se controla en CSS.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const DESCRIPTION = "Comenta cualquier página del sitio de un cliente, sobre la página misma.";

/**
 * Contra qué se resuelven las direcciones de los metadatos —ahora mismo solo la
 * imagen de la tarjeta—. Tienen que salir enteras: quien las lee es un servidor
 * ajeno (WhatsApp, Slack, el que enseñe la vista previa del enlace), y media
 * dirección no le sirve de nada. Sin esto la compilación falla.
 *
 * No sale de `lib/origin.ts`, que es lo que usa el resto de la aplicación para
 * esto mismo: aquello lee la cabecera de la petición, y leerla aquí volvería
 * dinámica la plantilla raíz, o sea todas las pantallas. Esto se lee del entorno,
 * que es lo que hay en compilación: el dominio de producción si está, el del
 * despliegue si no, y en local la máquina de trabajo.
 */
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Frame It",
  description: DESCRIPTION,
  // El icono de la marca, sin el texto y sobre fondo transparente. Vive bajo
  // /marca/ y no en la raíz por lo que explica proxy.ts: cada ruta que reclamamos
  // se la quitamos al sitio revisado, que comparte origen con la app.
  icons: { icon: "/marca/icon.svg" },

  /*
   * La vista previa del enlace: los dos cuadros de la marca sobre papel blanco,
   * sin el texto. A ese tamaño, y recortado como lo recorta cada chat, el
   * logotipo entero se lee peor que el icono solo.
   *
   * Es un archivo de `public/` y no un `opengraph-image.tsx`, que es lo que
   * tocaría en Next: esa convención sirve la imagen desde una ruta de la raíz, y
   * la raíz es del sitio revisado (proxy.ts). Le quitaríamos una ruta más, y
   * encima para nada: quien pide la imagen es un rastreador sin sesión, y el
   * proxy le contestaría con el 401. Bajo /marca/ pasa sin sesión, que es el
   * único prefijo que ya tiene esa excepción.
   *
   * El título y la descripción van escritos aquí aunque repitan los de arriba:
   * las pantallas que cambian su `title` —"Proyectos · Frame It", "Entrar ·
   * Frame It"— heredan este bloque tal cual, así que la tarjeta dice siempre lo
   * mismo. Y lo que se comparte de verdad es el enlace de invitado, que para
   * quien lo abre no es ninguna de esas pantallas: es la aplicación.
   */
  openGraph: {
    type: "website",
    siteName: "Frame It",
    title: "Frame It",
    description: DESCRIPTION,
    locale: "es_MX",
    images: [{ url: "/marca/og.png", width: 1200, height: 630, alt: "Frame It" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Frame It",
    description: DESCRIPTION,
    images: ["/marca/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning` va aquí y en ningún otro sitio, y es obligado:
    // el guion de tema escribe `data-theme` en este mismo elemento *antes* de
    // que React hidrate, así que React llega y encuentra un atributo que no
    // estaba en el HTML que mandó el servidor. Eso es exactamente lo que avisa,
    // y aquí no es un error sino el mecanismo: la discrepancia es a propósito,
    // porque el atributo tiene que estar puesto antes del primer pintado y el
    // servidor no puede saber cuál toca (`lib/theme.ts`).
    //
    // Solo calla este nivel —el `<html>` y su texto—, nunca sus descendientes,
    // así que cualquier otra discrepancia de la aplicación se sigue viendo.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-body">
        {/*
          Lo primero del documento, y a propósito sin `next/script`: es un guion
          en línea que detiene el parser mientras corre, que es justo lo que hace
          falta. Pone el tema guardado en el `<html>` antes de que el navegador
          pinte un solo píxel; hecho en un efecto de React —que corre después de
          pintar— quien tiene puesto el oscuro vería un destello de pantalla
          blanca en cada navegación dura. Lo que ejecuta está en `lib/theme.ts`.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
