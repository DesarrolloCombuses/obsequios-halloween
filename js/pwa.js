// PWA: registra el service worker, muestra la versión en el pie de página y se actualiza sola.
// Al publicar una versión nueva (VERSION en sw.js) la página se recarga sola, revisando cada 5 minutos
// y cada vez que se vuelve a la app. Si hay datos escritos sin guardar, en vez de recargar muestra
// un aviso con un botón, para no borrar lo que la persona estaba escribiendo.
import { $ } from "./utilidades/dom.js";

const REVISAR_CADA_MS = 5 * 60 * 1000;
let recargando = false;

function mostrarVersion(v){
  if (v) $("appVersion").textContent = "v" + v;
}

// Sin service worker (por ejemplo, abriendo por la IP de la red, sin HTTPS) la versión se lee del propio sw.js
async function leerVersionDelArchivo(){
  try {
    const texto = await (await fetch("sw.js", { cache: "no-cache" })).text();
    const m = texto.match(/const VERSION = "([^"]+)"/);
    if (m) mostrarVersion(m[1]);
  } catch(e){}
}

function preguntarVersion(){
  const sw = navigator.serviceWorker.controller;
  if (!sw){ leerVersionDelArchivo(); return; }
  const canal = new MessageChannel();
  canal.port1.onmessage = e => mostrarVersion(e.data && e.data.version);
  sw.postMessage({ type: "GET_VERSION" }, [canal.port2]);
}

// ¿Hay algo escrito en algún formulario que se perdería al recargar?
function hayDatosSinGuardar(){
  return [...document.querySelectorAll("form input, form select")].some(el => el.type === "checkbox" ? el.checked : el.value.trim() !== "");
}

function recargar(){
  recargando = true;
  location.reload();
}

function avisarVersionNueva(){
  if ($("avisoVersion")) return;
  const aviso = document.createElement("div");
  aviso.id = "avisoVersion"; aviso.className = "aviso-flotante"; aviso.setAttribute("role", "status");
  const texto = document.createElement("span"); texto.textContent = "Hay una versión nueva. Termina lo que estás haciendo o actualiza ahora.";
  const boton = document.createElement("button"); boton.type = "button"; boton.className = "btn"; boton.textContent = "Actualizar";
  boton.addEventListener("click", recargar);
  aviso.append(texto, boton);
  document.body.appendChild(aviso);
}

function aplicarVersionNueva(){
  if (recargando) return;
  if (hayDatosSinGuardar()) avisarVersionNueva(); else recargar();
}

// "Instalar app": el navegador avisa cuando la app se puede instalar (Android/Chrome/Edge). En iPhone es Compartir > Agregar a inicio.
function prepararInstalacion(){
  let solicitud = null;
  const boton = $("instalarApp");
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    solicitud = e;
    boton.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => { solicitud = null; boton.classList.add("hidden"); });
  boton.addEventListener("click", async () => {
    if (!solicitud) return;
    solicitud.prompt();
    try { await solicitud.userChoice; } catch(e){}
    solicitud = null;
    boton.classList.add("hidden");
  });
}

export function iniciarPWA(){
  // El service worker solo funciona con HTTPS o en localhost / 127.0.0.1
  if (!("serviceWorker" in navigator) || !window.isSecureContext){ leerVersionDelArchivo(); return; }
  prepararInstalacion();

  // La primera vez que el service worker toma control no hay nada viejo que reemplazar: no se recarga
  let habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaControlador){ habiaControlador = true; preguntarVersion(); return; }
    aplicarVersionNueva();
  });
  navigator.serviceWorker.addEventListener("message", e => {
    if (e.data && e.data.type === "SW_ACTIVATED") mostrarVersion(e.data.version);
  });

  window.addEventListener("load", async () => {
    let reg;
    try {
      reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    } catch(e){
      leerVersionDelArchivo();
      return;
    }
    preguntarVersion();
    const revisar = () => reg.update().catch(() => {});
    setInterval(revisar, REVISAR_CADA_MS);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") revisar(); });

    // Tocar la versión busca una actualización en ese momento
    const pastilla = $("appVersion");
    pastilla.addEventListener("click", async () => {
      pastilla.textContent = "Buscando…";
      await revisar();
      if (reg.installing || reg.waiting){ pastilla.textContent = "Actualizando…"; return; }
      pastilla.textContent = "Al día ✓";
      setTimeout(preguntarVersion, 1800);
    });
  });
}
