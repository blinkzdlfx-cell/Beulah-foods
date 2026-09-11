// Admin Supabase client.
//
// Fill in your project's URL and anon/public key below (Supabase
// dashboard → Settings → API). The anon key is safe to keep in this
// file — see ARCHITECTURE.md for why. NEVER put the service_role key
// here or anywhere else in /admin.
//
// Loaded via the Supabase JS CDN build — add this script tag before any
// page script that imports this file:
// <script type="module" src="https://esm.sh/@supabase/supabase-js@2"></script>
// (or self-host the library if you'd rather not depend on a CDN)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
