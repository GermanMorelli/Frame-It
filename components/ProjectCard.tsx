"use client";

import Link from "next/link";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { deleteProject, removeMember } from "@/app/proyectos/actions";
import SiteThumb from "@/components/SiteThumb";
import { washFor } from "@/lib/author-color";
import { plural, shortDate } from "@/lib/dates";
import { useMenuFocus, useMenuKeys } from "@/lib/menu";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";
import type { Project } from "@/lib/projects";
import { projectPath, workspacePath } from "@/lib/routes";

type ProjectCardProps = {
  project: Project;
  /** Quién mira: decide si el proyecto es suyo y, con eso, qué se puede hacer con él. */
  userId: string;
};

/** Ancho del menú. Hace falta en número para colocarlo antes de poder medirlo. */
const MENU_WIDTH = 208;
/** Aire que se le deja al borde de la ventana. */
const EDGE = 8;

const ITEM =
  "label flex min-h-10 w-full items-center rounded-button px-3 text-left transition hover:bg-soft-mist";

/**
 * Lo que destruye algo no se pinta en rojo —el sistema no tiene rojo— ni se hace
 * más grande. Se queda en piedra de oliva y solo se enciende bajo el puntero, y
 * lo que se enciende es durazno, que es la superficie de aviso (DESIGN.md).
 */
const ITEM_DANGER = `${ITEM} text-olive-stone hover:bg-peach-wash hover:text-midnight-ink`;

/**
 * La tarjeta de un proyecto: la portada del sitio, su nombre y sus cuentas.
 *
 * La tarjeta entera abre el espacio de trabajo —es el blanco más grande que cabe
 * en la pantalla para la acción de siempre (ley de Fitts)— y todo lo demás vive
 * en un menú: el botón derecho, como en cualquier escritorio, o el botón de tres
 * puntos para quien no tiene botón derecho a mano —un móvil, un teclado— y para
 * que el menú se pueda descubrir sin que nadie lo cuente.
 *
 * Lo que aquí se elimina no es lo mismo para todo el mundo: quien creó el
 * proyecto lo borra, con sus comentarios y para todo el equipo; a quien se lo
 * compartieron solo puede salirse de él. Dos verbos distintos porque son dos
 * cosas distintas, y la pregunta de confirmación lo dice con todas las letras.
 */
export default function ProjectCard({ project, userId }: ProjectCardProps) {
  const mine = project.ownerId === userId;
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const dots = useRef<HTMLButtonElement>(null);
  const closedAt = useRef(0);

  const close = useCallback((restoreFocus = true) => {
    closedAt.current = Date.now();
    setAt(null);
    // El foco vuelve siempre a los tres puntos: es el sitio del que sale el menú
    // para el teclado, y también donde lo esperaría quien lo abrió con el ratón.
    if (restoreFocus) dots.current?.focus();
  }, []);

  return (
    <li
      className="relative flex flex-col overflow-hidden rounded-card border border-soft-mist transition hover:border-midnight-ink"
      onContextMenu={(event) => {
        event.preventDefault();
        setAt({ x: event.clientX, y: event.clientY });
      }}
    >
      <SiteThumb url={project.startUrl} wash={washFor(project.slug)} width={800} />

      <div className="flex flex-1 flex-col justify-between gap-6 p-4">
        {/* Los tres puntos van en la fila del título, no sobre la foto: encima de
            una captura cualquiera son un botón puesto sobre una imagen ajena, y
            se leen como parte de ella. Aquí caen en el chrome de la tarjeta —el
            papel, donde vive todo lo demás que se pulsa— y quedan a la altura de
            lo que nombran. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-subheading">
              <Link
                href={workspacePath(project.slug)}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {project.name}
              </Link>
            </h2>
            {/* El dominio baja aquí: arriba lo dice ya la foto, y un dominio se lee
                carácter a carácter, o sea en la monoespaciada (DESIGN.md). */}
            <p
              className="mt-1 truncate font-mono text-caption text-olive-stone"
              title={project.siteHost}
            >
              {project.siteHost}
            </p>
          </div>

          {/* Por encima del enlace estirado (`z-10`), que si no se lo tragaría. */}
          <button
            ref={dots}
            type="button"
            aria-haspopup="menu"
            aria-expanded={at !== null}
            aria-label={`Acciones de ${project.name}`}
            onClick={(event) => {
              // Este botón solo abre; de cerrar ya se encarga el velo del menú,
              // que se traga el `pointerdown` de este mismo clic. Sin el compás
              // de espera, el `click` que viene detrás —cuando el velo ya no
              // está— volvería a abrir lo que se acaba de cerrar, y el menú
              // parecería clavado en pantalla.
              if (Date.now() - closedAt.current < 250) return;
              const box = event.currentTarget.getBoundingClientRect();
              setAt({ x: box.right - MENU_WIDTH, y: box.bottom + 6 });
            }}
            /* El dibujo mide 32px porque es lo que cabe en la fila de un título
               de 19px sin pesar más que él, pero el blanco no tiene por qué
               medir lo mismo: el `before` le añade seis píxeles por lado y lo
               deja en 44, que es un blanco de dedo. No mueve nada —es un
               pseudoelemento absoluto— y va por encima del enlace estirado
               (`z-10`), que si no se tragaría el anillo de fuera. */
            className="label before:absolute before:-inset-1.5 before:content-[''] relative z-10 flex size-8 shrink-0 items-center justify-center rounded-button border border-midnight-ink bg-paper-white leading-none text-midnight-ink transition hover:bg-midnight-ink hover:text-paper-white"
          >
            <span aria-hidden>···</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* La cifra que dice si queda trabajo va en verde voltaje; cuando no
              queda ninguno, no hay insignia que mirar. */}
          {project.openCount > 0 && (
            <span className="label-xs rounded-button bg-lime-voltage px-2 py-1">
              {project.openCount} sin resolver
            </span>
          )}
          {!mine && (
            <span className="label-xs rounded-button border border-soft-mist px-2 py-1 text-olive-stone">
              Compartido
            </span>
          )}
          <p className="text-caption text-olive-stone">
            {plural(project.commentCount, "comentario", "comentarios")} ·{" "}
            {shortDate(project.lastActivity)}
          </p>
        </div>
      </div>

      {at && (
        <CardMenu at={at} label={`Acciones de ${project.name}`} onClose={close}>
          <Link href={projectPath(project.slug)} role="menuitem" className={ITEM}>
            Ajustes
          </Link>

          {/* Un `form` entre el menú y su entrada rompería la cadena que ARIA
              espera (menu › menuitem): `role="none"` lo hace transparente sin
              quitarlo, que es lo que envía la acción de servidor. */}
          {mine ? (
            <form action={deleteProject} role="none">
              <input type="hidden" name="id" value={project.id} />
              <MenuSubmit
                confirm={`¿Borrar «${project.name}»? Se lleva por delante ${plural(
                  project.commentCount,
                  "comentario",
                  "comentarios",
                )} y no se puede deshacer.`}
              >
                Eliminar
              </MenuSubmit>
            </form>
          ) : (
            <form action={removeMember} role="none">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="slug" value={project.slug} />
              <MenuSubmit confirm={`¿Salir de «${project.name}»? Dejarás de ver sus comentarios.`}>
                Salir del proyecto
              </MenuSubmit>
            </form>
          )}
        </CardMenu>
      )}
    </li>
  );
}

