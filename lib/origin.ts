import { headers } from "next/headers";

/**
 * El origen de esta instalación, tal y como lo pidió el navegador.
 *
 * Hace falta cada vez que una dirección nuestra tiene que salir entera de aquí,
 * y ahora mismo eso pasa en dos sitios: el enlace de invitado, que alguien pega
 * en un chat, y la vuelta del correo de confirmación del alta, que se abre desde
 * una bandeja. En los dos, media dirección no sirve de nada.
 *
 * Sale de la cabecera y no de una variable de entorno porque esto corre igual en
 * `localhost:3000`, en una IP de la red de casa y en producción, y en las tres
 * el enlace bueno es el del host por el que se entró. Una variable obligaría a
 * acertarla en cada máquina, y el día que no se acierte el enlace saldría igual
 * —llevando a otra parte, que es peor que no salir.
 *
 * `x-forwarded-proto` es lo que pone el proxy de delante en producción; sin él,
 * en local, se da por hecho http, que es lo que hay en una máquina de trabajo.
 */
export async function requestOrigin(): Promise<string> {
  const head = await headers();
  const host = head.get("host") ?? "";
  const forwarded = head.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = host.startsWith("localhost") || host.startsWith("127.");
  return `${forwarded || (local ? "http" : "https")}://${host}`;
}
