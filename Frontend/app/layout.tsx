import type React from "react"
import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Inter } from "next/font/google"
import "./globals.css"
import { TrackingPixel } from "@/components/tracking-pixel"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
})
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

import { AuthProvider } from "@/components/auth/auth-provider"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Outmate.ai - B2B GTM Intelligence Platform",
  description: "AI-powered B2B lead generation, buying signals, and GTM automation",
  icons: {
    icon: "/image.png",
    apple: "/image.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
        <TrackingPixel />
        <Toaster />
      </body>
    </html>
  )
}
