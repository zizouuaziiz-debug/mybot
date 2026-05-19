import { useState, useEffect, useCallback } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Copy, CheckCircle2, Clock, XCircle, ExternalLink, QrCode, Wallet, Check, Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useUser } from "@/context/user-context"

const cryptoOptions = [
  { id: "usdt_erc20", name: "USDT", network: "ERC20", icon: "₮", color: "bg-blue-500", chainNetwork: "eth" },
  { id: "eth", name: "ETH", network: "Ethereum", icon: "Ξ", color: "bg-purple-500", chainNetwork: "eth" },
  { id: "usdt_bep20", name: "USDT", network: "BEP20", icon: "₮", color: "bg-yellow-500", chainNetwork: "bsc" },
  { id: "bnb", name: "BNB", network: "BSC", icon: "B", color: "bg-yellow-500", chainNetwork: "bsc" },
]

const depositAmounts = [10, 25, 50, 100, 250, 500]

// Generate unique deposit addresses per session (in production, this would come from your backend)
const DEPOSIT_ADDRESSES = {
  eth: "0x742d35Cc6634C0532925a3b844Bc9e7595f8bE7a",
  bsc: "0x742d35Cc6634C0532925a3b844Bc9e7595f8bE7a",
}

interface TransactionStatus {
  found: boolean
  confirmed: boolean
  transaction?: {
    hash: string
    from: string
    to: string
    amount: string
    confirmations: number
    timestamp: string
    isNative?: boolean
  }
}

const withdrawAmounts = [10, 25, 50, 100, 250, 500]

interface WalletScreenProps {
  initialAction?: "deposit" | "withdraw" | null
  onActionHandled?: () => void
}

