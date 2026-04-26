"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  User, Users, Bell, Shield, Wallet, BarChart3, FileText, 
  Building2, Settings2, Code2, History, AlertTriangle, Key,
  ChevronRight, Save, Upload, Copy, ExternalLink, Mail, Trash2, Loader2, Search
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { settingsApi, type UserProfile, type WorkspaceSettings, type NotificationSettings } from "@/lib/api/settings"

type SettingsNavItem = {
  id: string
  icon: any
  name: string
  badge?: string
  danger?: boolean
}

type SettingsSection = {
  label: string
  items: SettingsNavItem[]
}

const NAV_SECTIONS: SettingsSection[] = [
  {
    label: "Account",
    items: [
      { id: "profile", icon: User, name: "Profile" },
      { id: "team", icon: Users, name: "Team & roles" },
      { id: "notifications", icon: Bell, name: "Notifications" },
      { id: "security", icon: Shield, name: "Security" },
    ],
  },
  {
    label: "Financial",
    items: [
      { id: "billing", icon: Wallet, name: "Plan & billing" },
      { id: "usage", icon: BarChart3, name: "Usage & credits", badge: "78%" },
      { id: "invoices", icon: FileText, name: "Invoices" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "organization", icon: Building2, name: "Organization" },
      { id: "preferences", icon: Settings2, name: "Preferences" },
      { id: "search-settings", icon: Search, name: "Search settings" },
      { id: "api", icon: Code2, name: "API & webhooks" },
      { id: "audit", icon: History, name: "Audit logs" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "byok", icon: Key, name: "API Keys (BYOK)" },
      { id: "danger", icon: AlertTriangle, name: "Danger zone", danger: true }
    ],
  },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null)
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true)
        const [profile, ws, notifs] = await Promise.all([
          settingsApi.getUserProfile(),
          settingsApi.getWorkspaceSettings(),
          settingsApi.getNotificationSettings(),
        ])
        setUserProfile(profile)
        setWorkspace(ws)
        setNotifications(notifs)
      } catch (error) {
        console.error("Failed to load settings:", error)
        toast.error("Failed to load settings")
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleUpdateNotifications = async (updates: Partial<NotificationSettings>) => {
    try {
      const updated = { ...notifications, ...updates } as NotificationSettings
      setNotifications(updated)
      await settingsApi.updateNotificationSettings(updates)
      toast.success("Notification preferences updated")
    } catch (error: any) {
      toast.error(error.message || "Failed to update notifications")
    }
  }

  return (
    <div className="flex h-full bg-background overflow-hidden font-sans">
      {/* Left Navigation */}
      <aside className="w-[280px] shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-8 border-b border-border">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-primary" />
             </div>
             <div>
               <h1 className="text-xl font-black tracking-tight text-foreground">Settings</h1>
               <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Live Sync On
               </div>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto no-scrollbar p-6">
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.label} className="mb-8 last:mb-0">
              <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-4">
                {sec.label}
              </h3>
              <div className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon
                  const active = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all group relative",
                        active 
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                          : item.danger 
                            ? "text-red-500 hover:bg-red-500/5 hover:text-red-600" 
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", active ? "text-primary-foreground" : "text-muted-foreground/40 group-hover:text-current")} />
                      <span className="flex-1 text-left uppercase tracking-widest leading-none">{item.name}</span>
                      {item.badge && (
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-black",
                          active ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                        )}>
                          {item.badge}
                        </span>
                      )}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-r-full" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 border-t border-border bg-muted/5">
           {loading ? (
             <div className="flex items-center gap-3">
               <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
               <span className="text-[11px] font-medium text-muted-foreground">Loading...</span>
             </div>
           ) : userProfile ? (
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                {userProfile.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                 <div className="text-[11px] font-black text-foreground truncate uppercase tracking-widest">{userProfile.name}</div>
                 <div className="text-[10px] font-bold text-muted-foreground/40 truncate">{workspace?.plan || 'Pro'} Plan</div>
              </div>
           </div>
           ) : null}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto no-scrollbar bg-background">
        <div className="max-w-4xl mx-auto p-12">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm font-medium text-muted-foreground">Loading settings...</p>
             </div>
           ) : (
             <>
               {activeTab === 'profile' && <ProfileSettings userProfile={userProfile} workspace={workspace} />}
               {activeTab === 'team' && <TeamSettings />}
               {activeTab === 'notifications' && <NotificationsSettings notifications={notifications} onUpdate={handleUpdateNotifications} />}
               {activeTab === 'search-settings' && <SearchSettings />}
               {activeTab === 'byok' && <BYOKSettings />}
               {(activeTab !== 'profile' && activeTab !== 'team' && activeTab !== 'notifications' && activeTab !== 'search-settings' && activeTab !== 'byok') && (
                 <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <div className="w-16 h-16 rounded-3xl bg-muted/10 border border-border border-dashed flex items-center justify-center mb-6">
                       <Settings2 className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-foreground uppercase tracking-widest">{activeTab} section</h2>
                    <p className="text-xs font-medium text-muted-foreground/40 mt-2">Section content placeholder. Components will be dynamically loaded here.</p>
                    <Button variant="outline" className="mt-8 h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl border-border" onClick={() => setActiveTab('profile')}>
                       Return to Profile
                    </Button>
                 </div>
               )}
             </>
           )}
        </div>
      </main>
    </div>
  )
}

