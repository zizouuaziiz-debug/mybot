import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"

const router = Router()

router.get("/me", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { data: user, error } = await supabase.from("users").select("*, wallets(*)").eq("telegram_id", telegramId).single()
  if (error || !user) { res.status(404).json({ error: "User not found" }); return }
  res.json({ user })
})

export default router
