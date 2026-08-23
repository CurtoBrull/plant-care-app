-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabla: users
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT,
  display_name          TEXT NOT NULL,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_time         TIME NOT NULL DEFAULT '08:00',
  fcm_token             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla: plants
CREATE TABLE IF NOT EXISTS plants (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  common_name                 TEXT NOT NULL CHECK (char_length(common_name) > 0),
  species                     TEXT NOT NULL CHECK (char_length(species) > 0),
  scientific_name             TEXT,
  acquisition_date            DATE,
  location                    TEXT CHECK (location IN ('interior', 'exterior')),
  plant_type                  TEXT CHECK (plant_type IN ('suculenta', 'cactus', 'tropical', 'herbácea', 'frutal', 'arbusto', 'árbol', 'acuática', 'otra')),
  notes                       TEXT,
  representative_photo_url    TEXT,
  watering_frequency_days     INTEGER CHECK (watering_frequency_days > 0),
  fertilizing_frequency_days  INTEGER CHECK (fertilizing_frequency_days > 0),
  fertilizer_type             TEXT,
  light_needs                 TEXT CHECK (light_needs IN ('directa', 'indirecta', 'sombra')),
  temperature_min_c           NUMERIC,
  temperature_max_c           NUMERIC,
  pruning_frequency_months    INTEGER CHECK (pruning_frequency_months > 0),
  repotting_frequency_months  INTEGER CHECK (repotting_frequency_months > 0),
  next_watering_date          DATE,
  next_fertilizing_date       DATE,
  next_pruning_date           DATE,
  next_repotting_date         DATE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT temperature_range_valid CHECK (
    temperature_min_c IS NULL OR
    temperature_max_c IS NULL OR
    temperature_min_c <= temperature_max_c
  )
);

CREATE INDEX IF NOT EXISTS idx_plants_user_id ON plants (user_id);
CREATE INDEX IF NOT EXISTS idx_plants_plant_type ON plants (plant_type);
CREATE INDEX IF NOT EXISTS idx_plants_common_name ON plants USING gin (to_tsvector('simple', common_name));
CREATE INDEX IF NOT EXISTS idx_plants_species ON plants USING gin (to_tsvector('simple', species));

-- 3. Tabla: photos
CREATE TABLE IF NOT EXISTS photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_plant_id ON photos (plant_id);

-- 4. Tabla: care_logs
CREATE TABLE IF NOT EXISTS care_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  task_type    TEXT NOT NULL CHECK (task_type IN ('watering', 'fertilizing', 'pruning', 'repotting')),
  performed_at TIMESTAMPTZ NOT NULL,
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_care_logs_plant_id ON care_logs (plant_id);

-- 5. Tabla: problems
CREATE TABLE IF NOT EXISTS problems (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (char_length(type) > 0),
  description  TEXT NOT NULL CHECK (char_length(description) > 0),
  detected_at  TIMESTAMPTZ NOT NULL,
  image_url    TEXT,
  resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at  TIMESTAMPTZ,
  CONSTRAINT resolved_has_date CHECK (resolved = false OR resolved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_problems_plant_id ON problems (plant_id);

-- 6. Tabla: analysis_reports
CREATE TABLE IF NOT EXISTS analysis_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id          UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  image_url         TEXT NOT NULL,
  general_status    TEXT NOT NULL CHECK (char_length(general_status) > 0),
  detected_problems TEXT[] NOT NULL DEFAULT '{}',
  recommendations   TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_plant_id ON analysis_reports (plant_id);
