import { $ } from "../utilidades/dom.js";
import { txtEdad, fmtHora } from "../utilidades/fechas.js";
import { listarFamilias, eliminarFamilia, escucharInscripciones, marcarAsistencia } from "../servicios/inscripciones.js";
import { generarCSV, descargarCSV } from "../servicios/exportacion.js";
import { mostrarMensaje } from "./mensajes.js";

// Listado del panel como checklist de la entrega: una fila por niño, agrupada por empleado (acudiente).
// En cada niño se marca "Asistió" o "No asistió"; tocar otra vez el botón marcado lo deja pendiente.
let familias = [];
let filtro = "todos";   // "todos", "pendiente", "asistio" o "no_asistio"
const TEXTO_VACIO = "Todavía no hay inscritos. El primero aparecerá aquí.";
const ESTADOS = { asistio: "Asistió", no_asistio: "No asistió" };

const estadoDe = n => n.asistencia || "pendiente";
// Para buscar sin importar tildes ni mayúsculas
const normalizar = t => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// silencioso: recarga sin el aviso "Cargando…" (la usa el tiempo real)
export async function cargarListado({ silencioso = false } = {}){
  if (!silencioso){
    $("vacio").textContent = "Cargando inscripciones…";
    $("vacio").classList.remove("hidden");
  }
  try {
    familias = await listarFamilias();
  } catch(e){
    // Si ya había un listado, se deja a la vista; solo se avisa
    pintarListado();
    if (!familias.length) $("vacio").textContent = "No se pudo cargar el listado.";
    mostrarMensaje("err","No se pudo cargar el listado. Revisa tu conexión e intenta de nuevo.");
    return;
  }
  pintarListado();
}

// Familias y niños que coinciden con la búsqueda y el filtro. Si coincide el empleado, se muestran todos sus niños.
function visibles(){
  const q = normalizar($("buscar").value.trim());
  return familias.map(f => {
    const coincideFamilia = !q || normalizar(f.acudiente).includes(q) || f.ccAcudiente.includes(q) || normalizar(f.cargo).includes(q);
    const candidatos = coincideFamilia ? f.ninos : f.ninos.filter(n => normalizar(n.nombres).includes(q));
    return { f, ninos: filtro === "todos" ? candidatos : candidatos.filter(n => estadoDe(n) === filtro) };
  }).filter(x => x.ninos.length);
}

