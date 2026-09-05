"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createComment, deleteComment, setResolved } from "@/app/proyectos/[slug]/actions";
import AnnouncementBar from "@/components/AnnouncementBar";
import Sidebar from "@/components/Sidebar";
import SitePreview from "@/components/SitePreview";
import type { Avatar as AvatarSpec } from "@/lib/avatar";
import { groupByPage, type AnchorHints, type Comment } from "@/lib/comments";
import { authorColor } from "@/lib/author-color";
import { mirrorPath } from "@/lib/mirror";
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
 */
function toMark(comment: Comment, index: number) {
  return {
    id: comment.id,
    selector: comment.selector,
    hints: comment.hints,
    number: index + 1,
    author: asName(comment.author),
    color: comment.resolvedAt ? "#838976" : authorColor(comment.authorEmail || comment.author),
    body: comment.text,
  };
}

function marksFor(comments: Comment[], pageUrl: string) {
  return comments.filter((comment) => comment.pageUrl === pageUrl).map(toMark);
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

  // El manejador de mensajes se monta una vez y no puede leer el estado de después:
  // se queda con el de su render. Esta copia es la que sí está al día cuando llega
  // un "ready" y hay que mandar las marcas de la página nueva.
  const latest = useRef(comments);
  useEffect(() => {
    latest.current = comments;
  }, [comments]);

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
        toFrame({ type: "set-marks", marks: marksFor(latest.current, data.url) });
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

  /** Deja el proyecto en el estado que le dé la función y rehace las marcas. */
  const apply = useCallback(
    (next: Comment[]) => {
      setComments(next);
      toFrame({ type: "set-marks", marks: marksFor(next, pageUrl) });
    },
    [pageUrl, toFrame],
  );

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
  async function saveDraft(text: string) {
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
    });

    setSaving(false);
    if (result.error || !result.comment) {
      setFailure(result.error ?? "No se pudo guardar el comentario.");
      return;
    }

    setDraft(null);
    apply([...comments, result.comment]);
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
          comments={pageComments}
          groups={groups}
          missingIds={missing}
          picking={picking}
          draft={draft}
          saving={saving}
          failure={failure}
          canEdit={canEdit}
          isOwner={isOwner}
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
