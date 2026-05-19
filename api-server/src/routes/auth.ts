import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"
import { generateReferralCode, validateTelegramWebAppData } from "../lib/telegram-auth.js"

const router = Router()

router.post("/telegram", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { telegram_id, first_name, last_name, username, photo_url, referral_code: refCode, init_data } = req.body

    if (!telegram_id) {
      res.status(400).json({ error: "Missing telegram_id" })
      return
    }

    const botToken = process.env["TELEGRAM_BOT_TOKEN"]
    if (botToken && init_data) {
      const validatedUser = validateTelegramWebAppData(init_data, botToken)
      if (!validatedUser) {
        res.status(401).json({ error: "Invalid Telegram authentication" })
        return
      }
      if (String(validatedUser.id) !== String(telegram_id)) {
        res.status(401).json({ error: "Telegram ID mismatch" })
        return
      }
    } else if (botToken && !init_data && process.env["NODE_ENV"] === "production") {
      res.status(401).json({ error: "Telegram authentication required" })
      return
    }

    const telegramIdStr = String(telegram_id)

    let { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*, wallets(*)")
      .eq("telegram_id", telegramIdStr)
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      res.status(500).json({ error: fetchError.message })
      return
    }

    if (!user) {
      const newReferralCode = generateReferralCode(Number(telegram_id))

      let referredBy: string | null = null
      if (refCode) {
        const { data: referrer } = await supabase.from("users").select("id, referral_code").eq("referral_code", refCode).single()
        if (referrer) referredBy = referrer.referral_code
      }

      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({ telegram_id: telegramIdStr, first_name, last_name, username, photo_url, referral_code: newReferralCode, referred_by: referredBy, vip_level: 0 })
        .select()
        .single()

      if (createError) {
        res.status(500).json({ error: createError.message })
        return
      }

      await supabase.from("wallets").insert({ user_id: newUser.id, balance: 0, total_earned: 0, total_withdrawn: 0, coins: 0 })

      if (referredBy) {
        const { data: referrer } = await supabase.from("users").select("id").eq("referral_code", referredBy).single()
        if (referrer) {
          await supabase.from("referrals").insert({ referrer_id: referrer.id, referred_id: newUser.id, earnings: 0 })
        }
      }

      const { data: fullUser } = await supabase.from("users").select("*, wallets(*)").eq("id", newUser.id).single()
      res.json({ user: fullUser, isNew: true })
      return
    }

    await supabase.from("users").update({ first_name, last_name, username, photo_url, updated_at: new Date().toISOString() }).eq("telegram_id", telegramIdStr)

    const { data: updatedUser } = await supabase.from("users").select("*, wallets(*)").eq("telegram_id", telegramIdStr).single()
    res.json({ user: updatedUser, isNew: false })
  } catch (err) {
    req.log.error({ err }, "Auth error")
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
