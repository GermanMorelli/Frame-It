"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createComment,
  deleteComment,
  refreshComments,
  setResolved,
} from "@/app/proyectos/[slug]/actions";
import AnnouncementBar from "@/components/AnnouncementBar";
import Sidebar from "@/components/Sidebar";
import SitePreview from "@/components/SitePreview";
import { avatarSrc, type Avatar as AvatarSpec } from "@/lib/avatar";
import { groupByPage, splitMentions, type AnchorHints, type Comment } from "@/lib/comments";
import { authorColor, washById, washOf } from "@/lib/author-color";
import { mirrorPath } from "@/lib/mirror";
import { useLive, type Watcher } from "@/lib/live";
import type { Member } from "@/lib/projects";
import { displayHost } from "@/lib/url";
import { asName } from "@/lib/user";

type FrameMessage =
  | { source: "frameit-frame"; type: "ready"; url: string }
  | { source: "frameit-frame"; type: "picked"; selector: string; label: string; hints: AnchorHints }
  | { source: "frameit-frame"; type: "marks-applied"; missing: string[] }
  | { source: "frameit-frame"; type: "reveal-missing"; id: string }
  | { source: "frameit-frame"; type: "painted" }
  | { source: "frameit-frame"; type: "load-error"; detail: string; url: string }
  | { source: "frameit-frame"; type: "pong"; url: string };

export type Draft = { selector: string; label: string; hints: AnchorHints };

/** Lo mínimo del proyecto que necesita el espacio de trabajo. */
export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Lo que el anotador necesita para reencontrar y perfilar un elemento, y para
 * decir de quién es al pasar el cursor por encima. Lo resuelto se perfila en gris:
 * sigue estando, pero ya no es algo que mirar.
 *
 * La cara viaja resuelta —dirección, lavado y inicial— y no como el estilo y la
 * semilla que la componen: el anotador es un texto que corre dentro de una
 * página ajena y no puede importar nada de aquí, así que lo que no se resuelva
 * en este lado tendría que duplicarse allí en la mano.
 *
 * Por lo mismo viaja el texto ya partido en lo que es mención y lo que no: quién
 * está en el equipo se sabe aquí, y el globo solo tiene que pintar lo que le
 * llega. Es la misma cuenta que hace la lista de la columna, hecha una vez
 * (`splitMentions`), para que las dos resalten exactamente los mismos nombres.
 */
function toMark(comment: Comment, index: number, names: string[]) {
  const author = asName(comment.author);
  const key = comment.authorEmail || comment.author;
  // El mismo lavado con el que se pide el dibujo y con el que se pinta el disco
  // de debajo: separarlos devolvería el canto de color al llegar la imagen.
  const wash = comment.authorAvatar.bg ? washById(comment.authorAvatar.bg) : washOf(key);

  return {
    id: comment.id,
    selector: comment.selector,
    hints: comment.hints,
    number: index + 1,
    author,
    color: comment.resolvedAt ? "#838976" : authorColor(key),
    avatar: avatarSrc(comment.authorAvatar, wash.hex),
    bg: "#" + wash.hex,
    initial: author.trim().charAt(0) || "·",
    body: splitMentions(comment.text, names),
  };
}

function marksFor(comments: Comment[], pageUrl: string, names: string[]) {
  return comments
    .filter((comment) => comment.pageUrl === pageUrl)
    .map((comment, index) => toMark(comment, index, names));
}

type WorkspaceProps = {
  project: WorkspaceProject;
  /** Página por la que se abre. Puede cambiar si se navega por el sitio. */
  url: string;
  /** Todos los comentarios del proyecto, de todas sus páginas y de todo el equipo. */
  initialComments: Comment[];
  /** Quién está dentro: decide qué comentarios puede borrar. */
  userId: string;
  userName: string;
  /** Y su cara, que se enseña en el pie de la columna de comentarios. */
  userAvatar: AvatarSpec;
  userEmail: string;
  /** Los invitados como "solo mira" leen los comentarios pero no escriben. */
  canEdit: boolean;
  /** El dueño puede borrar el comentario de cualquiera, para poder limpiar. */
  isOwner: boolean;
  /** El equipo, para poder señalar a alguien con una arroba al comentar. */
  members: Member[];
};

