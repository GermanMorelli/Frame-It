"use client";

import gsap from "gsap";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteProject } from "@/app/proyectos/actions";
import PendingBar from "@/components/PendingBar";
import { plural } from "@/lib/dates";
import { DURATION, EASE, reducedMotion } from "@/lib/motion";
import { BTN_OUTLINE, BTN_QUIET, BTN_SOLID, FIELD, FIELD_LABEL } from "@/lib/ui";

type DeleteProjectDialogProps = {
  id: string;
  name: string;
  commentCount: number;
  /** Cuenta al dueño: quien se queda fuera es el resto. */
  memberCount: number;
  /**
   * Rótulo del botón que lo abre. Con él el diálogo se abre solo; sin él lo abre
   * quien lo monta —el menú de una tarjeta, que ya tiene su propia entrada.
   */
  trigger?: string;
  open?: boolean;
  onClose?: () => void;
};

/**
 * Borrar un proyecto, preguntado en la pantalla y no por el navegador.
 *
 * `window.confirm` tenía una virtud —nadie puede pintar nada por encima— y un
 * defecto que pesa más: se contesta con la barra espaciadora, sin leerla, y lo
 * que hay detrás son los comentarios de gente que no está delante. Aquí la
 * barrera no es la pregunta sino el nombre: hay que escribirlo, y eso no se
 * puede hacer sin mirar qué se está borrando. El mismo nombre se vuelve a
 * comprobar en la acción de servidor, que es donde de verdad se cierra la puerta.
 *
 * Va sobre durazno, la superficie de aviso del sistema, y se separa del papel
 * con el trazo de tinta que llevan todos los paneles flotantes —ninguna sombra
 * (DESIGN.md)—. El velo de detrás no oscurece para dramatizar: es lo que apaga
 * el resto de la pantalla mientras esta pregunta esté sin contestar.
 *
 * Es un `dialog` nativo, así que el foco se queda dentro, el fondo queda inerte
 * y Escape cierra sin que haya que escribir nada de eso.
 */
export default function DeleteProjectDialog({
  id,
  name,
  commentCount,
  memberCount,
  trigger,
  open,
  onClose,
}: DeleteProjectDialogProps) {
  const [own, setOwn] = useState(false);
  const [typed, setTyped] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLFormElement>(null);
  // La rejilla del panel monta una tarjeta por proyecto: los identificadores no
  // pueden ser literales o dos diálogos compartirían rótulo.
  const uid = useId();

  const showing = trigger ? own : open === true;

  function close() {
    setOwn(false);
    onClose?.();
  }

  // Abrir y cerrar son métodos, no atributos: `open` a pelo pinta el diálogo
  // pero sin velo, sin foco atrapado y sin inertar lo de detrás.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (showing && !element.open) {
      setTyped("");
      element.showModal();
      if (!reducedMotion()) {
        gsap.fromTo(
          panel.current,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: DURATION.message, ease: EASE.out, clearProps: "transform" },
        );
      }
    }
    if (!showing && element.open) element.close();
  }, [showing]);

  // Escape cierra por su cuenta, y el estado tiene que enterarse: si no, volver
  // a pulsar el botón no abriría nada —para React seguiría abierto—.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const sync = () => close();
    element.addEventListener("close", sync);
    return () => element.removeEventListener("close", sync);
  });

  const listo = typed.trim().toLowerCase() === name.trim().toLowerCase();
  const fuera = memberCount - 1;

  return (
    <>
      {/* Lo que destruye se queda en el registro callado: lo que lo hace
          encontrable es la tarjeta de durazno donde vive, no su tamaño (ley de
          Fitts, aplicada al revés — DESIGN.md). */}
      {trigger && (
        <button type="button" onClick={() => setOwn(true)} className={BTN_QUIET}>
          {trigger}
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-titulo`}
        // El clic en el velo cae sobre el propio `dialog`, que no tiene relleno:
        // cualquier impacto en él es un impacto fuera del formulario.
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-card border border-midnight-ink bg-peach-wash p-0 text-midnight-ink backdrop:bg-midnight-ink/25"
      >
        <form ref={panel} action={deleteProject} className="p-6">
          <input type="hidden" name="id" value={id} />

          <h2 id={`${uid}-titulo`} className="text-subheading">
            Borrar «{name}»
          </h2>
          <p className="mt-3 text-body">
            Se lleva por delante {plural(commentCount, "comentario", "comentarios")}
            {fuera > 0 && <> y deja fuera a {plural(fuera, "persona", "personas")}</>}. No se puede
            deshacer.
          </p>

          <label htmlFor={`${uid}-nombre`} className={`mt-6 block ${FIELD_LABEL}`}>
            Escribe el nombre del proyecto
          </label>
          {/* El nombre va de marcador de posición y no en el rótulo: el rótulo
              es versalitas, y ahí «Mercado Libre» se leería MERCADO LIBRE, que
              es justo lo que no hay que escribir. */}
          <input
            id={`${uid}-nombre`}
            name="name"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={name}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className={`mt-2 ${FIELD}`}
          />

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {/* Cancelar va a la izquierda, donde para la lectura y no la mano. */}
            <button type="button" onClick={close} className={BTN_OUTLINE}>
              Cancelar
            </button>
            <Confirm ready={listo} />
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * El botón que borra. Apagado hasta que el nombre coincide: mientras no lo esté,
 * no hay nada que pulsar ahí, así que un resbalón no llega a ninguna parte.
 *
 * Va en su propio componente porque `useFormStatus` solo sabe del formulario que
 * tiene por encima, y aquí el formulario lo pone el diálogo.
 */
function Confirm({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!ready || pending}
      className={`${BTN_SOLID} relative overflow-hidden`}
    >
      {pending && <PendingBar className="absolute inset-x-0 bottom-0 block h-[3px]" />}
      <span>{pending ? "Borrando…" : "Borrar"}</span>
    </button>
  );
}
