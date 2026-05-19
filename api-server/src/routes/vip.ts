import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"
import { DEFAULT_VIP_PLANS, getVipPlans } from "../lib/vip-config.js"

const router = Router()

router.get("/config", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const supabaseGet = async (key: string) => {
    const { data } = await supabase.from("app_config").select("value").eq("key", key).single()
    return data?.value ?? null
  }
  const plans = await getVipPlans(supabaseGet)
  res.json({ plans })
})

router.post("/upgrade", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { target_level } = req.body
  if (target_level === undefined) { res.status(400).json({ error: "target_level required" }); return }

  const { data: user } = await supabase.from("users").select("id, vip_level").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  if (target_level <= user.vip_level) { res.status(400).json({ error: "Already at or above this VIP level" }); return }

  const supabaseGet = async (key: string) => {
    const { data } = await supabase.from("app_config").select("value").eq("key", key).single()
    return data?.value ?? null
  }
  const plans = await getVipPlans(supabaseGet)
  const plan = plans.find((p) => p.level === target_level)
  if (!plan) { res.status(400).json({ error: "Invalid VIP level" }); return }

  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()
  if (!wallet || wallet.balance < plan.price) { res.status(400).json({ error: "Insufficient balance" }); return }

  await supabase.from("wallets").update({
    balance: wallet.balance - plan.price,
    updated_at: new Date().toISOString(),
  }).eq("user_id", user.id)

  await supabase.from("users").update({ vip_level: target_level, updated_at: new Date().toISOString() }).eq("id", user.id)

  await supabase.from("transactions").insert({ user_id: user.id, type: "bonus", amount: -plan.price, status: "completed", source: `VIP upgrade to ${plan.name}` })

  res.json({ success: true, vip_level: target_level, plan })
})

export default router
