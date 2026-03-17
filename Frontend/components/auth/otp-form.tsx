"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authService } from "@/lib/auth"
import { useStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60 // seconds

interface OtpFormProps {
  email: string
}

export function OtpForm({ email }: OtpFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const setUser = useStore((state) => state.setUser)

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""))
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const [error, setError] = useState("")

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-start cooldown on mount (OTP was just sent)
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const otp = digits.join("")

  const handleChange = (index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, "").slice(-1)
    setError("")

    const next = [...digits]
    next[index] = digit
    setDigits(next)

    // Auto-advance
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ""
        setDigits(next)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        const next = [...digits]
        next[index - 1] = ""
        setDigits(next)
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    } else if (e.key === "Enter" && otp.length === OTP_LENGTH) {
      handleVerify()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH)
    if (!pasted) return

    const next = [...digits]
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    setDigits(next)
    // Focus last filled or last input
    const lastIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    inputRefs.current[lastIndex]?.focus()
  }

  const handleVerify = useCallback(async () => {
    if (otp.length !== OTP_LENGTH) return
    setIsVerifying(true)
    setError("")
    try {
      const user = await authService.verifyOtp(email, otp)
      setUser(user)
      toast({ title: "Email verified!", description: "Welcome to Outmate.ai." })
      router.push("/dashboard")
    } catch (err: any) {
      const msg = err?.message || "Invalid code. Please try again."
      setError(msg)
      // Clear inputs on error
      setDigits(Array(OTP_LENGTH).fill(""))
      inputRefs.current[0]?.focus()
    } finally {
      setIsVerifying(false)
    }
  }, [otp, email, router, setUser, toast])

  // Auto-submit when all digits filled
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !isVerifying) {
      handleVerify()
    }
  }, [otp])

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return
    setIsResending(true)
    try {
      await authService.sendOtp(email)
      toast({ title: "Code resent", description: "Check your email for a new code." })
      setCooldown(RESEND_COOLDOWN)
      setDigits(Array(OTP_LENGTH).fill(""))
      setError("")
      inputRefs.current[0]?.focus()

      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0 }
          return c - 1
        })
      }, 1000)
    } catch (err: any) {
      toast({
        title: "Failed to resend",
        description: err?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsResending(false)
    }
  }

  const maskedEmail = email.replace(/(.{2}).+(@.+)/, "$1…$2")

  return (
    <div className="w-full max-w-[400px] space-y-8">
      {/* Icon + Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{maskedEmail}</span>
          </p>
        </div>
      </div>

      {/* OTP input boxes */}
      <div className="space-y-4">
        <div className="flex gap-2.5 justify-center">
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={isVerifying}
              className={`
                w-12 h-14 text-center text-xl font-bold rounded-lg border-2
                bg-background text-foreground
                outline-none transition-all duration-150
                focus:border-primary focus:ring-2 focus:ring-primary/20
                disabled:opacity-50
                ${error ? "border-destructive" : digits[i] ? "border-primary/50" : "border-border"}
              `}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-destructive font-medium">{error}</p>
        )}
      </div>

      {/* Verify button */}
      <Button
        className="w-full h-11 font-semibold"
        onClick={handleVerify}
        disabled={otp.length !== OTP_LENGTH || isVerifying}
      >
        {isVerifying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          "Verify email"
        )}
      </Button>

      {/* Resend */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">Didn&apos;t receive the code?</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="gap-2 text-sm"
        >
          {isResending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
      </div>

      {/* Back link */}
      <div className="text-center">
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign up
        </Link>
      </div>
    </div>
  )
}
