"""One-off: write coherent BigStep Technologies pitch copy into the
UserCompanyProfile row for user ae00ffd8-2ecf-4e0a-ab7d-1905b8f98b9e.

Source facts come from clutch.co, bigsteptech.com, and Tracxn/RocketReach
(verified 2026-04-18).  The old row mixed Outmate's copy with BigStep's
name — this script replaces the inconsistent fields with a matched set."""

from __future__ import annotations
import logging
import sys

from dotenv import load_dotenv

load_dotenv()
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

from app.db.session import SessionLocal  # noqa: E402
from app.db.models.company_profile import UserCompanyProfile  # noqa: E402

USER_ID = "ae00ffd8-2ecf-4e0a-ab7d-1905b8f98b9e"

NEW_VALUES = {
    "company_name": "BigStep Technologies",
    "website_url": "https://bigsteptech.com/",

    # Said in the opening 10 seconds — keep under 20 words, speakable.
    "one_liner":
        "We're a product engineering studio — 17 years, 700-plus apps "
        "shipped — helping startups build web, mobile, and AI products.",

    # Longer answer when the prospect asks "so what do you actually do?"
    "product_description":
        "BigStep is a Gurugram-based product engineering firm founded in 2008. "
        "We've built 700-plus web, mobile, and enterprise apps for 500-plus "
        "customers worldwide. Our full-stack team covers web, iOS, Android, "
        "cloud and DevOps, with deeper specialisms in real-time video and "
        "WebRTC, AI and GenAI integration, and SaaS product architecture. "
        "Most engagements are either a dedicated product pod on a monthly "
        "retainer, or a fixed-scope build with weekly demos.",

    # Short, speakable pricing answer — avoids precise quotes, nudges to demo.
    "pricing_summary":
        "Engagements start at ten thousand dollars for focused builds, with "
        "blended hourly rates between twenty-five and forty-nine dollars. "
        "Most clients choose a dedicated pod on a monthly retainer — happy "
        "to send a tailored quote after a fifteen-minute scoping call.",

    # Who we're a good fit for — agent uses this to qualify in-call.
    "icp_description":
        "Funded startups and mid-market companies that need an engineering "
        "team but don't want to hire in-house yet. Sweet spot: Seed to "
        "Series C SaaS, healthtech, fintech, and media companies in the US, "
        "UK, and Europe. Typical buyer is a founder, CTO, or head of "
        "product without a full in-house dev org.",

    # Why pick BigStep over another dev shop.
    "key_differentiators":
        "Seventeen years in business — we've shipped over 700 products, so "
        "we rarely hit a problem we haven't seen. Deep bench for real-time "
        "video and WebRTC, which most agencies don't touch. Senior-led "
        "teams — median engineer has six-plus years of experience — not a "
        "body-shop model. Transparent weekly demos, fixed sprint costs, and "
        "we stay engaged post-launch for scaling.",

    # Reusable counters for common objections.  Agent is instructed to pull
    # the relevant one when the objection surfaces rather than recite the
    # whole block.
    "objection_handling":
        "If they already have a dev team — position us as an extension that "
        "owns specific modules like video, AI integrations, or mobile, not "
        "a replacement. If they worry about offshore quality — offer a "
        "two-week no-obligation discovery sprint so they can judge the team "
        "before committing long-term. If they say it's too expensive — "
        "frame that our blended rate is roughly a third of a US senior "
        "contractor at the same quality bar. If they say bad timing — ask "
        "for a soft calendar hold sixty days out so they're queued when "
        "they are ready.",

    # Freeform extras the agent can reference — named clients build trust.
    "additional_context":
        "Public case studies include Panacea Infosec (a cybersecurity "
        "platform), House of Diagnostics (a healthcare diagnostics chain), "
        "and Digli (a social media and entertainment app). Headquartered "
        "in Gurugram with 100-plus engineers. Top-tier ratings on Clutch "
        "in the India custom software category, and a 4.5-out-of-5 "
        "Glassdoor score from over 200 employee reviews.",

    # Persona — keep "Alex" per user, but role fits a dev-services pitch
    # better as "Partnership Lead" than the old "GTM Specialist" default.
    "agent_persona_name": "Alex",
    "agent_persona_role": "Partnership Lead",
}


def main() -> int:
    db = SessionLocal()
    try:
        p = db.query(UserCompanyProfile).filter(UserCompanyProfile.user_id == USER_ID).first()
        if not p:
            print(f"no UserCompanyProfile for user {USER_ID}", file=sys.stderr)
            return 1

        changed = []
        for k, v in NEW_VALUES.items():
            old = getattr(p, k)
            if old != v:
                setattr(p, k, v)
                changed.append(k)

        if not changed:
            print("no changes (values already match)")
            return 0

        db.commit()
        print(f"updated {len(changed)} field(s): {', '.join(changed)}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
