import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"

const router = Router()

router.get("/balance", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { data: user } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()
  const { data: transactions } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)

  res.json({ wallet, transactions: transactions || [] })
})

router.post("/withdraw", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { amount, address } = req.body
  if (!amount || !address) { res.status(400).json({ error: "Amount and address are required" }); return }

  const numAmount = parseFloat(amount)
  if (isNaN(numAmount) || numAmount < 5) { res.status(400).json({ error: "Minimum withdrawal is $5" }); return }
  if (numAmount > 10000) { res.status(400).json({ error: "Maximum withdrawal is $10000" }); return }

  const { data: user } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()
  if (!wallet || wallet.balance < numAmount) { res.status(400).json({ error: "Insufficient balance" }); return }

  await supabase.from("wallets").update({
    balance: wallet.balance - numAmount,
    total_withdrawn: wallet.total_withdrawn + numAmount,
    updated_at: new Date().toISOString(),
  }).eq("user_id", user.id)

  const { data: tx } = await supabase.from("transactions").insert({
    user_id: user.id, type: "withdrawal", amount: -numAmount, status: "pending", address,
  }).select().single()

  res.json({ success: true, transaction: tx })
})

export default router
