-- Obsequios de Halloween – Combuses
-- Entrega de obsequios: el panel del equipo marca si cada niño o niña asistió o no asistió.
--
-- Requiere haber ejecutado antes 20261020120000_inscripciones_halloween.sql.
-- No modifica public.employees. Se puede ejecutar más de una vez sin perder datos.

-- 1. Asistencia de cada niño o niña (vacía = pendiente) ------------------------------

alter table public.ninos
  add column if not exists asistencia      text check (asistencia in ('asistio', 'no_asistio')),
  add column if not exists asistencia_en   timestamptz,  -- cuándo se marcó
  add column if not exists asistencia_por  text;         -- correo de quien la marcó

-- 2. Marcar asistencia (solo administradores) -----------------------------------------
-- p_ninos: ids de los niños (uno, o todos los de un empleado). p_estado: 'asistio', 'no_asistio' o null (pendiente).
-- Devuelve cuántos niños se marcaron. El público no la puede llamar.
create or replace function public.marcar_asistencia(p_ninos uuid[], p_estado text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quien  text;
  v_total  int;
begin
  if not public.es_admin() then
    raise exception 'Solo el equipo puede marcar la asistencia.' using errcode = '42501';
  end if;
  if p_estado is not null and p_estado not in ('asistio', 'no_asistio') then
    raise exception 'Estado de asistencia inválido: %', p_estado using errcode = '22023';
  end if;

  select email into v_quien from public.administradores where user_id = auth.uid();
  update public.ninos
     set asistencia     = p_estado,
         asistencia_en  = case when p_estado is null then null else now() end,
         asistencia_por = case when p_estado is null then null else v_quien end
   where id = any(p_ninos);
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;
revoke execute on function public.marcar_asistencia(uuid[], text) from public, anon;
grant execute on function public.marcar_asistencia(uuid[], text) to authenticated;

-- 3. Tiempo real: lo que marca una persona del equipo aparece en los demás paneles abiertos
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ninos') then
    alter publication supabase_realtime add table public.ninos;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Comprobación
select count(*) as ninos_inscritos, count(asistencia) as con_asistencia_marcada from public.ninos;
