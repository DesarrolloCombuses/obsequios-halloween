import { $, soloDigitos, marcarError, conEspera } from "../utilidades/dom.js";
import { txtEdad } from "../utilidades/fechas.js";
import * as reglas from "../validacion.js";
import { inscribir } from "../servicios/inscripciones.js";
import { agregarNino, reiniciarNinos, tarjetas, campo, errorDe } from "./ninos.js";
import { iniciarEmpleado, verificarEmpleado, empleadoActual, errorEmpleado, rechazarEmpleado, reiniciarEmpleado } from "./empleado.js";
import { irAPaso, pasoActual } from "./pasos.js";
import { verificarPlazo } from "./plazo.js";
import { mostrarMensaje } from "./mensajes.js";

// Inscripción en tres pasos: 1 cédula y celular, 2 todos los niños, 3 confirmar que están todos y enviar.
// Cada empleado se inscribe una sola vez (el servidor no deja repetir la cédula), por eso el paso 3 pide confirmar.
const form = $("form");
let ninosPorEnviar = [];

const ocultarMensaje = () => $("mensaje").classList.add("hidden");
const contarNinos = n => n === 1 ? "1 niño o niña" : n + " niños";

// Marca en rojo los campos con error y enfoca el primero. Devuelve true si no hay errores.
function revisar(campos){
  let primero = null;
  campos.forEach(([input, errEl, texto]) => { if (!marcarError(input, errEl, texto)) primero = primero || input; });
  if (primero) primero.focus();
  return !primero;
}

// Paso 1: cédula de un empleado activo y celular
function validarEmpleado(){
  return revisar([
    [$("ccAcudiente"), $("e-ccAcudiente"), reglas.validarCedula($("ccAcudiente").value.trim()) || errorEmpleado()],
    [$("celular"), $("e-celular"), reglas.validarCelular($("celular").value.trim())]
  ]);
}

// Paso 2: cada niño y la autorización. Devuelve los niños si todo está bien, o null.
function validarNinos(){
  const enEste = new Set(), campos = [];
  const ninos = tarjetas().map(card => {
    const c = n => campo(card, n);
    const e = n => errorDe(card, n);
    const nombres = c("nombres").value.trim();
    const clave = nombres.toLowerCase().replace(/\s+/g, " ");  // igual que el servidor, para detectar repetidos
    const ed = c("edad").value === "" ? null : Number(c("edad").value);

    campos.push([c("nombres"), e("nombres"), reglas.validarNombreNino(nombres, { repetido: enEste.has(clave) })]);
    enEste.add(clave);
    campos.push([c("edad"), e("edad"), reglas.validarEdad(ed)]);
    campos.push([c("sexo"), e("sexo"), reglas.validarSexo(c("sexo").value)]);
    campos.push([c("parentesco"), e("parentesco"), reglas.validarParentesco(c("parentesco").value)]);

    return { nombres, edad: ed, sexo: c("sexo").value, parentesco: c("parentesco").value };
  });
  campos.push([$("autoriza"), $("e-autoriza"), reglas.validarAutorizacion($("autoriza").checked)]);
  return revisar(campos) ? ninos : null;
}

// Lista de niños para confirmar y para el mensaje final
function pintarLista(ul, ninos){
  ul.textContent = "";
  ninos.forEach(n => {
    const li = document.createElement("li");
    const nombre = document.createElement("strong"); nombre.textContent = n.nombres;
    const detalle = document.createElement("span"); detalle.textContent = [txtEdad(n.edad), n.sexo, n.parentesco].join(" · ");
    li.append(nombre, detalle);
    ul.appendChild(li);
  });
}

async function continuar(){
  if ($("continuar").disabled) return;
  // Si la cédula aún no se verificó (por ejemplo, se escribió muy rápido), se verifica ahora
  await conEspera($("continuar"), "Verificando…", verificarEmpleado);
  if (!validarEmpleado()) return;
  ocultarMensaje();
  const e = empleadoActual();
  $("saludoNombre").textContent = e.nombre;
  $("saludoCargo").textContent = e.cargo || "Empleado activo de Combuses";
  irAPaso(2);
}

