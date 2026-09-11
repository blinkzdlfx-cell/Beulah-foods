-- Promo codes are validated inside trusted checkout. Do not expose the active
-- promo catalogue to browser roles because some codes may be private campaigns.
drop policy if exists "Anyone can validate active promo codes" on public.promo_codes;
