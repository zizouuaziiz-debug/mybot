import React, { createContext, useContext, useEffect, useState, useCallback } from "react"

export interface Wallet {
  id: string
  user_id: string
  balance: number
  total_earned: number
  total_withdrawn: number
  coins: number
}

export interface UserProfile {
  id: string
  telegram_id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  photo_url: string | null
  referral_code: string
  referred_by: string | null
  vip_level: number
  created_at: string
  wallets: Wallet | null
}

interface UserContextType {
  user: UserProfile | null
  wallet: Wallet | null
  loading: boolean
  telegramId: string | null
  authHeaders: HeadersInit
  refreshUser: () => Promise<void>
  refreshWallet: () => Promise<void>
  logout: () => void
}

const UserContext = createContext<UserContextType>({
  user: null,
  wallet: null,
  loading: true,
  telegramId: null,
  authHeaders: {},
  refreshUser: async () => {},
  refreshWallet: async () => {},
  logout: () => {},
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(false)
  const [telegramId, setTelegramId] = useState<string | null>(null)

  const authHeaders: HeadersInit = telegramId
    ? { "x-telegram-id": telegramId, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" }

  const initUser = useCallback(async (
    tgUser: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
    },
    refCode?: string,
    initData?: string
  ) => {
    try {
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          photo_url: tgUser.photo_url,
          referral_code: refCode,
          init_data: initData,
        }),
      })
      const data = await res.json()
      if (data.user) {
        setUser(data.user)
        setWallet(data.user.wallets)
        setTelegramId(String(tgUser.id))
      }
    } catch (err) {
      console.error("Auth error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initTelegram = async () => {
      if (typeof window === "undefined") return

      const tgWebApp = (window as any).Telegram?.WebApp
      if (tgWebApp) {
        tgWebApp.ready()
        tgWebApp.expand()
        const tgUser = tgWebApp.initDataUnsafe?.user
        const startParam = tgWebApp.initDataUnsafe?.start_param
        const initData: string = tgWebApp.initData || ""

        if (tgUser?.id) {
          await initUser(tgUser, startParam, initData)
          return
        }
      }

      // Dev-only fallback: ?tg_id=123 in URL
      if (process.env.NODE_ENV !== "production") {
        const urlParams = new URLSearchParams(window.location.search)
        const debugId = urlParams.get("tg_id")
        if (debugId) {
          await initUser({ id: parseInt(debugId), first_name: "Debug", username: "debuguser" })
          return
        }

        const stored = localStorage.getItem("tg_user")
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            await initUser(parsed)
            return
          } catch {}
        }
      }

      setLoading(false)
    }

    initTelegram()
  }, [initUser])

  useEffect(() => {
    if (user && telegramId && process.env.NODE_ENV !== "production") {
      localStorage.setItem(
        "tg_user",
        JSON.stringify({
          id: parseInt(telegramId),
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          photo_url: user.photo_url,
        })
      )
    }
  }, [user, telegramId])

  const refreshUser = useCallback(async () => {
    if (!telegramId) return
    const res = await fetch("/api/user/me", { headers: authHeaders })
    const data = await res.json()
    if (data.user) {
      setUser(data.user)
      setWallet(data.user.wallets)
    }
  }, [telegramId, authHeaders])

  const refreshWallet = useCallback(async () => {
    if (!telegramId) return
    const res = await fetch("/api/wallet/balance", { headers: authHeaders })
    const data = await res.json()
    if (data.wallet) setWallet(data.wallet)
  }, [telegramId, authHeaders])

  const logout = useCallback(() => {
    setUser(null)
    setWallet(null)
    setTelegramId(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("tg_user")
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, wallet, loading, telegramId, authHeaders, refreshUser, refreshWallet, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
