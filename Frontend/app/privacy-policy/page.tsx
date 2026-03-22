// Frontend/app/privacy-policy/page.tsx
import React from "react"

export const metadata = {
  title: "Privacy Policy – Outmate",
  description: "Outmate Privacy Policy",
}

const PrivacyPolicyPage = () => (
  <main className="mx-auto max-w-5xl p-8 prose prose-slate prose-headings:text-slate-900 prose-a:text-blue-600">
    <h1>Outmate Privacy Policy</h1>
    <p><strong>Effective Date:</strong> March 22, 2026</p>

    <h2>1. Overview</h2>
    <p>
      Outmate ("Outmate", "we", "us", "our") operates a business intelligence platform for
      B2B lead discovery, enrichment, and outreach automation. We respect your privacy and are
      committed to protecting your personal data in accordance with global privacy standards.
    </p>
    <p>
      By using our services, you consent to the processing described in this policy. If you do not
      agree, please do not use the service.
    </p>

    <h2>2. Contact</h2>
    <p>
      Send privacy questions, access requests, or deletion requests to:
      <a href="mailto:gautam.singh@outmate.ai">gautam.singh@outmate.ai</a>.
    </p>

    <h2>3. Data Collected</h2>
    <h3>3.1 Account & Authentication</h3>
    <ul>
      <li>Email address, full name, company, job title</li>
      <li>Password hash (hashed via pbkdf2-sha256), JWT tokens</li>
      <li>Google OAuth data: user ID, profile claims, email verification status</li>
      <li>Terms acceptance, subscription state, credits balance</li>
    </ul>

    <h3>3.2 Usage & Behavior</h3>
    <ul>
      <li>IP address, browser, OS, device type, session timestamps</li>
      <li>Page actions, search and filter activity, feature usage</li>
      <li>Error logs and application event data</li>
    </ul>

    <h3>3.3 Prospect / Company Data</h3>
    <ul>
      <li>Data imported or generated in the platform (contact info, firmographics, technographics, signals)</li>
      <li>Enrichment details, scores, source metadata</li>
      <li>Vector embeddings for similarity search (pgvector)</li>
    </ul>

    <h3>3.4 Third-Party Integrations</h3>
    <ul>
      <li>Authentication via Google OAuth</li>
      <li>Provider integrations (Crustdata, Explorium, ContactOut, etc.)</li>
      <li>Optional Gmail send scope: <code>https://www.googleapis.com/auth/gmail.send</code></li>
    </ul>

    <h2>4. Purpose & Legal Basis</h2>
    <p>We use your data to:</p>
    <ul>
      <li>Create and manage user accounts</li>
      <li>Authenticate and authorize access (security enforcement)</li>
      <li>Deliver features, search results, and enriched data</li>
      <li>Support operations, billing, and customer support</li>
      <li>Improve the product and perform analytics</li>
      <li>Comply with legal obligations</li>
    </ul>

    <h2>5. Data Sharing</h2>
    <h3>5.1 With service providers</h3>
    <p>Data is shared with subprocessors under contract and security controls, including:</p>
    <ul>
      <li>Cloud hosting (database, servers, cache)</li>
      <li>Email delivery providers</li>
      <li>Analytics and monitoring tools</li>
      <li>Payment processors</li>
      <li>Data enrichment vendors</li>
    </ul>

    <h3>5.2 Legal requirements</h3>
    <p>We may disclose personal data to comply with applicable law, enforce our terms, and respond to law enforcement requests.</p>

    <h3>5.3 Business transfers</h3>
    <p>If the company is acquired or reorganized, user data may be part of the transaction with notice provided to users.</p>

    <h2>6. Data Retention</h2>
    <p>We retain data as long as necessary to provide service, meet legal obligations, resolve disputes, enforce our agreements, and improve our product.</p>
    <ul>
      <li>Account data: until deletion + 2 years</li>
      <li>Logs and audit trails: generally 90 days to 2 years</li>
      <li>Billing records: 7 years</li>
      <li>Enrichment records: 1-3 years depending on plan and legal requirements</li>
    </ul>

    <h2>7. Security</h2>
    <ul>
      <li>HTTPS/TLS everywhere</li>
      <li>Strong password hashing and token management</li>
      <li>SQL parameterization and input validation</li>
      <li>Rate limiting on auth endpoints</li>
      <li>Monitoring for unusual activity and incident response</li>
    </ul>

    <h2>8. Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li>Access and correct your personal data</li>
      <li>Request deletion (subject to legal obligations)</li>
      <li>Obtain a copy of your data in machine-readable form</li>
      <li>Object to certain processing and request portability</li>
    </ul>
    <p>Submit requests to <a href="mailto:gautam.singh@outmate.ai">gautam.singh@outmate.ai</a>. We respond under applicable law (e.g., 30 days for GDPR).</p>

    <h2>9. Google OAuth Details</h2>
    <p>We use Google OAuth for login and optional Gmail send capability.</p>
    <ul>
      <li>Required scopes: <code>openid</code>, <code>email</code>, <code>profile</code></li>
      <li>Optional scope: <code>https://www.googleapis.com/auth/gmail.send</code></li>
      <li>Google token verification uses <code>oauth2.googleapis.com/tokeninfo</code></li>
      <li>Google tokens are stored securely and can be revoked anytime in Google Account settings</li>
    </ul>

    <h2>10. Cookies & Tracking</h2>
    <p>We use cookies and local storage for:</p>
    <ul>
      <li>Authentication sessions</li>
      <li>UX preferences and app state</li>
      <li>Analytics and functional behavior (with consent)</li>
    </ul>

    <h2>11. Children</h2>
    <p>Our platform is not intended for users under 16 years old. We do not knowingly collect data from minors.</p>

    <h2>12. Changes to This Policy</h2>
    <p>We may modify this policy and will notify users through app notices and email when significant changes occur.</p>

    <h2>13. Contact</h2>
    <p>
      Email: <a href="mailto:gautam.singh@outmate.ai">gautam.singh@outmate.ai</a><br/>
      Support: <a href="mailto:gautam.singh@outmate.ai">gautam.singh@outmate.ai</a>
    </p>
  </main>
)

export default PrivacyPolicyPage