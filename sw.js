// Service worker – Obsequios de Halloween Combuses
// Estrategia:
//   - Archivos propios (HTML, JS, CSS, imágenes): primero la red (siempre lo último publicado); si no hay red, la caché.
//   - Supabase, la librería de Supabase (jsDelivr) y Google Fonts: directo a la red, NUNCA se guardan en caché.
//   - Auto-actualización: al cambiar VERSION, el nuevo service worker reemplaza al anterior al instante
//     y js/pwa.js recarga la página (o avisa, si hay datos escritos sin guardar).
//
// PARA PUBLICAR UNA VERSIÓN NUEVA: cambia VERSION (por ejemplo "1.0.1"). Es lo que ve la gente en el pie de página.

const VERSION = "1.3.1";
const CACHE_NAME = `obsequios-halloween-${VERSION}`;
const ESPERA_RED_MS = 4000;

const PRECACHE = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.webmanifest", "./manifest-admin.webmanifest",
  "./css/tokens.css", "./css/base.css", "./css/ambiente.css", "./css/hero.css",
  "./css/formulario.css", "./css/listado.css", "./css/admin.css",
  "./js/main.js", "./js/admin.js", "./js/pwa.js", "./js/config.js", "./js/validacion.js",
  "./js/utilidades/dom.js", "./js/utilidades/fechas.js",
  "./js/servicios/supabase.js", "./js/servicios/inscripciones.js", "./js/servicios/sesion.js", "./js/servicios/exportacion.js",
  "./js/componentes/formulario.js", "./js/componentes/empleado.js", "./js/componentes/ninos.js", "./js/componentes/plazo.js", "./js/componentes/pasos.js",
  "./js/componentes/acceso.js", "./js/componentes/listado.js", "./js/componentes/mensajes.js",
  "./assets/img/calabaza.svg", "./assets/img/murcielago.svg", "./assets/img/marca/combuses-logo-negativo.png",
  "./assets/img/marca/logo-halloween.webp", "./assets/img/marca/logo-halloween-640.webp",
  "./assets/iconos/icon-192.png", "./assets/iconos/icon-512.png", "./assets/iconos/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Uno por uno: si falta un archivo, los demás igual quedan guardados
    await Promise.allSettled(PRECACHE.map(url => cache.add(new Request(url, { cache: "no-cache" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("obsequios-halloween-") && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    const clientes = await self.clients.matchAll({ type: "window" });
    clientes.forEach(c => c.postMessage({ type: "SW_ACTIVATED", version: VERSION }));
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "GET_VERSION" && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION });
  }
});

// "no-cache" pregunta siempre al servidor si el archivo cambió: así un F5 muestra lo último sin borrar caché a mano
async function primeroRed(request){
  const cache = await caches.open(CACHE_NAME);
  const fresca = request.mode === "navigate"
    ? new Request(request.url, { cache: "no-cache", credentials: "same-origin" })
    : new Request(request, { cache: "no-cache" });
  try {
    const respuesta = await Promise.race([
      fetch(fresca),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("sin-red")), ESPERA_RED_MS)),
    ]);
    if (respuesta && respuesta.ok && respuesta.type === "basic") cache.put(request, respuesta.clone());
    return respuesta;
  } catch (e) {
    const guardada = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (guardada) return guardada;
    if (request.mode === "navigate") {
      const inicio = await cache.match("./index.html");
      if (inicio) return inicio;
    }
    throw e;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Solo archivos de esta app; todo lo de otros dominios (Supabase, jsDelivr, fuentes) va directo a la red
  if (url.origin !== self.location.origin) return;
  event.respondWith(primeroRed(request));
});