function ProfileSettings({ userProfile, workspace }: { userProfile: UserProfile | null; workspace: WorkspaceSettings | null }) {
  const [name, setName] = useState(userProfile?.name || "")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(userProfile?.name || "")
  }, [userProfile])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await settingsApi.updateUserProfile({ name })
      toast.success("Profile updated successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Profile Settings
        </CardTitle>
        <CardDescription>
          Manage your personal identity and workspace preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-xl font-black">
              {userProfile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold">{userProfile?.name}</h3>
            <p className="text-sm text-muted-foreground">{userProfile?.role || 'Member'} · {workspace?.name || 'Workspace'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <Input value={userProfile?.email || ''} disabled />
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function NotificationsSettings({ 
  notifications, 
  onUpdate 
}: { 
  notifications: NotificationSettings | null
  onUpdate: (updates: Partial<NotificationSettings>) => void 
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Control how and when you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium">Channel Preferences</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch
                checked={notifications?.emailNotifications}
                onCheckedChange={(checked) => onUpdate({ emailNotifications: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Slack Notifications</p>
                <p className="text-sm text-muted-foreground">Get notified in Slack</p>
              </div>
              <Switch
                checked={notifications?.slackNotifications}
                onCheckedChange={(checked) => onUpdate({ slackNotifications: checked })}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <h4 className="font-medium">Event Notifications</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">New Leads</p>
                <p className="text-sm text-muted-foreground">Get notified when new leads are generated</p>
              </div>
              <Switch
                checked={notifications?.newLeads}
                onCheckedChange={(checked) => onUpdate({ newLeads: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Campaign Updates</p>
                <p className="text-sm text-muted-foreground">Get updates on campaign performance</p>
              </div>
              <Switch
                checked={notifications?.campaignUpdates}
                onCheckedChange={(checked) => onUpdate({ campaignUpdates: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Signal Alerts</p>
                <p className="text-sm text-muted-foreground">Get alerted for high-confidence signals</p>
              </div>
              <Switch
                checked={notifications?.signalAlerts}
                onCheckedChange={(checked) => onUpdate({ signalAlerts: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Report</p>
                <p className="text-sm text-muted-foreground">Receive weekly performance summary</p>
              </div>
              <Switch
                checked={notifications?.weeklyReport}
                onCheckedChange={(checked) => onUpdate({ weeklyReport: checked })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BYOKSettings() {
  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase tracking-widest mb-2">API Keys (BYOK)</h2>
        <p className="text-sm font-medium text-muted-foreground/60">Bring Your Own Keys - Manage your API keys for external services.</p>
      </header>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl shadow-black/5 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Key className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight uppercase tracking-widest">Bring Your Own Keys</h3>
            <p className="text-sm text-muted-foreground">Manage your API keys for external services like OpenAI, CrustData, etc.</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-2xl p-8 border border-dashed border-border">
          <p className="text-center text-muted-foreground text-sm">
            BYOK management interface coming soon...
          </p>
        </div>
      </div>
    </div>
  )
}

function TeamSettings() {
  const members = [
    { name: "Gautam Singh", role: "Owner", email: "gautam@outmate.ai", status: "Active", initials: "GS" },
    { name: "Saurabh Mishra", role: "Admin", email: "saurabh@outmate.ai", status: "Active", initials: "SM" },
    { name: "Abhinav Gupta", role: "Member", email: "abhinav@outmate.ai", status: "Active", initials: "AG" },
    { name: "Vatsal Sharma", role: "Member", email: "vatsal@outmate.ai", status: "Invited", initials: "VS" },
  ]

  return (
    <div className="space-y-12">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase tracking-widest mb-2">Team & Roles</h2>
          <p className="text-sm font-medium text-muted-foreground/60">Manage your workspace collaborators and their access levels.</p>
        </div>
        <Button className="h-11 px-8 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20">
           + Invite User
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {members.map((member) => (
          <div key={member.email} className="group bg-card border border-border rounded-3xl p-6 flex items-center gap-6 transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-black/5">
             <div className="w-14 h-14 rounded-2xl bg-muted/50 border border-border flex items-center justify-center text-sm font-black text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                {member.initials}
             </div>
             <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                   <h3 className="text-[15px] font-black tracking-tight text-foreground truncate uppercase tracking-widest">{member.name}</h3>
                   <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border-transparent px-2",
                     member.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500')}>
                     {member.status}
                   </Badge>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground/60">
                   <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {member.email}</span>
                   <span className="w-1 h-1 rounded-full bg-border" />
                   <span className="flex items-center gap-1.5 uppercase tracking-widest text-[10px]">{member.role}</span>
                </div>
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground/30 hover:text-foreground rounded-xl hover:bg-muted transition-all">
                   <Settings2 className="w-4 h-4" />
                </Button>
                {member.role !== 'Owner' && (
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-red-500/30 hover:text-red-500 rounded-xl hover:bg-red-500/5 transition-all">
                     <Trash2 className="w-4 h-4" />
                  </Button>
                )}
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SearchSettings() {
  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase tracking-widest mb-2">Search Settings</h2>
        <p className="text-sm font-medium text-muted-foreground/60">Configure your search preferences and default filters.</p>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              People Search
            </CardTitle>
            <CardDescription>
              Default settings for prospect and people searches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Default Filters</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Include similar titles</p>
                    <p className="text-sm text-muted-foreground">Automatically match related job titles</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Include remote workers</p>
                    <p className="text-sm text-muted-foreground">Show remote candidates in location results</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Include subsidiaries</p>
                    <p className="text-sm text-muted-foreground">Match parent and subsidiary companies</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h4 className="font-medium">Search Results</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Results per page</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                    <option>25</option>
                    <option>50</option>
                    <option>100</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default sort order</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                    <option>Relevance</option>
                    <option>Recently Updated</option>
                    <option>Company Size</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Company Search
            </CardTitle>
            <CardDescription>
              Default settings for company searches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Company Filters</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Include inactive companies</p>
                    <p className="text-sm text-muted-foreground">Show companies with no recent activity</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Exclude personal profiles</p>
                    <p className="text-sm text-muted-foreground">Filter out individual profiles</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="h-11 px-8 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}