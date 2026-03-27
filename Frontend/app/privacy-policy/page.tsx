// Frontend/app/privacy-policy/page.tsx
import React from "react"
import { Navbar } from "@/components/website/navbar"
import { Footer } from "@/components/website/footer"

export const metadata = {
  title: "Privacy Policy – Outmate",
  description: "Outmate Privacy Policy",
}

const PrivacyPolicyPage = () => (
  <div className="bg-[#0A0A1A] min-h-screen">
    <Navbar />
    <main className="pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-lg">
            Effective Date: March 22, 2026
          </p>
        </div>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Overview</h2>
            <p className="mb-4">
              Outmate ("Outmate", "we", "us", "our") operates a business intelligence platform for
              B2B lead discovery, enrichment, and outreach automation. We respect your privacy and are
              committed to protecting your personal data in accordance with global privacy standards.
            </p>
            <p>
              By using our services, you consent to the processing described in this policy. If you do not
              agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Contact</h2>
            <p>
              Send privacy questions, access requests, or deletion requests to:{" "}
              <a
                href="mailto:gautam.singh@outmate.ai"
                className="text-primary hover:text-primary/80 underline"
              >
                gautam.singh@outmate.ai
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Data Collected</h2>

            <h3 className="text-xl font-medium text-white mb-3">3.1 Account & Authentication</h3>
            <ul className="list-disc list-inside mb-6 space-y-1">
              <li>Email address, full name, company, job title</li>
              <li>Password hash (hashed via pbkdf2-sha256), JWT tokens</li>
              <li>Google OAuth data: user ID, profile claims, email verification status</li>
              <li>Terms acceptance, subscription state, credits balance</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3">3.2 Usage & Behavior</h3>
            <ul className="list-disc list-inside mb-6 space-y-1">
              <li>IP address, browser, OS, device type, session timestamps</li>
              <li>Page actions, search and filter activity, feature usage</li>
              <li>Error logs and application event data</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3">3.3 Prospect / Company Data</h3>
            <ul className="list-disc list-inside mb-6 space-y-1">
              <li>Data imported or generated in the platform (contact info, firmographics, technographics, signals)</li>
              <li>Enrichment details, scores, source metadata</li>
              <li>Vector embeddings for similarity search (pgvector)</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3">3.4 Third-Party Integrations</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Authentication via Google OAuth</li>
              <li>Provider integrations (Crustdata, Explorium, ContactOut, etc.)</li>
              <li>Optional email send scope: <code className="bg-muted px-2 py-1 rounded text-sm">https://www.googleapis.com/auth/gmail.send</code></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Purpose & Legal Basis</h2>
            <p className="mb-4">We use your data to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Create and manage user accounts</li>
              <li>Authenticate and authorize access (security enforcement)</li>
              <li>Deliver features, search results, and enriched data</li>
              <li>Support operations, billing, and customer support</li>
              <li>Improve the product and perform analytics</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Sharing</h2>

            <h3 className="text-xl font-medium text-white mb-3">5.1 With service providers</h3>
            <p className="mb-4">Data is shared with subprocessors under contract and security controls, including:</p>
            <ul className="list-disc list-inside mb-6 space-y-1">
              <li>Cloud hosting (database, servers, cache)</li>
              <li>Email delivery providers</li>
              <li>Analytics and monitoring tools</li>
              <li>Payment processors</li>
              <li>Data enrichment vendors</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3">5.2 Legal requirements</h3>
            <p className="mb-4">We may disclose personal data to comply with applicable law, enforce our terms, and respond to law enforcement requests.</p>

            <h3 className="text-xl font-medium text-white mb-3">5.3 Business transfers</h3>
            <p>If the company is acquired or reorganized, user data may be part of the transaction with notice provided to users.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p className="mb-4">We retain data as long as necessary to provide service, meet legal obligations, resolve disputes, enforce our agreements, and improve our product.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Account data: until deletion + 2 years</li>
              <li>Logs and audit trails: generally 90 days to 2 years</li>
              <li>Billing records: 7 years</li>
              <li>Enrichment records: 1-3 years depending on plan and legal requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Security</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>HTTPS/TLS everywhere</li>
              <li>Strong password hashing and token management</li>
              <li>SQL parameterization and input validation</li>
              <li>Rate limiting on auth endpoints</li>
              <li>Monitoring for unusual activity and incident response</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside mb-6 space-y-1">
              <li>Access and correct your personal data</li>
              <li>Request deletion (subject to legal obligations)</li>
              <li>Obtain a copy of your data in machine-readable form</li>
              <li>Object to certain processing and request portability</li>
            </ul>
            <p>
              Submit requests to{" "}
              <a
                href="mailto:gautam.singh@outmate.ai"
                className="text-primary hover:text-primary/80 underline"
              >
                gautam.singh@outmate.ai
              </a>
              . We respond under applicable law (e.g., 30 days for GDPR).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Google OAuth Details</h2>
            <p className="mb-4">We use OAuth for login and optional email send capability.</p>
            <ul className="list-disc list-inside mb-6 space-y-1">
              <li>Required scopes: <code className="bg-muted px-2 py-1 rounded text-sm">openid</code>, <code className="bg-muted px-2 py-1 rounded text-sm">email</code>, <code className="bg-muted px-2 py-1 rounded text-sm">profile</code></li>
              <li>Optional scope: <code className="bg-muted px-2 py-1 rounded text-sm">https://www.googleapis.com/auth/gmail.send</code></li>
              <li>Google token verification uses <code className="bg-muted px-2 py-1 rounded text-sm">oauth2.googleapis.com/tokeninfo</code></li>
              <li>Google tokens are stored securely and can be revoked anytime in Google Account settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Cookies & Tracking</h2>
            <p className="mb-4">We use cookies and local storage for:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Authentication sessions</li>
              <li>UX preferences and app state</li>
              <li>Analytics and functional behavior (with consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Children</h2>
            <p>Our platform is not intended for users under 16 years old. We do not knowingly collect data from minors.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to This Policy</h2>
            <p>We may modify this policy and will notify users through app notices and email when significant changes occur.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Contact</h2>
            <div className="space-y-2">
              <p>
                Email:{" "}
                <a
                  href="mailto:gautam.singh@outmate.ai"
                  className="text-primary hover:text-primary/80 underline"
                >
                  gautam.singh@outmate.ai
                </a>
              </p>
              <p>
                Support:{" "}
                <a
                  href="mailto:gautam.singh@outmate.ai"
                  className="text-primary hover:text-primary/80 underline"
                >
                  gautam.singh@outmate.ai
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
    <Footer />
  </div>
)

export default PrivacyPolicyPage
