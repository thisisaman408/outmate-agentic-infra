"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Copy, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react"
import {
  settingsApi,
  type UserProfile,
  type WorkspaceSettings,
  type APIKey,
  type NotificationSettings,
} from "@/lib/api/settings"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { IntegrationsStep } from "@/components/onboarding/integrations-step"
import { Zap } from "lucide-react"

export default function SettingsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Profile
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({ name: "", email: "" })

  // Workspace
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null)
  const [workspaceForm, setWorkspaceForm] = useState({ name: "", billingEmail: "" })

  // API Keys
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  // Notifications
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const [profileData, workspaceData, apiKeysData, notificationsData] = await Promise.all([
        settingsApi.getUserProfile(),
        settingsApi.getWorkspaceSettings(),
        settingsApi.getAPIKeys(),
        settingsApi.getNotificationSettings(),
      ])

      setProfile(profileData)
      setProfileForm({ name: profileData.name, email: profileData.email })

      setWorkspace(workspaceData)
      setWorkspaceForm({ name: workspaceData.name, billingEmail: workspaceData.billingEmail })

      setApiKeys(apiKeysData)
      setNotifications(notificationsData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await settingsApi.updateUserProfile(profileForm)
      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
      fetchSettings()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveWorkspace = async () => {
    setIsSaving(true)
    try {
      await settingsApi.updateWorkspaceSettings(workspaceForm)
      toast({
        title: "Success",
        description: "Workspace settings updated successfully",
      })
      fetchSettings()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update workspace settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateAPIKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a key name",
        variant: "destructive",
      })
      return
    }

    try {
      await settingsApi.createAPIKey(newKeyName)
      toast({
        title: "Success",
        description: "API key created successfully",
      })
      setNewKeyName("")
      fetchSettings()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAPIKey = async (keyId: string) => {
    try {
      await settingsApi.deleteAPIKey(keyId)
      toast({
        title: "Success",
        description: "API key deleted",
      })
      fetchSettings()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      })
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    })
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const handleUpdateNotifications = async (updates: Partial<NotificationSettings>) => {
    try {
      await settingsApi.updateNotificationSettings(updates)
      setNotifications((prev) => (prev ? { ...prev, ...updates } : null))
      toast({
        title: "Success",
        description: "Notification settings updated",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace settings</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Zap className="h-4 w-4 text-orange-400" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Manage your personal account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Badge variant="secondary">{profile?.role}</Badge>
              </div>
              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Settings</CardTitle>
              <CardDescription>Manage your workspace configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace Name</Label>
                <Input
                  id="workspaceName"
                  value={workspaceForm.name}
                  onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Badge variant="default" className="capitalize">
                    {workspace?.plan}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>Team Members</Label>
                  <p className="text-sm font-medium">{workspace?.members} members</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Billing Email</Label>
                <Input
                  id="billingEmail"
                  type="email"
                  value={workspaceForm.billingEmail}
                  onChange={(e) => setWorkspaceForm({ ...workspaceForm, billingEmail: e.target.value })}
                />
              </div>
              <Button onClick={handleSaveWorkspace} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New API Key</CardTitle>
              <CardDescription>Generate a new API key for integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Key name (e.g., Production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
                <Button onClick={handleCreateAPIKey}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API keys for accessing the Outmate API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{key.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(key.createdAt).toLocaleDateString()}
                          {key.lastUsed && ` • Last used ${new Date(key.lastUsed).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAPIKey(key.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                        {visibleKeys.has(key.id) ? key.key : key.key.replace(/./g, "•")}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => toggleKeyVisibility(key.id)}>
                        {visibleKeys.has(key.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleCopyKey(key.key)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notifications?.emailNotifications}
                    onCheckedChange={(checked) => handleUpdateNotifications({ emailNotifications: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Messaging Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive notifications in your messaging channel</p>
                  </div>
                  <Switch
                    checked={notifications?.slackNotifications}
                    onCheckedChange={(checked) => handleUpdateNotifications({ slackNotifications: checked })}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Event Notifications</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Leads</p>
                      <p className="text-sm text-muted-foreground">Get notified when new leads are generated</p>
                    </div>
                    <Switch
                      checked={notifications?.newLeads}
                      onCheckedChange={(checked) => handleUpdateNotifications({ newLeads: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Campaign Updates</p>
                      <p className="text-sm text-muted-foreground">Get updates on campaign performance</p>
                    </div>
                    <Switch
                      checked={notifications?.campaignUpdates}
                      onCheckedChange={(checked) => handleUpdateNotifications({ campaignUpdates: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Signal Alerts</p>
                      <p className="text-sm text-muted-foreground">Get alerted for high-confidence signals</p>
                    </div>
                    <Switch
                      checked={notifications?.signalAlerts}
                      onCheckedChange={(checked) => handleUpdateNotifications({ signalAlerts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Weekly Report</p>
                      <p className="text-sm text-muted-foreground">Receive weekly performance summary</p>
                    </div>
                    <Switch
                      checked={notifications?.weeklyReport}
                      onCheckedChange={(checked) => handleUpdateNotifications({ weeklyReport: checked })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <IntegrationsStep onStatusChange={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
