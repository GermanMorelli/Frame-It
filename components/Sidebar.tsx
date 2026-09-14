"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import FormMessage from "@/components/FormMessage";
import GuestClaim from "@/components/GuestClaim";
import MentionBox, { mentionsIn } from "@/components/MentionBox";
import Watchers from "@/components/Watchers";
import type { Draft, WorkspaceProject } from "@/components/Workspace";
import type { Avatar as AvatarSpec } from "@/lib/avatar";
import { splitMentions, type Comment, type CommentGroup } from "@/lib/comments";
import { grow, pop, useListMotion } from "@/lib/motion";
import type { Watcher } from "@/lib/live";
import type { Member } from "@/lib/projects";
import { projectPath, workspacePath } from "@/lib/routes";
import { BADGE, BTN_ON, BTN_QUIET, BTN_SOLID_SM } from "@/lib/ui";
import { displayHost, pageLabel } from "@/lib/url";
import { asName } from "@/lib/user";

type SidebarProps = {
  project: WorkspaceProject;
  url: string;
  /** Quién está dentro: decide qué comentarios puede borrar. */
  userId: string;
  userName: string;
  /** Y su cara, para el pie de la columna. */
  userAvatar: AvatarSpec;
  userEmail: string;
  /** Tú mismo, tal y como te ven los demás en la fila de quién está mirando. */
  me: Watcher;
  /** Y quién más tiene el proyecto abierto ahora mismo, sin ti. */
  watchers: Watcher[];
  /** Comentarios de la página que se está viendo. */
  comments: Comment[];
  /** Todas las páginas con comentarios, para agrupar la lista. */
  groups: CommentGroup[];
  /** Comentarios cuyo elemento ya no existe en la página que se ve ahora. */
  missingIds: string[];
  /**
   * Y los que existen pero no están delante, con el rótulo que hay que abrir para
   * llegar a ellos: la página está en otro paso del formulario, o el modal donde
   * se comentó está cerrado. Sin entrada quiere decir que sí está a la vista; con
   * el rótulo vacío, que no se sabe cuál abrir.
   */
  awayViews: Record<string, string>;
  picking: boolean;
  draft: Draft | null;
  /** Hay una escritura en vuelo contra la base. */
  saving: boolean;
  /** Lo que la base rechazó, si rechazó algo. */
  failure: string | null;
  /** Los invitados como "solo mira" leen los comentarios pero no escriben. */
  canEdit: boolean;
  /** Dar por resuelto es del equipo, no de quien entró por un enlace. */
  canResolve: boolean;
  isOwner: boolean;
  /**
   * Contra qué nombres se resaltan las menciones del texto. Llega hecho y no se
   * calcula aquí porque el globo que sale sobre la página revisada tiene que
   * resaltar exactamente los mismos (`Workspace`).
   */
  names: string[];
  /**
   * Quien entró por un enlace de invitado. Aquí no cambia lo que puede hacer
   * —eso lo dicen `canEdit` y `canResolve`— sino a dónde puede ir: no tiene
   * panel de proyectos, ni ajustes del proyecto, ni cuenta que tocar, así que
   * los enlaces del chrome no llevarían a ninguna parte.
   */
  isGuest: boolean;
  /** El equipo, sin uno mismo: a quién se puede señalar con una arroba. */
  members: Member[];
  /** No hay página anotable: se salió del proxy o no llegó a cargar. */
  disabled: boolean;
  /** Qué decir bajo el botón mientras está deshabilitado. */
  disabledReason: string;
  onTogglePicking: () => void;
  onSaveDraft: (text: string, mentions: string[]) => void;
  onDiscardDraft: () => void;
  onDeleteComment: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
  onRevealComment: (pageUrl: string, id: string) => void;
};

