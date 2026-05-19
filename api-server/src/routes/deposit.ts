import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"

const router = Router()

router.post("/check-deposit", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { txHash, amount } = req.body
  if (!txHash || !amount) { res.status(400).json({ error: "txHash and amount required" }); return }

  const { data: user } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const numAmount = parseFloat(amount)
  if (isNaN(numAmount) || numAmount <= 0) { res.status(400).json({ error: "Invalid amount" }); return }

  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()
  if (wallet) {
    await supabase.from("wallets").update({
      balance: wallet.balance + numAmount,
      total_earned: wallet.total_earned + numAmount,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id)
  }

  await supabase.from("transactions").insert({ user_id: user.id, type: "bonus", amount: numAmount, status: "completed", source: `deposit:${txHash}` })

  res.json({ success: true, amount: numAmount })
})

export default router
