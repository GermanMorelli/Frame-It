/**
 * El tema de la interfaz: la mesa blanca o la mesa apagada.
 *
 * Aquí no hay paleta —esa vive entera en `app/globals.css`, en cuatro variables
 * que se redefinen bajo `html[data-theme="dark"]`—. Lo que hay es la única cosa
 * de la que el CSS no puede encargarse: recordar qué eligió esta persona y
 * dejarlo puesto antes de que el navegador pinte.
 *
 * El de partida es el claro, y a propósito no se consulta `prefers-color-scheme`.
 * El sistema operativo dice cómo quiere el usuario *sus* aplicaciones, no cómo
 * quiere revisar el sitio de un cliente: lo que se ve dentro del marco es una
 * página ajena que casi siempre es blanca, y arrancar en oscuro pondría la mesa
 * más oscura que el trabajo que sostiene. Quien quiera lo contrario lo dice una
 * vez en la barra y no se le vuelve a preguntar.
 */
export type Theme = "light" | "dark";

/**
 * Dónde se guarda. En `localStorage` y no en una cookie porque el servidor no
 * tiene nada que hacer con esto: el HTML que manda es el mismo en los dos temas
 * —las clases son las mismas, lo que cambia son los valores de cuatro
 * variables— y meterlo en la petición solo serviría para partir la caché de
 * cada página en dos.
 */
export const THEME_KEY = "frame-it-theme";

/** El atributo del `<html>` del que cuelga todo lo demás. */
const ATTRIBUTE = "data-theme";

/**
 * El guion que corre antes que nada, incrustado en el `<body>` por el layout.
 *
 * Tiene que ser esto —una cadena que el navegador ejecuta al leerla, mientras el
 * parser está detenido— y no un efecto de React: un efecto corre después de
 * pintar, así que quien tiene guardado el oscuro vería un destello de blanco a
 * pantalla completa en cada navegación dura. Es el mismo motivo por el que va
 * sin `defer` y sin `async`.
 *
 * Va envuelto en `try` porque `localStorage` no siempre está: en navegación
 * privada de algunos navegadores, y con las cookies de terceros bloqueadas
 * dentro de un iframe, leerlo lanza. Un tema que no se pudo recuperar es una
 * molestia; una excepción aquí dejaría la página a medio parsear.
 */
export const THEME_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)})==="dark")document.documentElement.setAttribute(${JSON.stringify(
  ATTRIBUTE,
)},"dark")}catch(e){}`;

/** El tema que hay puesto ahora mismo, leído del DOM, que es quien lo sabe. */
export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute(ATTRIBUTE) === "dark" ? "dark" : "light";
}

/**
 * Y el que pintó el servidor, que no puede ser otro: el HTML sale siempre en
 * claro porque el `localStorage` de quien lo pide está en su navegador y no aquí.
 */
export function serverTheme(): Theme {
  return "light";
}

/**
 * Avisar cuando el atributo cambie.
 *
 * Existe para que el conmutador pueda leer el tema con `useSyncExternalStore` en
 * vez de guardarse una copia en estado. Aquí el DOM es el original y React el
 * espejo —el guion de arranque escribe el atributo antes de que React exista—,
 * así que copiarlo a un `useState` en un efecto sería tener dos versiones de la
 * misma verdad y una de ellas siempre un render por detrás.
 *
 * Es un `MutationObserver` y no un evento propio porque lo que se vigila es el
 * atributo, no la función que lo pone: así el conmutador se entera igual si el
 * tema lo cambia otra pestaña de este mismo código, la consola o cualquier cosa
 * que llegue después.
 */
export function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ATTRIBUTE],
  });
  return () => observer.disconnect();
}

/**
 * Poner uno. Primero el atributo y después el guardado: lo que se ve tiene que
 * cambiar en el mismo fotograma del clic, y si `localStorage` lanza —que puede—
 * la sesión en curso ya está en el tema pedido y solo se pierde el recuerdo.
 *
 * En claro se quita el atributo en vez de escribir `light`. El claro es el
 * estado de partida y el que sale del servidor; dejarlo escrito significaría que
 * hay dos maneras de estar en claro, y las reglas de CSS tendrían que conocer
 * las dos.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute(ATTRIBUTE, "dark");
  else root.removeAttribute(ATTRIBUTE);

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Sin sitio donde guardar: el tema vale para esta pestaña y ya está.
  }
}
