/**
 * Cabecera con la que proxy.ts le pasa el destino al route handler.
 *
 * Hace falta porque en un rewrite el handler sigue viendo la URL original de la
 * petición: el `?url=` que añade el reescritor no llega a leerse nunca. Sin esto,
 * toda URL que el sitio proxiado construya en ejecución (imágenes de un bundle,
 * llamadas a su propia API) acaba en un 400.
 */
export const TARGET_HEADER = "x-frameit-target";
