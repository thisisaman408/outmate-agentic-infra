# Copilot Roadmap — Future Features

This document tracks planned features and enhancements for the Outmate Copilot module. The core copilot (Daily Brief, Meeting Prep, Campaign Analysis, Pipeline Alerts) is implemented on the `copilot_feature` branch.

---

## Near-Term (code exists, not production-ready)

### 1. Real LLM Integration
Switch from `MOCK_LLM=true` to real OpenRouter API calls. The service layer already has the LLM call paths — they just need valid API keys and `MOCK_LLM=false`.

### 2. Email / Slack Notifications
Backend notification service is built (`app/services/copilot/notification_service.py`) with SMTP and Slack webhook delivery. Requires:
- SMTP credentials configured in `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`)
- Slack incoming webhook URL

### 3. Celery Scheduled Tasks
Celery Beat schedule and on-demand tasks exist in `app/tasks/copilot_tasks.py`. Requires Redis running and Celery worker/beat processes started:
```bash
celery -A app.core.celery_app worker --loglevel=info
celery -A app.core.celery_app beat --loglevel=info
```

### 4. Command Bar (Cmd+K)
Quick copilot access from anywhere in the app. Allows users to trigger briefs, meeting preps, or search copilot history without navigating to the copilot page.

### 5. Alert Resolution UI
Backend endpoint exists (`PUT /copilot/pipeline-alerts/{id}/resolve`), but the frontend alert cards don't yet wire up a resolve/dismiss action.

### 6. Copilot Feed
Unified activity stream combining briefs, alerts, meeting preps, and recommendations into a single chronological feed with filtering.

---

## Future Features

### 7. Smart Follow-Up Composer
AI-generated personalized follow-up emails based on prospect history, engagement signals, and campaign context. Drafts appear in-app for review before sending.

### 8. ICP Match Scorer
Score prospects against the user's Ideal Customer Profile with an explanation of why they match or don't. Surfaces high-fit prospects automatically.

### 9. Objection Handler
AI-powered response frameworks for common sales objections. Given a prospect's objection, generates tailored rebuttals using company context and past successful responses.

### 10. Weekly Performance Digest
Weekly rollup email/notification summarizing accomplishments, pipeline changes, conversion rates, and suggested focus areas for the coming week.

### 11. Real-Time Signal Nudges
SSE-based push notifications for high-priority signals (e.g., a target prospect visits your website, opens a proposal, or gets funding). Delivered as browser notifications or in-app toasts.

### 12. Conversation Intelligence Summary
Extract action items, key topics, and next steps from call notes or meeting transcripts. Auto-links extracted items to the relevant prospect/deal record.

---

## Infrastructure Enhancements

| Enhancement | Details |
|---|---|
| **Production Email** | Replace SMTP with SendGrid or Resend for reliable transactional email delivery |
| **Slack App** | Full Slack App with slash commands (`/outmate brief`, `/outmate prep Acme`) instead of simple webhooks |
| **CRM Integrations** | Salesforce and HubSpot connectors for bi-directional pipeline data sync |
| **Redis Caching** | TTL-based caching for generated briefs and meeting preps to reduce redundant LLM calls |
