-- =============================================================================
-- Seed de desarrollo — datos de prueba para entorno local
-- Se ejecuta con: supabase db reset
-- =============================================================================

-- Usuario de prueba (el registro en auth.users lo crea el trigger handle_new_user)
-- Para tests de integración se usa supabase.auth.admin.createUser() desde código

-- Planta de ejemplo (se inserta directamente para tests SQL)
-- Requiere que el usuario exista previamente en auth.users y public.users

-- Ejemplo de inserción manual para inspección en Supabase Studio:
/*
INSERT INTO public.plants (user_id, common_name, species, location, watering_frequency_days, next_watering_date)
VALUES (
  '<UUID del usuario de prueba>',
  'Monstera',
  'Monstera deliciosa',
  'interior',
  7,
  CURRENT_DATE
);
*/
