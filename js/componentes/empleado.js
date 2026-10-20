import { $, marcarError } from "../utilidades/dom.js";
import { buscarEmpleado } from "../servicios/inscripciones.js";
import * as reglas from "../validacion.js";

// Al escribir la cédula se busca al empleado activo en Supabase y se muestran su nombre y cargo.
// El servidor solo devuelve esos dos datos y limita las consultas por conexión.
const ESPERA_MS = 700;   // pausa al escribir antes de buscar
let encontrado = null;   // { cedula, nombre, cargo }
let rechazo = "";        // mensaje del último rechazo para la cédula escrita
let enCurso = null;      // { cedula, promesa } de la búsqueda que está en camino
let temporizador = null;

const cedula = () => $("ccAcudiente").value.trim();

export const empleadoActual = () => encontrado && encontrado.cedula === cedula() ? encontrado : null;

// Error a mostrar en el campo cédula: "" si ya se encontró al empleado
export const errorEmpleado = () => empleadoActual() ? "" : (rechazo || "No pudimos verificar tu cédula. Intenta de nuevo.");

function mensajeRechazo(r){
  switch (r.codigo){
    case "no_es_empleado": return reglas.MENSAJE_NO_EMPLEADO;
    case "acudiente_duplicado": return reglas.MENSAJE_ACUDIENTE_DUPLICADO;
    case "demasiadas_consultas": return reglas.MENSAJE_DEMASIADAS_CONSULTAS;
    case "fuera_de_plazo": return "Las inscripciones no están abiertas en este momento.";
    default: return r.mensaje || "No pudimos verificar tu cédula. Revisa tu conexión e intenta de nuevo.";
  }
}

function pintar(estado){
  const caja = $("empleado");
  caja.textContent = "";
  caja.classList.toggle("hidden", estado === "oculto");
  caja.classList.toggle("buscando", estado === "buscando");
  if (estado === "buscando") caja.textContent = "Buscando tu registro de empleado…";
  if (estado === "encontrado"){
    const nombre = document.createElement("strong"); nombre.textContent = encontrado.nombre;
    const cargo = document.createElement("span"); cargo.textContent = encontrado.cargo || "Empleado activo de Combuses";
    caja.append(nombre, cargo);
  }
}

// El servidor rechazó la cédula (al buscar o al inscribir): se marca el campo y se oculta el nombre
export function rechazarEmpleado(r){
  encontrado = null;
  rechazo = mensajeRechazo(r);
  marcarError($("ccAcudiente"), $("e-ccAcudiente"), rechazo);
  pintar("oculto");
}

// Busca al empleado de la cédula escrita, o reutiliza la búsqueda en camino. Devuelve la respuesta del servidor.
export function verificarEmpleado(){
  const cc = cedula();
  clearTimeout(temporizador);
  if (empleadoActual()) return Promise.resolve({ ok: true });
  if (enCurso && enCurso.cedula === cc) return enCurso.promesa;
  if (reglas.validarCedula(cc)){ rechazo = ""; pintar("oculto"); return Promise.resolve({ ok: false, codigo: "formato" }); }

  pintar("buscando");
  const promesa = buscarEmpleado(cc).then(r => {
    if (enCurso && enCurso.promesa === promesa) enCurso = null;
    if (cedula() !== cc) return r;  // la persona siguió escribiendo: esta respuesta ya no aplica
    if (r.ok){
      encontrado = { cedula: cc, nombre: r.nombre, cargo: r.cargo };
      rechazo = "";
      marcarError($("ccAcudiente"), $("e-ccAcudiente"), "");
      pintar("encontrado");
    } else {
      rechazarEmpleado(r);
    }
    return r;
  });
  enCurso = { cedula: cc, promesa };
  return promesa;
}

export function reiniciarEmpleado(){
  clearTimeout(temporizador);
  encontrado = null; rechazo = ""; enCurso = null;
  pintar("oculto");
}

// Debe llamarse después de soloDigitos(ccAcudiente), para leer la cédula ya limpia
export function iniciarEmpleado(){
  const campo = $("ccAcudiente");
  campo.addEventListener("input", () => {
    clearTimeout(temporizador);
    if (empleadoActual()) return;
    rechazo = "";
    marcarError(campo, $("e-ccAcudiente"), "");
    pintar("oculto");
    if (!reglas.validarCedula(cedula())) temporizador = setTimeout(verificarEmpleado, ESPERA_MS);
  });
  campo.addEventListener("change", () => { if (!reglas.validarCedula(cedula())) verificarEmpleado(); });
}
