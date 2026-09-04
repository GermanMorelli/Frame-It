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
 * Es el archivo de `public/marca/logo.svg` tal cual, sin copiar sus trazos aquí: la
 * marca se retoca en el archivo y cambia en las tres pantallas a la vez. Va por
 * `next/image` para que el alto y el ancho viajen en el HTML y la barra no dé un
 * tirón mientras carga; los SVG no pasan por el optimizador (Next los sirve tal
 * cual al terminar el `src` en `.svg`), así que no hay pérdida ni conversión.
 *
 * `priority` porque en los tres sitios donde sale está arriba del todo, visible
 * desde el primer píxel: cargarlo con pereza solo serviría para que la marca
 * apareciera la última.
 */
export default function Logo({ className = "h-6 w-auto", alt = "Frame It" }: LogoProps) {
  return (
    <Image
      src="/marca/logo.svg"
      alt={alt}
      width={INTRINSIC.width}
      height={INTRINSIC.height}
      priority
      className={className}
    />
  );
}
