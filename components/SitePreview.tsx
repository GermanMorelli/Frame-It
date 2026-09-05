"use client";

import gsap from "gsap";
import { forwardRef, useEffect, useRef, useState } from "react";
import PendingBar from "@/components/PendingBar";
import { mirrorPath } from "@/lib/mirror";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";
import { displayHost } from "@/lib/url";

/**
 * El sitio se sirve por el proxy, bajo una ruta que calca la suya, para que sea
 * mismo-origen —y el script de anotación pueda inyectarse— sin descolocar lo que
 * su propio JavaScript resuelve contra la URL del documento (lib/mirror.ts).
 *
 * `allow-same-origin` es necesario: sin él el documento cae en un origen opaco y
 * las APIs que muchos sitios usan al arrancar (Web Locks, storage) lanzan, dejando
 * la página en blanco. El precio es que el JS del sitio proxiado corre en nuestro
 * origen y puede leer el localStorage de los comentarios; aislarlo requiere servir
 * el proxy desde otro dominio.
 */
type SitePreviewProps = {
  url: string;
  /** El documento ya pintó algo (o falló): el velo debe quitarse de en medio. */
  painted: boolean;
  /** Está armado el modo de señalar: la vista previa entera es el blanco. */
  picking: boolean;
  /** Se dispara en cada carga del iframe, incluidas las que provoca el propio sitio. */
  onFrameLoad: () => void;
};

const SitePreview = forwardRef<HTMLIFrameElement, SitePreviewProps>(function SitePreview(
  { url, painted, picking, onFrameLoad },
  ref,
) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  // Montar el iframe solo en cliente: si carga antes de la hidratación, el evento
  // load ya pasó cuando se adjunta onLoad y el overlay se quedaría colgado.
  const [mounted, setMounted] = useState(false);
  const veil = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLSpanElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 20000);
    return () => clearTimeout(timer);
  }, []);

  // El velo es opaco y se come los clics, así que se retira en cuanto la página
  // sirve para algo: pintó contenido, terminó de cargar, o se agotó la espera.
  const loading = !painted && !loaded && !timedOut;
  // Se sigue pintando mientras se desvanece: quien lo retira es el tween, no el
  // render. Un velo opaco que desaparece de golpe se lee como un fallo de
  // pintado; fundiéndose se lee como una página que acaba de llegar.
  const [showVeil, setShowVeil] = useState(true);

  useEffect(() => {
    if (loading || !showVeil) return;

    if (reducedMotion()) {
      setShowVeil(false);
      return;
    }

    const tween = gsap.to(veil.current, {
      autoAlpha: 0,
      duration: DURATION.fade,
      ease: EASE.out,
      onComplete: () => setShowVeil(false),
    });

    return () => {
      tween.kill();
    };
  }, [loading, showVeil]);

  // El encuadre encendido. La orden de señalar se da en la barra de la izquierda
  // y se cumple con un clic dentro del iframe, a media pantalla de distancia: sin
  // esto, lo único que dice que el modo está armado es el cursor de cruz, que
  // aparece únicamente cuando ya se está encima. Doble trazo —verde por dentro,
  // tinta por fuera— porque cae sobre un sitio del que no se sabe el color, igual
  // que las marcas del anotador (DESIGN.md).
  useEffect(() => {
    if (reducedMotion()) {
      gsap.set(frame.current, { autoAlpha: picking ? 1 : 0 });
      return;
    }

    gsap.to(frame.current, {
      autoAlpha: picking ? 1 : 0,
      duration: DURATION.message,
      ease: EASE.out,
    });
  }, [picking]);

  return (
    <div className="relative flex-1">
      {mounted && (
        <iframe
          ref={ref}
          src={mirrorPath(url)}
          title={`Vista previa de ${displayHost(url)}`}
          onLoad={() => {
            setLoaded(true);
            onFrameLoad();
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-paper-white"
        />
      )}

      <span
        ref={frame}
        aria-hidden
        className="pointer-events-none invisible absolute inset-0 z-10 border border-midnight-ink"
      >
        <span className="absolute inset-0 border-[3px] border-lime-voltage" />
      </span>

      {showVeil && (
        <div
          ref={veil}
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-paper-white"
        >
          <span className="label-xs text-olive-stone">Cargando {displayHost(url)}…</span>
          <PendingBar track className="block h-[3px] w-40 rounded-button" />
        </div>
      )}
    </div>
  );
});

export default SitePreview;
