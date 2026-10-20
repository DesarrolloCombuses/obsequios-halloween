// Configuración de la campaña: fechas, edades y límites en un solo lugar.
// Las mismas reglas se validan en el servidor (supabase/migrations): si cambias algo aquí, cámbialo también allá.

// Plazo: lunes 19 al viernes 23 de octubre de 2026, hora de Colombia (UTC-5)
export const PLAZO = {
  inicio: new Date("2026-10-19T00:00:00-05:00"),
  cierre: new Date("2026-10-23T23:59:59-05:00"),
  textoInicio: "lunes 19 de octubre de 2026",
  textoCierre: "viernes 23 de octubre de 2026",
};

export const ZONA_HORARIA = "America/Bogota";
export const EDAD_MAX = 10;  // Reciben obsequio de 0 a EDAD_MAX años
export const MAX_NINOS = 10; // Máximo de niños por acudiente

export const NOMBRE_CSV = "combuses-obsequios-halloween-2026.csv";

// Supabase: Project Settings > API Keys. Va la clave pública (anon o publishable), nunca la secreta (service_role):
// la pública puede estar en el navegador porque los permisos de la base solo le dejan inscribir.
export const SUPABASE_URL = "https://cbplebkmxrkaafqdhiyi.supabase.co";
export const SUPABASE_CLAVE_PUBLICA = "sb_publishable_DZCceNTENY4ViP17-eZrGg_bdMElZ9X";
