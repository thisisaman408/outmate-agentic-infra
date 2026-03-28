"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { X, Loader2, Mail, Calendar, Search, Users, AlertCircle, Shield, Target, Eye, TrendingUp, Zap, MessageSquare } from "lucide-react"
import { useCopilotPanelStore } from "@/hooks/use-copilot-panel"


const actions = [
  {
    id: "draft_email",
    name: "Draft Email",
    description: "Generate a personalized email draft",
    icon: Mail,
    credits: 1,
  },
  {
    id: "meeting_prep",
    name: "Meeting Prep",
    description: "Prepare for your meeting with insights",
    icon: Calendar,
    credits: 2,
  },
  {
    id: "research",
    name: "Research",
    description: "Deep dive into prospect background",
    icon: Search,
    credits: 2,
  },
  {
    id: "find_similar",
    name: "Find Similar",
    description: "Discover similar prospects",
    icon: Users,
    credits: 1,
  },
  {
    id: "objection_handler",
    name: "Objection Handler",
    description: "Handle common sales objections",
    icon: AlertCircle,
    credits: 1,
  },
  {
    id: "compliance_oracle",
    name: "Compliance Oracle",
    description: "Ensure compliance in outreach",
    icon: Shield,
    credits: 1,
  },
  {
    id: "business_intent",
    name: "Business Intent",
    description: "Analyze business signals",
    icon: Target,
    credits: 2,
  },
  {
    id: "talent_radar",
    name: "Talent Radar",
    description: "Spot talent hiring signals",
    icon: Eye,
    credits: 2,
  },
  {
    id: "virality_engine",
    name: "Virality Engine",
    description: "Create viral content strategies",
    icon: TrendingUp,
    credits: 1,
  },
  {
    id: "regime_shifter",
    name: "Regime Shifter",
    description: "Navigate changing landscapes",
    icon: Zap,
    credits: 2,
  },
  {
    id: "website_traffic",
    name: "Website Traffic",
    description: "Analyze website traffic patterns",
    icon: TrendingUp,
    credits: 1,
  },
  {
    id: "social_post_analysis",
    name: "Social Post Analysis",
    description: "Analyze social media engagement",
    icon: MessageSquare,
    credits: 1,
  },
]

export function CopilotPanel() {
  const { isPanelOpen, selectedProspect, closePanel } = useCopilotPanelStore()
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set())

  if (!isPanelOpen || !selectedProspect) return null

  const handleAction = async (actionId: string) => {
    setLoadingActions(prev => new Set([...prev, actionId]))

    try {
      console.log(`Executing ${actionId} for prospect:`, selectedProspect.name)
      
      // Simulate 2-second processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log(`${actionId} completed successfully`)
      
    } catch (error) {
      console.error(`Error executing ${actionId}:`, error)
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(actionId)
        return newSet
      })
    }
  }

  const currentEmployer = selectedProspect.current_employers?.[0]
  const displayName = selectedProspect.name || "Unknown"
  const initials = displayName.split(" ").filter((n: string) => n.trim()).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "UN"
  const profileUrl = selectedProspect.linkedin_profile_url || selectedProspect.flagship_profile_url

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <div className="text-2xl">🤖</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Lead Copilot</h2>
              <p className="text-sm text-gray-600">AI Intelligence</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePanel}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Prospect Info */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={selectedProspect.profile_picture_url} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{displayName}</h3>
              <p className="text-sm text-gray-600">
                {currentEmployer?.title || "N/A"} at {currentEmployer?.name || "N/A"}
              </p>
              <p className="text-xs text-gray-500">
                {selectedProspect.location_details?.city}, {selectedProspect.location_details?.country}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs">
                {selectedProspect.num_of_connections || 0} connections
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actions.map((action) => {
              const Icon = action.icon
              const isLoading = loadingActions.has(action.id)

              return (
                <Card key={action.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isLoading ? 'bg-gray-100' : 'bg-blue-50'}`}>
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        ) : (
                          <Icon className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {action.name}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {action.description}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-500">
                            {action.credits} credit{action.credits !== 1 ? 's' : ''}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleAction(action.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? "Processing..." : "Run"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
