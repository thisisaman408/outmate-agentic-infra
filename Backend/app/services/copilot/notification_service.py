"""
Notification Service — delivers Co-Pilot alerts via email (SMTP) and Slack webhooks.

Both channels are best-effort: failures are logged but never raise to callers.
"""

import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """Send Co-Pilot notifications over email and/or Slack."""

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def send_daily_brief(
        self,
        *,
        to_email: Optional[str],
        slack_webhook_url: Optional[str],
        brief: dict,
    ) -> None:
        """Deliver a daily-brief payload to configured channels."""
        subject = f"Co-Pilot Daily Brief — {brief.get('brief_date', 'Today')}"
        html_body = self._render_brief_html(brief)
        text_body = self._render_brief_text(brief)

        if to_email:
            self._send_email(to=to_email, subject=subject, html=html_body, text=text_body)

        if slack_webhook_url:
            slack_text = self._render_brief_slack(brief)
            self._send_slack(webhook_url=slack_webhook_url, text=slack_text)

    def send_pipeline_alert(
        self,
        *,
        to_email: Optional[str],
        slack_webhook_url: Optional[str],
        alert_title: str,
        alert_description: str,
        recommendation: str,
        severity: str = "medium",
    ) -> None:
        """Deliver a pipeline-risk alert to configured channels."""
        subject = f"Co-Pilot Pipeline Alert: {alert_title}"
        html_body = self._render_alert_html(
            title=alert_title,
            description=alert_description,
            recommendation=recommendation,
            severity=severity,
        )
        text_body = (
            f"{alert_title}\n\n{alert_description}\n\nRecommendation: {recommendation}"
        )

        if to_email:
            self._send_email(to=to_email, subject=subject, html=html_body, text=text_body)

        if slack_webhook_url:
            severity_emoji = {"high": ":red_circle:", "medium": ":large_yellow_circle:"}.get(
                severity, ":large_green_circle:"
            )
            slack_text = (
                f"{severity_emoji} *Pipeline Alert: {alert_title}*\n"
                f"{alert_description}\n"
                f">*Recommendation:* {recommendation}"
            )
            self._send_slack(webhook_url=slack_webhook_url, text=slack_text)

    # ------------------------------------------------------------------ #
    # Email delivery                                                       #
    # ------------------------------------------------------------------ #

    def _send_email(self, *, to: str, subject: str, html: str, text: str) -> None:
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning(
                "SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing). "
                "Email notification skipped for: %s",
                to,
            )
            return

        from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_addr
            msg["To"] = to
            msg.attach(MIMEText(text, "plain"))
            msg.attach(MIMEText(html, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_addr, [to], msg.as_string())

            logger.info("Email sent to %s | subject: %s", to, subject)
        except Exception as exc:
            logger.error("Email delivery failed to %s: %s", to, exc)

    # ------------------------------------------------------------------ #
    # Slack delivery                                                       #
    # ------------------------------------------------------------------ #

    def send_slack_blocks(self, *, webhook_url: str, blocks: list, text: str) -> None:
        """Send a Slack Block Kit message. Fixes crash when called from copilot_tasks."""
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.post(webhook_url, json={"text": text, "blocks": blocks})
                resp.raise_for_status()
            logger.info("Slack blocks notification sent to webhook")
        except Exception as exc:
            logger.error("Slack blocks delivery failed: %s", exc)

    def send_meeting_brief_slack(
        self,
        *,
        webhook_url: str,
        brief: dict,
        meeting_title: str,
        event_start: str,
    ) -> None:
        """Send a pre-call meeting brief to Slack."""
        context = brief.get("context", "")
        talking_points = brief.get("talking_points", [])
        objections = brief.get("objections", [])
        ask = brief.get("ask", "")

        tp_lines = "\n".join(f"• {tp}" for tp in talking_points[:3])
        obj_lines = "\n".join(
            f"• _{o['objection']}_ → {o['rebuttal']}" for o in objections[:2]
        )

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"📋 Meeting Brief: {meeting_title}"},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Time:* {event_start}\n\n*Context:*\n{context}"},
            },
        ]
        if tp_lines:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Talking Points:*\n{tp_lines}"},
            })
        if obj_lines:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Objections & Rebuttals:*\n{obj_lines}"},
            })
        if ask:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*The Ask:*\n{ask}"},
            })

        text_fallback = f":calendar: *Meeting Brief Ready: {meeting_title}* (at {event_start})"
        self.send_slack_blocks(webhook_url=webhook_url, blocks=blocks, text=text_fallback)

    def _send_slack(self, *, webhook_url: str, text: str) -> None:
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.post(webhook_url, json={"text": text})
                resp.raise_for_status()
            logger.info("Slack notification sent to webhook")
        except Exception as exc:
            logger.error("Slack delivery failed: %s", exc)

    # ------------------------------------------------------------------ #
    # Renderers                                                            #
    # ------------------------------------------------------------------ #

    def _render_brief_html(self, brief: dict) -> str:
        actions_html = "".join(
            f"<li><strong>#{a['priority']}</strong> {a['action']} — <em>{a['reason']}</em></li>"
            for a in brief.get("priority_actions", [])
        )
        signals_html = "".join(
            f"<li>[{s['urgency'].upper()}] {s['entity']}: {s['description']}</li>"
            for s in brief.get("new_signals", [])
        )
        return f"""
        <html><body style="font-family:sans-serif;max-width:600px;margin:auto;">
          <h2>Co-Pilot Daily Brief — {brief.get('brief_date','')}</h2>
          <p>{brief.get('summary','')}</p>
          <h3>Priority Actions</h3>
          <ul>{actions_html}</ul>
          {"<h3>New Signals</h3><ul>" + signals_html + "</ul>" if signals_html else ""}
        </body></html>
        """

    def _render_brief_text(self, brief: dict) -> str:
        lines = [
            f"Co-Pilot Daily Brief — {brief.get('brief_date','')}",
            "",
            brief.get("summary", ""),
            "",
            "Priority Actions:",
        ]
        for a in brief.get("priority_actions", []):
            lines.append(f"  {a['priority']}. {a['action']} ({a['reason']})")
        if brief.get("new_signals"):
            lines += ["", "New Signals:"]
            for s in brief["new_signals"]:
                lines.append(f"  [{s['urgency'].upper()}] {s['entity']}: {s['description']}")
        return "\n".join(lines)

    def _render_brief_slack(self, brief: dict) -> str:
        lines = [
            f":sparkles: *Co-Pilot Daily Brief — {brief.get('brief_date','')}*",
            brief.get("summary", ""),
            "",
            "*Priority Actions*",
        ]
        for a in brief.get("priority_actions", []):
            lines.append(f">{a['priority']}. {a['action']} — _{a['reason']}_")
        return "\n".join(lines)

    def _render_alert_html(
        self, *, title: str, description: str, recommendation: str, severity: str
    ) -> str:
        color = {"high": "#ef4444", "medium": "#f59e0b"}.get(severity, "#22c55e")
        return f"""
        <html><body style="font-family:sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:{color}">Pipeline Alert: {title}</h2>
          <p>{description}</p>
          <p><strong>Recommendation:</strong> {recommendation}</p>
        </body></html>
        """