export function WalletScreen({ initialAction, onActionHandled }: WalletScreenProps) {
  const { wallet, telegramId, authHeaders, refreshWallet } = useUser()
  const availableBalance = wallet?.balance ?? 0
  const minWithdraw = 10

  // Deposit states
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositStep, setDepositStep] = useState<"amount" | "crypto" | "payment" | "processing" | "success" | "failed">("amount")
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(1800) // 30 minutes in seconds
  const [depositStartTime, setDepositStartTime] = useState<number | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | null>(null)
  const [checkCount, setCheckCount] = useState(0)

  // Withdraw states
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<"amount" | "network" | "address" | "confirm" | "submitted">("amount")
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null)
  const [withdrawCustomAmount, setWithdrawCustomAmount] = useState("")
  const [withdrawNetwork, setWithdrawNetwork] = useState<string | null>(null)
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [addressCopied, setAddressCopied] = useState(false)

  // Handle initial action from navigation
  useEffect(() => {
    if (initialAction === "deposit") {
      setDepositOpen(true)
      onActionHandled?.()
    } else if (initialAction === "withdraw") {
      setWithdrawOpen(true)
      onActionHandled?.()
    }
  }, [initialAction, onActionHandled])

  const getSelectedCrypto = () => cryptoOptions.find(c => c.id === selectedCrypto)
  const getFinalAmount = () => selectedAmount || parseFloat(customAmount) || 0

  // Get deposit address based on selected network
  const getDepositAddress = () => {
    const crypto = getSelectedCrypto()
    if (!crypto) return ""
    return DEPOSIT_ADDRESSES[crypto.chainNetwork as keyof typeof DEPOSIT_ADDRESSES] || ""
  }

  // Check deposit status via Etherscan API
  const checkDepositStatus = useCallback(async () => {
    const crypto = getSelectedCrypto()
    if (!crypto || !depositStartTime) return

    try {
      const params = new URLSearchParams({
        address: getDepositAddress(),
        network: crypto.chainNetwork,
        amount: getFinalAmount().toString(),
        fromTimestamp: Math.floor(depositStartTime / 1000).toString(),
      })

      const response = await fetch(`/api/check-deposit?${params}`)
      const data: TransactionStatus = await response.json()

      setTransactionStatus(data)
      setCheckCount(prev => prev + 1)

      if (data.found && data.confirmed) {
        setDepositStep("success")
      }
    } catch (error) {
      console.error("Error checking deposit:", error)
    }
  }, [selectedCrypto, depositStartTime, selectedAmount, customAmount])

  // Auto-check deposit status every 15 seconds when in processing step
  useEffect(() => {
    if (depositStep !== "processing") return

    // Initial check
    checkDepositStatus()

    const interval = setInterval(() => {
      checkDepositStatus()
    }, 15000) // Check every 15 seconds

    return () => clearInterval(interval)
  }, [depositStep, checkDepositStatus])

  // Countdown timer for payment expiration
  useEffect(() => {
    if (depositStep !== "payment" && depositStep !== "processing") return
    if (timeRemaining <= 0) {
      setDepositStep("failed")
      return
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [depositStep, timeRemaining])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(DEPOSIT_ADDRESSES.eth)
  }

  const copyDepositAddress = () => {
    navigator.clipboard.writeText(getDepositAddress())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenDeposit = () => {
    setDepositStep("amount")
    setSelectedAmount(null)
    setCustomAmount("")
    setSelectedCrypto(null)
    setTimeRemaining(1800)
    setDepositStartTime(null)
    setTransactionStatus(null)
    setCheckCount(0)
    setDepositOpen(true)
  }

  // Withdraw functions
  const handleOpenWithdraw = () => {
    setWithdrawStep("amount")
    setWithdrawAmount(null)
    setWithdrawCustomAmount("")
    setWithdrawNetwork(null)
    setWithdrawAddress("")
    setWithdrawOpen(true)
  }

  const getWithdrawFinalAmount = () => withdrawAmount || parseFloat(withdrawCustomAmount) || 0

  const handleWithdrawAmountNext = () => {
    const amount = getWithdrawFinalAmount()
    if (amount >= minWithdraw && amount <= availableBalance) {
      setWithdrawStep("network")
    }
  }

  const handleWithdrawNetworkSelect = (networkId: string) => {
    setWithdrawNetwork(networkId)
    setWithdrawStep("address")
  }

  const handleWithdrawAddressNext = () => {
    if (withdrawAddress.trim().length > 10) {
      setWithdrawStep("confirm")
    }
  }

  const handleWithdrawSubmit = async () => {
    setWithdrawStep("submitted")
    if (!telegramId) return
    try {
      await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          amount: getWithdrawFinalAmount(),
          address: withdrawAddress,
          network: getSelectedWithdrawNetwork()?.network,
        }),
      })
      refreshWallet()
    } catch {}
  }

  const getSelectedWithdrawNetwork = () => cryptoOptions.find(c => c.id === withdrawNetwork)

  const handleAmountNext = () => {
    const amount = selectedAmount || parseFloat(customAmount)
    if (amount && amount >= 10) {
      setDepositStep("crypto")
    }
  }

  const handleCryptoSelect = (cryptoId: string) => {
    setSelectedCrypto(cryptoId)
    setDepositStartTime(Date.now())
    setDepositStep("payment")
  }

  const handleConfirmPayment = () => {
    setDepositStep("processing")
  }

  const getExplorerUrl = (hash: string) => {
    const crypto = getSelectedCrypto()
    if (!crypto) return "#"
    
    const explorers = {
      eth: `https://etherscan.io/tx/${hash}`,
      bsc: `https://bscscan.com/tx/${hash}`,
    }
    return explorers[crypto.chainNetwork as keyof typeof explorers] || "#"
  }

  return (
    <div className="flex flex-col gap-4 p-4 safe-area-top">
      <h1 className="text-2xl font-bold text-foreground">Wallet</h1>

      {/* Balance Card */}
      <Card className="glass-card primary-glow">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <h2 className="mt-1 text-4xl font-bold text-gradient">${availableBalance.toFixed(2)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">USDT (TRC20)</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button className="primary-gradient h-12" onClick={handleOpenDeposit}>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Deposit
            </Button>
            <Button className="h-12 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleOpenWithdraw}>
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Modal */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="glass-card border-primary/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Wallet className="h-5 w-5 text-primary" />
              {depositStep === "amount" && "Select Deposit Amount"}
              {depositStep === "crypto" && "Select Payment Method"}
              {depositStep === "payment" && "Complete Payment"}
              {depositStep === "processing" && "Verifying Payment"}
              {depositStep === "success" && "Deposit Successful"}
              {depositStep === "failed" && "Deposit Failed"}
            </DialogTitle>
            <DialogDescription>
              {depositStep === "amount" && "Choose how much you want to deposit"}
              {depositStep === "crypto" && "Select your preferred cryptocurrency"}
              {depositStep === "payment" && "Send the exact amount to the address below"}
              {depositStep === "processing" && "Auto-checking blockchain for your transaction..."}
              {depositStep === "success" && "Your deposit has been confirmed"}
              {depositStep === "failed" && "Payment expired or not found"}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Amount Selection */}
          {depositStep === "amount" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {depositAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    className={cn(
                      "h-12",
                      selectedAmount === amount && "primary-gradient border-0"
                    )}
                    onClick={() => {
                      setSelectedAmount(amount)
                      setCustomAmount("")
                    }}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>

              <div className="relative">
                <Label htmlFor="customAmount" className="text-muted-foreground">Or enter custom amount</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="customAmount"
                    type="number"
                    placeholder="0.00"
                    className="pl-7 bg-secondary/50"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value)
                      setSelectedAmount(null)
                    }}
                    min={10}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Minimum deposit: $10</p>
              </div>

              <Button
                className="w-full primary-gradient h-12"
                disabled={!selectedAmount && (!customAmount || parseFloat(customAmount) < 10)}
                onClick={handleAmountNext}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Crypto Selection */}
          {depositStep === "crypto" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <span className="text-muted-foreground">Deposit Amount</span>
                <span className="font-bold text-foreground">${getFinalAmount().toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                {cryptoOptions.map((crypto) => (
                  <button
                    key={crypto.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                    onClick={() => handleCryptoSelect(crypto.id)}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white font-bold", crypto.color)}>
                      {crypto.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{crypto.name}</p>
                      <p className="text-xs text-muted-foreground">{crypto.network}</p>
                    </div>
                    <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setDepositStep("amount")}
              >
                Back
              </Button>
            </div>
          )}

          {/* Step 3: Payment Details */}
          {depositStep === "payment" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white font-bold text-sm", getSelectedCrypto()?.color)}>
                    {getSelectedCrypto()?.icon}
                  </div>
                  <span className="text-muted-foreground">{getSelectedCrypto()?.name} ({getSelectedCrypto()?.network})</span>
                </div>
                <span className="font-bold text-foreground">${getFinalAmount().toFixed(2)}</span>
              </div>

              {/* QR Code Placeholder */}
              <div className="flex flex-col items-center p-4 rounded-xl bg-white">
                <div className="h-40 w-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMSAyMSI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTEgMWg3djdIMVYxem0xIDFoNXY1SDJWMnptMS0xaDN2M0gzVjN6bTEyLTJoN3Y3aC03VjF6bTEgMWg1djVoLTVWMnptMi0xaDN2M2gtM1Yxem0tMTMgMTJoN3Y3SDFoLTdWMTN6bTEgMWg1djVIMnYtNXptMS0xaDN2M0gzdi0zem00LTEwaDN2MUg5VjN6bTAgMmgxdjNIOXYtM3ptMi0yaDJ2MWgtMlYzem0zIDB2MWgyVjNoLTJ6bS0xIDJoMXYxaC0xVjV6bTEgMHYxaDJ2LTJoLTF2MWgtMXptMiAxdjFoMXYtMWgtMXptLTQgMGgxdjFoLTFWNnptLTMgMWgxdjNoLTFWN3ptMSAydjFoMnYxaC0xdjFoLTFWOXptMyAwaDF2MWgtMXYxaDJWOWgtMnptMSAyaDJ2MWgtMnYtMXptMSAxdjFoMXYxaC0xdi0xaC0xdi0xaDJ6bTEtM2gxdjJoLTF2LTJ6bTAgM3YxaDF2MWgtMXYtMmgxem0tMiAxdjFoLTJ2MWgydi0xaDF2LTFoLTF6bTIgMGgxdjFoLTF2LTF6bS01IDFoMXYxaC0xdi0xem0wIDNoMXYxaC0xdi0xem0yLTNoMXYxaC0xdi0xem0yIDF2MWgtMXYtMWgxem0tNCAxaDN2MWgtM3YtMXptNCAxdjFoMXYxaC0xdi0xaC0xdi0xaDJ6bTEgMGgxdjFoLTF2LTF6bS01IDFoMXYxaC0xdi0xem0yIDB2MWgxdi0xaC0xem0yIDFoMXYxaC0xdi0xem0tNiAyaDF2MWgtMXYtMXptNCAwaDJ2MWgtMnYtMXptMyAwdjFoMXYtMWgtMXptMSAwaDF2MmgtMXYtMnoiLz48L3N2Zz4=')] bg-contain bg-center bg-no-repeat flex items-center justify-center">
                  <QrCode className="h-32 w-32 text-black opacity-20" />
                </div>
                <p className="mt-2 text-xs text-gray-500">Scan QR code to pay</p>
              </div>

              {/* Payment Address */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Payment Address ({getSelectedCrypto()?.network})</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={getDepositAddress()}
                    readOnly
                    className="bg-secondary/50 font-mono text-xs"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={copyDepositAddress}
                    className="flex-shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <p className="text-xs text-orange-400">
                  <strong>Important:</strong> Send exactly ${getFinalAmount().toFixed(2)} worth of {getSelectedCrypto()?.name} ({getSelectedCrypto()?.network}) to this address. 
                  Sending a different amount or currency may result in loss of funds.
                </p>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className={cn("text-sm", timeRemaining < 300 && "text-orange-400")}>
                  Payment expires in {formatTime(timeRemaining)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDepositStep("crypto")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 primary-gradient"
                  onClick={handleConfirmPayment}
                >
                  I have sent the payment
                </Button>
              </div>

              {/* Auto-verification notice */}
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-border/50">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Auto-verification via Etherscan</span>
              </div>
            </div>
          )}

          {/* Step 4: Processing with Auto-Check */}
          {depositStep === "processing" && (
            <div className="flex flex-col items-center py-6 space-y-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full primary-gradient flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-primary-foreground animate-spin" />
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-foreground">Auto-Checking Blockchain</h3>
                <p className="text-sm text-muted-foreground">
                  We are automatically monitoring {getSelectedCrypto()?.network} for your transaction.
                  No action needed from you.
                </p>
              </div>

              {/* Status Card */}
              <div className="w-full space-y-3 p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium text-foreground">${getFinalAmount().toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium text-foreground">{getSelectedCrypto()?.name} ({getSelectedCrypto()?.network})</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Time Remaining</span>
                  <span className={cn("font-medium", timeRemaining < 300 ? "text-orange-400" : "text-foreground")}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Checks Performed</span>
                  <span className="font-medium text-foreground">{checkCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {transactionStatus?.found ? (
                    <Badge variant="outline" className="border-success text-success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Found - {transactionStatus.transaction?.confirmations || 0} confirmations
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-primary text-primary">
                      <Clock className="mr-1 h-3 w-3" />
                      Waiting for transaction
                    </Badge>
                  )}
                </div>
              </div>

              {/* Progress indicator */}
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    transactionStatus?.found ? "bg-success" : "bg-primary animate-pulse"
                  )} />
                  <span className="text-xs text-muted-foreground">
                    {transactionStatus?.found ? "Transaction detected" : "Scanning blockchain..."}
                  </span>
                </div>
                {transactionStatus?.found && (
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      transactionStatus.confirmed ? "bg-success" : "bg-primary animate-pulse"
                    )} />
                    <span className="text-xs text-muted-foreground">
                      {transactionStatus.confirmed 
                        ? "Confirmed (12+ confirmations)" 
                        : `Waiting for confirmations (${transactionStatus.transaction?.confirmations || 0}/12)`}
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setDepositOpen(false)}
              >
                Close (We will notify you)
              </Button>
            </div>
          )}

          {/* Step 5: Success */}
          {depositStep === "success" && (
            <div className="flex flex-col items-center py-6 space-y-4">
              <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-foreground">Deposit Confirmed!</h3>
                <p className="text-sm text-muted-foreground">
                  Your deposit of ${getFinalAmount().toFixed(2)} has been successfully credited to your account.
                </p>
              </div>

              {transactionStatus?.transaction && (
                <div className="w-full space-y-2 p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Amount Received</span>
                    <span className="font-medium text-success">${transactionStatus.transaction.amount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Transaction Hash</span>
                    <a 
                      href={getExplorerUrl(transactionStatus.transaction.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {transactionStatus.transaction.hash.slice(0, 8)}...{transactionStatus.transaction.hash.slice(-6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confirmations</span>
                    <span className="font-medium text-foreground">{transactionStatus.transaction.confirmations}</span>
                  </div>
                </div>
              )}

              <Button
                className="w-full primary-gradient"
                onClick={() => setDepositOpen(false)}
              >
                Done
              </Button>
            </div>
          )}

          {/* Step 6: Failed */}
          {depositStep === "failed" && (
            <div className="flex flex-col items-center py-6 space-y-4">
              <div className="h-20 w-20 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-foreground">Payment Expired</h3>
                <p className="text-sm text-muted-foreground">
                  We could not detect your payment within the time limit. 
                  If you have sent the payment, please contact support.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 w-full">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5" />
                  <p className="text-xs text-orange-400">
                    If you sent the payment after the timer expired, it may still be processed. 
                    Check your transaction history or contact support with your transaction hash.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDepositOpen(false)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 primary-gradient"
                  onClick={handleOpenDeposit}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="glass-card border-primary/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ArrowUpFromLine className="h-5 w-5 text-orange-500" />
              {withdrawStep === "amount" && "Withdrawal Amount"}
              {withdrawStep === "network" && "Select Network"}
              {withdrawStep === "address" && "Wallet Address"}
              {withdrawStep === "confirm" && "Confirm Withdrawal"}
              {withdrawStep === "submitted" && "Request Submitted"}
            </DialogTitle>
            <DialogDescription>
              {withdrawStep === "amount" && "Choose how much you want to withdraw"}
              {withdrawStep === "network" && "Select the network for withdrawal"}
              {withdrawStep === "address" && "Enter your wallet address"}
              {withdrawStep === "confirm" && "Review and confirm your withdrawal"}
              {withdrawStep === "submitted" && "Your request is being processed"}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Amount Selection */}
          {withdrawStep === "amount" && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary/50 flex items-center justify-between">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-bold text-foreground">${availableBalance.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {withdrawAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant={withdrawAmount === amount ? "default" : "outline"}
                    className={cn(
                      "h-12",
                      withdrawAmount === amount && "bg-orange-500 hover:bg-orange-600 border-0"
                    )}
                    onClick={() => {
                      setWithdrawAmount(amount)
                      setWithdrawCustomAmount("")
                    }}
                    disabled={amount > availableBalance}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>

              <div className="relative">
                <Label htmlFor="withdrawCustomAmount" className="text-muted-foreground">Or enter custom amount</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="withdrawCustomAmount"
                    type="number"
                    placeholder="0.00"
                    className="pl-7 bg-secondary/50"
                    value={withdrawCustomAmount}
                    onChange={(e) => {
                      setWithdrawCustomAmount(e.target.value)
                      setWithdrawAmount(null)
                    }}
                    min={minWithdraw}
                    max={availableBalance}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Minimum: ${minWithdraw} | Maximum: ${availableBalance.toFixed(2)}</p>
              </div>

              {/* Max button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setWithdrawCustomAmount(availableBalance.toString())
                  setWithdrawAmount(null)
                }}
              >
                Withdraw Max (${availableBalance.toFixed(2)})
              </Button>

              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 h-12"
                disabled={getWithdrawFinalAmount() < minWithdraw || getWithdrawFinalAmount() > availableBalance}
                onClick={handleWithdrawAmountNext}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Network Selection */}
          {withdrawStep === "network" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <span className="text-muted-foreground">Withdrawal Amount</span>
                <span className="font-bold text-foreground">${getWithdrawFinalAmount().toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                {cryptoOptions.filter(c => c.name === "USDT").map((crypto) => (
                  <button
                    key={crypto.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                    onClick={() => handleWithdrawNetworkSelect(crypto.id)}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white font-bold", crypto.color)}>
                      {crypto.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{crypto.name}</p>
                      <p className="text-xs text-muted-foreground">{crypto.network}</p>
                    </div>
                    <ArrowUpFromLine className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setWithdrawStep("amount")}
              >
                Back
              </Button>
            </div>
          )}

          {/* Step 3: Wallet Address */}
          {withdrawStep === "address" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white font-bold text-sm", getSelectedWithdrawNetwork()?.color)}>
                    {getSelectedWithdrawNetwork()?.icon}
                  </div>
                  <span className="text-muted-foreground">{getSelectedWithdrawNetwork()?.name} ({getSelectedWithdrawNetwork()?.network})</span>
                </div>
                <span className="font-bold text-foreground">${getWithdrawFinalAmount().toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAddress" className="text-foreground">
                  Your {getSelectedWithdrawNetwork()?.network} Wallet Address
                </Label>
                <Input
                  id="withdrawAddress"
                  placeholder={getSelectedWithdrawNetwork()?.network === "ERC20" ? "0x..." : "0x..."}
                  className="bg-secondary/50 font-mono"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Make sure this is a valid {getSelectedWithdrawNetwork()?.network} address. Sending to wrong network will result in loss of funds.
                </p>
              </div>

              {/* Warning */}
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5" />
                  <p className="text-xs text-orange-400">
                    Double-check your wallet address. Withdrawals to incorrect addresses cannot be reversed.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setWithdrawStep("network")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  disabled={withdrawAddress.trim().length < 10}
                  onClick={handleWithdrawAddressNext}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {withdrawStep === "confirm" && (
            <div className="space-y-4">
              <div className="space-y-3 p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-foreground">${getWithdrawFinalAmount().toFixed(2)} USDT</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium text-foreground">{getSelectedWithdrawNetwork()?.network}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span className="font-medium text-foreground">$1.00</span>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">You will receive</span>
                  <span className="font-bold text-success">${(getWithdrawFinalAmount() - 1).toFixed(2)} USDT</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Destination Address</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                  <span className="font-mono text-xs text-foreground flex-1 break-all">{withdrawAddress}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="flex-shrink-0 h-8 w-8"
                    onClick={() => {
                      navigator.clipboard.writeText(withdrawAddress)
                      setAddressCopied(true)
                      setTimeout(() => setAddressCopied(false), 2000)
                    }}
                  >
                    {addressCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Processing time notice */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-primary mt-0.5" />
                  <p className="text-xs text-primary">
                    Withdrawals are processed manually by admin within 24-48 hours. You will receive a notification once approved.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setWithdrawStep("address")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={handleWithdrawSubmit}
                >
                  Confirm Withdrawal
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Submitted */}
          {withdrawStep === "submitted" && (
            <div className="flex flex-col items-center py-6 space-y-4">
              <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-foreground">Request Submitted!</h3>
                <p className="text-sm text-muted-foreground">
                  Your withdrawal request has been submitted successfully and is pending admin approval.
                </p>
              </div>

              <div className="w-full space-y-3 p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-foreground">${getWithdrawFinalAmount().toFixed(2)} USDT</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium text-foreground">{getSelectedWithdrawNetwork()?.network}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="border-primary text-primary">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending Approval
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Time</span>
                  <span className="font-medium text-foreground">24-48 hours</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 w-full">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <p className="text-xs text-primary">
                    You can track your withdrawal status in the Transaction History below.
                  </p>
                </div>
              </div>

              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={() => setWithdrawOpen(false)}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Address */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Your TRC20 Wallet Address</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              value={DEPOSIT_ADDRESSES.eth}
              readOnly
              className="bg-secondary/50 font-mono text-xs"
            />
            <Button size="icon" variant="outline" onClick={copyAddress} className="flex-shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Only send USDT (TRC20) to this address. Other tokens will be lost.
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Earned</p>
            <p className="mt-1 font-bold text-success">${(wallet?.total_earned ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Withdrawn</p>
            <p className="mt-1 font-bold text-foreground">${(wallet?.total_withdrawn ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Coins</p>
            <p className="mt-1 font-bold text-primary">{(wallet?.coins ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-secondary/50">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="earnings" className="text-xs">Earnings</TabsTrigger>
              <TabsTrigger value="withdrawals" className="text-xs">Withdrawals</TabsTrigger>
              <TabsTrigger value="bonuses" className="text-xs">Bonuses</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="flex flex-col items-center py-10 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Your transaction history will appear here</p>
              </div>
            </TabsContent>
            <TabsContent value="earnings" className="mt-4">
              <div className="flex flex-col items-center py-10 text-center">
                <ArrowDownToLine className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No earnings yet</p>
              </div>
            </TabsContent>
            <TabsContent value="withdrawals" className="mt-4">
              <div className="flex flex-col items-center py-10 text-center">
                <ArrowUpFromLine className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No withdrawals yet</p>
              </div>
            </TabsContent>
            <TabsContent value="bonuses" className="mt-4">
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No bonuses yet</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
