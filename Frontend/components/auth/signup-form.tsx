"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader2, Lock, Mail, User, Building2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { authService } from "@/lib/auth"
import { useStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { GoogleButton } from "@/components/auth/google-button"

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.pass).length

  if (!password) return null

  const colors = ["bg-destructive", "bg-warning", "bg-warning", "bg-success"]
  const labels = ["Weak", "Fair", "Good", "Strong"]

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < score ? colors[score] : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`flex items-center gap-1 text-[10px] ${c.pass ? "text-success" : "text-muted-foreground"}`}
          >
            <CheckCircle2 className={`h-3 w-3 ${c.pass ? "text-success" : "text-border"}`} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SignupForm() {
  const router = useRouter()
  const { toast } = useToast()
  const setUser = useStore((state) => state.setUser)

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    workspace: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!termsAccepted) {
      toast({
        title: "Terms required",
        description: "Please accept the Terms of Service to continue.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      await authService.signup(
        formData.email,
        formData.password,
        formData.name,
        formData.workspace,
        termsAccepted,
      )

      // Send OTP and redirect to verify page
      await authService.sendOtp(formData.email)

      toast({
        title: "Account created!",
        description: "Check your email for a 6-digit verification code.",
      })

      router.push(`/auth/verify?email=${encodeURIComponent(formData.email)}`)
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error?.message || "Failed to create account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[420px] space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Get started free</h1>
        <p className="text-sm text-muted-foreground">
          Create your Outmate.ai account — no credit card required
        </p>
      </div>

      {/* Terms required notice for Google */}
      {!termsAccepted && (
        <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-2">
          Accept the Terms of Service below before signing up with Google or email.
        </p>
      )}

      {/* Google Sign-Up */}
      <div>
          <GoogleButton
            text="signup_with"
            disabled={isLoading || !termsAccepted}
            termsAccepted={termsAccepted}
          />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground tracking-wider">or sign up with email</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">
              Full name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                className="pl-9"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace" className="text-sm font-medium">
              Company{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="workspace"
                type="text"
                placeholder="Acme Inc."
                className="pl-9"
                value={formData.workspace}
                onChange={(e) => setFormData({ ...formData, workspace: e.target.value })}
                disabled={isLoading}
                autoComplete="organization"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Work email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="pl-9"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              className="pl-9 pr-10"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={isLoading}
              minLength={8}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrength password={formData.password} />
        </div>

        {/* Terms & Conditions */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(v) => setTermsAccepted(Boolean(v))}
            disabled={isLoading}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
            I agree to Outmate.ai&apos;s{" "}
            <Link href="/legal/terms" className="text-primary hover:underline underline-offset-4" target="_blank">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-primary hover:underline underline-offset-4" target="_blank">
              Privacy Policy
            </Link>
            . I understand this platform is for B2B use only and consent to processing my data for
            lead intelligence and visitor analytics purposes.
          </Label>
        </div>

        <Button
          type="submit"
          className="w-full h-11 font-semibold"
          disabled={isLoading || !termsAccepted}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-primary font-medium hover:underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}
