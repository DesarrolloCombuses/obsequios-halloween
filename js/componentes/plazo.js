import { PLAZO } from "../config.js";
import { $ } from "../utilidades/dom.js";

// Abre o cierra el formulario según la fecha. Devuelve true si se puede inscribir.
export function verificarPlazo(){
  const ahora = new Date(), plazo = $("plazo");
  if (ahora < PLAZO.inicio){ cerrar("Las inscripciones aún no han abierto", "Abren el " + PLAZO.textoInicio + "."); plazo.textContent = "Abre el " + PLAZO.textoInicio; return false; }
  if (ahora > PLAZO.cierre){ cerrar("Inscripciones cerradas", "El plazo terminó el " + PLAZO.textoCierre + " a las 11:59 p. m."); plazo.textContent = "Plazo terminado"; return false; }
  const dias = Math.ceil((PLAZO.cierre - ahora) / 86400000);
  plazo.innerHTML = dias <= 1 ? "<b>Último día</b> para inscribirse" : "Quedan <b>" + dias + "</b> días";
  return true;
}

function cerrar(titulo, texto){
  $("cerradoTitulo").textContent = titulo; $("cerradoTexto").textContent = texto;
  $("cerrado").classList.remove("hidden"); $("form").classList.add("hidden");
  $("plazo").dataset.estado = "cerrado";
}

// Revisa el plazo al cargar y cada minuto, por si la página queda abierta al cierre
export function vigilarPlazo(){
  $("textoCierre").textContent = PLAZO.textoCierre;
  verificarPlazo();
  setInterval(verificarPlazo, 60000);
}
