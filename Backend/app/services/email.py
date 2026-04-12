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


async def send_first_visitor_alert(to_email: str, company_name: str, domain: str, score: int, visitor_name: str = None, visitor_id: str = None) -> bool:
    """Send an alert when the first identified visitor hits the user's website."""
    settings = _get_smtp_settings()
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        return False

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    
    visitor_line = f"Someone from <strong style='color:#f1f5f9;'>{company_name}</strong>"
    if visitor_name:
        visitor_line = f"<strong style='color:#f1f5f9;'>{visitor_name}</strong> from <strong style='color:#f1f5f9;'>{company_name}</strong>"

    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f17;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17;padding:48px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;border:1px solid #334155;">
        <tr>
          <td style="background:linear-gradient(135deg,#10b981,#3b82f6);padding:32px 40px;border-radius:16px 16px 0 0;">
            <div style="font-size:24px;font-weight:700;color:#fff;">First Visitor Identified! 🎉</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="color:#94a3b8;font-size:16px;line-height:1.6;">
              Great news! Your Outmate pixel just captured its first high-intent visitor.
            </p>
            <div style="background:#0f172a;border-radius:12px;padding:24px;margin:24px 0;border:1px border-style:dashed; border-color:#334155;">
               <div style="color:#f1f5f9;font-size:18px;font-weight:600;margin-bottom:8px;">{visitor_line}</div>
               <div style="color:#94a3b8;font-size:14px;">Domain: {domain}</div>
               <div style="color:#10b981;font-size:14px;font-weight:700;margin-top:8px;">ICP Score: {score}/100</div>
            </div>
            <p style="color:#94a3b8;font-size:14px;margin-bottom:24px;">
              Log in to see the full visitor profile, company details, and send personalised outreach.
            </p>
            <a href="https://app.outmate.ai/visitors/{visitor_id or ''}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Visitor Profile</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🚀 First Visitor! {company_name} is on your website"
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
        return True
    except Exception as exc:
        logger.error(f"Failed to send first visitor email: {exc}")
        return False

async def send_developer_invite(to_email: str, workspace_name: str, pixel_key: str, pixel_url: str) -> bool:
    """Send an invitation to a developer with the pixel installation code."""
    settings = _get_smtp_settings()
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        return False

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    
    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:sans-serif;color:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:48px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;">
            <div style="font-size:22px;font-weight:700;color:#fff;">Outmate<span style="color:#a5b4fc;">.ai</span></div>
            <div style="font-size:14px;color:#c4b5fd;margin-top:4px;">Technical Integration Request</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="color:#f1f5f9;font-size:16px;line-height:1.6;margin-top:0;">
              Hello,
            </p>
            <p style="color:#94a3b8;font-size:15px;line-height:1.6;">
              Someone from the <strong>{workspace_name}</strong> team has invited you to install the Outmate.ai Tracking Pixel on their website.
            </p>
            
            <div style="margin:32px 0;">
              <p style="color:#f1f5f9;font-size:14px;font-weight:700;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Installation Snippet</p>
              <div style="background:#020617;border-radius:12px;padding:24px;border:1px solid #4f46e5;font-family:'Courier New',monospace;font-size:13px;color:#818cf8;line-height:1.5;overflow-x:auto;">
                &lt;!-- Outmate.ai Tracking --&gt;<br>
                &lt;script src="{pixel_url}"<br>
                &nbsp;&nbsp;data-pixel-key="{pixel_key}"<br>
                &nbsp;&nbsp;async&gt;&lt;/script&gt;
              </div>
            </div>

            <p style="color:#f1f5f9;font-size:14px;font-weight:700;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Instructions</p>
            <ul style="color:#94a3b8;font-size:14px;line-height:1.6;padding-left:20px;margin-bottom:32px;">
              <li>Place the snippet inside the <strong>&lt;head&gt;</strong> section of your website.</li>
              <li>It will start tracking corporate visitors automatically.</li>
              <li>The script is lightweight and executes asynchronously to ensure zero impact on page speed.</li>
            </ul>

            <div style="text-align:center;">
              <p style="color:#94a3b8;font-size:12px;">Technical documentation is available within the Outmate platform once you log in.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#111827;border-top:1px solid #334155;">
            <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
              Need help? Reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Technical Request: Install Outmate Pixel for {workspace_name}"
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
        return True
    except Exception as exc:
        logger.error(f"Failed to send developer invite: {exc}")
        return False

