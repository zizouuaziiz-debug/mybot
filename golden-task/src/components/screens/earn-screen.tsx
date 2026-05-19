import { useState, useEffect, useCallback, useRef } from "react"
import {
  Play, CheckCircle2, ExternalLink, MessageCircle, Globe,
  UserPlus, Calendar, Gift, X, WifiOff, RefreshCw
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useUser } from "@/context/user-context"
import { MiningScreen } from "@/components/screens/mining-screen"

// ─── Types ─────────────────────────────────────────────────────────────────

interface AdNetwork {
  networkId: string
  fields: Record<string, string>
}

interface Task {
  id: string; title: string; description: string; reward: number
  icon: string; action_url: string | null; task_type: string; completed?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SLOTS_PER_BATCH = 5
const wheelPrizes = ["$0.10", "$0.50", "$1.00", "$0.25", "$5.00", "$0.05", "$10.00", "$0.15"]
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle, Globe, UserPlus, Calendar, Play, Gift,
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

// ─── Monetag ad injector ────────────────────────────────────────────────────
// Injects Monetag's rewarded interstitial script and waits for completion.
// Falls back to a timer if the ad network sends no postMessage event.

function useMonetagRewarded(zoneId: string | null) {
  const injected = useRef(false)

  const showAd = useCallback((onComplete: () => void, fallbackSeconds = 30) => {
    if (!zoneId) { setTimeout(onComplete, fallbackSeconds * 1000); return }

    // Load Monetag tag once
    if (!injected.current) {
      const s = document.createElement("script")
      s.src = `https://vignette.top/tag.min.js?z=${zoneId}`
      s.async = true
      document.head.appendChild(s)
      injected.current = true
    }

    // Fallback timer
    const fallback = setTimeout(onComplete, fallbackSeconds * 1000)

    // Listen for rewarded completion postMessage from Monetag
    const handler = (evt: MessageEvent) => {
      if (
        evt.data === "rewarded" ||
        evt.data?.type === "rewarded" ||
        evt.data?.event === "rewardedAdCompleted" ||
        evt.data?.action === "reward"
      ) {
        clearTimeout(fallback)
        window.removeEventListener("message", handler)
        onComplete()
      }
    }
    window.addEventListener("message", handler)

    return () => {
      clearTimeout(fallback)
      window.removeEventListener("message", handler)
    }
  }, [zoneId])

  return { showAd }
}

// ─── Ad Slot Card ───────────────────────────────────────────────────────────

const SLOT_STYLES = [
  { gradient: "from-blue-600 to-purple-700",   label: "إعلان حصري" },
  { gradient: "from-emerald-600 to-teal-700",  label: "فيديو مدفوع" },
  { gradient: "from-orange-600 to-red-700",    label: "إعلان مميز" },
  { gradient: "from-pink-600 to-rose-700",     label: "فيديو حصري" },
  { gradient: "from-violet-600 to-indigo-700", label: "إعلان رقمي" },
]

function AdSlotCard({
  slotIndex, network, reward, isWatched, isWatching, onClick
}: {
  slotIndex: number
  network: AdNetwork | null
  reward: number
  isWatched: boolean
  isWatching: boolean
  onClick: () => void
}) {
  const style = SLOT_STYLES[slotIndex % SLOT_STYLES.length]

  return (
    <Card className={cn("glass-card overflow-hidden transition-opacity", isWatched && "opacity-55")}>
      <CardContent className="p-0">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className={cn("relative h-24 w-32 flex-shrink-0 bg-gradient-to-br", style.gradient)}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="h-10 w-10 text-white/80" fill="white" />
            </div>
            {isWatched && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-green-400" />
              </div>
            )}
            <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
              0:30
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col justify-between py-2 pr-3">
            <div>
              <h3 className="font-medium text-foreground">{style.label}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">شاهد الفيديو واكسب USDT</p>
              <p className="mt-1 text-sm font-semibold text-primary">+${reward.toFixed(2)} USDT</p>
            </div>
            <Button
              size="sm"
              className={cn(
                "w-fit",
                isWatched
                  ? "bg-green-600 hover:bg-green-600 cursor-default"
                  : network
                  ? "primary-gradient"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              disabled={isWatched || isWatching || !network}
              onClick={onClick}
            >
              {isWatched ? "تمت المشاهدة" : isWatching ? "جارٍ التشغيل..." : "شاهد الآن"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export function EarnScreen() {
  const { telegramId, authHeaders, refreshWallet } = useUser()

  // ── Ad network config ──
  const [adConfig, setAdConfig] = useState<AdNetwork[]>([])
  const [configLoading, setConfigLoading] = useState(true)

  // ── Slots (5 per batch) ──
  const [watchedSlots, setWatchedSlots] = useState<Set<number>>(new Set())
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [allDone, setAllDone] = useState(false)

  // ── Video player dialog ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [adRunning, setAdRunning] = useState(false)
  const [showReward, setShowReward] = useState(false)
  const [earnedAmount] = useState(0.05)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // ── Tasks ──
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [taskCompletedDialog, setTaskCompletedDialog] = useState(false)
  const [completedTaskReward, setCompletedTaskReward] = useState(0)

  // ── Spin ──
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [spinsRemaining, setSpinsRemaining] = useState(3)
  const [wonPrize, setWonPrize] = useState<string | null>(null)
  const [showPrizeDialog, setShowPrizeDialog] = useState(false)
  const [winningIdx, setWinningIdx] = useState<number | null>(null)
  const [glowFlash, setGlowFlash] = useState(false)

  // Primary active ad network
  const primaryNetwork = adConfig[0] ?? null
  const monetagZone = primaryNetwork?.networkId === "monetag"
    ? (primaryNetwork.fields.rewardedZoneId ?? primaryNetwork.fields.interstitialZoneId ?? null)
    : null
  const { showAd: showMonetagAd } = useMonetagRewarded(monetagZone)

  // ── Fetch ad config ──
  const fetchAdConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await fetch("/api/earn/ad-config")
      const data = await res.json()
      if (data.activeNetworks) setAdConfig(data.activeNetworks)
    } catch {}
    setConfigLoading(false)
  }, [])

  useEffect(() => { fetchAdConfig() }, [fetchAdConfig])

  // ── Check if batch complete ──
  useEffect(() => {
    if (watchedSlots.size >= SLOTS_PER_BATCH) setAllDone(true)
  }, [watchedSlots])

  // ── Timer for ad countdown ──
  useEffect(() => {
    if (!adRunning) return
    if (timeRemaining <= 0) { handleAdComplete(); return }
    timerRef.current = setInterval(() => setTimeRemaining(p => p - 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [adRunning, timeRemaining])

  const handleAdComplete = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (cleanupRef.current) cleanupRef.current()
    setAdRunning(false)
    setShowReward(true)
    if (activeSlot !== null) {
      setWatchedSlots(prev => new Set([...prev, activeSlot]))
    }
    refreshWallet()
    setTimeout(() => {
      setShowReward(false)
      setDialogOpen(false)
      setActiveSlot(null)
    }, 2500)
  }, [activeSlot, refreshWallet])

  const handleWatchSlot = (slotIndex: number) => {
    if (!primaryNetwork || watchedSlots.has(slotIndex)) return
    setActiveSlot(slotIndex)
    setTimeRemaining(30)
    setAdRunning(true)
    setShowReward(false)
    setDialogOpen(true)

    // Trigger the real ad network
    if (primaryNetwork.networkId === "monetag" && monetagZone) {
      const cleanup = showMonetagAd(handleAdComplete, 30)
      if (cleanup) cleanupRef.current = cleanup
    }
    // For other networks (native SDKs): just use the countdown timer as fallback
  }

  const handleCloseDialog = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (cleanupRef.current) cleanupRef.current()
    setAdRunning(false)
    setDialogOpen(false)
    setActiveSlot(null)
    setShowReward(false)
  }

  const resetBatch = () => {
    setWatchedSlots(new Set())
    setAllDone(false)
  }

  // ── Tasks ──
  const fetchTasks = useCallback(async () => {
    if (!telegramId) { setTasksLoading(false); return }
    setTasksLoading(true)
    try {
      const res = await fetch("/api/tasks", { headers: authHeaders })
      const data = await res.json()
      if (data.tasks) setTasks(data.tasks)
    } catch {}
    finally { setTasksLoading(false) }
  }, [telegramId, authHeaders])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleStartTask = async (task: Task) => {
    if (task.completed || completingTask) return
    if (task.action_url) window.open(task.action_url, "_blank")
    setCompletingTask(task.id)
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ task_id: task.id }),
      })
      const data = await res.json()
      if (data.success) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true } : t))
        setCompletedTaskReward(task.reward)
        setTaskCompletedDialog(true)
        setTimeout(() => setTaskCompletedDialog(false), 2500)
        refreshWallet()
      }
    } catch {}
    finally { setCompletingTask(null) }
  }

  // ── Spin ──
  // Compute target rotation so that segment `idx` lands under the pointer (top).
  // Segment i occupies [i*45, i*45+45)° clockwise from the top in the wheel's frame.
  // After rotating by R degrees (CSS clockwise), the pointer sees the segment originally
  // at (360 - R%360)%360 in the wheel's frame.
  // To land on segment idx: we need (360 - target%360)%360 ∈ [idx*45, idx*45+45)
  // → target%360 = (360 - idx*45 - mid) % 360  where mid ∈ [5,35] keeps us in the segment.
  const calcTarget = (currentRotation: number, idx: number) => {
    const mid = Math.random() * 30 + 7.5          // 7.5–37.5° into the 45° segment
    const desiredAngle = (idx * 45 + mid) % 360
    const currentMod = ((currentRotation % 360) + 360) % 360
    const alignOffset = ((360 - desiredAngle - currentMod) % 360 + 360) % 360
    return currentRotation + 1800 + alignOffset    // at least 5 full turns
  }

  const revealWin = (idx: number, prize: string, doRefresh = false) => {
    setSpinning(false)
    setWinningIdx(idx)
    // Flash the winning segment 3 times before opening dialog
    let flashes = 0
    const flashInterval = setInterval(() => {
      setGlowFlash(f => !f)
      flashes++
      if (flashes >= 6) {
        clearInterval(flashInterval)
        setGlowFlash(true)
        setWonPrize(prize)
        setShowPrizeDialog(true)
        if (doRefresh) refreshWallet()
      }
    }, 160)
  }

  const handleSpin = async () => {
    if (spinning || spinsRemaining <= 0) return
    setSpinning(true)
    setWinningIdx(null)
    setGlowFlash(false)
    if (telegramId) {
      try {
        const res = await fetch("/api/rewards/spin", { method: "POST", headers: authHeaders })
        const data = await res.json()
        if (data.success) {
          const idx: number = data.prizeIndex ?? Math.floor(Math.random() * 8)
          const target = calcTarget(rotation, idx)
          setRotation(target)
          setSpinsRemaining(data.spinsRemaining ?? spinsRemaining - 1)
          setTimeout(() => revealWin(idx, `$${(data.prize as number).toFixed(2)}`, true), 4000)
          return
        }
      } catch {}
    }
    // Fallback (no telegramId / API error): pick locally, no balance update
    const idx = Math.floor(Math.random() * 8)
    const target = calcTarget(rotation, idx)
    setRotation(target)
    setSpinsRemaining(p => p - 1)
    setTimeout(() => revealWin(idx, wheelPrizes[idx], false), 4000)
  }

  const completedCount = tasks.filter(t => t.completed).length
  const rewardPerSlot = 0.05

  return (
    <div className="flex flex-col gap-4 p-4 safe-area-top">
      <h1 className="text-2xl font-bold text-foreground">Earn Rewards</h1>

      <Tabs defaultValue="videos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="mining">⛏️ Mining</TabsTrigger>
          <TabsTrigger value="spin">Spin</TabsTrigger>
        </TabsList>

        {/* ── Videos Tab ── */}
        <TabsContent value="videos" className="mt-4 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">شاهد إعلانات الشركات واكسب USDT</p>
            <Badge variant="outline" className="border-primary text-primary">
              {watchedSlots.size}/{SLOTS_PER_BATCH} اليوم
            </Badge>
          </div>

          {/* No-network warning (only shown when nothing is configured) */}
          {!configLoading && !primaryNetwork && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-muted/40 text-muted-foreground border border-border">
              <WifiOff className="h-3.5 w-3.5" />
              <span>الإعلانات غير متاحة حالياً · حاول لاحقاً</span>
            </div>
          )}

          {/* All done banner */}
          {allDone && (
            <Card className="glass-card border-green-500/30 bg-green-500/10">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-300">أنهيت جميع إعلانات اليوم! 🎉</p>
                </div>
                <Button size="sm" className="primary-gradient flex-shrink-0" onClick={resetBatch}>
                  <RefreshCw className="h-4 w-4 mr-1" /> تجديد
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Slots */}
          {configLoading ? (
            Array.from({ length: SLOTS_PER_BATCH }).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-0">
                  <div className="flex gap-3">
                    <Skeleton className="h-24 w-32 flex-shrink-0 rounded-none" />
                    <div className="flex-1 py-3 pr-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-8 w-28 mt-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            Array.from({ length: SLOTS_PER_BATCH }).map((_, i) => (
              <AdSlotCard
                key={i}
                slotIndex={i}
                network={primaryNetwork}
                reward={rewardPerSlot}
                isWatched={watchedSlots.has(i)}
                isWatching={activeSlot === i && adRunning}
                onClick={() => handleWatchSlot(i)}
              />
            ))
          )}

          {/* Progress */}
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">تقدم اليوم</span>
                <span className="text-sm font-medium text-foreground">{watchedSlots.size}/{SLOTS_PER_BATCH}</span>
              </div>
              <Progress value={(watchedSlots.size / SLOTS_PER_BATCH) * 100} className="h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                أكمل {SLOTS_PER_BATCH} إعلانات يومياً لتكسب +${(rewardPerSlot * SLOTS_PER_BATCH).toFixed(2)} USDT
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Mining Tab ── */}
        <TabsContent value="mining" className="mt-0 -mx-4">
          <MiningScreen />
        </TabsContent>

        {/* ── Spin Tab ── */}
        <TabsContent value="spin" className="mt-4">
          <Card className="glass-card overflow-hidden">
            <CardContent className="flex flex-col items-center p-6">
              <h2 className="text-xl font-bold text-foreground mb-2">Lucky Wheel</h2>
              <p className="text-sm text-muted-foreground mb-6">Spin to win up to $10 USDT!</p>
              <div className="relative mb-6">
                <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-amber-500/30 via-yellow-400/20 to-amber-500/30 blur-xl animate-pulse" />
                <div className="absolute -inset-4 rounded-full border-4 border-amber-400/50"
                  style={{ boxShadow: "0 0 20px rgba(251,191,36,.4),inset 0 0 20px rgba(251,191,36,.1)" }}>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i}
                      className={cn("absolute w-2.5 h-2.5 rounded-full",
                        spinning ? i % 2 === 0 ? "bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,.9)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,.9)]"
                        : "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,.8)]")}
                      style={{ left: "50%", top: "50%", transform: `rotate(${i * 22.5}deg) translateY(-140px) translateX(-50%)` }} />
                  ))}
                </div>
                <div className="relative h-64 w-64 rounded-full transition-transform ease-out"
                  style={{ transform: `rotate(${rotation}deg)`, transitionDuration: spinning ? "4000ms" : "0ms", transitionTimingFunction: "cubic-bezier(.17,.67,.12,.99)", boxShadow: "0 0 0 6px #1a1a2e,0 0 0 8px rgba(251,191,36,.6),0 0 30px rgba(251,191,36,.3),inset 0 0 30px rgba(0,0,0,.3)" }}>
                  <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
                    <defs>
                      <filter id="win-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    {wheelPrizes.map((prize, i) => {
                      const colors = [
                        { bg: "#f43f5e", text: "#fff" }, { bg: "#1e1e32", text: "#fbbf24" },
                        { bg: "#10b981", text: "#fff" }, { bg: "#1e1e32", text: "#fbbf24" },
                        { bg: "#f59e0b", text: "#fff" }, { bg: "#1e1e32", text: "#fbbf24" },
                        { bg: "#8b5cf6", text: "#fff" }, { bg: "#1e1e32", text: "#fbbf24" },
                      ]
                      const isWinner = winningIdx === i
                      const a = i * 45, s = (a - 90) * Math.PI / 180, e = (a + 45 - 90) * Math.PI / 180
                      const x1 = 100 + 100 * Math.cos(s), y1 = 100 + 100 * Math.sin(s)
                      const x2 = 100 + 100 * Math.cos(e), y2 = 100 + 100 * Math.sin(e)
                      const ta = a + 22.5, tx = 100 + 65 * Math.cos((ta - 90) * Math.PI / 180), ty = 100 + 65 * Math.sin((ta - 90) * Math.PI / 180)
                      return (
                        <g key={i} filter={isWinner && glowFlash ? "url(#win-glow)" : undefined}>
                          <path
                            d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
                            fill={isWinner && glowFlash ? "#ffffff" : colors[i].bg}
                            stroke={isWinner ? "#fbbf24" : "#2a2a4a"}
                            strokeWidth={isWinner ? "2.5" : "1"}
                            opacity={isWinner && !glowFlash ? 0.6 : 1}
                          />
                          <text x={tx} y={ty} fill={isWinner && glowFlash ? "#1a1a2e" : colors[i].text} fontSize={isWinner ? "13" : "12"} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${ta},${tx},${ty})`}>{prize}</text>
                        </g>
                      )
                    })}
                  </svg>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center" style={{ boxShadow: "0 4px 15px rgba(251,191,36,.5)" }}>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center">
                      <span className="text-amber-900 font-bold text-xs">SPIN</span>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
                  <div className="w-0 h-0" style={{ borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "28px solid #fbbf24", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.4))" }} />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-amber-400" />
                <span className="text-sm text-muted-foreground">{spinsRemaining} spins remaining today</span>
              </div>
              <Button onClick={handleSpin} disabled={spinning || spinsRemaining <= 0}
                className="h-12 w-full text-lg font-semibold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-600 hover:via-yellow-600 hover:to-amber-600 text-amber-950 shadow-lg shadow-amber-500/30">
                {spinning ? "Spinning..." : spinsRemaining <= 0 ? "No Spins Left" : "Spin Now"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Ad Player Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="glass-card border-primary/20 p-0 max-w-sm overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>مشاهدة الإعلان</DialogTitle>
            <DialogDescription>شاهد الإعلان لتحصل على مكافأتك</DialogDescription>
          </DialogHeader>

          {showReward ? (
            /* Reward screen */
            <div className="flex flex-col items-center justify-center py-12 px-6 bg-gradient-to-b from-green-900/50 to-background">
              <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4 animate-in zoom-in duration-300">
                <CheckCircle2 className="h-12 w-12 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">تم ربح المكافأة!</p>
              <p className="text-3xl font-bold text-green-400">+${rewardPerSlot.toFixed(2)} USDT</p>
            </div>
          ) : (
            /* Ad playing screen */
            <div className="flex flex-col">
              {/* Generic header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-700 to-purple-700">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <Play className="h-5 w-5 text-white" fill="white" />
                </div>
                <div>
                  <p className="font-semibold text-white">فيديو مدفوع</p>
                  <p className="text-xs text-white/70">شاهد حتى النهاية لتكسب مكافأتك</p>
                </div>
                <button onClick={handleCloseDialog}
                  className="ml-auto p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Ad content area */}
              <div className="flex flex-col items-center justify-center py-10 px-6 gap-4">
                {/* Animated ad indicator */}
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Play className="h-10 w-10 text-primary" fill="currentColor" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  الإعلان يعمل في الخلفية...
                </p>

                {/* Countdown */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl font-bold text-primary tabular-nums">
                    {formatTime(timeRemaining)}
                  </span>
                  <span className="text-xs text-muted-foreground">متبقية للمكافأة</span>
                </div>

                {/* Progress bar */}
                <Progress
                  value={((30 - timeRemaining) / 30) * 100}
                  className="h-2 w-full"
                />

                <p className="text-xs text-muted-foreground text-center">
                  ستحصل على <span className="text-primary font-semibold">+${rewardPerSlot.toFixed(2)} USDT</span> عند انتهاء العداد
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Prize Dialog ── */}
      <Dialog open={showPrizeDialog} onOpenChange={(open) => { setShowPrizeDialog(open); if (!open) { setWinningIdx(null); setGlowFlash(false) } }}>
        <DialogContent className="glass-card border-primary/20 text-center">
          <DialogHeader className="sr-only"><DialogTitle>Prize</DialogTitle><DialogDescription>You won</DialogDescription></DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4 animate-bounce">
              <Gift className="h-12 w-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Congratulations!</h2>
            <p className="text-4xl font-bold text-green-400 mb-2">{wonPrize}</p>
            <p className="text-sm text-muted-foreground">has been added to your balance</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Task Completed ── */}
      <Dialog open={taskCompletedDialog} onOpenChange={setTaskCompletedDialog}>
        <DialogContent className="glass-card border-primary/20 text-center">
          <DialogHeader className="sr-only"><DialogTitle>Task Done</DialogTitle><DialogDescription>Task completed</DialogDescription></DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Task Completed!</h2>
            <p className="text-3xl font-bold text-green-400">+${completedTaskReward.toFixed(2)} USDT</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
