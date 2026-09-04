import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col text-body">{children}</body>
    </html>
  );
}
