import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"

const router = Router()

router.get("/", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { data: user } = await supabase.from("users").select("id, referral_code, referred_by").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: referrals } = await supabase
    .from("referrals")
    .select("*, referred:referred_id(id, first_name, last_name, username, created_at)")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false })

  const totalEarnings = (referrals || []).reduce((sum: number, r: any) => sum + Number(r.earnings), 0)
  const activeCount = (referrals || []).length

  const tier = activeCount <= 10 ? 1 : activeCount <= 50 ? 2 : activeCount <= 100 ? 3 : 4
  const tierNames = ["", "Bronze", "Silver", "Gold", "Diamond"]
  const commissions = ["", "10%", "15%", "20%", "25%"]
  const nextTierAt = [0, 10, 50, 100, Infinity]

  res.json({
    referralCode: user.referral_code,
    referrals: referrals || [],
    totalReferrals: activeCount,
    activeReferrals: activeCount,
    totalEarnings,
    pendingEarnings: 0,
    tier,
    tierName: tierNames[tier],
    commission: commissions[tier],
    nextTierProgress: nextTierAt[tier] > 0 ? Math.min(100, Math.round((activeCount / nextTierAt[tier]) * 100)) : 100,
    nextTierAt: nextTierAt[tier],
  })
})

export default router
