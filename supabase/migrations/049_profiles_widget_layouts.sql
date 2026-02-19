-- Add widget_layouts JSONB column to profiles for per-user widget layout persistence
-- Stores { dashboardWidgetLayout: [...], projectWidgetLayout: [...] }

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS widget_layouts JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.widget_layouts IS 'Per-user widget grid layout (dashboard + project). JSON with dashboardWidgetLayout and projectWidgetLayout arrays.';
