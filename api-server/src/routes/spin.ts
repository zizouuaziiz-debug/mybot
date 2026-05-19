import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"

const router = Router()

const PRIZES = [0.10, 0.50, 1.00, 0.25, 5.00, 0.05, 10.00, 0.15]
const WEIGHTS = [25, 20, 10, 20, 3, 30, 1, 15]
const MAX_DAILY_SPINS = 3

function weightedRandom(prizes: number[], weights: number[]): { prize: number; index: number } {
  const total = weights.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < prizes.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return { prize: prizes[i], index: i }
  }
  return { prize: prizes[prizes.length - 1], index: prizes.length - 1 }
}

router.post("/spin", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { data: user } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todaySpins } = await supabase
    .from("spin_history")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", today.toISOString())

  if ((todaySpins?.length ?? 0) >= MAX_DAILY_SPINS) {
    res.status(400).json({ error: `Maximum ${MAX_DAILY_SPINS} spins per day`, spinsUsed: todaySpins?.length, maxSpins: MAX_DAILY_SPINS })
    return
  }

  const { prize, index } = weightedRandom(PRIZES, WEIGHTS)

  await supabase.from("spin_history").insert({ user_id: user.id, prize })

  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()
  if (wallet) {
    await supabase.from("wallets").update({
      balance: wallet.balance + prize,
      total_earned: wallet.total_earned + prize,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id)
  }

  await supabase.from("transactions").insert({ user_id: user.id, type: "spin", amount: prize, status: "completed", source: "Lucky Wheel" })

  res.json({ prize, prizeIndex: index, spinsUsed: (todaySpins?.length ?? 0) + 1, maxSpins: MAX_DAILY_SPINS })
})

export default router
