"use client";

import gsap from "gsap";
import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Tokens de movimiento. Igual que la escala tipográfica, las duraciones y las
 * curvas viajan juntas: así las animaciones se leen como un sistema y no como
 * cinco decisiones sueltas. Todo aquí es discreto a propósito — el sistema es
 * plano y de imprenta (DESIGN.md), el movimiento acompaña, nunca protagoniza.
 *
 * Una sola biblioteca, GSAP, y ninguna en 3D: el sistema no tiene sombras,
 * degradados ni elevación, así que no hay profundidad que animar. Lo que se
 * mueve aquí son planos de papel sobre una mesa.
 */
export const DURATION = {
  /** Hundido del botón bajo el dedo. */
  press: 0.12,
  /** Vuelta del botón a su sitio, con un rebote mínimo. */
  release: 0.3,
  /** Entrada de un bloque de contenido. */
  reveal: 0.62,
  /** Aparición de un mensaje de validación. */
  message: 0.3,
  /** Un bloque que se abre o se cierra ocupando alto. */
  grow: 0.34,
  /** Una pieza que aparece en su sitio, sin recorrido: el disco de resuelto. */
  pop: 0.42,
  /** La tinta encendida saltando de una píldora a otra. */
  slide: 0.38,
  /** Lo que tarda una lista en cerrar el hueco de lo que se fue. */
  shift: 0.4,
  /** Retirada del velo de carga. */
  fade: 0.28,
} as const;

export const EASE = {
  out: "power2.out",
  /** El rebote corto al soltar es lo que hace que el botón se sienta físico. */
  release: "back.out(2.4)",
  /** Oscilación amortiguada para la sacudida de un campo rechazado. */
  shake: "elastic.out(1, 0.32)",
  /**
   * Curva de recorrido: arranca y frena. Es la de lo que se desplaza de un sitio
   * a otro —el indicador de las píldoras, las tarjetas que suben al cerrarse un
   * hueco—, donde el ojo tiene que poder seguir el camino entero.
   */
  move: "power3.inOut",
  /** Un pellizco al aparecer: pasa un poco de largo y vuelve. */
  pop: "back.out(1.8)",
} as const;

/** Separación entre las entradas encadenadas de una misma columna. */
export const STAGGER = 0.075;

/**
 * Las animaciones de entrada se declaran con `gsap.matchMedia`, que ya respeta
 * esta preferencia. Esto es para el movimiento suelto — el que dispara un clic
 * o un error — donde no hay contexto que consultar.
 */
export function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Sacudida corta sobre el campo que el formulario acaba de rechazar. Va en el
 * transform, así que no toca el layout: nada de alrededor se mueve.
 *
 * Es imperativa y no un efecto porque el mismo error puede repetirse (enviar
 * dos veces el mismo dominio inválido) y entonces no hay cambio de estado que
 * observar; lo que hay es un envío más, y cada envío merece su respuesta.
 */
export function shake(target: Element | null) {
  if (!target || reducedMotion()) return;

  gsap.fromTo(
    target,
    { x: -6 },
    { x: 0, duration: 0.5, ease: EASE.shake, clearProps: "x" },
  );
}

/**
 * Una pieza pequeña que aparece o cambia de significado en su propio sitio: el
 * disco de un comentario al darse por resuelto, la tarjeta que acaba de
 * guardarse. No hay recorrido porque no viene de ningún lado; lo que dice el
 * pellizco es «esto de aquí es lo que acaba de cambiar».
 */
export function pop(target: Element | null) {
  if (!target || reducedMotion()) return;

  gsap.fromTo(
    target,
    { scale: 0.72 },
    { scale: 1, duration: DURATION.pop, ease: EASE.pop, clearProps: "scale" },
  );
}

/**
 * Abre un bloque que antes no ocupaba nada: el campo de nombre al pasar a crear
 * cuenta, la franja de aviso del espacio de trabajo, el formulario de redacción.
 *
 * Se anima el alto y no un `scale` porque lo que hay debajo tiene que apartarse
 * de verdad; si el bloque apareciera de golpe, el botón que estaba bajo el dedo
 * se movería sin que nada lo explicara. `overflow` se fuerza durante el tween
 * —el contenido ya está a su tamaño final— y se devuelve al terminar, junto con
 * el alto: dejarlo escrito congelaría la caja a los píxeles del primer render.
 */
