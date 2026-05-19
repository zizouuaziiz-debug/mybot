import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"
import { DEFAULT_MINING_RATES } from "../lib/mining-config.js"

const router = Router()

async function getRatesConfig(supabase: ReturnType<typeof getSupabaseAdmin>) {
  let ratesConfig: Record<string, typeof DEFAULT_MINING_RATES.basic> = { ...DEFAULT_MINING_RATES }
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", "mining_rates").single()
    if (data?.value) ratesConfig = { ...DEFAULT_MINING_RATES, ...JSON.parse(data.value) }
  } catch {}
  return ratesConfig
}

router.get("/status", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { data: user } = await supabase.from("users").select("id, vip_level").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: wallet } = await supabase.from("wallets").select("balance, total_earned").eq("user_id", user.id).single()
  const { data: sessionRow } = await supabase.from("app_config").select("value").eq("key", `mining_active_${user.id}`).single()

  let session = null
  if (sessionRow?.value) { try { session = JSON.parse(sessionRow.value) } catch {} }

  const ratesConfig = await getRatesConfig(supabase)
  const vipLevel: number = user.vip_level ?? 0
  const rates = { ...ratesConfig, ultimate: { ...ratesConfig.ultimate, daily_rate: vipLevel >= 5 ? 0.10 : ratesConfig.ultimate.daily_rate } }

  const { data: history } = await supabase.from("transactions").select("id, amount, source, created_at")
    .eq("user_id", user.id).eq("type", "earning").ilike("source", "mining:%")
    .order("created_at", { ascending: false }).limit(20)

  res.json({ session, vip_level: vipLevel, balance: wallet?.balance ?? 0, total_earned: wallet?.total_earned ?? 0, rates, history: history ?? [] })
})

router.post("/start", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { plan_id } = req.body
  if (!plan_id) { res.status(400).json({ error: "plan_id required" }); return }

  const { data: user } = await supabase.from("users").select("id, vip_level").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single()
  if (!wallet || wallet.balance <= 0) { res.status(400).json({ error: "Insufficient balance to start mining" }); return }

  const ratesConfig = await getRatesConfig(supabase)
  const plan = ratesConfig[plan_id]
  if (!plan) { res.status(400).json({ error: "Invalid plan" }); return }

  const vipLevel: number = user.vip_level ?? 0
  if (vipLevel < plan.min_vip) { res.status(403).json({ error: `Requires VIP ${plan.min_vip}` }); return }

  const { data: existing } = await supabase.from("app_config").select("value").eq("key", `mining_active_${user.id}`).single()
  if (existing?.value) {
    try {
      const sess = JSON.parse(existing.value)
      if (sess.end_time > Date.now()) { res.status(400).json({ error: "Mining already active" }); return }
    } catch {}
  }

  const now = Date.now()
  const session = {
    plan_id,
    plan_name: plan.name,
    daily_rate: plan.daily_rate,
    start_time: now,
    end_time: now + plan.duration_hours * 3600 * 1000,
    duration_hours: plan.duration_hours,
    balance_at_start: wallet.balance,
  }

  await supabase.from("app_config").upsert({ key: `mining_active_${user.id}`, value: JSON.stringify(session), updated_at: new Date().toISOString() })

  res.json({ success: true, session })
})

router.post("/claim", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { data: user } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: sessionRow } = await supabase.from("app_config").select("value").eq("key", `mining_active_${user.id}`).single()
  if (!sessionRow?.value) { res.status(400).json({ error: "No active mining session" }); return }

  let session: any
  try { session = JSON.parse(sessionRow.value) } catch { res.status(400).json({ error: "Invalid session" }); return }

  const now = Date.now()
  if (now < session.end_time) { res.status(400).json({ error: "Mining not completed yet" }); return }

  const elapsed = Math.min((now - session.start_time) / (1000 * 3600), session.duration_hours)
  const earned = parseFloat(((session.daily_rate / 24) * elapsed).toFixed(6))

  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()
  if (wallet) {
    await supabase.from("wallets").update({
      balance: wallet.balance + earned,
      total_earned: wallet.total_earned + earned,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id)
  }

  await supabase.from("transactions").insert({ user_id: user.id, type: "earning", amount: earned, status: "completed", source: `mining:${session.plan_id}` })
  await supabase.from("app_config").delete().eq("key", `mining_active_${user.id}`)

  res.json({ success: true, earned })
})

router.get("/config", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const ratesConfig = await getRatesConfig(supabase)
  res.json({ rates: ratesConfig })
})

export default router
