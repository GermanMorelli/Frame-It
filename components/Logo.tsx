import Image from "next/image";

/** Las medidas del archivo. Fijan la proporción y evitan el salto al cargar. */
const INTRINSIC = { width: 1293, height: 320 };

type LogoProps = {
  /** El tamaño se da por alto (`h-6 w-auto`): el ancho sale de la proporción. */
  className?: string;
  /**
   * El texto alternativo. Vacío cuando el logotipo va dentro de algo que ya se
   * nombra —el enlace de la barra tiene su `aria-label`—: repetirlo haría que
   * un lector de pantalla dijera la marca dos veces seguidas.
   */
  alt?: string;
};

/**
 * El logotipo de Frame It: las dos fichas y la palabra, en un solo bloque.
 *
 * Son los archivos de `public/marca/` tal cual, sin copiar sus trazos aquí: la
 * marca se retoca en el archivo y cambia en las tres pantallas a la vez. Van por
 * `next/image` para que el alto y el ancho viajen en el HTML y la barra no dé un
 * tirón mientras carga; los SVG no pasan por el optimizador (Next los sirve tal
 * cual al terminar el `src` en `.svg`), así que no hay pérdida ni conversión.
 *
 * `priority` porque en los tres sitios donde sale está arriba del todo, visible
 * desde el primer píxel: cargarlo con pereza solo serviría para que la marca
 * apareciera la última.
 *
 * Son dos archivos y no uno porque la palabra tiene que cambiar de color con el
 * tema y esto es un `<img>`: lo que hay dentro de un SVG referenciado así no lo
 * alcanza el CSS de la página, ni con `currentColor` ni con una variable. Las
 * salidas eran copiar los trazos a este archivo —perdiendo el original como
 * única fuente— o tener el mismo dibujo dos veces con un atributo de diferencia.
 * Gana lo segundo: `logo-dark.svg` se genera de `logo.svg` cambiando el único
 * `fill="black"`, que es la palabra, y el negro de las fichas vive en su
 * `stroke` y se queda donde está.
 *
 * Los dos están siempre puestos, uno encima del otro, y elige el CSS por el
 * atributo del `<html>` — el mismo reparto que el sol y la luna del conmutador,
 * y por el mismo motivo: así el que toca ya está pintado en el primer fotograma,
 * sin esperar a que hidrate nada.
 *
 * El nombre accesible lo lleva siempre el claro, incluso cuando no se ve: una
 * imagen a opacidad cero sigue en el árbol de accesibilidad, mientras que la
 * oscura sale de él con `aria-hidden`. Así la marca se anuncia una vez y una
 * sola, esté encendida la luz o apagada.
 */
export default function Logo({ className = "h-6 w-auto", alt = "Frame It" }: LogoProps) {
  return (
    // `inline-flex` y no un bloque: el logotipo se alinea con lo que tenga al
    // lado, y la caja tiene que medir lo que mida el dibujo. La segunda copia
    // sale del flujo, así que no cuenta para esa medida.
    <span className="relative inline-flex">
      <Image
        src="/marca/logo.svg"
        alt={alt}
        width={INTRINSIC.width}
        height={INTRINSIC.height}
        priority
        className={`${className} dark:opacity-0`}
      />
      <Image
        src="/marca/logo-dark.svg"
        alt=""
        aria-hidden
        width={INTRINSIC.width}
        height={INTRINSIC.height}
        priority
        // `left-0 top-0` y no `inset-0`: estirar la caja rompería la proporción,
        // y las dos copias solo se superponen si las dos miden lo mismo por la
        // misma razón — el alto que pide quien llama y el ancho que sale de él.
        className={`${className} absolute left-0 top-0 opacity-0 dark:opacity-100`}
      />
    </span>
  );
}