/**
 * La barra del espacio de trabajo: el proyecto arriba, el botón de comentar
 * debajo y la lista de lo comentado ocupando todo lo que sobra.
 *
 * Aquí el aire se gana quitando, no espaciando. Lo que se fue:
 *
 *   · Los bordes. Cada comentario iba en su propia caja con regla de 1px, y una
 *     lista de ocho comentarios eran ocho rectángulos. Las tarjetas ya no tienen
 *     borde: lo que las separa es el espacio, y lo que dice cuál se va a pulsar
 *     es el fondo al pasar por encima. En toda la columna queda una sola regla,
 *     la que separa el chrome de la lista.
 *   · El bloque de color de cada autor. El número ya identifica la marca, y era
 *     un elemento gráfico más en una columna que tenía de sobra. En su hueco hay
 *     ahora una cara, que no es lo mismo: aquel bloque repetía lo que el número
 *     ya decía —cuál es la marca—, y la cara dice lo único que en esta lista hay
 *     que leer nombre a nombre, que es de quién es cada comentario.
 *   · El selector del elemento (`h1 · Corte láser…`) en cada tarjeta: es dato de
 *     máquina repetido en toda la lista. Sigue donde hace falta —al redactar,
 *     para saber qué se eligió— y en el título al pasar por encima.
 *   · El pie con la URL entera y su «Abrir en pestaña nueva». Abrir el sitio de
 *     verdad vive en el enlace de arriba, que ya es su dirección: la flecha dice
 *     que sale fuera sin tener que escribirlo.
 *   · Dos de las tres frases de ayuda. Queda una, y solo cuando dice algo que no
 *     se ve en la pantalla.
 */
