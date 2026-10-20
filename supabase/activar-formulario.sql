-- Vuelve a encender el formulario público después de supabase/desactivar-formulario.sql.
-- Solo responde dentro del plazo de inscripción (función inscripciones_abiertas en la migración).

grant execute on function public.buscar_empleado(text) to anon, authenticated;
grant execute on function public.inscribir(jsonb, jsonb) to anon, authenticated;
