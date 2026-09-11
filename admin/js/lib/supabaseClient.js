// Admin uses the same Supabase project and anon/public key as the storefront.
// Authorization is enforced by database RLS through public.admin_users.
// NEVER place a service_role/secret key in this file.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wcyztayuulzxchkljdoo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjeXp0YXl1dWx6eGNoa2xqZG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjY3NjEsImV4cCI6MjEwNDY0Mjc2MX0.ALaX08krMhTTAR01YRBYdI_KME3CdkeSYtbHcC2e5NY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