export function grow(target: HTMLElement | null) {
  if (!target) return;
  if (reducedMotion()) return;

  gsap.fromTo(
    target,
    { height: 0, opacity: 0, overflow: "hidden" },
    {
      height: "auto",
      opacity: 1,
      duration: DURATION.grow,
      ease: EASE.out,
      overwrite: true,
      clearProps: "height,overflow",
    },
  );
}

/**
 * El movimiento inverso. Recibe qué hacer al terminar porque quien cierra el
 * bloque es React: hay que desmontarlo *después*, no a la vez.
 */
export function collapse(target: HTMLElement | null, done: () => void) {
  if (!target || reducedMotion()) {
    done();
    return;
  }

  gsap.to(target, {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    duration: DURATION.grow,
    ease: "power2.in",
    // Si el bloque vuelve a abrirse antes de terminar de cerrarse, `grow` mata
    // este tween — y un tween muerto no llama a su `onComplete`, que es lo que
    // desmontaría lo que se acaba de pedir otra vez.
    overwrite: true,
    onComplete: done,
  });
}

/**
 * Hace que una lista dé cuenta de lo que le pasa: lo que llega se presenta, y lo
 * que se queda cierra el hueco moviéndose en vez de saltar.
 *
 * Es la técnica FLIP: se apunta dónde estaba cada hijo, React quita o reordena
 * alguno, y a cada superviviente se le pone el desplazamiento contrario y se le
 * anima hasta cero. Como el transform no toca el layout, la lista ya está en su
 * sitio definitivo desde el primer fotograma; lo que se ve moverse es pintura.
 *
 * Aquí importa porque borrar o resolver un comentario es una escritura contra la
 * base y no hay optimismo: la lista se recoloca cuando la respuesta vuelve,
 * décimas después del clic y lejos de donde está mirando el ojo. Sin esto, lo
 * que se ve es un salto que no se puede atribuir a nada.
 *
 * Las posiciones se toman en el `useLayoutEffect` de cada render y se guardan
 * para el siguiente: no hay forma de medir *justo antes* de que React escriba en
 * el DOM, así que se mide siempre después y se compara con lo apuntado la vez
 * anterior. Los hijos se identifican por `data-shift-id`, no por su posición en
 * la lista, que es precisamente lo que cambia.
 *
 * Y se miden unos respecto de otros, no respecto del contenedor: por encima de
 * la lista hay cosas que crecen con su propia animación —el formulario de
 * redacción, la franja de aviso—, y esas bajan a todas las tarjetas por igual.
 * Medido en absoluto, cualquier render suelto durante ese crecimiento leería un
 * desplazamiento que nadie hizo y lo animaría por segunda vez.
 */
export function useListMotion(container: RefObject<HTMLElement | null>) {
  const previous = useRef(new Map<string, number>());
  const first = useRef(true);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-shift-id]"));
    const tops = items.map((item) => item.offsetTop);
    const origin = tops.length > 0 ? Math.min(...tops) : 0;
    const positions = new Map<string, number>();
    // La primera pasada no anima nada: la lista no ha cambiado, es que acaba de
    // llegar. De su entrada se encarga la pantalla, si es que la tiene.
    const quiet = first.current || reducedMotion();
    first.current = false;

    items.forEach((item, index) => {
      const id = item.dataset.shiftId ?? "";
      const top = tops[index] - origin;
      positions.set(id, top);

      if (quiet) return;
      const before = previous.current.get(id);

      // Nuevo: no viene de ningún sitio, así que no se desplaza — aparece. Es el
      // acuse de recibo de un guardado que no es optimista: la tarjeta no existe
      // hasta que la base ha dicho que sí.
      if (before === undefined) {
        gsap.fromTo(
          item,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION.grow,
            ease: EASE.out,
            overwrite: true,
            clearProps: "opacity,transform",
          },
        );
        return;
      }

      if (before === top) return;

      gsap.fromTo(
        item,
        { y: before - top },
        { y: 0, duration: DURATION.shift, ease: EASE.move, overwrite: true },
      );
    });

    previous.current = positions;
  });
}
