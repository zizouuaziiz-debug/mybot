import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"

const router = Router()

router.get("/ad-config", async (req, res) => {
  const supabase = getSupabaseAdmin()
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", "adnet_monetag").single()
    if (data?.value) {
      try { res.json(JSON.parse(data.value)); return } catch {}
    }
  } catch {}
  res.json({ siteId: "", interstitialZoneId: "" })
})

router.get("/videos", async (req, res) => {
  const supabase = getSupabaseAdmin()
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", "videos_config").single()
    if (data?.value) {
      try { res.json(JSON.parse(data.value)); return } catch {}
    }
  } catch {}
  res.json({ videos: [] })
})

export default router