export default function Workspace({
  project,
  url,
  initialComments,
  userId,
  userName,
  userAvatar,
  userEmail,
  canEdit,
  isOwner,
  members,
}: WorkspaceProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // La página puede cambiar si el usuario navega por enlaces dentro del proxy.
  const [pageUrl, setPageUrl] = useState(url);
  /** Los del proyecto entero: la lista de la izquierda los agrupa por página. */
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Ids de los comentarios cuyo elemento no aparece en la página actual. */
  const [missing, setMissing] = useState<string[]>([]);
  /** Hay una escritura en vuelo: el formulario no debe aceptar otra encima. */
  const [saving, setSaving] = useState(false);
  /** Lo que la base rechazó, dicho donde se intentó. */
  const [failure, setFailure] = useState<string | null>(null);
  // El iframe ya tiene algo pintado: sirve para retirar el velo de carga, que si no
  // se quedaría puesto tapando la página en los sitios que tardan en emitir load.
  const [painted, setPainted] = useState(false);
  // El sitio no llegó a servirse (DNS, conexión rechazada, tiempo agotado). No es
  // lo mismo que escaparse del proxy y el aviso no debe confundirlos.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Un sitio puede llevarse el iframe fuera del proxy con location.href, que es
  // unforgeable y no se puede interceptar. Sí se puede detectar: si nadie responde
  // al ping, el documento ya no es el nuestro.
  const [escaped, setEscaped] = useState(false);
  const pongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Comentario al que ir en cuanto termine de cargar la página a la que se saltó. */
  const pendingReveal = useRef<string | null>(null);

  /**
   * Los nombres que una arroba puede estar señalando, el propio incluido: en la
   * lista lo que hay que reconocer de un vistazo es cuándo va contigo. Se calcula
   * aquí porque lo necesitan los dos sitios donde se pinta un comentario —la
   * columna y el globo sobre la página—, y no puede ser una cuenta por sitio.
   */
  const names = useMemo(
    () => [userName, ...members.map((member) => member.name)].filter(Boolean),
    [userName, members],
  );

  // El manejador de mensajes se monta una vez y no puede leer el estado de después:
  // se queda con el de su render. Esta copia es la que sí está al día cuando llega
  // un "ready" y hay que mandar las marcas de la página nueva: los comentarios, y
  // los nombres contra los que se resaltan sus menciones.
  const latest = useRef({ comments, names });
  useEffect(() => {
    latest.current = { comments, names };
  }, [comments, names]);

  const toFrame = useCallback((message: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(
      { source: "frameit-parent", ...message },
      window.location.origin,
    );
  }, []);

  // Se comprueba con un ping tras cada carga y no esperando el saludo inicial: ese
  // llega durante el parseo, antes del evento load, así que armar el temporizador
  // después lo haría saltar siempre.
  const handleFrameLoad = useCallback(() => {
    if (pongTimer.current) clearTimeout(pongTimer.current);
    toFrame({ type: "ping" });
    pongTimer.current = setTimeout(() => setEscaped(true), 2500);
  }, [toFrame]);

  useEffect(
    () => () => {
      if (pongTimer.current) clearTimeout(pongTimer.current);
    },
    [],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // El origen es opaco, así que la identidad se comprueba por la ventana emisora.
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data as FrameMessage | undefined;
      if (!data || data.source !== "frameit-frame") return;

      if (data.type === "ready") {
        if (pongTimer.current) clearTimeout(pongTimer.current);
        setEscaped(false);
        setLoadError(null);
        setPageUrl(data.url);
        setPicking(false);
        setDraft(null);
        // Los no anclados son de la página anterior hasta que el marcado responda.
        setMissing([]);
        toFrame({ type: "set-marks", marks: marksFor(latest.current.comments, data.url, latest.current.names) });
        // Se saltó aquí desde el comentario de otra página: ahora toca ir al elemento.
        // El anotador reintenta por su cuenta mientras el cuerpo se arma.
        if (pendingReveal.current) {
          toFrame({ type: "reveal", id: pendingReveal.current });
          pendingReveal.current = null;
        }
      }
      if (data.type === "load-error") {
        if (pongTimer.current) clearTimeout(pongTimer.current);
        setEscaped(false);
        setLoadError(data.detail);
        setPainted(true);
        setPicking(false);
        setDraft(null);
        setMissing([]);
        pendingReveal.current = null;
      }
      if (data.type === "picked") {
        setDraft({ selector: data.selector, label: data.label, hints: data.hints });
        setPicking(false);
        toFrame({ type: "set-mode", picking: false });
      }
      if (data.type === "pong") {
        if (pongTimer.current) clearTimeout(pongTimer.current);
        setEscaped(false);
      }
      if (data.type === "painted") setPainted(true);
      if (data.type === "marks-applied") setMissing(data.missing);
      // El elemento se buscó al pedir "llévame ahí" y no apareció: la lista debe
      // decirlo aunque el marcado periódico aún no haya informado.
      if (data.type === "reveal-missing") {
        setMissing((previous) => (previous.includes(data.id) ? previous : [...previous, data.id]));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [toFrame]);

  const pageComments = useMemo(
    () => comments.filter((comment) => comment.pageUrl === pageUrl),
    [comments, pageUrl],
  );
  const groups = useMemo(() => groupByPage(comments), [comments]);

  /**
   * Quién eres tú para los demás mientras tengas esto abierto.
   *
   * Se resuelve entero aquí, y por lo mismo que se resuelve una marca en
   * `toMark`: lo que sale de esta pantalla no puede depender de nada que solo
   * exista en esta pantalla. Tu color y tu lavado salen de tu correo
   * (`lib/author-color.ts`), y el correo no viaja —el canal de presencia es
   * público (`lib/supabase/browser.ts`)—, así que la cuenta se hace de este lado
   * y lo que se manda es el resultado: un color y una cara con su fondo ya
   * elegido, que es lo justo para dibujarte donde no te conocen.
   */
  const me = useMemo<Watcher>(
    () => ({
      id: userId,
      name: userName,
      avatar: { ...userAvatar, bg: userAvatar.bg ?? washOf(userEmail || userName).id },
      tint: authorColor(userEmail || userName),
      page: pageUrl,
    }),
    [userId, userName, userAvatar, userEmail, pageUrl],
  );

  /** Deja el proyecto en el estado que le dé la función y rehace las marcas. */
  const apply = useCallback(
    (next: Comment[]) => {
      setComments(next);
      toFrame({ type: "set-marks", marks: marksFor(next, pageUrl, names) });
    },
    [names, pageUrl, toFrame],
  );

  /** Hay una lectura de comentarios en vuelo, y si llegó otro aviso mientras tanto. */
  const pulling = useRef(false);
  const again = useRef(false);

  /**
   * Vuelve a pedir los comentarios del proyecto porque alguien los tocó.
   *
   * Se pide la lista entera y no el comentario que cambió: el aviso que llega
   * por el canal no dice qué pasó —a propósito, `refreshComments` explica por
   * qué—, así que aquí no hay nada que parchear, hay que volver a mirar. Sale
   * barato porque solo ocurre cuando alguien del equipo escribe de verdad.
   *
   * Dos avisos seguidos no son dos lecturas simultáneas: la segunda espera a que
   * termine la primera y se hace una sola vez al final. Dos personas comentando
   * a la vez es exactamente el caso para el que existe esto, y sería raro que
   * fuera el que abriera tres consultas a la vez.
   */
  const pullComments = useCallback(async () => {
    if (pulling.current) {
      again.current = true;
      return;
    }

    pulling.current = true;
    try {
      do {
        again.current = false;
        const fresh = await refreshComments(project.id);
        // Null es «no se pudo preguntar», y entonces no se toca nada: dejar la
        // lista como está es siempre mejor que vaciarla por un tropiezo de red.
        if (fresh) apply(fresh);
      } while (again.current);
    } finally {
      pulling.current = false;
    }
  }, [project.id, apply]);

  /**
   * Quién más está mirando, y el hilo por el que llegan y salen los avisos de que
   * los comentarios cambiaron. Sin red, la fila se queda contigo y la pantalla
   * sigue funcionando igual que antes de que esto existiera.
   */
  const { watchers, announce } = useLive({
    projectId: project.id,
    me,
    onChanged: pullComments,
  });

  function togglePicking() {
    const next = !picking;
    setPicking(next);
    if (next) setDraft(null);
    setFailure(null);
    toFrame({ type: "set-mode", picking: next });
  }

  /**
   * Guarda el comentario en la base y solo entonces lo pinta. Sin optimismo a
   * propósito: si RLS lo rechaza, la marca se habría quedado en la página como si
   * el equipo fuera a verla, y no la vería nadie más.
   */
  async function saveDraft(text: string, mentions: string[]) {
    if (!draft || saving) return;
    setSaving(true);
    setFailure(null);

    const result = await createComment({
      projectId: project.id,
      slug: project.slug,
      pageUrl,
      selector: draft.selector,
      hints: draft.hints,
      label: draft.label,
      text,
      mentions,
    });

    setSaving(false);
    if (result.error || !result.comment) {
      setFailure(result.error ?? "No se pudo guardar el comentario.");
      return;
    }

    setDraft(null);
    apply([...comments, result.comment]);
    announce();
  }

  function discardDraft() {
    setDraft(null);
    setFailure(null);
  }

  async function removeComment(id: string) {
    if (saving) return;
    setSaving(true);
    setFailure(null);

    const result = await deleteComment(id, project.slug);
    setSaving(false);
    if (result.error) {
      setFailure(result.error);
      return;
    }

    setMissing((previous) => previous.filter((missingId) => missingId !== id));
    apply(comments.filter((comment) => comment.id !== id));
    announce();
  }

  async function toggleResolved(id: string, resolved: boolean) {
    if (saving) return;
    setSaving(true);
    setFailure(null);

    const result = await setResolved(id, project.slug, resolved);
    setSaving(false);
    if (result.error) {
      setFailure(result.error);
      return;
    }

    apply(
      comments.map((comment) =>
        comment.id === id ? { ...comment, resolvedAt: result.resolvedAt ?? null } : comment,
      ),
    );
    // También al resolver y al reabrir: lo que cambia es el color de una marca
    // sobre la página del otro, y una marca que dice "esto sigue abierto" cuando
    // ya no lo está es peor que no tenerla.
    announce();
  }

  /**
   * Lleva la vista previa hasta el elemento comentado. Si el comentario es de otra
   * página, primero se salta a ella: el elemento no está en la que se ve ahora.
   */
  function revealComment(commentPage: string, id: string) {
    if (commentPage === pageUrl) {
      toFrame({ type: "reveal", id });
      return;
    }
    const frame = frameRef.current;
    if (!frame) return;
    pendingReveal.current = id;
    // Se navega por el atributo src y no por contentWindow.location: si la página
    // anterior se salió del proxy, tocar su location sería un acceso entre orígenes.
    frame.src = mirrorPath(commentPage);
  }

  const blocked = escaped || loadError !== null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {escaped && (
        <AnnouncementBar
          message="Aquí no se puede comentar: la página salió del proxy o no es un documento HTML."
          href={pageUrl}
          action="Ábrelo en una pestaña"
        />
      )}

      {!escaped && loadError && (
        <AnnouncementBar
          message={`No se pudo cargar ${displayHost(pageUrl)}: ${loadError}`}
          href={pageUrl}
          action="Ábrelo en una pestaña"
        />
      )}

      {!blocked && missing.length > 0 && (
        <AnnouncementBar
          message={`${missing.length === 1 ? "Un comentario no se pudo anclar" : `${missing.length} comentarios no se pudieron anclar`}: su elemento ya no existe en la página.`}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          project={project}
          url={pageUrl}
          userId={userId}
          userName={userName}
          userAvatar={userAvatar}
          userEmail={userEmail}
          me={me}
          watchers={watchers}
          comments={pageComments}
          groups={groups}
          missingIds={missing}
          picking={picking}
          draft={draft}
          saving={saving}
          failure={failure}
          canEdit={canEdit}
          isOwner={isOwner}
          names={names}
          members={members}
          disabled={blocked}
          disabledReason={
            escaped
              ? "No disponible: la página abandonó el proxy o no es HTML."
              : "No disponible: la página no se pudo cargar."
          }
          onTogglePicking={togglePicking}
          onSaveDraft={saveDraft}
          onDiscardDraft={discardDraft}
          onDeleteComment={removeComment}
          onToggleResolved={toggleResolved}
          onRevealComment={revealComment}
        />
        <SitePreview
          ref={frameRef}
          url={url}
          painted={painted}
          picking={picking}
          onFrameLoad={handleFrameLoad}
        />
      </div>
    </div>
  );
}
