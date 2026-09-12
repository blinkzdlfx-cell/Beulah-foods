-- Delivery model refinement: delivery is controlled by one fee and an on/off switch.
-- Free-delivery thresholds are no longer part of the active business model.
-- The legacy columns are retained temporarily for migration compatibility and are cleared.

update public.delivery_settings
set is_free_delivery_enabled = false,
    free_delivery_threshold = null,
    updated_at = now();

comment on table public.delivery_settings is
  'Admin-controlled delivery settings. Current model uses one delivery fee with delivery enabled/disabled. Legacy free-delivery columns are retained temporarily for migration compatibility.';
