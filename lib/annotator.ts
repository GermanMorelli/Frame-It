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
  /** Ruta absoluta del proxy, para que la navegación interna no se salga de él. */
  proxyPath: string;
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
export function annotatorScript({ origin, proxyPath, pageUrl }: AnnotatorOptions): string {
  return `(function () {
  var ORIGIN = ${JSON.stringify(origin)};
  var PROXY = ${JSON.stringify(proxyPath)};
  var PAGE = ${JSON.stringify(pageUrl)};
  var INK = "#0d1400";
  var LIME = "#aaff00";
  var STONE = "#838976";
  var MIST = "#e6e7e4";
  var HOVER = "__mk-hover";
  var MARK = "__mk-mark";
  var FLASH = "__mk-flash";
  var picking = false;
  var hovered = null;
  var wanted = [];
  var observer = null;
  var throttled = false;
  var reportTimer = null;
  var latestMissing = [];
  var flashTimer = null;
  var tipHost = null;
  var tipBox = null;
  var tipTarget = null;

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
      ".who{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1.2;" +
      "letter-spacing:0.5px;text-transform:uppercase;font-weight:600;}" +
      ".dot{width:12px;height:12px;border-radius:3px;background:" + LIME + ";flex:0 0 auto;}" +
      ".name{color:" + STONE + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".body{margin-top:6px;font-size:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;}";
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

  function fillTip(list) {
    while (tipBox.firstChild) tipBox.removeChild(tipBox.firstChild);
    for (var i = 0; i < list.length; i++) {
      var row = document.createElement("div");
      row.className = "row";

      var who = document.createElement("div");
      who.className = "who";
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = list[i].color || LIME;
      var num = document.createElement("span");
      num.textContent = String(list[i].number || i + 1);
      var name = document.createElement("span");
      name.className = "name";
      // Los comentarios anteriores a las cuentas no tienen autor: se dice, no se inventa.
      name.textContent = list[i].author ? "De: " + list[i].author : "Sin autor";
      who.appendChild(dot);
      who.appendChild(num);
      who.appendChild(name);

      var body = document.createElement("div");
      body.className = "body";
      body.textContent = list[i].body || "";

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
      location.href = PROXY + "?url=" + encodeURIComponent(destination);
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
    // Ya apunta al proxy: es un enlace que reescribimos nosotros.
    if (path.indexOf("/api/proxy") === 0) return "";
    try {
      return new URL(path, PAGE).toString();
    } catch (err) {
      return "";
    }
  }

  function markNow() {
    var previous = document.querySelectorAll("." + MARK);
    for (var i = 0; i < previous.length; i++) {
      previous[i].classList.remove(MARK);
      previous[i].style.removeProperty("--mk-color");
    }

    var missing = [];
    // Con dos comentarios de personas distintas sobre el mismo elemento manda el
    // primero: un contorno no puede llevar dos colores. El globo los enseña todos.
    var painted = [];
    for (var j = 0; j < wanted.length; j++) {
      var el = resolve(wanted[j]);
      // Se recuerda cuál era: al pasar el cursor hay que saber qué comentario toca.
      wanted[j].el = el || null;
      if (el && el.classList) {
        el.classList.add(MARK);
        if (painted.indexOf(el) === -1) {
          el.style.setProperty("--mk-color", wanted[j].color || LIME);
          painted.push(el);
        }
      } else {
        missing.push(wanted[j].id);
      }
    }
    return missing;
  }

  // El informe de "no anclados" se retrasa: en una SPA el DOM aún está vacío
  // cuando llegan las marcas, y avisar de inmediato sería un falso positivo. El
  // temporizador no se reinicia en cada intento, solo se actualiza lo que dirá:
  // reiniciándolo, una página que muta sin parar no informaría nunca.
  function scheduleReport(missing) {
    latestMissing = missing;
    if (reportTimer) return;
    reportTimer = setTimeout(function () {
      reportTimer = null;
      send({ type: "marks-applied", missing: latestMissing });
    }, 3000);
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
        scheduleReport(markNow());
      }, 250);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function applyMarks(marks) {
    wanted = marks || [];
    hideTip();
    scheduleReport(markNow());
    if (!wanted.length) return;
    watchDom();
    // Este script corre en <head>: cuando llegan las marcas el cuerpo suele estar
    // vacío todavía. Se reintenta mientras la página se arma, por si el sitio la
    // construye de una forma que el observador no alcance a ver.
    var delays = [100, 300, 800, 1600, 3000, 6000];
    for (var d = 0; d < delays.length; d++) {
      setTimeout(function () {
        scheduleReport(markNow());
      }, delays[d]);
    }
  }

  /** Trae a la vista el elemento de un comentario y lo destella un momento. */
  function reveal(id, attempt) {
    var mark = null;
    for (var i = 0; i < wanted.length; i++) {
      if (wanted[i].id === id) mark = wanted[i];
    }
    var el = mark ? resolve(mark) : null;
    if (!el) {
      // Se reintenta un rato antes de darlo por perdido: cuando la petición llega
      // recién cargada la página (al saltar desde otra) el cuerpo aún se está armando.
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

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    var data = e.data;
    if (!data || data.source !== "frameit-parent") return;

    if (data.type === "set-mode") {
      picking = !!data.picking;
      document.documentElement.classList.toggle("__mk-picking", picking);
      hideTip();
      if (!picking) clearHover();
    }
    if (data.type === "set-marks") applyMarks(data.marks || []);
    if (data.type === "reveal") reveal(data.id);
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
