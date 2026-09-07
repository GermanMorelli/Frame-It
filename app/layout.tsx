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

export const metadata: Metadata = {
  title: "Frame It",
  description: "Comenta cualquier página del sitio de un cliente, sobre la página misma.",
  // El icono de la marca, sin el texto y sobre fondo transparente. Vive bajo
  // /marca/ y no en la raíz por lo que explica proxy.ts: cada ruta que reclamamos
  // se la quitamos al sitio revisado, que comparte origen con la app.
  icons: { icon: "/marca/icon.svg" },
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