function revisarInscripcion(){
  const ninos = validarNinos();
  if (!ninos){ mostrarMensaje("err","Revisa los campos marcados en rojo."); return; }
  ocultarMensaje();
  ninosPorEnviar = ninos;
  const n = ninos.length;
  $("confirmaTexto").textContent = empleadoActual().nombre + ", vas a inscribir a " + contarNinos(n) + ":";
  pintarLista($("confirmaLista"), ninos);
  $("enviar").textContent = n === 1 ? "Sí, es el único: inscribir" : "Sí, están todos: inscribir a los " + n;
  irAPaso(3);
}

async function enviar(){
  if ($("enviar").disabled) return;
  const familia = {
    acudiente: empleadoActual().nombre,
    ccAcudiente: $("ccAcudiente").value.trim(),
    celular: $("celular").value.trim(),
    autoriza: $("autoriza").checked,
    ninos: ninosPorEnviar
  };
  const r = await conEspera($("enviar"), "Inscribiendo…", () => inscribir(familia));
  if (!r.ok){ mostrarRechazo(r); return; }
  mostrarListo(familia);
}

// Lleva al paso y al campo correspondiente lo que respondió el servidor. Los datos del formulario se conservan.
function mostrarRechazo(r){
  if (r.codigo === "no_es_empleado" || r.codigo === "acudiente_duplicado"){
    rechazarEmpleado(r);
    irAPaso(1);
    $("ccAcudiente").focus();
    mostrarMensaje("err", r.codigo === "acudiente_duplicado" ? reglas.MENSAJE_ACUDIENTE_DUPLICADO : reglas.MENSAJE_NO_EMPLEADO);
    return;
  }
  if (r.codigo === "datos_invalidos"){
    // Los mensajes de los niños empiezan por "Niño o niña N"; los del empleado (cédula, celular) van al paso 1
    irAPaso(/cédula|celular/i.test(r.mensaje || "") ? 1 : 2);
    mostrarMensaje("err", r.mensaje);
    return;
  }
  if (r.codigo === "demasiadas_consultas"){
    mostrarMensaje("err", reglas.MENSAJE_DEMASIADAS_CONSULTAS);
    return;
  }
  if (r.codigo === "fuera_de_plazo"){
    verificarPlazo();
    mostrarMensaje("err","Las inscripciones no están abiertas en este momento.");
    return;
  }
  mostrarMensaje("err", r.mensaje || "No se pudo guardar la inscripción. Intenta de nuevo.");
}

function mostrarListo(familia){
  const n = familia.ninos.length;
  ocultarMensaje();
  form.reset(); reiniciarNinos(); reiniciarEmpleado(); irAPaso(1, { enfocar: false });
  form.classList.add("hidden");
  $("listoTexto").textContent = familia.acudiente + ", quedaron inscritos " + contarNinos(n) + " para el obsequio de Halloween:";
  pintarLista($("listoLista"), familia.ninos);
  $("listo").classList.remove("hidden");
  $("listo").scrollIntoView({ block: "start" });
  $("listo").focus({ preventScroll: true });
}

export function iniciarFormulario(){
  soloDigitos($("ccAcudiente"));
  soloDigitos($("celular"));
  iniciarEmpleado();
  $("agregar").addEventListener("click", () => { agregarNino().querySelector("input").focus(); });
  $("cambiarCedula").addEventListener("click", () => { irAPaso(1); $("ccAcudiente").focus(); });
  $("volver").addEventListener("click", () => irAPaso(2));
  $("otraInscripcion").addEventListener("click", () => {
    $("listo").classList.add("hidden");
    form.classList.remove("hidden");
    irAPaso(1);
    $("ccAcudiente").focus();
  });

  // Enter o el botón principal de cada paso
  form.addEventListener("submit", ev => {
    ev.preventDefault();
    if (!verificarPlazo()) return;
    ({ 1: continuar, 2: revisarInscripcion, 3: enviar })[pasoActual()]();
  });

  agregarNino();
  irAPaso(1, { enfocar: false });
}
