"""
Email service for transactional emails (OTP, welcome, etc.)
Uses SMTP — configure SMTP_HOST/SMTP_USER/SMTP_PASSWORD in .env
"""

import ssl
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def _get_smtp_settings():
    from app.core.config import settings
    return settings


async def send_otp_email(to_email: str, otp: str, user_name: str = "") -> bool:
    """
    Send a 6-digit OTP verification email.
    Returns True if sent successfully, False if SMTP is not configured or sending fails.
    """
    settings = _get_smtp_settings()

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — OTP email not sent (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD)")
        return False

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    greeting = f"Hi {user_name}," if user_name else "Hi,"

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17;padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;">
            <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Outmate<span style="color:#a5b4fc;">.ai</span></div>
            <div style="font-size:12px;color:#c4b5fd;margin-top:4px;">AI-Powered B2B Intelligence</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;font-weight:600;">Verify your email address</h2>
            <p style="margin:0 0 28px;color:#94a3b8;font-size:14px;line-height:1.6;">
              {greeting} Use the verification code below to confirm your email. This code expires in <strong style="color:#f1f5f9;">10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <div style="background:#0f172a;border:1px solid #4f46e5;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
              <div style="font-size:42px;font-weight:800;letter-spacing:16px;color:#818cf8;font-family:'Courier New',monospace;">{otp}</div>
            </div>

            <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.5;">
              If you didn't create an account on Outmate.ai, you can safely ignore this email.
            </p>
            <p style="margin:0;color:#64748b;font-size:12px;">
              Never share this code with anyone — Outmate.ai will never ask for it.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e293b;">
            <p style="margin:0;color:#475569;font-size:11px;text-align:center;">
              © 2026 Outmate.ai · B2B Intelligence Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your Outmate.ai verification code: {otp}"
    msg["From"] = f"Outmate.ai <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        context = ssl.create_default_context()
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_email, to_email, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_email, to_email, msg.as_string())

        logger.info(f"OTP email sent to {to_email}")
        return True

    except Exception as exc:
        logger.error(f"Failed to send OTP email to {to_email}: {exc}")
        return False