/**
 * La entrada del menú que destruye algo. La confirmación es la del navegador, por
 * lo mismo que en `DangerButton`: es la única que no se puede pintar por detrás de
 * otra cosa, y esto borra comentarios de gente que no está delante de la pantalla.
 */
function MenuSubmit({ children, confirm }: { children: ReactNode; confirm: string }) {
  return (
    <button
      type="submit"
      role="menuitem"
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className={ITEM_DANGER}
    >
      {children}
    </button>
  );
}

type CardMenuProps = {
  /** Esquina superior izquierda pedida. Si no cabe ahí, se recoloca. */
  at: { x: number; y: number };
  label: string;
  onClose: (restoreFocus?: boolean) => void;
  children: ReactNode;
};

/**
 * El menú flotante, colgado del `body`.
 *
 * Va por portal y no dentro de la tarjeta porque la tarjeta recorta lo que se
 * sale de ella (`overflow-hidden`, que es lo que redondea la foto): ahí dentro,
 * el menú se cortaría por el canto. Y no lleva sombra: lo que lo separa del papel
 * es el trazo de tinta, igual que el panel de nuevo proyecto (DESIGN.md).
 *
 * El velo de detrás no oscurece nada —es transparente—; está para que el clic que
 * cierra el menú muera ahí. Sin él, ese mismo clic caería sobre la tarjeta que
 * hay debajo y abriría un proyecto que nadie pidió.
 */
function CardMenu({ at, label, onClose, children }: CardMenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(at);

  // Se coloca midiendo, y antes de pintar: leerlo después dejaría ver un
  // fotograma del menú saliéndose por debajo de la ventana.
  useLayoutEffect(() => {
    const box = panel.current?.getBoundingClientRect();
    if (!box) return;
    setPlaced({
      x: Math.max(EDGE, Math.min(at.x, window.innerWidth - box.width - EDGE)),
      y: Math.max(EDGE, Math.min(at.y, window.innerHeight - box.height - EDGE)),
    });
  }, [at]);

  // Montado es abierto: este menú solo existe mientras lo está.
  useMenuFocus(panel, true);

  useEffect(() => {
    // Con el scroll el menú se quedaría flotando lejos de la tarjeta de la que
    // salió: se cierra. Sin devolver el foco, que quien hace scroll ya está
    // mirando a otro sitio y devolvérselo lo traería de vuelta de un salto.
    const dismiss = () => onClose(false);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [onClose]);

  useEffect(() => {
    if (reducedMotion()) return;
    const tween = gsap.fromTo(
      panel.current,
      { opacity: 0, y: -6 },
      { opacity: 1, y: 0, duration: DURATION.message, ease: EASE.out, clearProps: "transform" },
    );
    return () => {
      tween.kill();
    };
  }, []);

  // Arriba, abajo, las dos de extremo y Escape: lo mismo que el menú del
  // perfil, y por eso el recorrido vive en `lib/menu.ts` y no aquí.
  const onKeyDown = useMenuKeys(panel, onClose);

  return createPortal(
    <div
      className="fixed inset-0 z-40"
      onPointerDown={() => onClose()}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={panel}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
        style={{ left: placed.x, top: placed.y, width: MENU_WIDTH }}
        className="absolute rounded-card border border-midnight-ink bg-paper-white p-1"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
