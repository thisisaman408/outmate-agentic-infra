"use client"

import React, { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  User, Users, Bell, Shield, Wallet, BarChart3, FileText, 
  Building2, Settings2, Code2, History, AlertTriangle,
  ChevronRight, Save, Upload, Copy, ExternalLink, Mail, Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
      { id: "api", icon: Code2, name: "API & webhooks" },
      { id: "audit", icon: History, name: "Audit logs" },
    ],
  },
  {
    label: "System",
    items: [{ id: "danger", icon: AlertTriangle, name: "Danger zone", danger: true }],
  },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")

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
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg">GS</div>
              <div className="flex-1 min-w-0">
                 <div className="text-[11px] font-black text-foreground truncate uppercase tracking-widest">Gautam Singh</div>
                 <div className="text-[10px] font-bold text-muted-foreground/40 truncate">Growth Plan</div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto no-scrollbar bg-background">
        <div className="max-w-4xl mx-auto p-12">
           {activeTab === 'profile' && <ProfileSettings />}
           {activeTab === 'team' && <TeamSettings />}
           {(activeTab !== 'profile' && activeTab !== 'team') && (
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
        </div>
      </main>
    </div>
  )
}

function ProfileSettings() {
  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase tracking-widest mb-2">Profile Settings</h2>
        <p className="text-sm font-medium text-muted-foreground/60">Manage your personal identity, roles, and preferences across Outmate.</p>
      </header>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl shadow-black/5">
        <div className="p-8">
           <div className="flex items-center gap-8 mb-10 pb-10 border-b border-border">
              <div className="relative group">
                 <div className="w-24 h-24 rounded-[32px] bg-primary text-white flex items-center justify-center text-2xl font-black shadow-2xl shadow-primary/40 group-hover:scale-105 transition-transform duration-500">GS</div>
                 <button className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-white text-foreground shadow-xl border border-border flex items-center justify-center hover:bg-muted transition-all active:scale-95">
                    <Upload className="w-4 h-4" />
                 </button>
              </div>
              <div>
                 <h3 className="text-lg font-black tracking-tight text-foreground uppercase tracking-widest">Gautam Singh</h3>
                 <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1 opacity-60">Account Holder · Administrator</p>
                 <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-xl border-border">Change Photo</Button>
                    <Button variant="ghost" size="sm" className="h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-xl text-red-500 hover:bg-red-500/5">Remove</Button>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Full Name</label>
                    <Input defaultValue="Gautam Singh" className="h-12 bg-muted/20 border-transparent focus:bg-background focus:ring-0 text-sm font-bold rounded-2xl" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Email Address</label>
                    <Input defaultValue="gautam@outmate.ai" disabled className="h-12 bg-muted/40 border-transparent text-sm font-bold rounded-2xl opacity-60" />
                 </div>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Organization Role</label>
                    <Input defaultValue="Chief Executive Officer" className="h-12 bg-muted/20 border-transparent focus:bg-background focus:ring-0 text-sm font-bold rounded-2xl" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Timezone</label>
                    <div className="h-12 bg-muted/20 border border-transparent rounded-2xl flex items-center px-4 text-sm font-bold text-foreground">
                       (GMT+5:30) Asia/Kolkata
                       <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/30" />
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="px-8 py-6 bg-muted/10 border-t border-border flex items-center justify-between">
           <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <p className="text-[10px] font-bold text-muted-foreground/60">Changes will apply across all linked Outmate organizations.</p>
           </div>
           <Button className="h-11 px-8 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
           </Button>
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
