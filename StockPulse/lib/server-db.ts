import "server-only";
import { createClient } from "@supabase/supabase-js";

// Privileged database access must never fall back to the public anonymous key.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "missing-service-role",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
