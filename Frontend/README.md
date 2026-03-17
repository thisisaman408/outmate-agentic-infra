# Outmate.ai - GTM Intelligence Platform

This is the production-ready frontend for Outmate.ai, built with Next.js (App Router), Tailwind CSS, and Framer Motion.

## 🚀 Overview

Outmate.ai is an autonomous B2B GTM platform that handles everything from identity resolution (visitor tracking) to AI-powered lead enrichment and automated campaign execution.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Deployment**: Optimized for Azure Container Apps / Docker

## 📦 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` (or use the existing `.env.local`) and configure your backend URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_PIXEL_KEY=your_pixel_key
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_id
   ```

3. **Run Localization Server**:
   ```bash
   npm run dev
   ```

## 🏗️ Deployment

This project is configured for standalone production builds via Docker.

```bash
docker build -t outmate-web .
```

The build is automatically handled via GitHub Actions when pushing to the `outmate` branch.

## 🔒 Security

- All API calls are routed through a secure backend proxy to protect sensitive keys.
- Authorization is handled via JWT tokens stored in a secure session.
- Google OAuth is integrated for enterprise-grade authentication.

---
© 2026 Outmate AI. All rights reserved.