function pintarContadores(){
  const todos = familias.flatMap(f => f.ninos);
  const cuenta = estado => todos.filter(n => estadoDe(n) === estado).length;
  $("cTodos").textContent = todos.length;
  $("cPendiente").textContent = cuenta("pendiente");
  $("cAsistio").textContent = cuenta("asistio");
  $("cNoAsistio").textContent = cuenta("no_asistio");
  document.querySelectorAll("[data-filtro]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filtro === filtro)));
  return todos.length;
}

function pintarListado(){
  // Al volver a pintar se conserva el foco en el mismo botón (el tiempo real repinta mientras se marca)
  const foco = document.activeElement && document.activeElement.dataset.foco;
  const tb = $("tbody"); tb.textContent = "";
  const total = pintarContadores();
  const lista = visibles();
  const mostrados = lista.reduce((s, x) => s + x.ninos.length, 0);
  lista.forEach(({ f, ninos }) => ninos.forEach((n, i) => tb.appendChild(filaNino(f, n, i === 0))));

  $("resumenLista").textContent = !familias.length ? ""
    : (mostrados === total ? "" : "Mostrando " + mostrados + " de " + total + " niños · ") + familias.length + (familias.length === 1 ? " empleado inscrito." : " empleados inscritos.");
  $("vacio").textContent = familias.length ? "Nadie coincide con la búsqueda o el filtro." : TEXTO_VACIO;
  $("vacio").classList.toggle("hidden", mostrados > 0);
  if (foco){ const el = tb.querySelector('[data-foco="' + foco + '"]'); if (el) el.focus(); }
}

function filaNino(f, n, primera){
  const tr = document.createElement("tr");
  if (primera) tr.className = "familia";
  const td0 = document.createElement("td");
  if (primera){
    td0.textContent = f.acudiente;
    const s = document.createElement("div"); s.className = "hint"; s.textContent = [f.cargo, "CC " + f.ccAcudiente, "cel. " + f.celular].filter(Boolean).join(" · ");
    td0.appendChild(s);
    if (f.ninos.length > 1){
      const todos = document.createElement("button");
      todos.type = "button"; todos.className = "enlace"; todos.dataset.foco = "todos-" + f.id;
      todos.textContent = "Todos asistieron (" + f.ninos.length + ")";
      todos.addEventListener("click", () => marcar(f.ninos, "asistio", "todos los niños de " + f.acudiente));
      td0.appendChild(todos);
    }
  }
  tr.appendChild(td0);
  // La etiqueta se muestra en celular, donde cada fila pasa a ser una tarjeta (ver listado.css)
  [["", n.nombres + " (" + n.sexo.toLowerCase() + ")"], ["Edad", txtEdad(n.edad)], ["Parentesco", n.parentesco]].forEach(([etiqueta, t]) => {
    const td = document.createElement("td"); td.textContent = t;
    if (etiqueta) td.dataset.label = etiqueta;
    tr.appendChild(td);
  });
  tr.appendChild(celdaAsistencia(n));
  const td = document.createElement("td");
  if (primera) td.appendChild(botonEliminar(f));
  tr.appendChild(td);
  return tr;
}

function celdaAsistencia(n){
  const td = document.createElement("td");
  td.className = "celda-asistencia";
  const grupo = document.createElement("div");
  grupo.className = "asistencia"; grupo.setAttribute("role", "group"); grupo.setAttribute("aria-label", "Asistencia de " + n.nombres);
  [["asistio", "si"], ["no_asistio", "no"]].forEach(([estado, clase]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "boton-asistencia " + clase; b.textContent = ESTADOS[estado];
    b.dataset.foco = clase + "-" + n.id;
    b.setAttribute("aria-pressed", String(n.asistencia === estado));
    b.addEventListener("click", () => marcar([n], n.asistencia === estado ? null : estado, n.nombres));
    grupo.appendChild(b);
  });
  td.appendChild(grupo);
  if (n.asistencia && n.asistenciaEn){
    const info = document.createElement("div"); info.className = "hint marca-info";
    info.textContent = fmtHora(n.asistenciaEn) + (n.asistenciaPor ? " · " + n.asistenciaPor.split("@")[0] : "");
    td.appendChild(info);
  }
  return td;
}

// Se pinta enseguida (sin esperar al servidor); si no se puede guardar, se devuelve como estaba y se avisa
async function marcar(ninos, estado, quien){
  const antes = ninos.map(n => [n, { asistencia: n.asistencia, asistenciaEn: n.asistenciaEn, asistenciaPor: n.asistenciaPor }]);
  const ahora = new Date().toISOString(), usuario = $("usuario").textContent;
  ninos.forEach(n => { n.asistencia = estado; n.asistenciaEn = estado && ahora; n.asistenciaPor = estado && usuario; });
  pintarListado();
  try {
    await marcarAsistencia(ninos.map(n => n.id), estado);
  } catch(e){
    antes.forEach(([n, previo]) => Object.assign(n, previo));
    pintarListado();
    mostrarMensaje("err","No se pudo guardar la asistencia de " + quien + ". Revisa tu conexión e intenta de nuevo.");
  }
}

function botonEliminar(f){
  const b = document.createElement("button");
  b.type = "button"; b.className = "eliminar"; b.textContent = "Eliminar";
  b.setAttribute("aria-label","Eliminar inscripción de " + f.acudiente);
  b.addEventListener("click", async () => {
    if (!confirm("¿Eliminar la inscripción de " + f.acudiente + " y sus " + f.ninos.length + " niño(s)? No se puede deshacer.")) return;
    b.disabled = true;
    try {
      await eliminarFamilia(f.id);
    } catch(e){
      b.disabled = false;
      mostrarMensaje("err","No se pudo eliminar la inscripción de " + f.acudiente + ". " + (e.message || ""));
      return;
    }
    familias = familias.filter(x => x !== f);
    pintarListado();
    mostrarMensaje("ok","Se eliminó la inscripción de " + f.acudiente + ".");
  });
  return b;
}

// Tiempo real: con cada inscripción, eliminación o asistencia marcada el listado se recarga solo (agrupando cambios seguidos)
let dejarDeEscuchar = null;
let pendiente = null;
export async function activarTiempoReal(){
  if (dejarDeEscuchar) return;
  try {
    dejarDeEscuchar = await escucharInscripciones(
      () => { clearTimeout(pendiente); pendiente = setTimeout(() => cargarListado({ silencioso: true }), 800); },
      estado => $("enVivo").classList.toggle("hidden", estado !== "SUBSCRIBED")
    );
  } catch(e){
    $("enVivo").classList.add("hidden");
  }
}
export function desactivarTiempoReal(){
  clearTimeout(pendiente);
  if (dejarDeEscuchar){ dejarDeEscuchar(); dejarDeEscuchar = null; }
  $("enVivo").classList.add("hidden");
}

export function iniciarListado(){
  $("exportar").addEventListener("click", async () => {
    if (!familias.length){ mostrarMensaje("err","No hay inscritos para descargar."); return; }
    const resultado = await descargarCSV(generarCSV(familias));
    if (resultado === "copiado") mostrarMensaje("ok","Listado copiado. Pégalo en Excel o en un archivo .csv.");
    else if (resultado === "error") mostrarMensaje("err","No se pudo descargar ni copiar el listado en este navegador.");
  });
  $("actualizar").addEventListener("click", () => cargarListado());
  $("buscar").addEventListener("input", pintarListado);
  document.querySelectorAll("[data-filtro]").forEach(b => b.addEventListener("click", () => { filtro = b.dataset.filtro; pintarListado(); }));
}
