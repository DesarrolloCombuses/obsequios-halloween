-- Apaga el formulario público: desde este momento nadie puede buscar empleados por cédula ni inscribir.
-- Las inscripciones guardadas no se borran y el panel del equipo sigue funcionando.
-- Ejecútalo en Supabase > SQL Editor cuando termine la campaña (o antes, si hace falta).
-- Aunque no lo ejecutes, el formulario se cierra solo al terminar el plazo (viernes 23 de octubre, 11:59 p. m.).
-- Para volver a encenderlo: supabase/activar-formulario.sql

revoke execute on function public.buscar_empleado(text) from anon, authenticated;
revoke execute on function public.inscribir(jsonb, jsonb) from anon, authenticated;
