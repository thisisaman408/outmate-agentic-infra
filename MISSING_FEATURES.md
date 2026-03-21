# Audit: Outmate Features to be Integrated into Copilot

The following features are already **applied in the Outmate infrastructure** (Backend services/routes exist) but are **missing from the Copilot interface**.

## 1. GTM Specialized Agents (from `GTMAgentsService`)
- [ ] **Crossfire Intelligence**: Integrate competitive research into Copilot. Allow users to ask "How do we beat [Competitor]?" and get a battle card.
- [ ] **Compliance Oracle**: Add an "Audit for Compliance" button to the Draft Email action to check GDPR/CAN-SPAM.
- [ ] **Virality Engine**: Suggest referral hooks based on the lead's role and company champions.
- [ ] **Talent Radar**: Monitor key accounts for executive churn and alert the user in the "Pipeline Risk" panel.
- [ ] **Regime Shifter**: Provide macro-economic context for "Daily Briefs" (e.g., how a new regulation affects the lead's industry).

## 2. Advanced Intelligence Signals (from `SignalDetectionService`)
- [ ] **Bombora Intent Data**: Show "Researching Topics" in the Lead Context panel. Costs **2 credits** to fetch.
- [ ] **Website Traffic Analysis**: Show growth/decline in lead's website traffic as a conversation hook.
- [ ] **Real-time Business Events**: Inject Funding, IPO, and M&A alerts into the "Meeting Prep" brief.
- [ ] **Firmographic Growth**: Track employee headcount trends to identify "Fast Growing" accounts.

## 3. Bulk Table Intelligence (UI Transitions)
- [ ] **Analyse Email Fill Rate**: Scan the entire Enrichment Table to find missing data points.
- [ ] **Bulk Verify Email**: Use existing validation logic to refresh "Stale" emails in the table.
- [ ] **AI Columns**: Automatically populate "Company Briefs" or "Persona Matches" for all rows in a view.

## 4. Advanced Lead Personalization
- [ ] **LinkedIn Post Ingestion**: (Already identified) Connect existing `Crustdata` post-fetching to Copilot prompts.
- [ ] **Executive Insights**: Use the `Unipile` and `Crustdata` data to generate a "Personality Profile" for CXOs.

---

## 💰 Updated Credit Strategy (Applied + Planned)
| Action | Status | Cost |
| :--- | :--- | :--- |
| **Crossfire Intelligence** | Applied in Backend | **2 Credits** |
| **Compliance Audit** | Applied in Backend | **1 Credit** |
| **Bombora Intent Lookup** | Applied in Backend | **2 Credits** |
| **Website Traffic Data** | Applied in Backend | **1 Credit** |
| **LinkedIn Post Analysis** | Applied in Backend | **2 Credits** |
| **Executive Churn (Radar)** | Applied in Backend | **2 Credits** |
| **Bulk AI Column (Per Row)**| Planned | **1 Credit** |
| **Table Data Fill Audit** | Planned | **5 Credits** |

---
*Status "Applied in Backend" means the service code exists but is not currently used by the /api/copilot routes.*
