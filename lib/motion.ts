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
  /** El relevo de un icono por otro en el mismo sitio: el sol y la luna. */
  swap: 0.44,
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
 * La campana se sacude al pasarle el puntero por encima.
 *
 * Es el único movimiento de la aplicación que no responde a un cambio de estado
 * sino a que alguien se acerque, y por eso tiene que ser corto y terminar solo:
 * lo que dice no es «ha pasado algo», que para eso está el disco verde, sino
 * «esto es una campana, y las campanas suenan». Un icono que se explica al
 * rozarlo se aprende una vez y ya no hace falta el rótulo.
 *
 * El pivote va arriba y al centro, donde iría el clavo del que cuelga: girar
 * desde el medio no es un badajo, es una rueda. Las cuatro oscilaciones se
 * acortan y se amortiguan hasta el reposo elástico, que es cómo se para de
 * verdad algo que cuelga. En total, novecientas milésimas.
 *
 * Se anima el `rotate`, así que no toca el layout: el disco de la cuenta va
 * fuera del icono y se queda quieto donde estaba, que es lo correcto —lo que se
 * mueve es la campana, no el número de cosas que tienes sin ver.
 */
export function ring(target: Element | null): gsap.core.Timeline | null {
  if (!target || reducedMotion()) return null;

  return gsap
    .timeline()
    .set(target, { transformOrigin: "50% 12%" })
    .to(target, { rotate: 14, duration: 0.11, ease: "power2.out" })
    .to(target, { rotate: -11, duration: 0.13, ease: "power1.inOut" })
    .to(target, { rotate: 7, duration: 0.13, ease: "power1.inOut" })
    .to(target, { rotate: -4, duration: 0.13, ease: "power1.inOut" })
    .to(target, { rotate: 0, duration: 0.4, ease: EASE.shake, clearProps: "rotate" });
}

/**
 * El sol gira al pasarle el puntero por encima.
 *
 * Es el hermano de `ring` y comparte su regla: el conmutador de tema es, como la
 * campana, un icono sin rótulo en una barra, y lo que un icono así no puede
 * hacer es esperar a que lo pulsen para explicarse. Un sol que se mueve como se
 * mueve un sol se aprende al rozarlo y ya no hace falta el texto.
 *
 * Gira exactamente cuarenta y cinco grados, que no es una cifra suelta: el sol
 * de Lucide es un disco con ocho rayos, o sea que se repite cada cuarenta y
 * cinco. Al terminar, el `clearProps` lo devuelve a cero de golpe y no se ve el
 * corte, porque los cuarenta y cinco grados y el reposo son el mismo dibujo. Sin
 * esa coincidencia habría que animar la vuelta, y un icono desandando el camino
 * al retirar el puntero se lee como algo que se arrepiente.
 *
 * El pellizco de tamaño va montado encima y dura menos que el giro: la escala es
 * lo que hace que el gesto empiece —responde en dos décimas— y el giro es lo que
 * lo hace durar. Los dos salen del centro, que es donde está el disco.
 */
export function shine(target: Element | null): gsap.core.Timeline | null {
  if (!target || reducedMotion()) return null;

  return gsap
    .timeline()
    .set(target, { transformOrigin: "50% 50%" })
    .to(target, { rotate: 45, duration: 0.8, ease: EASE.out }, 0)
    .to(target, { scale: 1.12, duration: 0.2, ease: EASE.out }, 0)
    .to(target, { scale: 1, duration: 0.6, ease: EASE.release }, 0.2)
    .set(target, { clearProps: "rotate,scale" });
}

/**
 * Y la luna se vence al pasarle el puntero.
 *
 * No podía ser el mismo movimiento que la campana ni que el sol: los tres viven
 * a treinta píxeles unos de otros en el mismo canto de la barra, y tres iconos
 * que se sacuden igual dejan de decir tres cosas. La campana da cuatro golpes
 * cada vez más cortos —eso es un badajo—; el sol da una vuelta continua; la luna
 * hace lo único que le queda, que es inclinarse despacio hacia un lado y volver
 * meciéndose, como algo colgado que alguien acaba de empujar.
 *
 * De ahí el reparto de tiempos, que es al revés que en el sol: un tercio para
 * irse y el doble para volver. Lo que se reconoce de un péndulo no es la ida
 * sino cuánto tarda en pararse.
 */
export function gleam(target: Element | null): gsap.core.Timeline | null {
  if (!target || reducedMotion()) return null;

  return gsap
    .timeline()
    .set(target, { transformOrigin: "50% 50%" })
    .to(target, { rotate: -22, scale: 1.06, duration: 0.34, ease: EASE.out })
    .to(target, {
      rotate: 0,
      scale: 1,
      duration: 0.72,
      ease: "elastic.out(1, 0.45)",
      clearProps: "rotate,scale",
    });
}

/**
 * El relevo: un icono se va girando por un lado mientras el otro entra por el
 * contrario, en el mismo cuadrado de veintiocho píxeles.
 *
 * Se cruzan a propósito. Cambiar de tema repinta la pantalla entera de golpe, y
 * el único sitio donde se puede decir quién ha hecho eso es el botón que se
 * acaba de pulsar; un icono que se cambiara por el otro sin más sería el
 * elemento más quieto de una pantalla donde todo lo demás acaba de cambiar de
 * color. El sentido del giro sigue al gesto —al anochecer todo gira hacia un
 * lado, al amanecer hacia el otro—, así que ir y volver no son el mismo camino.
 *
 * El que entra se solapa doce centésimas con el que se va: sin ese solape hay un
 * fotograma con la caja vacía, y un hueco en el sitio donde está el dedo se lee
 * como que el botón ha desaparecido. `back.out` lo deja pasarse un poco y volver,
 * que es el mismo pellizco con el que aparece cualquier otra pieza del sistema.
 *
 * Los dos estados de partida se escriben con un `gsap.set` suelto y no dentro de
 * la línea de tiempo, que es la única parte de esto que no es cosmética. Quien
 * llama ya ha cambiado el atributo del `<html>`, así que para el CSS el relevo
 * *ya ocurrió*: el que se va está a opacidad cero y el que llega a uno. Una línea
 * de tiempo no pinta su primer fotograma hasta el siguiente tic, y entre medias
 * el navegador tendría un fotograma con los dos iconos exactamente al revés de lo
 * que se va a animar. `gsap.set` escribe en el style ahora mismo, en la misma
 * vuelta del manejador y antes de que se pinte nada.
 *
 * Y al final se limpia todo, que es cuando manda otra vez el CSS —que para
 * entonces lleva medio segundo diciendo lo que acaba de quedar en pantalla—. Sin
 * movimiento no hay nada que hacer: el relevo ya está dado.
 */
export function swap(going: Element | null, coming: Element | null, toDark: boolean) {
  if (!going || !coming || reducedMotion()) return;

  const turn = toDark ? 1 : -1;

  gsap.set(going, { transformOrigin: "50% 50%", rotate: 0, scale: 1, opacity: 1 });
  gsap.set(coming, { transformOrigin: "50% 50%", rotate: -110 * turn, scale: 0.3, opacity: 0 });

  gsap
    .timeline()
    .to(
      going,
      { rotate: 90 * turn, scale: 0.3, opacity: 0, duration: 0.26, ease: "power2.in" },
      0,
    )
    .to(
      coming,
      { rotate: 0, scale: 1, opacity: 1, duration: DURATION.swap, ease: EASE.pop },
      0.12,
    )
    .set([going, coming], { clearProps: "all" });
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
