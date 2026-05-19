import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"
import {
  COOKIE_NAME, hashPassword, createSessionToken, verifySessionToken,
  getAdminPasswordHash, setAdminPasswordHash,
} from "../lib/admin-auth.js"
import { DEFAULT_MINING_RATES } from "../lib/mining-config.js"
import { DEFAULT_VIP_PLANS } from "../lib/vip-config.js"

const router = Router()

function requireAdmin(req: any, res: any, next: any) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token || !verifySessionToken(token)) { res.status(401).json({ error: "Unauthorized" }); return }
  next()
}

router.post("/login", async (req, res) => {
  const { password } = req.body
  if (!password) { res.status(400).json({ error: "Password required" }); return }

  const stored = await getAdminPasswordHash()
  const inputHash = hashPassword(password)
  if (inputHash !== stored) { res.status(401).json({ error: "Invalid password" }); return }

  const token = createSessionToken()
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  })
  res.json({ success: true })
})

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME)
  res.json({ success: true })
})

router.get("/verify", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token || !verifySessionToken(token)) { res.status(401).json({ authenticated: false, error: "Unauthorized" }); return }
  res.json({ authenticated: true, ok: true })
})

router.post("/change-password", requireAdmin, async (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return }
  const result = await setAdminPasswordHash(hashPassword(newPassword))
  res.json(result)
})

router.get("/users", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const page = parseInt(req.query.page as string) || 1
  const limit = 20
  const offset = (page - 1) * limit

  const { data: users, count } = await supabase
    .from("users").select("*, wallets(*)", { count: "exact" })
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1)

  res.json({ users: users || [], total: count || 0, page, limit })
})

router.get("/withdrawals", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const status = req.query.status as string

  let query = supabase.from("transactions")
    .select("*, users!inner(username, first_name, last_name, telegram_id)")
    .eq("type", "withdrawal")
    .order("created_at", { ascending: false })
    .limit(100)

  if (status) query = query.eq("status", status)

  const { data: withdrawals } = await query
  res.json({ withdrawals: withdrawals || [] })
})

router.patch("/withdrawals/:id", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { id } = req.params
  const { status } = req.body

  if (!["completed", "failed"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return }

  const { data } = await supabase.from("transactions").update({ status }).eq("id", id).select().single()
  res.json({ success: true, transaction: data })
})

router.get("/settings", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from("app_config").select("key, value")
  const settings: Record<string, string> = {}
  for (const row of data || []) { settings[row.key] = row.value }
  res.json({ settings })
})

router.post("/settings", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { key, value } = req.body
  if (!key) { res.status(400).json({ error: "key required" }); return }
  await supabase.from("app_config").upsert({ key, value: typeof value === "string" ? value : JSON.stringify(value), updated_at: new Date().toISOString() })
  res.json({ success: true })
})

router.get("/ad-networks", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from("app_config").select("value").eq("key", "adnet_monetag").single()
  res.json(data?.value ? JSON.parse(data.value) : { siteId: "", interstitialZoneId: "" })
})

router.post("/ad-networks", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  await supabase.from("app_config").upsert({ key: "adnet_monetag", value: JSON.stringify(req.body), updated_at: new Date().toISOString() })
  res.json({ success: true })
})

router.get("/videos", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from("app_config").select("value").eq("key", "videos_config").single()
  res.json(data?.value ? JSON.parse(data.value) : { videos: [] })
})

router.post("/videos", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  await supabase.from("app_config").upsert({ key: "videos_config", value: JSON.stringify(req.body), updated_at: new Date().toISOString() })
  res.json({ success: true })
})

router.get("/mining-config", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from("app_config").select("value").eq("key", "mining_rates").single()
  res.json({ rates: data?.value ? { ...DEFAULT_MINING_RATES, ...JSON.parse(data.value) } : DEFAULT_MINING_RATES })
})

router.post("/mining-config", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  await supabase.from("app_config").upsert({ key: "mining_rates", value: JSON.stringify(req.body.rates), updated_at: new Date().toISOString() })
  res.json({ success: true })
})

router.get("/vip-config", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from("app_config").select("value").eq("key", "vip_config").single()
  res.json({ plans: data?.value ? DEFAULT_VIP_PLANS.map((d) => ({ ...d, ...JSON.parse(data.value)[d.level] })) : DEFAULT_VIP_PLANS })
})

router.post("/vip-config", requireAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const plansMap: Record<number, any> = {}
  for (const p of req.body.plans || []) plansMap[p.level] = p
  await supabase.from("app_config").upsert({ key: "vip_config", value: JSON.stringify(plansMap), updated_at: new Date().toISOString() })
  res.json({ success: true })
})

export default router
