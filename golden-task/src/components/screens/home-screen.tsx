import { useState, useEffect, useCallback } from "react"
import { Bell, Crown, Play, Gift, Users, TrendingUp, Zap, CheckCircle2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useUser } from "@/context/user-context"

interface HomeScreenProps {
  onNavigateToEarn?: () => void
}

const fullLeaderboard = [
  { rank: 1, name: "Ahmed K.", earnings: "$12,450", avatar: "AK" },
  { rank: 2, name: "Marie L.", earnings: "$10,230", avatar: "ML" },
  { rank: 3, name: "Omar B.", earnings: "$8,920", avatar: "OB" },
  { rank: 4, name: "Sarah M.", earnings: "$7,650", avatar: "SM" },
  { rank: 5, name: "John D.", earnings: "$6,340", avatar: "JD" },
  { rank: 6, name: "Lisa K.", earnings: "$5,890", avatar: "LK" },
  { rank: 7, name: "Mike R.", earnings: "$4,560", avatar: "MR" },
  { rank: 8, name: "Emma W.", earnings: "$3,210", avatar: "EW" },
  { rank: 9, name: "David L.", earnings: "$2,890", avatar: "DL" },
  { rank: 10, name: "Anna P.", earnings: "$2,450", avatar: "AP" },
]

export function HomeScreen({ onNavigateToEarn }: HomeScreenProps) {
  const { user, wallet, telegramId, authHeaders } = useUser()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState(false)
  const [bonusClaimOpen, setBonusClaimOpen] = useState(false)
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [referralEarnings, setReferralEarnings] = useState(0)
  const [activeReferrals, setActiveReferrals] = useState(0)

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "User"
    : "Guest"
  const avatarInitials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const fetchReferralStats = useCallback(async () => {
    if (!telegramId) return
    try {
      const res = await fetch("/api/referrals", { headers: authHeaders })
      const data = await res.json()
      if (!data.error) {
        setTotalReferrals(data.totalReferrals || 0)
        setReferralEarnings(data.totalEarnings || 0)
        setActiveReferrals(data.activeReferrals || 0)
      }
    } catch {}
  }, [telegramId, authHeaders])

  useEffect(() => {
    fetchReferralStats()
  }, [fetchReferralStats])

  const handleClaimBonus = () => {
    if (!dailyBonusClaimed) {
      setDailyBonusClaimed(true)
      setBonusClaimOpen(true)
      setTimeout(() => setBonusClaimOpen(false), 2500)
    }
  }

  const currentDay = 5

  return (
    <div className="flex flex-col gap-4 p-4 safe-area-top">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/50">
            {user?.photo_url && <AvatarImage src={user.photo_url} alt={displayName} />}
            <AvatarFallback className="bg-secondary text-foreground">{avatarInitials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h2 className="font-semibold text-foreground">{displayName}</h2>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationsOpen(true)}>
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
        </Button>
      </header>

      {/* Balance Card */}
      <Card className="glass-card primary-glow overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <h1 className="mt-1 text-3xl font-bold text-gradient">
                ${(wallet?.balance ?? 0).toFixed(2)}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">USDT</p>
            </div>
            <Badge className="primary-gradient text-primary-foreground border-0 gap-1">
              <Crown className="h-3 w-3" />
              VIP {user?.vip_level ?? 0}
            </Badge>
          </div>

          <div className="mt-4 flex gap-4">
            <div className="flex-1 rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Coins</p>
              <p className="mt-1 font-semibold text-foreground">{(wallet?.coins ?? 0).toLocaleString()}</p>
            </div>
            <div className="flex-1 rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Total Earned</p>
              <p className="mt-1 font-semibold text-success">+${(wallet?.total_earned ?? 0).toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watch & Earn Button */}
      <Button
        className="primary-gradient h-14 text-lg font-semibold animate-pulse-glow"
        onClick={onNavigateToEarn}
      >
        <Play className="mr-2 h-5 w-5" />
        Watch & Earn
      </Button>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center p-3">
            <Zap className="h-5 w-5 text-primary" />
            <p className="mt-2 text-lg font-bold text-foreground">0</p>
            <p className="text-[10px] text-muted-foreground">Videos Today</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center p-3">
            <TrendingUp className="h-5 w-5 text-success" />
            <p className="mt-2 text-lg font-bold text-foreground">${(wallet?.total_earned ?? 0).toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Total Earned</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center p-3">
            <Users className="h-5 w-5 text-primary" />
            <p className="mt-2 text-lg font-bold text-foreground">{totalReferrals}</p>
            <p className="text-[10px] text-muted-foreground">Referrals</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Bonus Card */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full primary-gradient">
                <Gift className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Daily Bonus</p>
                <p className="text-xs text-muted-foreground">Day {currentDay} of 7</p>
              </div>
            </div>
            <Button
              size="sm"
              className="primary-gradient"
              onClick={handleClaimBonus}
              disabled={dailyBonusClaimed}
            >
              {dailyBonusClaimed ? "Claimed" : "Claim"}
            </Button>
          </div>
          <Progress value={(currentDay / 7) * 100} className="mt-3 h-2" />
        </CardContent>
      </Card>

      {/* Referral Earnings Card */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Referral Earnings</p>
                <p className="text-xs text-muted-foreground">All time</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-success">+${referralEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{activeReferrals} active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Preview */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Top Earners</h3>
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => setLeaderboardOpen(true)}>
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {fullLeaderboard.slice(0, 3).map((u) => (
              <div key={u.rank} className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  u.rank === 1 ? "primary-gradient text-primary-foreground"
                  : u.rank === 2 ? "bg-slate-400 text-slate-900"
                  : "bg-orange-700 text-orange-100"
                }`}>{u.rank}</span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-sm">{u.avatar}</AvatarFallback>
                </Avatar>
                <span className="flex-1 font-medium text-foreground">{u.name}</span>
                <span className="font-semibold text-primary">{u.earnings}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications Dialog */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="glass-card border-primary/20 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </DialogTitle>
            <DialogDescription>Your recent activity and updates</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">We will notify you of important updates here</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Leaderboard Dialog */}
      <Dialog open={leaderboardOpen} onOpenChange={setLeaderboardOpen}>
        <DialogContent className="glass-card border-primary/20 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Earners Leaderboard
            </DialogTitle>
            <DialogDescription>Top 10 earners this month</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {fullLeaderboard.map((u) => (
              <div key={u.rank} className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  u.rank === 1 ? "primary-gradient text-primary-foreground"
                  : u.rank === 2 ? "bg-slate-400 text-slate-900"
                  : u.rank === 3 ? "bg-orange-700 text-orange-100"
                  : "bg-secondary text-muted-foreground"
                }`}>{u.rank}</span>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-secondary">{u.avatar}</AvatarFallback>
                </Avatar>
                <span className="flex-1 font-medium text-foreground">{u.name}</span>
                <span className="font-semibold text-primary">{u.earnings}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bonus Claim Dialog */}
      <Dialog open={bonusClaimOpen} onOpenChange={setBonusClaimOpen}>
        <DialogContent className="glass-card border-primary/20 text-center">
          <DialogHeader className="sr-only">
            <DialogTitle>Bonus Claimed</DialogTitle>
            <DialogDescription>Daily bonus successfully claimed</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Bonus Claimed!</h2>
            <p className="text-3xl font-bold text-green-400">+$0.30 USDT</p>
            <p className="text-sm text-muted-foreground mt-4">Day {currentDay} bonus collected. Come back tomorrow!</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
