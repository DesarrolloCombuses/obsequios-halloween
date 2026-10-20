import { obtenerCliente } from "./supabase.js";

// Inicio de sesión del equipo con Supabase Auth (correo y contraseña)

export async function sesionActual(){
  const supabase = await obtenerCliente();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function entrar(correo, clave){
  const supabase = await obtenerCliente();
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw error;
  return data.session;
}

export async function salir(){
  const supabase = await obtenerCliente();
  await supabase.auth.signOut();
}

// true si el usuario está en la tabla administradores
export async function esAdmin(){
  const supabase = await obtenerCliente();
  const { data, error } = await supabase.rpc("es_admin");
  if (error) throw error;
  return data === true;
}