async def send_support_notification(user_email: str, message: str) -> bool:
    """Send a notification to the support team about a new inquiry."""
    settings = _get_smtp_settings()
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        return False

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    support_email = settings.SMTP_FROM_EMAIL or "support@outmate.ai"
    
    html_body = f"""<!DOCTYPE html>
<html>
<body style="background:#f8fafc;padding:40px;font-family:sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:40px;border-radius:12px;border:1px solid #e2e8f0;">
    <h2 style="color:#1e293b;margin-top:0;">New Support Inquiry</h2>
    <p style="color:#64748b;">From: <strong>{user_email}</strong></p>
    <div style="background:#f1f5f9;padding:24px;border-radius:8px;color:#334155;line-height:1.6;margin:24px 0;">
      {message}
    </div>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:32px 0;">
    <p style="font-size:12px;color:#94a3b8;text-align:center;">Outmate.ai Support System</p>
  </div>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Support Inquiry from {user_email}"
    msg["From"] = f"Outmate.ai <{from_email}>"
    msg["To"] = support_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, support_email, msg.as_string())
        return True
    except Exception as exc:
        logger.error(f"Failed to send support notification: {exc}")
        return False

async def send_booking_confirmation(user_email: str, slot: str, meet_link: str = None) -> bool:
    """Send a confirmation email to the user for their booking, with Meet link if available."""
    settings = _get_smtp_settings()
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        return False

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER

    if meet_link:
        meet_section = f"""
    <div style="text-align:center;margin:24px 0;">
      <a href="{meet_link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">
        Join Google Meet
      </a>
      <p style="color:#6b7280;font-size:12px;margin-top:12px;">
        Or paste this link: <a href="{meet_link}" style="color:#4f46e5;">{meet_link}</a>
      </p>
    </div>
    <p style="color:#6b7280;font-size:14px;line-height:1.5;text-align:center;">
      A calendar invite has been added to your Google Calendar.
    </p>"""
    else:
        meet_section = """
    <p style="color:#6b7280;font-size:14px;line-height:1.5;text-align:center;">
      Our team will send you a meeting link shortly via email.
    </p>"""

    html_body = f"""<!DOCTYPE html>
<html>
<body style="background:#f3f4f6;padding:40px;font-family:sans-serif;">
  <div style="max-width:500px;margin:0 auto;background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="background:#4f46e5;width:64px;height:64px;border-radius:32px;display:flex;align-items:center;justify-content:center;margin:0 auto;">
        <span style="font-size:32px;color:#fff;">&#128197;</span>
      </div>
    </div>
    <h2 style="text-align:center;color:#111827;margin-top:0;">Session Confirmed</h2>
    <p style="text-align:center;color:#4b5563;font-size:16px;">We've scheduled your 1:1 GTM strategy session.</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:20px;border-radius:12px;text-align:center;margin:32px 0;">
      <div style="font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Date &amp; Time</div>
      <div style="font-size:20px;font-weight:700;color:#111827;">{slot}</div>
    </div>

    {meet_section}
  </div>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Confirmed: Your GTM Session ({slot})"
    msg["From"] = f"Outmate.ai <{from_email}>"
    msg["To"] = user_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, user_email, msg.as_string())
        return True
    except Exception as exc:
        logger.error(f"Failed to send booking confirmation: {exc}")
        return False
