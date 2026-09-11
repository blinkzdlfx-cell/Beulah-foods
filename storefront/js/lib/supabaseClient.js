// Storefront Supabase client.
//
// Fill in your project's URL and anon/public key below (Supabase
// dashboard → Settings → API). The anon key is safe to keep in this
// file — see ARCHITECTURE.md for why. NEVER put the service_role key
// here or anywhere else in /storefront.
//
// Loaded via the Supabase JS CDN build — add this script tag before any
// page script that imports this file:
// <script type="module" src="https://esm.sh/@supabase/supabase-js@2"></script>
// (or self-host the library if you'd rather not depend on a CDN)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wcyztayuulzxchkljdoo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzIiwicmVmIjoid2N5enRheXV1bHoxeGNoa2xqZG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjY3NjIsImV4cCI6MjEwNDY0Mjc2MX0.ALaX08krMhTTAR01YRBYdI_KME3CdkeSYtbHcC2e5NY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
