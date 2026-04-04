-- =============================================================================
-- Migración 002 — Row Level Security para Plant Care App
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: select propio"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users: update propio"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- plants
-- ---------------------------------------------------------------------------
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plants: gestión propia"
  ON public.plants FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- photos
-- (acceso verificado mediante JOIN con plants)
-- ---------------------------------------------------------------------------
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos: gestión propia"
  ON public.photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = photos.plant_id
        AND plants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = photos.plant_id
        AND plants.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- care_logs
-- ---------------------------------------------------------------------------
ALTER TABLE public.care_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_logs: gestión propia"
  ON public.care_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = care_logs.plant_id
        AND plants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = care_logs.plant_id
        AND plants.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- problems
-- ---------------------------------------------------------------------------
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "problems: gestión propia"
  ON public.problems FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = problems.plant_id
        AND plants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = problems.plant_id
        AND plants.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- analysis_reports
-- ---------------------------------------------------------------------------
ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_reports: gestión propia"
  ON public.analysis_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = analysis_reports.plant_id
        AND plants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.id = analysis_reports.plant_id
        AND plants.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Función auxiliar para el Cron Job (Vercel Serverless, sin auth.uid())
-- Permite al service_role leer plants con tareas vencidas para enviar push
-- No expone datos al cliente; solo se usa en el servidor con service_role key
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_due_plants(reference_date DATE)
RETURNS SETOF public.plants
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.plants
  WHERE
    (next_watering_date    IS NOT NULL AND next_watering_date    <= reference_date) OR
    (next_fertilizing_date IS NOT NULL AND next_fertilizing_date <= reference_date) OR
    (next_pruning_date     IS NOT NULL AND next_pruning_date     <= reference_date) OR
    (next_repotting_date   IS NOT NULL AND next_repotting_date   <= reference_date);
$$;
