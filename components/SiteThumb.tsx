"use client";

import gsap from "gsap";
import { useCallback, useRef, useState } from "react";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";
import { thumbSrc } from "@/lib/thumb";
import { isPublicSite } from "@/lib/url";

type SiteThumbProps = {
  /** La página que se fotografía: la de entrada del proyecto. */
  url: string;
  /** El lavado pastel del proyecto: lo que se ve mientras no hay foto, y si no la hay. */
  wash: string;
  /** Ancho en píxeles que se le pide al servicio. */
  width?: number;
  /** Descripción para quien no ve la imagen. Vacía si al lado ya se dice el sitio. */
  alt?: string;
  className?: string;
};

/**
 * La portada del sitio dentro de la tarjeta de su proyecto.
 *
 * La foto se pinta *encima* del lavado pastel, no en su lugar: mientras no está
 * —y si no llega nunca— lo que se ve es exactamente la franja de color que había
 * antes de todo esto, que es la superficie de categoría del sistema y ya
 * identifica al proyecto por sí sola (DESIGN.md). Así no hay un estado de carga
 * que diseñar ni un hueco roto que enseñar: hay una tarjeta que a veces trae foto.
 *
 * De ahí que aquí no se reintente nada ni se avise de nada. Sacar la foto de un
 * sitio ajeno depende de un tercero y de que ese sitio conteste; cuando no sale,
 * la respuesta correcta es no decir nada y volver a intentarlo la próxima vez que
 * alguien abra el panel, no gastarle a nadie una fila de mensajes de error por
 * una imagen decorativa.
 */
export default function SiteThumb({
  url,
  wash,
  width = 800,
  alt = "",
  className = "",
}: SiteThumbProps) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement | null>(null);

  /** Descubrir la foto. Sin fundido cuando ya estaba puesta antes de mirarla. */
  const reveal = useCallback((target: HTMLImageElement, fade: boolean) => {
    if (!fade || reducedMotion()) {
      gsap.set(target, { autoAlpha: 1 });
      return;
    }
    gsap.to(target, { autoAlpha: 1, duration: DURATION.fade, ease: EASE.out });
  }, []);

  /**
   * La carga que ocurrió antes de que hubiera quien la escuchara.
   *
   * El `onLoad` de abajo es un evento del navegador, y el navegador no espera a
   * React: pide la foto en cuanto lee el HTML, y como viene de nuestra caché
   * suele estar entera antes de que la página hidrate. Ese `load` ya disparado no
   * se repite, así que el `onLoad` no llega nunca y la imagen se queda con el
   * `opacity: 0` con el que nace —cargada, encima del lavado, e invisible para
   * siempre—. Por eso, en cuanto el nodo existe, se le pregunta por `complete`,
   * que es lo único que sabe lo que pasó cuando aquí no había nadie.
   */
  const attach = useCallback(
    (node: HTMLImageElement | null) => {
      image.current = node;
      if (!node || !node.complete) return;
      // `complete` también es cierto para la que falló: lo que las separa es si
      // trajo píxeles. Sin ellos no hay foto, y la tarjeta se queda en su lavado.
      if (node.naturalWidth === 0) setFailed(true);
      else reveal(node, false);
    },
    [reveal],
  );

  // Un sitio que solo existe en esta máquina no lo puede fotografiar nadie de
  // fuera: se ahorra la petición. Que el servicio esté apagado no se pregunta
  // aquí —esa decisión vive en el servidor, y con razón: la plantilla de un
  // servicio de pago lleva su clave dentro—; apagado, la ruta contesta 204 al
  // instante y esto acaba en el mismo sitio.
  const possible = isPublicSite(url);

  return (
    <div className={`relative overflow-hidden ${wash} ${className}`}>
      {/* La caja guarda su sitio con la proporción, no con un alto fijo: la
          rejilla es fluida y una altura en píxeles descuadraría las tres
          columnas en cuanto la ventana cambia de ancho. */}
      <div className="aspect-[16/10]" />

      {possible && !failed && (
        /*
         * `<img>` y no `next/image`: el optimizador de Next va a buscar la imagen
         * por su cuenta, desde el servidor y sin las cookies de quien mira, y
         * `/api/thumb` exige sesión —le contestaría 401 a todas. Y no hay nada que
         * optimizar: la ruta ya sirve la foto en el ancho exacto que se le pide y
         * la guarda hecha. Lo que este aviso protege —el peso y el LCP— lo
         * resuelven aquí `loading="lazy"` y la lista cerrada de anchos.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={attach}
          src={thumbSrc(url, width)}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => {
            const target = image.current;
            if (target) reveal(target, true);
          }}
          onError={() => setFailed(true)}
          // Arranca invisible y la revela el tween del `onLoad`: una imagen que
          // aparece de golpe sobre el pastel se lee como un parpadeo de error.
          style={{ opacity: 0, visibility: "hidden" }}
          className="absolute inset-0 size-full object-cover object-top"
        />
      )}
    </div>
  );
}
