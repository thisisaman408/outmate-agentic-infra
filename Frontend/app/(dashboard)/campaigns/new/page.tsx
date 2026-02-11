import { CampaignCreationWizard } from "@/components/campaigns/campaign-creation-wizard"

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Campaign</h1>
        <p className="text-muted-foreground">Set up your outreach campaign in a few simple steps</p>
      </div>

      <CampaignCreationWizard />
    </div>
  )
}
