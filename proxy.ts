import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie, redirectWith, withSession } from "@/lib/supabase/proxy";
import { MIRROR_PREFIX, mirrorTarget } from "@/lib/mirror";
import { TARGET_HEADER } from "@/lib/target-header";

/** Pantallas de la app: exigen sesión. */
const APP_PATHS = new Set(["/", "/cuenta"]);

/**
 * Y sus ramas: /proyectos/<slug> y su espacio de trabajo. Va por prefijo porque
 * el slug no se conoce de antemano.
 *
 * Todo lo que caiga aquí deja de estar disponible para el sitio proxiado, que
 * comparte origen con la app: si el sitio revisado tuviera una ruta /proyectos,
 * la serviríamos nosotros. Por eso el prefijo es uno solo y con nombre propio.
 */
const APP_PREFIXES = ["/proyectos"];

function isAppPath(pathname: string): boolean {
  if (APP_PATHS.has(pathname)) return true;
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Rutas que se sirven sin sesión, porque son las que sirven para conseguirla. */
const LOGIN_PATH = "/login";
const AUTH_PREFIX = "/auth/";

/** Peticiones ajenas a todo esto, que no deben acabar en el proxy ni en el login. */
const PUBLIC_PATHS = new Set(["/favicon.ico"]);

/**
 * Lo nuestro que se sirve desde `public/`: el logotipo sale en el login, o sea
 * antes de que haya sesión, y sin esto se contestaría con el 401 de más abajo.
 *
 * Va bajo un prefijo con nombre propio y no suelto en la raíz por lo mismo que
 * /proyectos: cada ruta que reclamamos se la quitamos al sitio revisado, y
 * /logo.svg lo tiene medio internet. Servirle nuestra marca a quien pide la suya
 * sería un fallo difícil de ver y fácil de creerse.
 */
const OWN_ASSET_PREFIX = "/marca/";

function isOwnAsset(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith(OWN_ASSET_PREFIX);
}

/**
 * Encamina al proxy todo lo que pide el sitio revisado.
 *
 * Lo normal llega bajo la ruta calcada (`/_sitio/https/ejemplo.com/…`), que lleva
 * el destino escrito: es la forma de que las URLs que el sitio resuelve por su
 * cuenta —imports relativos dentro de su JavaScript— caigan donde deben.
 *
 * Queda fuera lo que ese JavaScript construye como ruta absoluta de la raíz
 * (`/assets/logo.png` dentro de un bundle de Vite, llamadas a su propia API…),
 * que pierde el prefijo. Para eso está la cookie que deja /api/proxy: el Referer
 * no sirve porque los routers de SPA cambian la URL del documento con pushState.
 *
 * Aquí se guarda además la puerta de entrada: sin sesión no se sirve ni la app ni
 * el proxy, que si no sería un relé abierto para cualquiera que sepa la URL.
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isOwnAsset(pathname)) return NextResponse.next();

  // El acceso y la vuelta del correo de confirmación: sin sesión, pero refrescando
  // cookies, que es donde se materializa la que acaba de crearse.
  if (pathname === LOGIN_PATH || pathname.startsWith(AUTH_PREFIX)) {
    const { user, response } = await withSession(request);
    if (user && pathname === LOGIN_PATH) return redirectWith(request, "/", response);
    return response;
  }

  if (isAppPath(pathname)) {
    const { user, response } = await withSession(request);
    if (user) return response;
    const next = encodeURIComponent(pathname + search);
    return redirectWith(request, `${LOGIN_PATH}?next=${next}`, response);
  }

  // De aquí abajo todo es tráfico del sitio proxiado. La comprobación es por
  // presencia de cookie, no contra Supabase: esto corre en cada imagen y cada
  // fetch de la página servida, y un viaje de red por recurso sería inaceptable.
  if (!hasSessionCookie(request)) {
    return new NextResponse("Frame It: hace falta iniciar sesión.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Lo nuestro que vive bajo /api: el proxy del sitio, las miniaturas de la
  // rejilla y las caras del equipo. Sin esto, la cookie de destino las
  // reconduciría al sitio revisado —que es justo lo que hace la regla de abajo—
  // y se pedirían a su servidor.
  if (
    pathname.startsWith("/api/proxy") ||
    pathname.startsWith("/api/thumb") ||
    pathname.startsWith("/api/avatar")
  ) {
    return NextResponse.next();
  }

  // El camino principal: el documento del sitio y todo lo que resuelva por su
  // cuenta viven bajo la ruta calcada, que ya lleva escrito a qué sitio pertenecen.
  if (pathname.startsWith(`${MIRROR_PREFIX}/`)) {
    const absolute = mirrorTarget(pathname, search);
    // Sin destino legible no hay a dónde ir: mejor el 404 de la app que acabar en
    // el sitio de la cookie, que puede ser otro distinto.
    return absolute ? toProxy(request, absolute) : NextResponse.next();
  }

  // Lo que se sale del prefijo: rutas absolutas que el JavaScript del sitio pide en
  // ejecución (`/api/datos`, `/assets/logo.png`) y que aterrizan en nuestra raíz.
  // Para esas queda la cookie, que es lo único que recuerda cuál era el sitio.
  const target = request.cookies.get("mk_target")?.value;
  if (!target) return NextResponse.next();

  let absolute: string;
  try {
    absolute = new URL(pathname + search, decodeURIComponent(target)).toString();
  } catch {
    return NextResponse.next();
  }

  return toProxy(request, absolute);
}

/**
 * Encamina la petición al route handler del proxy.
 *
 * El destino viaja en una cabecera de la petición, no solo en la query: tras un
 * rewrite el route handler sigue leyendo la URL original, donde ese `?url=` no
 * existe. La query se mantiene porque es la forma en que se le llama de fuera.
 */
function toProxy(request: NextRequest, absolute: string) {
  const headers = new Headers(request.headers);
  headers.set(TARGET_HEADER, absolute);

  const rewritten = new URL("/api/proxy", request.url);
  rewritten.searchParams.set("url", absolute);
  return NextResponse.rewrite(rewritten, { request: { headers } });
}

export const config = {
  // `_next/hmr` es nuestro websocket de recarga en caliente: reconducirlo al sitio
  // proxiado lo rompe en cuanto hay una cookie de destino puesta.
  matcher: ["/((?!_next/static|_next/image|_next/hmr|_next/webpack-hmr).*)"],
};
