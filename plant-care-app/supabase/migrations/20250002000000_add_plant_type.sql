-- =============================================================================
-- Migración 002 — Añadir columna plant_type a la tabla plants
-- =============================================================================

ALTER TABLE public.plants
  ADD COLUMN plant_type TEXT CHECK (
    plant_type IN (
      'suculenta', 'cactus', 'tropical', 'herbácea',
      'frutal', 'arbusto', 'árbol', 'acuática', 'otra'
    )
  );

CREATE INDEX idx_plants_plant_type ON public.plants (plant_type);
