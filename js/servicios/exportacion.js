import { NOMBRE_CSV } from "../config.js";
import { fmtFechaHora } from "../utilidades/fechas.js";

// CSV para Excel en español: separador ";" y BOM para que respete las tildes.
// Una fila por niño (un obsequio por fila), con los datos del acudiente.
export function generarCSV(familias){
  const enc = ["Empleado","Cargo","Cédula","Celular","Niño o niña","Obsequio para","Edad","Parentesco","Fecha de inscripción",
               "Asistencia","Asistencia marcada","Marcada por"];
  const asistencia = { asistio: "Asistió", no_asistio: "No asistió" };
  const esc = v => '"' + String(v ?? "").replace(/"/g,'""') + '"';
  const filas = familias.flatMap(f => f.ninos.map(n => [
    f.acudiente, f.cargo, f.ccAcudiente, f.celular, n.nombres, n.sexo, n.edad, n.parentesco,
    fmtFechaHora(f.fechaInscripcion),
    asistencia[n.asistencia] || "Pendiente", n.asistenciaEn ? fmtFechaHora(n.asistenciaEn) : "", n.asistenciaPor
  ].map(esc).join(";")));
  return "﻿" + [enc.map(esc).join(";"), ...filas].join("\r\n");
}

// Dentro de Claude se usa su capacidad "downloads"; fuera de Claude, descarga directa
let descargas = null;
export function prepararDescargas(){
  if (window.claude && typeof window.claude.use === "function"){
    window.claude.use("downloads").then(d => { descargas = d; }).catch(() => {});
  }
}

// Devuelve "descargado", "copiado" (al portapapeles) o "error"
export async function descargarCSV(contenido){
  if (descargas){ try { await descargas.save({ filename: NOMBRE_CSV, data: contenido }); return "descargado"; } catch(e){} }
  if (!window.claude){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenido], {type:"text/csv;charset=utf-8"}));
    a.download = NOMBRE_CSV;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return "descargado";
  }
  try { await navigator.clipboard.writeText(contenido); return "copiado"; }
  catch(e){ return "error"; }
}