export default function Sidebar({
  project,
  url,
  userId,
  userName,
  userAvatar,
  userEmail,
  me,
  watchers,
  comments,
  groups,
  missingIds,
  awayViews,
  picking,
  draft,
  saving,
  failure,
  canEdit,
  canResolve,
  isOwner,
  names,
  isGuest,
  members,
  disabled,
  disabledReason,
  onTogglePicking,
  onSaveDraft,
  onDiscardDraft,
  onDeleteComment,
  onToggleResolved,
  onRevealComment,
}: SidebarProps) {
  // Qué secciones ha abierto o cerrado el usuario a mano. Lo que no ha tocado sigue
  // a la página que se está viendo, que es la que interesa al llegar.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (pageUrl: string) => toggled[pageUrl] ?? pageUrl === url;
  const toggle = (pageUrl: string) =>
    setToggled((previous) => ({ ...previous, [pageUrl]: !isOpen(pageUrl) }));

  // Solo se secciona cuando hay comentarios repartidos por varias páginas: con una
  // sola, un encabezado de página sería un escalón de más para llegar a lo mismo.
  const sectioned = groups.length > 1;
  const current = groups.filter((group) => group.pageUrl === url);
  const others = groups.filter((group) => group.pageUrl !== url);
  const ordered = [...current, ...others];
  const total = groups.reduce((count, group) => count + group.comments.length, 0);

  /** Borrar el comentario de otro es cosa del dueño; el propio, de cada quien. */
  const canDelete = (comment: Comment) => isOwner || comment.authorId === userId;

  /** La única línea de ayuda que se permite. Vacía cuando no hace falta. */
  const hint = !canEdit
    ? "Solo puedes leer los comentarios."
    : disabled
      ? disabledReason
      : picking
        ? "Haz clic en el elemento a comentar."
        : "";

  // La lista se recoloca sola cuando algo entra o se va: ver moverse las
  // tarjetas es lo que dice qué contestó la base, que puede tardar décimas.
  const list = useRef<HTMLDivElement>(null);
  useListMotion(list);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-soft-mist bg-paper-white">
      <header className={`px-5 ${isGuest ? "pt-4" : "pt-3"}`}>
        {/* Solo «Volver»: a lo que se vuelve es al panel, y decirlo entero
            —«volver al proyecto»— era además decir otra cosa. La flecha ya dice
            que se sale de aquí. El invitado no lo lleva: para él no hay panel al
            que volver, y un enlace que va a una pantalla que redirige aquí mismo
            es peor que ningún enlace. */}
        {!isGuest && (
          <Link href="/" className={BTN_QUIET}>
            ← Volver
          </Link>
        )}

        {/* El nombre lleva a los ajustes del proyecto y la dirección abre el
            sitio de verdad en otra pestaña. Dos destinos y ningún botón: lo que
            se pulsa es el dato que había que enseñar de todas formas. Para el
            invitado el nombre es solo el nombre: los ajustes no son suyos. */}
        {isGuest ? (
          <p className="block truncate font-vend text-body font-semibold" title={project.name}>
            {project.name}
          </p>
        ) : (
          <Link
            href={projectPath(project.slug)}
            title="Ajustes del proyecto"
            className="mt-1 block truncate font-vend text-body font-semibold underline-offset-4 hover:underline"
          >
            {project.name}
          </Link>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={url}
          className="block truncate font-mono text-caption text-olive-stone underline-offset-4 transition hover:text-midnight-ink hover:underline"
        >
          {displayHost(url)} ↗
        </a>

        {/* Quién está aquí va antes que qué se puede hacer: lo primero cambia
            lo segundo. Y va arriba, junto al nombre del proyecto y su
            dirección, porque es del proyecto entero de lo que habla —no de
            esta página, ni de esta lista de comentarios. */}
        <Watchers me={me} others={watchers} url={url} />
      </header>

      <div className="px-5 py-4">
        {/* Ancho completo: es lo que se pulsa aquí, y el blanco tiene que ser el
            más fácil de la barra (ley de Fitts). Activo se enciende en verde
            voltaje, como cualquier otro estado encendido (DESIGN.md). */}
        <button
          type="button"
          onClick={onTogglePicking}
          aria-pressed={picking}
          disabled={disabled || !canEdit}
          className={`w-full ${picking ? BTN_ON : BTN_SOLID_SM}`}
        >
          {picking ? "Cancelar" : "Comentar un elemento"}
        </button>

        {hint && <p className="mt-2 text-caption text-olive-stone">{hint}</p>}

        {failure && <FormMessage className="mt-3">{failure}</FormMessage>}
      </div>

      {/* La única regla de la columna: separa el chrome de la lista. */}
      <div ref={list} className="flex-1 overflow-y-auto border-t border-soft-mist p-2">
        {draft && (
          // La clave es el elemento elegido: al señalar otro, el formulario se
          // monta de nuevo y el texto empieza en blanco sin tener que vaciarlo.
          <DraftForm
            key={draft.selector}
            draft={draft}
            members={members}
            saving={saving}
            onSave={onSaveDraft}
            onDiscard={onDiscardDraft}
          />
        )}

        {total === 0 && !draft && (
          <p className="px-3 py-4 text-caption text-olive-stone">Todavía no hay comentarios.</p>
        )}

        {/* Con varias páginas comentadas, la que se ve puede no tener ninguna:
            sin esta línea, la lista parecería hablar de otro sitio. */}
        {sectioned && comments.length === 0 && !draft && (
          <p className="px-3 py-4 text-caption text-olive-stone">
            Esta página no tiene comentarios.
          </p>
        )}

        {!sectioned &&
          comments.map((comment, index) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              index={index}
              unanchored={missingIds.includes(comment.id)}
              away={awayViews[comment.id] ?? null}
              disabled={disabled}
              busy={saving}
              canResolve={canResolve}
              canDelete={canDelete(comment)}
              names={names}
              onReveal={() => onRevealComment(url, comment.id)}
              onDelete={() => onDeleteComment(comment.id)}
              onToggleResolved={() => onToggleResolved(comment.id, comment.resolvedAt === null)}
            />
          ))}

        {sectioned &&
          ordered.map((group) => {
            const isCurrent = group.pageUrl === url;
            const open = isOpen(group.pageUrl);
            return (
              <section key={group.pageUrl}>
                <h2>
                  <button
                    type="button"
                    onClick={() => toggle(group.pageUrl)}
                    aria-expanded={open}
                    title={group.pageUrl}
                    className="flex w-full items-center gap-2 rounded-button px-3 py-2 text-left transition hover:bg-soft-mist"
                  >
                    <span aria-hidden className="w-3 shrink-0 text-caption text-olive-stone">
                      {open ? "▾" : "▸"}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-mono text-caption ${
                        isCurrent ? "text-midnight-ink" : "text-olive-stone"
                      }`}
                    >
                      {pageLabel(group.pageUrl)}
                    </span>
                    <span className="label-xs shrink-0 text-olive-stone">
                      {group.comments.length}
                    </span>
                  </button>
                </h2>

                {open &&
                  group.comments.map((comment, index) => (
                    <CommentCard
                      key={comment.id}
                      comment={comment}
                      index={index}
                      // Solo la página a la vista tiene marcas que puedan faltar.
                      unanchored={isCurrent && missingIds.includes(comment.id)}
                      away={isCurrent ? awayViews[comment.id] ?? null : null}
                      // En otra página el clic navega hasta ella, así que sigue sirviendo
                      // aunque la actual esté rota.
                      disabled={disabled && isCurrent}
                      busy={saving}
                      canResolve={canResolve}
                      canDelete={canDelete(comment)}
                      names={names}
                      onReveal={() => onRevealComment(group.pageUrl, comment.id)}
                      onDelete={() => onDeleteComment(comment.id)}
                      onToggleResolved={() =>
                        onToggleResolved(comment.id, comment.resolvedAt === null)
                      }
                    />
                  ))}
              </section>
            );
          })}
      </div>

      {/* Con «Volver» arriba, el pie se queda solo con quién está dentro: el
          único sitio donde se cambia con qué nombre se firma un comentario. */}
      <footer className="border-t border-soft-mist px-5 py-3">
        {isGuest ? (
          // Para el invitado no es un enlace, porque no hay cuenta que ajustar
          // todavía: es la firma con la que está comentando —lo único que hay
          // que poder comprobar antes de escribir— y, debajo, la forma de
          // quedarse con ella. Esa cuenta anónima no se recupera al cerrar la
          // pestaña, así que la puerta está siempre puesta y no escondida en una
          // pantalla a la que habría que salir (`components/GuestClaim.tsx`).
          <GuestClaim
            userName={userName}
            userAvatar={userAvatar}
            userEmail={userEmail}
            next={workspacePath(project.slug, url)}
          />
        ) : (
          <Link
            href={`/cuenta?next=${encodeURIComponent(projectPath(project.slug))}`}
            title="Tu cuenta"
            className={`${BTN_QUIET} flex min-w-0 gap-2`}
          >
            <Avatar avatar={userAvatar} name={userName} email={userEmail} size={18} />
            <span className="min-w-0 truncate">{userName}</span>
          </Link>
        )}
      </footer>
    </aside>
  );
}

/**
 * Marca los nombres señalados con arroba dentro del texto del comentario.
 *
 * Quién es una mención lo decide `splitMentions`, que es lo que comparte esta
 * lista con el globo que sale sobre la página revisada: los dos pintan la misma
 * frase y tienen que estar de acuerdo en qué parte de ella es un nombre.
 *
 * El resalte es tinta sobre menta y no un color propio: el sistema tiene un solo
 * acento y está reservado a lo que está encendido (DESIGN.md). Lo que separa una
 * mención del resto de la frase es la superficie, como en todo lo demás.
 */
function withMentions(text: string, names: string[]) {
  const parts = splitMentions(text, names);
  // Sin ninguna mención se devuelve el texto tal cual y no un trozo suelto: una
  // cadena es un nodo y una lista de uno es un nodo dentro de una lista.
  if (parts.length === 1 && !parts[0].mention) return text;

  return parts.map((part, index) =>
    part.mention ? (
      <mark key={index} className="bg-mint-wash px-0.5 text-wash-ink">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

/**
 * El número del comentario, en un disco de verde voltaje.
 *
 * Es lo primero que se ve de la tarjeta y lo que la ata a su marca sobre la
 * página, así que se lleva el tamaño y el único color saturado del sistema.
 * Resuelto cambia el número por una palomita sobre gris: cerrado se reconoce sin
 * leer nada, y lo que queda por hacer son los discos verdes que se ven al bajar.
 */
function IssueNumber({ number, resolved }: { number: number; resolved: boolean }) {
  const disc = useRef<HTMLSpanElement>(null);
  const before = useRef(resolved);

  // Dar por resuelto es un viaje a la base sin optimismo: el disco cambia cuando
  // la respuesta vuelve, y para entonces el cursor ya está en otro sitio. El
  // pellizco es el acuse de recibo, y dice cuál de las ocho tarjetas contestó.
  // Al montar no pasa nada: no ha cambiado nada, es que acaba de llegar.
  useEffect(() => {
    if (before.current === resolved) return;
    before.current = resolved;
    pop(disc.current);
  }, [resolved]);

  return (
    <span
      ref={disc}
      aria-hidden
      className={`flex size-8 shrink-0 items-center justify-center rounded-full font-vend text-label font-semibold ${
        resolved ? "bg-soft-mist text-olive-stone" : "bg-lime-voltage text-wash-ink"
      }`}
    >
      {resolved ? "✓" : number}
    </span>
  );
}

function CommentCard({
  comment,
  index,
  unanchored,
  away,
  disabled,
  busy,
  canResolve,
  canDelete,
  names,
  onReveal,
  onDelete,
  onToggleResolved,
}: {
  comment: Comment;
  index: number;
  unanchored: boolean;
  /**
   * El rótulo de la vista donde vive el elemento cuando no está delante, o null
   * si sí lo está. Cadena vacía: no está delante y no se sabe de dónde sacarlo.
   */
  away: string | null;
  disabled: boolean;
  /** Hay otra escritura en vuelo: no se encadenan dos. */
  busy: boolean;
  canResolve: boolean;
  canDelete: boolean;
  /** Los nombres que una arroba puede estar señalando dentro del texto. */
  names: string[];
  onReveal: () => void;
  onDelete: () => void;
  onToggleResolved: () => void;
}) {
  const resolved = comment.resolvedAt !== null;
  const author = asName(comment.author);
  // Lo que la insignia dice, dicho también para quien no la ve: el `aria-label`
  // del botón sustituye a su contenido, así que sin esto la insignia sería la
  // única cosa de la tarjeta que no se lee en voz alta.
  const state = resolved ? "" : unanchored ? ", sin anclar" : away !== null ? ", en otra vista" : "";

  return (
    // El identificador es del comentario y no de su posición: lo que la lista
    // necesita saber para moverse es cuál es cuál cuando el orden cambia.
    <article data-shift-id={comment.id}>
      {/* Toda la tarjeta lleva al elemento: es el blanco más grande de la barra
          y el que se pulsa siempre (ley de Fitts). El texto del comentario es lo
          único que se lee entero; lo demás cabe en una línea o no está. */}
      <button
        type="button"
        onClick={(event) => {
          // Si lo que acaba de terminar es un arrastre para seleccionar dentro
          // de esta misma tarjeta, el clic no es una pulsación: es el final de
          // una copia. Un comentario de revisión trae URLs, selectores y códigos
          // —cosas que se llevan a otro sitio— y saltar al elemento cada vez que
          // alguien coge una haría imposible cogerla.
          //
          // Se comprueba que la selección esté *aquí dentro*: seleccionar en
          // otra tarjeta y luego pulsar en esta es una pulsación de verdad. Y no
          // hace falta limpiarla al pulsar de nuevo, porque el `mousedown` de
          // ese segundo clic ya la deshace: para cuando llega el `click`, la
          // selección está recogida y esto no se cumple.
          const selection = window.getSelection();
          if (
            selection &&
            !selection.isCollapsed &&
            selection.anchorNode &&
            event.currentTarget.contains(selection.anchorNode)
          ) {
            return;
          }
          onReveal();
        }}
        disabled={disabled}
        title={`Ir al elemento — ${comment.label}`}
        aria-label={`Comentario ${index + 1}${resolved ? ", resuelto" : ""}${state}: ${comment.text}`}
        className="flex w-full gap-3 rounded-card px-3 pb-2 pt-3 text-left transition hover:bg-soft-mist disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <IssueNumber number={index + 1} resolved={resolved} />

        <span className="min-w-0 flex-1">
          {(author || unanchored || (away !== null && !resolved)) && (
            <span className="flex items-center gap-2">
              {/* La cara de quien lo escribió, y sin aro de color: el aro sería
                  el bloque de autor que esta columna quitó a propósito, y de
                  decir cuál es la marca ya se encarga el número. Lo que añade es
                  lo que el bloque no daba —quién—, que hoy hay que leer nombre a
                  nombre en una lista de ocho (DESIGN.md). */}
              {author && (
                <>
                  <Avatar
                    avatar={comment.authorAvatar}
                    name={author}
                    email={comment.authorEmail}
                    size={18}
                  />
                  <span className="label-xs min-w-0 flex-1 truncate text-olive-stone">
                    {author}
                  </span>
                </>
              )}
              {unanchored && !resolved && (
                <span className="label-xs shrink-0 rounded-button bg-peach-wash px-2 py-0.5 text-wash-ink">
                  Sin anclar
                </span>
              )}
              {/* Estar en otro paso no es un problema, así que no lleva la
                  superficie de durazno con la que el sistema avisa de uno: va en
                  la insignia neutra, regla de pelo y piedra de oliva. La
                  diferencia importa — durazno decía «esto se rompió» de un
                  comentario que estaba perfectamente. Y el rótulo del paso va en
                  el title y no en la píldora: en una columna de 320px, un
                  «Dimensiones de tu caja» dentro de la insignia se come la línea
                  del autor. */}
              {away !== null && !unanchored && !resolved && (
                <span
                  className={`${BADGE} shrink-0`}
                  title={
                    away
                      ? `Está en «${away}». Pulsa el comentario y ábrelo: te llevamos ahí.`
                      : "No está a la vista en este momento. Pulsa el comentario y te llevamos ahí en cuanto aparezca."
                  }
                >
                  En otra vista
                </span>
              )}
            </span>
          )}
          {/* Tres cosas en una clase, y las tres por el mismo motivo: aquí cae
              texto que no escribimos nosotros.

              `whitespace-pre-wrap` respeta los saltos de línea que alguien puso.
              `break-words` parte lo que no cabe —una URL de survey monkey, un
              selector CSS, un identificador: todo eso es *una sola palabra* para
              el navegador, y sin partirla se sale de la tarjeta—. Es `break-word`
              y no `break-all`: la primera solo parte la palabra que no cabe
              entera en su línea, la segunda parte por donde sea y dejaría la
              prosa normal cortada a mitad de sílaba.

              Y `select-text`, que es lo que devuelve algo que la tarjeta se
              había llevado. Dentro de un `<button>` el navegador no deja
              seleccionar: entiende que arrastrar sobre un botón es apuntar, no
              marcar. Pero esto es un comentario de revisión y lo que trae dentro
              —una dirección, un código— está ahí precisamente para llevárselo a
              otro sitio; un texto que se lee y no se puede copiar obliga a
              teclearlo mirando. La pulsación de la tarjeta la protege el guardián
              de selección del `onClick`. */}
          <span
            className={`mt-1 block select-text whitespace-pre-wrap break-words text-body ${
              resolved ? "text-olive-stone" : ""
            }`}
          >
            {withMentions(comment.text, names)}
          </span>
        </span>
      </button>

      {/* Sangradas hasta donde empieza el texto: la columna del disco se queda
          libre y la lista se lee como una sola cosa. */}
      <div className="flex items-center gap-4 pb-1 pl-14">
        {/* Dar por resuelto puede cualquiera del equipo, aunque el comentario
            sea de otro: cerrarlo no es reescribirlo. El invitado no: comentar es
            opinar, y cerrar es decidir (migración 0007). */}
        {canResolve && (
          <button type="button" onClick={onToggleResolved} disabled={busy} className={BTN_QUIET}>
            {resolved ? "Reabrir" : "Resolver"}
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={onDelete} disabled={busy} className={BTN_QUIET}>
            Eliminar
          </button>
        )}
      </div>
    </article>
  );
}

function DraftForm({
  draft,
  members,
  saving,
  onSave,
  onDiscard,
}: {
  draft: Draft;
  members: Member[];
  saving: boolean;
  onSave: (text: string, mentions: string[]) => void;
  onDiscard: () => void;
}) {
  const [text, setText] = useState("");
  // A quién se ha elegido de la lista de la arroba. No es la lista definitiva:
  // de aquí solo salen mencionados los que sigan escritos al guardar, que es lo
  // que deja borrar una mención borrándola (`mentionsIn`).
  const [picked, setPicked] = useState<Member[]>([]);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const box = useRef<HTMLElement>(null);

  // Al elegir elemento el foco salta al textarea: el clic ocurrió dentro del iframe.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Y por eso mismo el formulario se abre en vez de aparecer: el clic pasó en la
  // vista previa, a media pantalla de aquí, y lo que se abre es lo que se lleva
  // la mirada hasta el sitio donde ahora hay que escribir. De paso, las tarjetas
  // de abajo las empuja el propio bloque al crecer, y no un segundo movimiento.
  useLayoutEffect(() => grow(box.current), []);

  return (
    // Superficie de menta y ningún borde: lo que dice que esto todavía no está
    // guardado es el color, que es como el sistema separa sin elevar (DESIGN.md).
    <section ref={box} className="rounded-card bg-mint-wash p-3 text-wash-ink">
      <p className="truncate font-mono text-caption" title={draft.selector}>
        {draft.label}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) onSave(text.trim(), mentionsIn(text, picked));
        }}
      >
        <div className="mt-2">
          <MentionBox
            field={ref}
            value={text}
            onChange={setText}
            members={members}
            onPick={(member) => setPicked((before) => [...before, member])}
            onEscape={onDiscard}
            disabled={saving}
            placeholder="Escribe el comentario…"
          />
        </div>

        {/* La única instrucción del formulario, y solo cuando hay a quién
            señalar: una arroba no se ve, así que hay que decir que está. */}
        {members.length > 0 && (
          <p className="mt-2 text-caption text-olive-stone">
            Escribe @ para avisar a alguien del equipo.
          </p>
        )}

        <div className="mt-2 flex items-center gap-4">
          <button type="submit" disabled={!text.trim() || saving} className={BTN_SOLID_SM}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={onDiscard} className={BTN_QUIET}>
            Descartar
          </button>
        </div>
      </form>
    </section>
  );
}
