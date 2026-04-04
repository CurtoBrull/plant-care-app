-- =============================================================================
-- Migración 001 — Esquema base de Plant Care App
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tabla: users
-- Extiende auth.users de Supabase; se crea automáticamente via trigger
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT        NOT NULL,
  display_name          TEXT        NOT NULL,
  notifications_enabled BOOLEAN     NOT NULL DEFAULT true,
  reminder_time         TIME        NOT NULL DEFAULT '08:00',
  fcm_token             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: insertar fila en public.users cuando se registra un nuevo auth.user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tabla: plants
-- ---------------------------------------------------------------------------
CREATE TABLE public.plants (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  common_name                 TEXT        NOT NULL CHECK (char_length(common_name) > 0),
  species                     TEXT        NOT NULL CHECK (char_length(species) > 0),
  scientific_name             TEXT,
  acquisition_date            DATE,
  location                    TEXT        CHECK (location IN ('interior', 'exterior')),
  notes                       TEXT,
  representative_photo_url    TEXT,
  -- CareSchedule (embebido)
  watering_frequency_days     INTEGER     CHECK (watering_frequency_days > 0),
  fertilizing_frequency_days  INTEGER     CHECK (fertilizing_frequency_days > 0),
  fertilizer_type             TEXT,
  light_needs                 TEXT        CHECK (light_needs IN ('directa', 'indirecta', 'sombra')),
  temperature_min_c           NUMERIC,
  temperature_max_c           NUMERIC,
  pruning_frequency_months    INTEGER     CHECK (pruning_frequency_months > 0),
  repotting_frequency_months  INTEGER     CHECK (repotting_frequency_months > 0),
  -- NextCareDates (embebido)
  next_watering_date          DATE,
  next_fertilizing_date       DATE,
  next_pruning_date           DATE,
  next_repotting_date         DATE,
  -- Auditoría
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraint: temperatura mínima debe ser ≤ máxima cuando ambas están presentes
  CONSTRAINT temperature_range_valid CHECK (
    temperature_min_c IS NULL OR
    temperature_max_c IS NULL OR
    temperature_min_c <= temperature_max_c
  )
);

-- Índice para búsqueda por nombre común y especie (insensible a mayúsculas)
CREATE INDEX idx_plants_common_name ON public.plants USING gin (to_tsvector('simple', common_name));
CREATE INDEX idx_plants_species     ON public.plants USING gin (to_tsvector('simple', species));
CREATE INDEX idx_plants_user_id     ON public.plants (user_id);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER plants_set_updated_at
  BEFORE UPDATE ON public.plants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tabla: photos
-- ---------------------------------------------------------------------------
CREATE TABLE public.photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID        NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_plant_id ON public.photos (plant_id);

-- ---------------------------------------------------------------------------
-- Tabla: care_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.care_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID        NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  task_type    TEXT        NOT NULL CHECK (task_type IN ('watering', 'fertilizing', 'pruning', 'repotting')),
  performed_at TIMESTAMPTZ NOT NULL,
  notes        TEXT
);

CREATE INDEX idx_care_logs_plant_id ON public.care_logs (plant_id);

-- ---------------------------------------------------------------------------
-- Tabla: problems
-- ---------------------------------------------------------------------------
CREATE TABLE public.problems (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID        NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (char_length(type) > 0),
  description  TEXT        NOT NULL CHECK (char_length(description) > 0),
  detected_at  TIMESTAMPTZ NOT NULL,
  image_url    TEXT,
  resolved     BOOLEAN     NOT NULL DEFAULT false,
  resolved_at  TIMESTAMPTZ,
  -- Si está resuelto debe tener fecha de resolución
  CONSTRAINT resolved_has_date CHECK (
    resolved = false OR resolved_at IS NOT NULL
  )
);

CREATE INDEX idx_problems_plant_id ON public.problems (plant_id);

-- ---------------------------------------------------------------------------
-- Tabla: analysis_reports
-- ---------------------------------------------------------------------------
CREATE TABLE public.analysis_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id          UUID        NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  image_url         TEXT        NOT NULL,
  general_status    TEXT        NOT NULL CHECK (char_length(general_status) > 0),
  detected_problems TEXT[]      NOT NULL DEFAULT '{}',
  recommendations   TEXT[]      NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_reports_plant_id ON public.analysis_reports (plant_id);
