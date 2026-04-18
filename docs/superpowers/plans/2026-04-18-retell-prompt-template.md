# Retell Dashboard Prompt Template (after Company Profile)

Once the Company Profile backend + frontend ship, the Retell agent prompt needs to be updated **on the Retell dashboard** to consume the new dynamic variables. This is a one-time copy-paste.

## Where to paste

1. Log into [dashboard.retellai.com](https://dashboard.retellai.com)
2. Open agent `agent_88f65617cb80ca7382336f0c15` (or whichever agent ID is in your `RETELL_AGENT_ID` env var)
3. Go to **General Prompt** or **Conversation Flow → Global Prompt**
4. Paste the template below. It references the dynamic variables our backend now sends on every `create-phone-call`.

## Variables our backend sends (and Retell must declare)

Make sure each of these is declared in the agent's **Dynamic Variables** config so Retell knows to substitute `{{var}}` with the runtime value.

### Group 1 — Who we are (from Company Profile)
- `agent_name` — e.g. "Alex"
- `agent_role` — e.g. "GTM Specialist"
- `my_company_name` — e.g. "Acme Corp"
- `company_name` — same as `my_company_name` (kept for back-compat with older Retell templates)
- `product_pitch` — the one-liner
- `product_description` — longer product description
- `pricing_summary` — e.g. "Starts at $500/mo, 14-day trial"
- `icp_description` — e.g. "Series A-C SaaS"
- `objection_handling` — objection talking points
- `key_differentiators` — why us
- `booking_link` — calendar URL (e.g. Cal.com)
- `additional_context` — free-form extras

### Group 2 — Who we're calling (per-prospect)
- `lead_name` — prospect name
- `lead_company` — prospect's company
- `lead_role` — prospect's job title
- `lead_city`, `lead_industry`
- `lead_context` — the signal event or user-provided call context

### Group 3 — Why we're calling
- `call_objective` — e.g. "discovery", "demo", "followup"

## Paste this into Retell's General Prompt

```
You are {{agent_name}}, {{agent_role}} at {{my_company_name}}.

You are making an outbound phone call to {{lead_name}}, who works as {{lead_role}} at {{lead_company}}.

# Why you're calling
{{lead_context}}

Your objective for this call: {{call_objective}}

# About {{my_company_name}}
{{product_pitch}}

{{product_description}}

# Pricing
{{pricing_summary}}

# Who we typically work with
{{icp_description}}

# Why prospects choose {{my_company_name}}
{{key_differentiators}}

# If they raise objections
Handle objections using this guidance:
{{objection_handling}}

# Additional context you should know
{{additional_context}}

# How to book
If the prospect wants to book a meeting, direct them to: {{booking_link}}
If the prospect says "email it to me" or "send me something", acknowledge and say you'll follow up via email — do not give out the booking link in that case.

# Style rules
- Speak naturally, as a real human would. Never sound robotic.
- Keep turns short — never monologue for more than 20 seconds.
- Let the prospect talk. Your job is to discover their pain, not to pitch.
- If the prospect is not interested, thank them politely and end the call.
- If voicemail picks up, leave a 15-second message mentioning {{my_company_name}}, why you called ({{lead_context}}), and that you'll follow up with email.
- Never invent pricing, features, or case studies not listed above.

# Call flow
1. Greeting: "Hi {{lead_name}}, this is {{agent_name}} from {{my_company_name}}."
2. Reason: Mention the signal / context: {{lead_context}}
3. Ask an open-ended discovery question about their current situation.
4. Listen. Surface pain points. Handle objections using the guidance above.
5. If they're interested, offer to book via {{booking_link}} or schedule a follow-up.
6. End the call politely regardless of outcome.
```

## Conversation Flow — Extract Variables node

Our webhook (`/api/v1/voice-agent/retell-webhook`) expects Retell to extract these variables from the conversation and send them back after the call ends. Configure an **Extract Variables** node in the Conversation Flow with exactly these keys:

- `name` (string) — the prospect's confirmed name
- `pain_points` (string) — the problem they described
- `current_tools` (string) — tools/vendors they mentioned
- `budget_mentioned` (string) — any budget info
- `decision_maker` (string) — whether they're the decision maker, or who is
- `next_steps` (string) — what was agreed (meeting, demo, follow-up, etc.)
- `objections` (string) — concerns raised
- `competitor_mentioned` (string) — competitors they use/considered
- `timeline` (string) — their purchase timeline
- `key_quotes` (string) — memorable quotes worth saving

These become the "Extracted variables" panel in the campaign detail drawer on the Outmate dashboard.

## Verify your setup

After pasting + saving on Retell:

1. In Outmate, fill out your Company Profile at `/settings/company-profile`.
2. Use **Quick call** to call a test number (your own phone).
3. You should hear the agent say your company name, not "Outmate".
4. After the call, open the campaign detail → call row → confirm the extracted variables + transcript show up.

If the agent sounds generic or says the wrong company name, the most common causes are:
- Retell's prompt template doesn't reference the new variables (re-paste the template above)
- A variable isn't declared in the Retell agent's Dynamic Variables config (each `{{var}}` must be declared for Retell to substitute it)
- Your Company Profile is still empty — fill it out, then call again
