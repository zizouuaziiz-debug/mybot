import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
}

export function getSupabaseAdmin() {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
