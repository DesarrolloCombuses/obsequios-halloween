import { obtenerCliente, configurado, MENSAJE_SIN_CONFIGURAR } from "./supabase.js";

// Única puerta a los datos. Las inscripciones viven en Supabase (tablas acudientes y ninos);
// el resto de la app trabaja con esta forma:
// { id, acudiente, cargo, ccAcudiente, celular, fechaInscripcion,
//   ninos: [{ id, nombres, edad, sexo, parentesco, asistencia, asistenciaEn, asistenciaPor }] }
// asistencia: "asistio", "no_asistio" o null (pendiente)

const MENSAJE_CONEXION = "No se pudo guardar la inscripción. Revisa tu conexión a internet e intenta de nuevo.";
const PAGINA = 500;

// Público. Busca un empleado ACTIVO por cédula: { ok: true, nombre, cargo } o { ok: false, codigo }
export async function buscarEmpleado(cedula){
  if (!configurado) return { ok: false, codigo: "sin_configurar", mensaje: MENSAJE_SIN_CONFIGURAR };
  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase.rpc("buscar_empleado", { p_cedula: cedula });
    if (error || !data) return { ok: false, codigo: "error" };
    return data;
  } catch(e){
    return { ok: false, codigo: "error" };
  }
}

// Público. Devuelve { ok: true } o { ok: false, codigo, mensaje? } (ver la función inscribir en supabase/migrations)
// El nombre y el cargo no se envían: el servidor los toma de employees con la cédula.
export async function inscribir(familia){
  if (!configurado) return { ok: false, codigo: "sin_configurar", mensaje: MENSAJE_SIN_CONFIGURAR };
  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase.rpc("inscribir", {
      p_acudiente: { cedula: familia.ccAcudiente, celular: familia.celular, autoriza: familia.autoriza },
      p_ninos: familia.ninos.map(n => ({ nombres: n.nombres, edad: n.edad, sexo: n.sexo, parentesco: n.parentesco }))
    });
    if (error || !data) return { ok: false, codigo: "error", mensaje: MENSAJE_CONEXION };
    return data;
  } catch(e){
    return { ok: false, codigo: "error", mensaje: MENSAJE_CONEXION };
  }
}

// Panel del equipo (requiere sesión de administrador). Lanzan error si algo falla.
export async function listarFamilias(){
  const supabase = await obtenerCliente();
  const familias = [];
  for (let desde = 0; ; desde += PAGINA){
    const { data, error } = await supabase.from("acudientes")
      .select("id, nombre, cargo, cedula, celular, creado_en, ninos(id, orden, nombres, edad, sexo, parentesco, asistencia, asistencia_en, asistencia_por)")
      .order("creado_en").order("id")
      .order("orden", { referencedTable: "ninos" })
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    familias.push(...data.map(aFamilia));
    if (data.length < PAGINA) return familias;
  }
}

// Panel: avisa cuando alguien se inscribe, se elimina una inscripción o se marca una asistencia
// (Supabase Realtime; respeta los permisos). alEstado recibe "SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT" o "CLOSED".
// Devuelve una función para dejar de escuchar.
export async function escucharInscripciones(alCambiar, alEstado){
  const supabase = await obtenerCliente();
  const canal = supabase.channel("panel-inscripciones")
    .on("postgres_changes", { event: "*", schema: "public", table: "acudientes" }, () => alCambiar())
    .on("postgres_changes", { event: "*", schema: "public", table: "ninos" }, () => alCambiar())
    .subscribe(estado => alEstado(estado));
  return () => supabase.removeChannel(canal);
}

// Panel: marca la asistencia de uno o varios niños. estado: "asistio", "no_asistio" o null (pendiente).
export async function marcarAsistencia(ids, estado){
  const supabase = await obtenerCliente();
  const { error } = await supabase.rpc("marcar_asistencia", { p_ninos: ids, p_estado: estado });
  if (error) throw error;
}

export async function eliminarFamilia(id){
  const supabase = await obtenerCliente();
  const { data, error } = await supabase.from("acudientes").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw new Error("No se eliminó: la inscripción no existe o no tienes permiso.");
}

function aFamilia(fila){
  return {
    id: fila.id,
    acudiente: fila.nombre,
    cargo: fila.cargo,
    ccAcudiente: fila.cedula,
    celular: fila.celular,
    fechaInscripcion: fechaSafari(fila.creado_en),
    ninos: fila.ninos.map(n => ({
      id: n.id, nombres: n.nombres, edad: n.edad, sexo: n.sexo, parentesco: n.parentesco,
      asistencia: n.asistencia, asistenciaEn: n.asistencia_en && fechaSafari(n.asistencia_en), asistenciaPor: n.asistencia_por
    }))
  };
}

// Postgres envía microsegundos; se recortan a milisegundos para que Safari lea la fecha
const fechaSafari = iso => iso.replace(/(\.\d{3})\d+/, "$1");
