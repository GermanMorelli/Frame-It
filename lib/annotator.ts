import { MIRROR_PREFIX } from "./mirror";

/**
 * Capa del crosshair del modo selección. Va en una capa y no solo con !important
 * porque un `a{cursor:pointer !important}` del sitio le ganaría al selector por
 * especificidad; en las declaraciones !important, en cambio, cualquier capa gana a
 * lo que el sitio declare sin capa, tenga la especificidad que tenga.
 */
const PICKING_LAYER = "mk-picking";

type AnnotatorOptions = {
  /** Origen de nuestra app (el iframe va en sandbox de origen opaco y no puede deducirlo). */
  origin: string;
  /** URL real de la página servida, tras redirecciones. */
  pageUrl: string;
};

/**
 * Script que el proxy inyecta dentro de la página servida. Vive en el iframe y es
 * el único que puede tocar su DOM: detecta el elemento bajo el cursor, lo perfila
 * y avisa al padre por postMessage.
 *
 * Se usa `outline` y no `border` a propósito: el borde empujaría el layout del sitio.
 */
export function annotatorScript({ origin, pageUrl }: AnnotatorOptions): string {
  return `(function () {
  var ORIGIN = ${JSON.stringify(origin)};
  var MIRROR = ${JSON.stringify(MIRROR_PREFIX)};
  var PAGE = ${JSON.stringify(pageUrl)};
  var INK = "#0d1400";
  var LIME = "#aaff00";
  var STONE = "#838976";
  var MIST = "#e6e7e4";
  // El lavado de menta, que aquí solo pinta una cosa: el nombre al que alguien
  // señaló con una arroba. Es el mismo resalte que lleva ese nombre en la lista
  // de la columna, porque es la misma frase dicha en dos sitios.
  var MINT = "#caf3aa";
  var HOVER = "__mk-hover";
  var MARK = "__mk-mark";
  var FLASH = "__mk-flash";
  var picking = false;
  var hovered = null;
  var wanted = [];
  var observer = null;
  var throttled = false;
  var reportTimer = null;
  var latestReport = { missing: [], elsewhere: [] };
  var flashTimer = null;
  var tipHost = null;
  var tipBox = null;
  var tipTarget = null;
  /** Lo último que se le dijo al padre: no se repite. */
  var lastReport = "";
  /** Comentario al que se irá en cuanto su vista aparezca, y hasta cuándo se espera. */
  var armed = null;
  var armedUntil = 0;
  var chaseTimer = null;
  /** A qué comentario se está atendiendo: los reintentos del anterior se caen solos. */
  var revealing = null;
  var heartbeat = null;
  /**
   * Cuánto se espera a que el revisor abra el paso donde vive el elemento. Tres
   * minutos: lo bastante para llegar al paso siete de un cotizador, y no tanto
   * como para dejar un aviso encallado en la pantalla el resto de la sesión.
   */
  var ARM_MS = 180000;
  var HEADINGS = "h1,h2,h3,h4,h5,h6,legend,[role=heading]";

  var style = document.createElement("style");
  style.textContent =
    // Doble trazo a propósito: verde voltaje por dentro y tinta por fuera. Esto
    // cae encima de un sitio del que no se sabe el color, y ninguno de los dos
    // solo se vería siempre — el verde se pierde sobre blanco y la tinta sobre
    // negro. El anillo va en box-shadow, que no empuja el layout del sitio.
    "." + HOVER + "{outline:2px dashed " + LIME + " !important;outline-offset:-2px !important;" +
      "box-shadow:0 0 0 2px " + INK + " !important;}" +
    "." + MARK + "{outline:2px solid var(--mk-color, " + LIME + ") !important;outline-offset:-2px !important;" +
      "box-shadow:0 0 0 1px " + INK + " !important;}" +
    // El destello late dos veces. Una sola sacudida de color sobre una página
    // ajena se confunde con un fallo de pintado; dos tiempos se leen como una
    // señal, que es lo que es: «el comentario que has pulsado habla de esto».
    // El anillo se anima y por eso no lleva !important —una declaración marcada
    // le ganaría a los fotogramas—; el contorno, que es la señal de verdad, sí.
    "." + FLASH + "{outline:3px solid var(--mk-color, " + LIME + ") !important;outline-offset:-3px !important;" +
      "box-shadow:0 0 0 6px color-mix(in srgb, var(--mk-color, " + LIME + ") 35%, transparent);}" +
    "@media (prefers-reduced-motion: no-preference){." + FLASH + "{animation:__mk-beat 1.4s ease-out both;}}" +
    "@keyframes __mk-beat{" +
      "0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--mk-color, " + LIME + ") 60%, transparent);}" +
      "35%{box-shadow:0 0 0 12px color-mix(in srgb, var(--mk-color, " + LIME + ") 0%, transparent);}" +
      "50%{box-shadow:0 0 0 0 color-mix(in srgb, var(--mk-color, " + LIME + ") 60%, transparent);}" +
      "85%{box-shadow:0 0 0 12px color-mix(in srgb, var(--mk-color, " + LIME + ") 0%, transparent);}" +
      "100%{box-shadow:0 0 0 6px color-mix(in srgb, var(--mk-color, " + LIME + ") 35%, transparent);}}" +
    "@layer ${PICKING_LAYER}{html.__mk-picking,html.__mk-picking *{cursor:crosshair !important;}}";
  (document.head || document.documentElement).appendChild(style);

  function textOf(el) {
    return ((el && el.textContent) || "").replace(/\\s+/g, " ").trim();
  }

  function attr(el, name) {
    return (el && el.getAttribute && el.getAttribute(name)) || "";
  }

  /** Lo que describe al elemento: una imagen o un campo no tienen texto propio. */
  function labelText(el) {
    var text = textOf(el);
    if (text) return text;
    return attr(el, "alt") || attr(el, "aria-label") || attr(el, "title") || attr(el, "placeholder");
  }

  /** El destino de una imagen o de un enlace: ya viene absoluto del reescritor. */
  function keyOf(el) {
    return attr(el, "src") || attr(el, "href");
  }

  /**
   * ¿El navegador está pintando esto ahora mismo? Se pregunta por los rectángulos
   * y no por offsetParent, que también sale nulo en lo que va en position:fixed
   * —una barra pegada o un modal— y daría por oculto justo lo que más se ve.
   */
  function rendered(el) {
    return !!(el && el.getClientRects && el.getClientRects().length > 0);
  }

  /**
   * El encabezado que rotula un bloque: el bloque mismo, si lo es, o el que abre
   * su cabecera: el div de cabecera que abre con un h2, como en tantos
   * formularios. No se
   * baja más de un nivel a propósito: al segundo se empieza a recoger el
   * encabezado de la tarjeta de al lado, que no rotula nada de lo que hay aquí.
   */
  function headingOf(el) {
    var node = el;
    for (var depth = 0; node && depth < 2; depth++) {
      if (node.matches && node.matches(HEADINGS)) return textOf(node).slice(0, 80);
      node = node.firstElementChild;
    }
    return "";
  }

  /**
   * Los rótulos de la vista donde vive el elemento, de fuera hacia dentro.
   *
   * Es lo que arregla comentar dentro de un paso o de un modal. Un cotizador por
   * pasos no guarda el paso en la URL: al recargar arranca en el primero, y el
   * elemento comentado en el tercero no está en el árbol. Sin esto, lo único que
   * se podía decir era «su elemento ya no existe», que además de alarmar es
   * falso: existe, y basta con abrir «Dimensiones de tu caja» para verlo. Con el
   * rótulo guardado se puede distinguir un ancla perdida de una página que está
   * en otro paso, y decirle al revisor cuál abrir.
   */
  function viewOf(el) {
    var trail = [];
    var node = el;
    var hops = 0;
    while (node && node !== document.body && node.nodeType === 1 && hops++ < 40) {
      for (var kin = node.previousElementSibling; kin; kin = kin.previousElementSibling) {
        var heading = headingOf(kin);
        if (heading) {
          if (trail.indexOf(heading) === -1) trail.unshift(heading);
          break;
        }
      }
      node = node.parentElement;
    }
    // Los tres más cercanos. Los de más arriba rotulan la página entera —el <h1>
    // del cotizador está puesto en los siete pasos— y no distinguen ninguno.
    return trail.slice(-3);
  }

  /** ¿Hay algún encabezado con este rótulo, y a la vista, en la página de ahora? */
  function headingOnScreen(label) {
    var nodes = document.querySelectorAll(HEADINGS);
    for (var i = 0; i < nodes.length; i++) {
      if (textOf(nodes[i]).slice(0, 80) === label && rendered(nodes[i])) return true;
    }
    return false;
  }

  /**
   * El rótulo que hay que abrir para llegar al elemento: el más externo de los
   * guardados que ahora mismo no está en pantalla.
   *
   * Cadena vacía quiere decir que la vista está delante —y entonces el elemento
   * que no aparece sí se fue de verdad— o que el comentario es anterior a esto y
   * no guardó ninguno. En los dos casos no hay ningún paso que prometer, y no se
   * promete: lo que no se sabe se cuenta como se contaba antes.
   */
  function awayLabel(view) {
    if (!view) return "";
    for (var i = 0; i < view.length; i++) {
      if (!headingOnScreen(view[i])) return view[i];
    }
    return "";
  }

  function selectorFor(el) {
    if (!el || el === document.body || el.nodeType !== 1) return "body";
    var parts = [];
    var node = el;
    while (node && node !== document.body && node.nodeType === 1) {
      var parent = node.parentElement;
      if (!parent) break;
      var i = Array.prototype.indexOf.call(parent.children, node) + 1;
      parts.unshift(node.tagName.toLowerCase() + ":nth-child(" + i + ")");
      node = parent;
    }
    return parts.length ? "body > " + parts.join(" > ") : "body";
  }

  /** Un id sirve de ancla solo si el sitio no lo regenera en cada carga. */
  function stableId(el) {
    var id = el.getAttribute ? el.getAttribute("id") : "";
    if (!id || id.length > 60) return "";
    if (/[0-9]{4,}/.test(id)) return "";
    if (/^(:r|radix-|react-|mui-|headlessui-)/i.test(id)) return "";
    return id;
  }

  /**
   * Pistas para reencontrar el elemento cuando la ruta deje de valer: un banner de
   * cookies o un <script> insertado en el cuerpo corren todos los nth-child.
   */
  function hintsFor(el) {
    var classes = [];
    if (el.classList) {
      for (var i = 0; i < el.classList.length && classes.length < 4; i++) {
        var name = el.classList[i];
        // Las clases con tiradas de hexadecimal son hashes de compilación y cambian.
        if (name.indexOf("__mk-") !== 0 && !/[0-9a-f]{6,}/i.test(name)) classes.push(name);
      }
    }
    return {
      elementId: stableId(el),
      tag: el.tagName ? el.tagName.toLowerCase() : "",
      classes: classes,
      src: keyOf(el),
      text: labelText(el).slice(0, 80),
      view: viewOf(el),
    };
  }

  function labelFor(el) {
    var tag = el && el.tagName ? el.tagName.toLowerCase() : "?";
    var text = labelText(el).slice(0, 60);
    return text ? tag + " · " + text : tag;
  }

  /** ¿Este elemento puede ser el que se comentó, o la ruta cayó en otro sitio? */
  function looksLike(el, hints) {
    if (!el) return false;
    if (!hints.tag) return true;
    if (!el.tagName || el.tagName.toLowerCase() !== hints.tag) return false;
    // Cualquier señal fuerte basta: un contador cambia el texto y un despliegue
    // cambia las clases, pero rara vez pasan las dos cosas a la vez.
    if (hints.src && keyOf(el) === hints.src) return true;
    if (hints.text && labelText(el).slice(0, 80) === hints.text) return true;
    var classes = hints.classes || [];
    if (classes.length) {
      for (var i = 0; i < classes.length; i++) {
        if (!el.classList || !el.classList.contains(classes[i])) return false;
      }
      return true;
    }
    // Sin nada que contrastar (ni destino, ni texto, ni clases) la ruta es la única
    // prueba que hay, así que se acepta.
    return !hints.src && !hints.text;
  }

  function searchByHints(hints) {
    if (!hints.tag) return null;
    var classes = hints.classes || [];
    var candidates = document.getElementsByTagName(hints.tag);
    var sameClasses = [];
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var ok = true;
      for (var c = 0; c < classes.length; c++) {
        if (!el.classList || !el.classList.contains(classes[c])) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // El destino y el texto son lo que distingue a un elemento de sus hermanos.
      if (hints.src && keyOf(el) === hints.src) return el;
      if (hints.text && labelText(el).slice(0, 80) === hints.text) return el;
      sameClasses.push(el);
    }
    // Sin esas señales solo vale un candidato inequívoco. Quedarse con "el primero
    // que se parece" acabaría perfilando el elemento equivocado, y eso engaña más
    // que decir que el comentario se quedó sin anclar.
    if (classes.length && sameClasses.length === 1) return sameClasses[0];
    return null;
  }

  /** Búsqueda en cascada, de lo más preciso a lo más tolerante. */
  function resolve(mark) {
    var hints = mark.hints || {};
    if (hints.elementId) {
      var byId = document.getElementById(hints.elementId);
      if (byId) return byId;
    }

    var byPath = null;
    try {
      byPath = document.querySelector(mark.selector);
    } catch (err) {
      // Selector inservible: quedan las pistas.
    }
    // La ruta nth-child es exacta pero traicionera: si el sitio insertó un banner o
    // un <script> en el cuerpo, el mismo índice señala ahora a otro elemento. Se
    // acepta solo si encaja con las pistas; si no, mejor buscar de nuevo.
    if (byPath && looksLike(byPath, hints)) return byPath;

    var found = searchByHints(hints);
    if (found) return found;
    // Comentario viejo, sin pistas con las que contrastar: la ruta es cuanto hay.
    return hints.tag ? null : byPath;
  }

  function send(msg) {
    msg.source = "frameit-frame";
    parent.postMessage(msg, ORIGIN);
  }

  function clearHover() {
    if (hovered && hovered.classList) hovered.classList.remove(HOVER);
    hovered = null;
  }

  /**
   * Globo que dice de quién es lo que hay marcado bajo el cursor.
   *
   * Vive en un shadow root para que el CSS del sitio no lo despinte, y cuelga de
   * <html> y no de <body>: un hijo más en el cuerpo correría los nth-child y las
   * rutas guardadas dejarían de apuntar donde apuntaban.
   */
  function ensureTip() {
    if (tipHost) return;
    tipHost = document.createElement("div");
    var shadow = tipHost.attachShadow({ mode: "open" });
    var css = document.createElement("style");
    css.textContent =
      ":host{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;display:none;}" +
      ".box{max-width:320px;background:#FFFFFF;border:1px solid " + INK + ";border-radius:12px;" +
      "padding:12px;font-family:system-ui,ui-sans-serif,-apple-system,sans-serif;color:" + INK + ";}" +
      ".row+.row{margin-top:8px;padding-top:8px;border-top:1px solid " + MIST + ";}" +
      ".who{display:flex;align-items:center;gap:8px;font-size:11px;line-height:1.2;" +
      "letter-spacing:0.5px;text-transform:uppercase;font-weight:600;}" +
      // El disco es lo que antes era el cuadrado de color: sigue diciendo de quién
      // es la marca, pero ahora lo dice con una cara y no solo con un color. El
      // color se queda en el aro, que es lo que ata el globo al contorno que hay
      // sobre la página. Va por dentro y no por fuera para que el disco mida
      // siempre lo mismo, se pinte el aro o no.
      ".face{position:relative;width:22px;height:22px;flex:0 0 auto;border-radius:999px;" +
      "overflow:hidden;display:flex;align-items:center;justify-content:center;background:" + MIST + ";}" +
      ".face img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;}" +
      // Debajo del dibujo, y a la vista mientras no llegue —o para siempre, si el
      // servicio de caras está apagado—: una inicial sobre su lavado distingue de
      // sobra a las cuatro personas que caben en un globo.
      ".face .initial{font-size:10px;line-height:1;color:" + INK + ";}" +
      ".face .ring{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:999px;}" +
      ".name{color:" + STONE + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".body{margin-top:6px;font-size:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;}" +
      // Sin radio y sin borde: una mención es una superficie de color detrás de
      // unas palabras, no una píldora. El sistema tiene dos radios y los dos son
      // para cajas que se pulsan (DESIGN.md).
      ".body mark{background:" + MINT + ";color:" + INK + ";padding:0 2px;}";
    tipBox = document.createElement("div");
    tipBox.className = "box";
    shadow.appendChild(css);
    shadow.appendChild(tipBox);
    document.documentElement.appendChild(tipHost);
  }

  function hideTip() {
    tipTarget = null;
    if (tipHost) tipHost.style.display = "none";
  }

  /**
   * La cara de quien escribió el comentario, dentro del aro de su color.
   *
   * El dibujo llega de nuestra propia dirección, no de un tercero: aquí dentro
   * estamos en una página ajena, y pedirle una imagen a otro desde ella contaría
   * a ese otro por dónde anda navegando quien revisa. Si no llega, se quita y
   * queda la inicial sobre el lavado, que es lo que ya había debajo.
   */
  function face(mark) {
    var box = document.createElement("span");
    box.className = "face";
    if (mark.bg) box.style.background = mark.bg;

    var initial = document.createElement("span");
    initial.className = "initial";
    initial.textContent = mark.initial || "·";
    box.appendChild(initial);

    if (mark.avatar) {
      var img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.onerror = function () {
        if (img.parentNode) img.parentNode.removeChild(img);
      };
      img.src = mark.avatar;
      box.appendChild(img);
    }

    // El aro va encima del dibujo y no debajo: el avatar trae su propio fondo y
    // lo taparía.
    var ring = document.createElement("span");
    ring.className = "ring";
    ring.style.boxShadow = "inset 0 0 0 2px " + (mark.color || LIME);
    box.appendChild(ring);

    return box;
  }

  /**
   * Escribe el texto de un comentario, resaltando lo que sea una mención.
   *
   * Lo que llega ya viene partido en trozos desde la aplicación (toMark): aquí
   * no se busca ninguna arroba ni se sabe quién está en el equipo, solo se pinta.
   * Esa es la regla de todo este script —no puede importar nada de la app, así
   * que lo que decida algo tiene que venir decidido.
   *
   * Se admite además una cadena suelta, que es lo que mandaba la versión
   * anterior. No es por elegancia: al desplegar, una pestaña abierta puede
   * recargar el iframe —y traerse este script nuevo— mientras la aplicación que
   * le habla desde fuera sigue siendo la de antes. Un comentario sin texto en un
   * globo sería peor que un comentario sin resaltar.
   */
  function fillBody(node, parts) {
    if (typeof parts === "string") {
      node.textContent = parts;
      return;
    }
    if (!parts || !parts.length) return;

    for (var p = 0; p < parts.length; p++) {
      var part = parts[p] || {};
      var text = part.text || "";
      if (!text) continue;
      if (!part.mention) {
        node.appendChild(document.createTextNode(text));
        continue;
      }
      var at = document.createElement("mark");
      at.textContent = text;
      node.appendChild(at);
    }
  }

  function fillTip(list) {
    while (tipBox.firstChild) tipBox.removeChild(tipBox.firstChild);
    for (var i = 0; i < list.length; i++) {
      var row = document.createElement("div");
      row.className = "row";

      var who = document.createElement("div");
      who.className = "who";
      var num = document.createElement("span");
      num.textContent = String(list[i].number || i + 1);
      var name = document.createElement("span");
      name.className = "name";
      // Los comentarios anteriores a las cuentas no tienen autor: se dice, no se inventa.
      name.textContent = list[i].author || "Sin autor";
      who.appendChild(num);
      who.appendChild(face(list[i]));
      who.appendChild(name);

      var body = document.createElement("div");
      body.className = "body";
      fillBody(body, list[i].body);

      row.appendChild(who);
      row.appendChild(body);
      tipBox.appendChild(row);
    }
  }

  /** Se coloca junto al cursor sin salirse de la ventana. */
  function placeTip(x, y) {
    var pad = 10;
    var w = tipHost.offsetWidth;
    var h = tipHost.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;

    var left = x + 16;
    if (left + w + pad > vw) left = x - w - 16;
    if (left < pad) left = pad;

    var top = y + 18;
    if (top + h + pad > vh) top = y - h - 14;
    if (top < pad) top = pad;

    tipHost.style.left = left + "px";
    tipHost.style.top = top + "px";
  }

  /** El elemento marcado más cercano al cursor, y los comentarios que lo señalan. */
  function marksAt(node) {
    var marked = node && node.closest ? node.closest("." + MARK) : null;
    if (!marked) return null;
    var found = [];
    for (var i = 0; i < wanted.length; i++) {
      if (wanted[i].el === marked) found.push(wanted[i]);
    }
    return found.length ? { el: marked, list: found } : null;
  }

  document.addEventListener("mouseover", function (e) {
    if (picking) {
      clearHover();
      hovered = e.target;
      if (hovered && hovered.classList) hovered.classList.add(HOVER);
      return;
    }

    var hit = marksAt(e.target);
    if (!hit) {
      hideTip();
      return;
    }
    ensureTip();
    if (tipTarget !== hit.el) {
      fillTip(hit.list);
      tipTarget = hit.el;
    }
    tipHost.style.display = "block";
    placeTip(e.clientX, e.clientY);
  }, true);

  document.addEventListener("mousemove", function (e) {
    if (!picking && tipTarget) placeTip(e.clientX, e.clientY);
  }, true);

  document.addEventListener("mouseout", function (e) {
    if (picking) {
      clearHover();
      return;
    }
    // Salir hacia un hijo del mismo elemento no cuenta como salir.
    if (tipTarget && (!e.relatedTarget || !tipTarget.contains(e.relatedTarget))) hideTip();
  }, true);

  // Con la página desplazándose, el elemento ya no está donde estaba el cursor.
  window.addEventListener("scroll", function () {
    if (tipTarget) hideTip();
  }, true);

  document.addEventListener("click", function (e) {
    if (picking) {
      e.preventDefault();
      e.stopPropagation();
      var el = e.target;
      // El elemento raíz no es anclable: selectorFor lo colapsa a body, así que
      // la etiqueta debe describir body y no <html>.
      if (el === document.documentElement) el = document.body;
      clearHover();
      send({ type: "picked", selector: selectorFor(el), label: labelFor(el), hints: hintsFor(el) });
      return;
    }
    // Fuera del modo comentario: la navegación se queda dentro del proxy, o el
    // iframe saltaría al sitio real y volveríamos a no poder anotar nada.
    var link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!link || link.target === "_blank") return;
    var destination = siteUrl(link.href);
    if (destination) {
      e.preventDefault();
      location.href = mirrored(destination);
    }
  }, true);

  /**
   * A dónde lleva de verdad un enlace. Los que el propio sitio crea en ejecución
   * (React Router y compañía) salen relativos, y el navegador los resuelve contra
   * NUESTRO origen porque el documento se sirve desde el proxy: seguirlos tal cual
   * abriría Frame It dentro de su propia vista previa. Se devuelven al sitio real.
   * Cadena vacía significa "no lo toques".
   */
  function siteUrl(href) {
    if (!href || !/^https?:/i.test(href)) return "";
    if (href !== ORIGIN && href.indexOf(ORIGIN + "/") !== 0) return href;
    var path = href.slice(ORIGIN.length) || "/";
    // Ya apunta al proxy: es un enlace que sirve este mismo origen.
    if (path.indexOf(MIRROR + "/") === 0 || path.indexOf("/api/proxy") === 0) return "";
    try {
      return new URL(path, PAGE).toString();
    } catch (err) {
      return "";
    }
  }

  /**
   * La ruta calcada de una URL del sitio: la misma que sirve el documento actual,
   * para que lo que la página resuelva por su cuenta siga cayendo donde debe.
   */
  function mirrored(destination) {
    try {
      var u = new URL(destination);
      return MIRROR + "/" + u.protocol.replace(":", "") + "/" + u.host + u.pathname + u.search;
    } catch (err) {
      return "/api/proxy?url=" + encodeURIComponent(destination);
    }
  }

  function markNow() {
    var previous = document.querySelectorAll("." + MARK);
    for (var i = 0; i < previous.length; i++) {
      previous[i].classList.remove(MARK);
      previous[i].style.removeProperty("--mk-color");
    }

    var missing = [];
    var elsewhere = [];
    // Con dos comentarios de personas distintas sobre el mismo elemento manda el
    // primero: un contorno no puede llevar dos colores. El globo los enseña todos.
    var painted = [];
    for (var j = 0; j < wanted.length; j++) {
      var mark = wanted[j];
      var el = resolve(mark);
      // Se recuerda cuál era: al pasar el cursor hay que saber qué comentario toca.
      mark.el = el || null;
      if (el && el.classList) {
        el.classList.add(MARK);
        if (painted.indexOf(el) === -1) {
          el.style.setProperty("--mk-color", mark.color || LIME);
          painted.push(el);
        }
      }
      // El contorno se pone igual aunque el elemento no se esté pintando: hay
      // sitios que no desmontan el paso ni el modal, solo los esconden, y así la
      // marca ya está puesta en el momento en que se abren.
      if (el && rendered(el)) continue;

      var away = awayLabel((mark.hints && mark.hints.view) || []);
      // Ancla perdida solo si el elemento no está Y su vista sí: tener delante el
      // rótulo de la vista es la única prueba de que el elemento se fue. Lo demás
      // es una página en otro paso, que no es lo mismo y no debe decirse igual.
      if (!el && !away) missing.push(mark.id);
      else elsewhere.push({ id: mark.id, view: away });
    }
    return { missing: missing, elsewhere: elsewhere };
  }

  // El informe se retrasa: en una SPA el DOM aún está vacío cuando llegan las
  // marcas, y avisar de inmediato sería un falso positivo. El temporizador no se
  // reinicia en cada intento, solo se actualiza lo que dirá: reiniciándolo, una
  // página que muta sin parar no informaría nunca. Y no se repite lo ya dicho: el
  // latido vuelve a mirar cada segundo, y sin esta comparación la columna de
  // comentarios se repintaría entera cada tres para decir exactamente lo mismo.
  function scheduleReport(report) {
    latestReport = report;
    if (reportTimer) return;
    reportTimer = setTimeout(function () {
      reportTimer = null;
      var signature = JSON.stringify(latestReport);
      if (signature === lastReport) return;
      lastReport = signature;
      send({
        type: "marks-applied",
        missing: latestReport.missing,
        elsewhere: latestReport.elsewhere,
      });
    }, 3000);
  }

  function refresh() {
    scheduleReport(markNow());
  }

  function watchDom() {
    if (observer) return;
    observer = new MutationObserver(function () {
      // Estrangulado, no rebotado: con animaciones o carga perezosa el DOM cambia
      // sin descanso y un temporizador que se reinicia no llegaría a disparar.
      // Se observa childList, no atributos: poner la clase no se retroalimenta.
      if (throttled) return;
      throttled = true;
      setTimeout(function () {
        throttled = false;
        refresh();
      }, 250);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Un latido además del observador. Cambiar de paso puede no tocar el árbol
    // —hay sitios que dejan los siete pasos puestos y solo mueven un atributo
    // hidden o una clase— y entonces el observador no ve nada, aunque para quien
    // mira la página haya cambiado entera. Observar atributos no sirve de
    // remedio: este mismo marcado escribe class y style, y el observador se
    // alimentaría de su propio trabajo sin parar nunca.
    if (!heartbeat) heartbeat = setInterval(refresh, 1000);
  }

  function applyMarks(marks) {
    wanted = marks || [];
    hideTip();
    // Lo dicho la última vez describía otro juego de marcas: hay que volver a decirlo.
    lastReport = "";
    // Al comentario que se estaba esperando lo pueden haber borrado mientras tanto.
    if (armed && !markById(armed)) disarm();
    refresh();
    if (!wanted.length) return;
    watchDom();
    // Este script corre en <head>: cuando llegan las marcas el cuerpo suele estar
    // vacío todavía. Se reintenta mientras la página se arma, por si el sitio la
    // construye de una forma que el observador no alcance a ver.
    var delays = [100, 300, 800, 1600, 3000, 6000];
    for (var d = 0; d < delays.length; d++) {
      setTimeout(refresh, delays[d]);
    }
  }

  function markById(id) {
    for (var i = 0; i < wanted.length; i++) {
      if (wanted[i].id === id) return wanted[i];
    }
    return null;
  }

  /** Trae el elemento a la vista y lo destella un momento. */
  function land(el) {
    if (el.scrollIntoView) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });

    if (flashTimer) clearTimeout(flashTimer);
    var lit = document.querySelectorAll("." + FLASH);
    for (var p = 0; p < lit.length; p++) lit[p].classList.remove(FLASH);
    // Pedir una medida entre quitar y poner obliga al navegador a rehacer el
    // estilo ahí mismo. Sin eso, pulsar dos veces el mismo comentario quitaría y
    // devolvería la clase dentro de la misma tarea: para el motor nunca se fue,
    // y el latido no volvería a empezar.
    void el.offsetWidth;
    el.classList.add(FLASH);
    flashTimer = setTimeout(function () {
      el.classList.remove(FLASH);
    }, 1400);
  }

  function disarm() {
    armed = null;
    if (chaseTimer) clearInterval(chaseTimer);
    chaseTimer = null;
  }

  /**
   * Deja el destello armado: el elemento no está en pantalla, pero su vista se
   * puede abrir a mano. En cuanto aparezca —el revisor entra en ese paso, o abre
   * ese modal— se salta a él sin que haya que volver a pulsar nada.
   *
   * Antes esto se daba por perdido a los tres segundos, y quien llegaba al paso
   * se encontraba la marca puesta y ningún destello que le dijera cuál de todas
   * era la del comentario que había pulsado.
   */
  function arm(id, view) {
    disarm();
    armed = id;
    armedUntil = Date.now() + ARM_MS;
    chaseTimer = setInterval(chase, 250);
    send({ type: "reveal-waiting", id: id, view: view });
  }

  function chase() {
    if (!armed) return disarm();
    var id = armed;
    var mark = markById(id);
    var el = mark ? resolve(mark) : null;
    if (el && rendered(el)) {
      disarm();
      land(el);
      send({ type: "reveal-done", id: id });
      return;
    }
    // Se retira solo cuando la espera se pasa de larga, y se dice: un aviso que no
    // se va nunca acaba leyéndose como parte de la pantalla.
    if (Date.now() > armedUntil) {
      disarm();
      send({ type: "reveal-timeout", id: id });
    }
  }

  /** Lleva al elemento de un comentario, o espera a que su vista se abra. */
  function reveal(id, attempt) {
    if (!attempt) revealing = id;
    // Se pulsó otro comentario mientras este reintentaba: este ya no toca.
    if (revealing !== id) return;

    var mark = markById(id);
    var el = mark ? resolve(mark) : null;
    if (el && rendered(el)) {
      disarm();
      land(el);
      return;
    }

    var view = mark ? awayLabel((mark.hints && mark.hints.view) || []) : "";
    // Sin rótulo que abrir y sin elemento no hay nada que esperar más allá de que
    // la página termine de armarse: recién cargada (al saltar desde el comentario
    // de otra página) el cuerpo todavía se está montando, así que se reintenta un
    // rato antes de darlo por perdido.
    if (!view && !el) {
      var tries = attempt || 0;
      if (tries < 10) {
        setTimeout(function () {
          reveal(id, tries + 1);
        }, 300);
        return;
      }
      send({ type: "reveal-missing", id: id });
      return;
    }

    // O hay un paso que abrir, o el elemento está puesto pero sin pintar. En los
    // dos casos lo que falta es un gesto del revisor, no tiempo.
    arm(id, view);
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    var data = e.data;
    if (!data || data.source !== "frameit-parent") return;

    if (data.type === "set-mode") {
      picking = !!data.picking;
      document.documentElement.classList.toggle("__mk-picking", picking);
      hideTip();
      if (!picking) clearHover();
      // Ponerse a señalar otro elemento es haber dejado de esperar al de antes.
      if (picking) disarm();
    }
    if (data.type === "set-marks") applyMarks(data.marks || []);
    if (data.type === "reveal") reveal(data.id);
    if (data.type === "cancel-reveal") disarm();
    // Prueba de vida. Si el documento ya no es el nuestro, este mensaje ni
    // siquiera se entrega y el padre concluye que la página se fue del proxy.
    if (data.type === "ping") send({ type: "pong", url: PAGE });
  });

  // El padre tapa el iframe con "Cargando…" hasta recibir esto. No se usa el evento
  // load: un sitio con conexiones abiertas (analítica, chats, sockets) puede tardar
  // decenas de segundos en dispararlo y el velo se tragaría los clics mientras tanto.
  function whenPainted(done) {
    var tries = 0;
    (function check() {
      var body = document.body;
      var hasText = body && (body.innerText || "").trim().length > 0;
      var hasMedia = body && body.querySelector("img,svg,canvas,video,input,button");
      // El tope evita esperar para siempre a una página que nunca pinta nada.
      if (hasText || hasMedia || tries++ > 40) return done();
      setTimeout(check, 100);
    })();
  }

  whenPainted(function () {
    requestAnimationFrame(function () {
      send({ type: "painted" });
    });
  });

  send({ type: "ready", url: PAGE });
})();`;
}
