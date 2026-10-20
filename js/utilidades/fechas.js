import { ZONA_HORARIA } from "../config.js";

// Textos de edad y fecha para la pantalla y el CSV
export const txtEdad = e => e === 0 ? "Menos de 1 año" : e + (e === 1 ? " año" : " años");
export const fmtFechaHora = iso => new Date(iso).toLocaleString("es-CO",{timeZone:ZONA_HORARIA});
export const fmtHora = iso => new Date(iso).toLocaleTimeString("es-CO",{timeZone:ZONA_HORARIA,hour:"numeric",minute:"2-digit"});
