import type React from "react"
import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"

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
  const pixelKey = process.env.NEXT_PUBLIC_PIXEL_KEY
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Visitor tracking pixel — only rendered when NEXT_PUBLIC_PIXEL_KEY is set */}
        {pixelKey && (
          <Script
            src={`${apiUrl}/api/v1/visitors/pixel.js`}
            data-pixel-key={pixelKey}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body
        className={`${plusJakarta.variable} ${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
