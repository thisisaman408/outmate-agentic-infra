import React, { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

/* ─── NAV ─── */
const navSections = [
  {
    label: "ACCOUNT",
    items: [
      { id: "profile", icon: "◉", name: "Profile" },
      { id: "team", icon: "◎", name: "Team & roles" },
      { id: "notifications", icon: "⊟", name: "Notifications" },
      { id: "security", icon: "⊠", name: "Security" },
    ],
  },
  {
    label: "BILLING",
    items: [
      { id: "billing", icon: "⊞", name: "Plan & billing" },
      { id: "usage", icon: "⊙", name: "Usage & credits", badge: "78%" },
      { id: "invoices", icon: "✎", name: "Invoices" },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { id: "organization", icon: "⬡", name: "Organization" },
      { id: "preferences", icon: "⚙", name: "Preferences" },
      { id: "api", icon: "⊛", name: "API & webhooks" },
      { id: "audit", icon: "≡", name: "Audit logs" },
    ],
  },
  {
    label: "DANGER",
    items: [{ id: "danger", icon: "⊠", name: "Danger zone", danger: true }],
  },
];

/* ─── TYPES ─── */
interface TeamMember {
  name: string;
  email: string;
  role: string;
  status: string;
  joined: string;
  initials: string;
}

/* ─── TOGGLE ─── */
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    style={{
      width: 32, height: 18, borderRadius: 9, padding: 2,
      backgroundColor: checked ? "#4F46E5" : "hsl(var(--muted))",
      display: "flex", alignItems: "center", transition: "background .15s", cursor: "pointer", border: "none",
    }}
  >
    <span style={{
      width: 14, height: 14, borderRadius: "50%", backgroundColor: "white",
      transition: "transform .15s", transform: checked ? "translateX(14px)" : "translateX(0)",
      boxShadow: "0 1px 3px rgba(0,0,0,.15)",
    }} />
  </button>
);

/* ─── SECTION HEADER ─── */
const SectionHeader = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif", borderBottom: "1px solid hsl(var(--border))", paddingBottom: 8, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span>{title}</span>
    <div style={{ display: "flex", gap: 8 }}>{children}</div>
  </div>
);

/* ─── ROLE BADGE ─── */
const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    Owner: { bg: "hsl(var(--primary) / .1)", text: "#4F46E5" },
    Admin: { bg: "hsl(var(--amber-light))", text: "hsl(var(--amber-text))" },
    Member: { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))" },
  };
  const c = colors[role] || colors.Member;
  return <span style={{ fontSize: 10, fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: "2px 8px", borderRadius: 6, backgroundColor: c.bg, color: c.text }}>{role}</span>;
};

/* ─── FORM HELPERS ─── */
const FormRow = ({ children, cols = 1 }: { children: React.ReactNode; cols?: number }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 12 }}>
    {children}
  </div>
);

const FormField = ({ label, disabled, value, placeholder, type, onChange }: { label: string; disabled?: boolean; value?: string; placeholder?: string; type?: string; onChange?: (v: string) => void }) => (
  <div>
    <label style={{ fontSize: 11, fontWeight: 500, fontFamily: "'Inter', sans-serif", color: "hsl(var(--muted-foreground))", marginBottom: 4, display: "block" }}>{label}</label>
    <Input
      defaultValue={value} placeholder={placeholder} disabled={disabled} type={type || "text"}
      onChange={e => onChange?.(e.target.value)}
      style={{ fontSize: 12, fontFamily: "'Inter', sans-serif", borderColor: "hsl(var(--border-secondary))", borderRadius: "var(--radius)" }}
      className="focus:border-[hsl(var(--info))]"
    />
    {disabled && <span style={{ fontSize: 10, fontFamily: "'Inter', sans-serif", color: "hsl(var(--muted-foreground))", opacity: .7 }}>Contact support to change</span>}
  </div>
);

/* ─── CONFIRMATION DIALOG ─── */
const ConfirmDialog = ({ open, onClose, title, description, actionLabel, danger, onConfirm }: {
  open: boolean; onClose: () => void; title: string; description: string; actionLabel: string; danger?: boolean; onConfirm: () => void;
}) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent style={{ fontFamily: "'Inter', sans-serif", maxWidth: 400 }}>
      <DialogHeader>
        <DialogTitle style={{ fontSize: 15, fontWeight: 500 }}>{title}</DialogTitle>
        <DialogDescription style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter style={{ gap: 8, marginTop: 8 }}>
        <Button variant="ghost" size="sm" onClick={onClose} style={{ fontSize: 11 }}>Cancel</Button>
        <Button size="sm" onClick={() => { onConfirm(); onClose(); }}
          style={{ fontSize: 11, backgroundColor: danger ? "hsl(var(--destructive))" : "#4F46E5", color: "white" }}>
          {actionLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/* ─── MAIN COMPONENT ─── */
const SettingsPage = () => {
  const [active, setActive] = useState("profile");

  /* notification toggles */
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    agentRun: true, signal: true, reply: true, meeting: true, creditLow: true,
    agentError: true, newMember: false, weekly: true, product: false, billing: true,
  });
  const toggleNotif = (k: string) => setNotifs(p => ({ ...p, [k]: !p[k] }));

  /* preference toggles */
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    dark: false, compact: false, animations: true, autoRun: true, copilot: true, usageAlerts: true,
  });
  const togglePref = (k: string) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const [showKey, setShowKey] = useState(false);

  /* Team state */
  const [members, setMembers] = useState<TeamMember[]>([
    { name: "Gautam Singh", email: "gautam@outmate.ai", role: "Owner", status: "Active", joined: "Jan 2025", initials: "GS" },
    { name: "Rithik Kumar", email: "rithik@outmate.ai", role: "Admin", status: "Active", joined: "Feb 2025", initials: "RK" },
    { name: "Mudit Dubey", email: "mudit@outmate.ai", role: "Member", status: "Active", joined: "Mar 2025", initials: "MD" },
    { name: "Sara K.", email: "sara@outmate.ai", role: "Member", status: "Pending", joined: "—", initials: "SK" },
  ]);

  /* Invite dialog */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");

  /* Manage roles dialog */
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<string | null>(null);
  const [roleChangeValue, setRoleChangeValue] = useState("Member");

  /* Confirm dialog */
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; description: string; actionLabel: string; danger?: boolean; onConfirm: () => void }>({
    open: false, title: "", description: "", actionLabel: "", onConfirm: () => {},
  });
  const openConfirm = (title: string, description: string, actionLabel: string, onConfirm: () => void, danger = false) =>
    setConfirmDialog({ open: true, title, description, actionLabel, danger, onConfirm });

  const handleInvite = useCallback(() => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (members.some(m => m.email === inviteEmail.trim())) {
      toast({ title: "Already invited", description: "This email is already on the team.", variant: "destructive" });
      return;
    }
    const initials = inviteEmail.slice(0, 2).toUpperCase();
    setMembers(prev => [...prev, {
      name: inviteEmail.split("@")[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      status: "Pending",
      joined: "—",
      initials,
    }]);
    setInviteEmail("");
    setInviteRole("Member");
    setInviteOpen(false);
    toast({ title: "Invitation sent", description: `Invited ${inviteEmail.trim()} as ${inviteRole}` });
  }, [inviteEmail, inviteRole, members]);

  const handleResend = (email: string) => {
    toast({ title: "Invitation resent", description: `Re-sent invitation to ${email}` });
  };

  const handleRevokeMember = (email: string) => {
    openConfirm("Revoke invitation", `Remove the pending invitation for ${email}?`, "Revoke", () => {
      setMembers(prev => prev.filter(m => m.email !== email));
      toast({ title: "Invitation revoked", description: `Removed invitation for ${email}` });
    }, true);
  };

  const handleRemoveMember = (email: string, name: string) => {
    openConfirm("Remove member", `Remove ${name} from the team? They will lose access immediately.`, "Remove", () => {
      setMembers(prev => prev.filter(m => m.email !== email));
      toast({ title: "Member removed", description: `${name} has been removed from the team` });
    }, true);
  };

  const handleChangeRole = (email: string, newRole: string) => {
    setMembers(prev => prev.map(m => m.email === email ? { ...m, role: newRole } : m));
    toast({ title: "Role updated", description: `Role changed to ${newRole}` });
    setRoleChangeTarget(null);
    setRolesOpen(false);
  };

  const sectionTitles: Record<string, string> = {
    profile: "Profile", team: "Team & Roles", notifications: "Notifications", security: "Security",
    billing: "Plan & Billing", usage: "Usage & Credits", invoices: "Invoices",
    organization: "Organization", preferences: "Preferences", api: "API & Webhooks",
    audit: "Audit Logs", danger: "Danger Zone",
  };

  const headerActions: Record<string, React.ReactNode> = {
    profile: <Button size="sm" onClick={() => toast({ title: "Changes saved", description: "Your profile has been updated." })} style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Save changes</Button>,
    team: <>
      <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={() => setRolesOpen(true)}>Manage roles</Button>
      <Button size="sm" style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={() => setInviteOpen(true)}>Invite member</Button>
    </>,
    notifications: <Button size="sm" onClick={() => toast({ title: "Preferences saved", description: "Notification settings updated." })} style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Save preferences</Button>,
    billing: <>
      <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={() => toast({ title: "Usage limits", description: "Configure limits in your plan settings." })}>Usage limits</Button>
      <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={() => toast({ title: "Usage alerts", description: "Alert thresholds configured." })}>Usage alerts</Button>
    </>,
    usage: <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={() => toast({ title: "Export started", description: "CSV file will be downloaded shortly." })}>Export CSV</Button>,
    invoices: <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={() => toast({ title: "Downloading", description: "All invoices will be downloaded as a ZIP." })}>Download all</Button>,
    organization: <Button size="sm" onClick={() => toast({ title: "Organization saved", description: "Settings updated successfully." })} style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Save changes</Button>,
    preferences: <Button size="sm" onClick={() => toast({ title: "Preferences saved", description: "Workspace settings updated." })} style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Save</Button>,
    api: <Button size="sm" style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, fontFamily: "'Inter', sans-serif" }}
      onClick={() => { toast({ title: "API key created", description: "New key: sk-outmate-••••••••YZ1. Copy it now — it won't be shown again." }); }}>+ New API key</Button>,
    audit: <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={() => toast({ title: "Exporting", description: "Audit log export started." })}>Export</Button>,
  };

  const renderContent = () => {
    switch (active) {
      case "profile": return <ProfileSection />;
      case "team": return <TeamSectionContent members={members} onResend={handleResend} onRevoke={handleRevokeMember} onRemove={handleRemoveMember} onInvite={() => setInviteOpen(true)} />;
      case "notifications": return <NotificationsSection notifs={notifs} toggleNotif={toggleNotif} />;
      case "security": return <SecuritySection />;
      case "billing": return <BillingSection />;
      case "usage": return <UsageSection />;
      case "invoices": return <InvoicesSection />;
      case "organization": return <OrganizationSection />;
      case "preferences": return <PreferencesSection prefs={prefs} togglePref={togglePref} />;
      case "api": return <ApiSection showKey={showKey} setShowKey={setShowKey} />;
      case "audit": return <AuditSection />;
      case "danger": return <DangerSection openConfirm={openConfirm} />;
      default: return null;
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: "hsl(var(--background))", fontFamily: "'Inter', sans-serif" }}>
      {/* LEFT SIDEBAR */}
      <div style={{ width: 220, borderRight: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", backgroundColor: "hsl(var(--card))" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", cursor: "pointer", marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>← Back</div>
          <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: .7, marginBottom: 2, fontFamily: "'Inter', sans-serif" }}>Organization</div>
          <div style={{ fontSize: 13, fontWeight: 500, cursor: "pointer", color: "hsl(var(--foreground))", fontFamily: "'Inter', sans-serif" }}>Outmate ⌄</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }} className="settings-scroll">
          {navSections.map(sec => (
            <div key={sec.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".08em", color: "hsl(var(--muted-foreground))", padding: "6px 14px 4px", opacity: .7, fontFamily: "'Inter', sans-serif" }}>
                {sec.label}
              </div>
              {sec.items.map(item => (
                <div
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", cursor: "pointer",
                    fontSize: 12, fontWeight: active === item.id ? 500 : 400, fontFamily: "'Inter', sans-serif",
                    color: (item as any).danger ? "hsl(var(--destructive))" : active === item.id ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    backgroundColor: active === item.id ? "hsl(var(--secondary))" : "transparent",
                    borderRadius: 6, margin: "0 6px", transition: "background .1s",
                  }}
                  onMouseEnter={e => { if (active !== item.id) (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(var(--secondary))"; }}
                  onMouseLeave={e => { if (active !== item.id) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <span style={{ width: 16, textAlign: "center", fontSize: 11 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  {item.badge && (
                    <span style={{ fontSize: 8, fontWeight: 500, padding: "1px 6px", borderRadius: 6, backgroundColor: "hsl(var(--amber-light))", color: "hsl(var(--amber-text))" }}>
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 24px", borderBottom: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: "'Inter', sans-serif" }}>{sectionTitles[active]}</span>
          <div style={{ display: "flex", gap: 8 }}>{headerActions[active]}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }} className="settings-scroll">
          {renderContent()}
        </div>
      </div>

      {/* INVITE MEMBER DIALOG */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent style={{ fontFamily: "'Inter', sans-serif", maxWidth: 420 }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 15, fontWeight: 500 }}>Invite team member</DialogTitle>
            <DialogDescription style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              Send an invitation to join your Outmate workspace. They'll receive an email with a link to accept.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "hsl(var(--muted-foreground))", marginBottom: 4, display: "block" }}>Email address</label>
              <Input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                style={{ fontSize: 12, fontFamily: "'Inter', sans-serif" }}
                onKeyDown={e => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "hsl(var(--muted-foreground))", marginBottom: 4, display: "block" }}>Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger style={{ fontSize: 12 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin — Full access, can manage team</SelectItem>
                  <SelectItem value="Member">Member — Can use agents and view data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--secondary))", fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>Growth plan</strong> — {members.length} of 10 seats used. {10 - members.length} remaining.
            </div>
          </div>
          <DialogFooter style={{ gap: 8, marginTop: 12 }}>
            <Button variant="ghost" size="sm" onClick={() => setInviteOpen(false)} style={{ fontSize: 11 }}>Cancel</Button>
            <Button size="sm" onClick={handleInvite} style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11 }}>Send invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MANAGE ROLES DIALOG */}
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent style={{ fontFamily: "'Inter', sans-serif", maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 15, fontWeight: 500 }}>Manage roles</DialogTitle>
            <DialogDescription style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              Change team member roles. Owners have full control, Admins can manage members, Members have standard access.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {members.filter(m => m.status === "Active").map(m => (
              <div key={m.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid hsl(var(--border-secondary))" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: m.role === "Owner" ? "#4F46E5" : "hsl(var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: m.role === "Owner" ? "white" : "hsl(var(--muted-foreground))", flexShrink: 0 }}>{m.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{m.email}</div>
                </div>
                {m.role === "Owner" ? (
                  <RoleBadge role="Owner" />
                ) : roleChangeTarget === m.email ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <Select value={roleChangeValue} onValueChange={setRoleChangeValue}>
                      <SelectTrigger style={{ fontSize: 11, height: 28, width: 100 }}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" style={{ fontSize: 10, height: 28, backgroundColor: "#4F46E5", color: "white" }} onClick={() => handleChangeRole(m.email, roleChangeValue)}>Save</Button>
                    <Button size="sm" variant="ghost" style={{ fontSize: 10, height: 28 }} onClick={() => setRoleChangeTarget(null)}>✕</Button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <RoleBadge role={m.role} />
                    <Button variant="ghost" size="sm" style={{ fontSize: 10, height: 24, padding: "0 6px" }} onClick={() => { setRoleChangeTarget(m.email); setRoleChangeValue(m.role); }}>Edit</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter style={{ marginTop: 12 }}>
            <Button variant="ghost" size="sm" onClick={() => { setRolesOpen(false); setRoleChangeTarget(null); }} style={{ fontSize: 11 }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(p => ({ ...p, open: false }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        actionLabel={confirmDialog.actionLabel}
        danger={confirmDialog.danger}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
};

/* ═══════════════════════════════════════════ */
/*                 SECTIONS                    */
/* ═══════════════════════════════════════════ */

/* ─── PROFILE ─── */
const ProfileSection = () => (
  <div style={{ maxWidth: 640 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: 14, borderRadius: "var(--radius)", border: "1px solid hsl(var(--border-secondary))" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#4F46E5", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 500, flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>GS</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: "'Inter', sans-serif" }}>Gautam Singh</div>
        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>gautam@outmate.ai</div>
      </div>
      <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}
        onClick={() => toast({ title: "Upload photo", description: "Photo upload dialog would open here." })}>Change photo</Button>
      <Button variant="ghost" size="sm" style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}
        onClick={() => toast({ title: "Photo removed", description: "Profile photo has been removed." })}>Remove</Button>
    </div>

    <SectionHeader title="Personal information" />
    <FormRow cols={2}>
      <FormField label="First name" value="Gautam" />
      <FormField label="Last name" value="Singh" />
    </FormRow>
    <FormRow><FormField label="Display name" value="Gautam Singh" /></FormRow>
    <FormRow><FormField label="Work email" value="gautam@outmate.ai" disabled /></FormRow>
    <FormRow><FormField label="Role / Title" value="Co-Founder & CEO" /></FormRow>
    <FormRow cols={2}>
      <FormField label="Company" value="Outmate" />
      <FormField label="LinkedIn URL" value="linkedin.com/in/gautamsingh" />
    </FormRow>

    <SectionHeader title="Timezone & language" />
    <FormRow cols={2}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 500, fontFamily: "'Inter', sans-serif", color: "hsl(var(--muted-foreground))", marginBottom: 4, display: "block" }}>Timezone</label>
        <Select defaultValue="asia_kolkata">
          <SelectTrigger style={{ fontSize: 12 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="asia_kolkata">Asia/Kolkata (IST)</SelectItem>
            <SelectItem value="us_eastern">US/Eastern (EST)</SelectItem>
            <SelectItem value="us_pacific">US/Pacific (PST)</SelectItem>
            <SelectItem value="europe_london">Europe/London (GMT)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 500, fontFamily: "'Inter', sans-serif", color: "hsl(var(--muted-foreground))", marginBottom: 4, display: "block" }}>Language</label>
        <Select defaultValue="en">
          <SelectTrigger style={{ fontSize: 12 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="hi">Hindi</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </FormRow>
  </div>
);

/* ─── TEAM ─── */
const TeamSectionContent = ({ members, onResend, onRevoke, onRemove, onInvite }: {
  members: TeamMember[]; onResend: (e: string) => void; onRevoke: (e: string) => void; onRemove: (e: string, n: string) => void; onInvite: () => void;
}) => {
  const pendingMembers = members.filter(m => m.status === "Pending");
  const activeMembers = members.filter(m => m.status === "Active");

  return (
    <div>
      <div style={{ padding: "10px 14px", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--info) / .08)", border: "1px solid hsl(var(--info) / .2)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "hsl(var(--info))", fontFamily: "'Inter', sans-serif" }}>Growth plan — {members.length} of 10 seats used</span>
        <Button size="sm" variant="ghost" style={{ fontSize: 11, color: "#4F46E5", fontFamily: "'Inter', sans-serif" }}
          onClick={() => toast({ title: "Upgrade plan", description: "Redirecting to plan selection..." })}>Upgrade</Button>
      </div>

      <SectionHeader title="Team members" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Member</TableHead>
            <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Role</TableHead>
            <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Status</TableHead>
            <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Joined</TableHead>
            <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeMembers.map(m => (
            <TableRow key={m.email}>
              <TableCell>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: m.role === "Owner" ? "#4F46E5" : "hsl(var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: m.role === "Owner" ? "white" : "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{m.initials}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{m.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell><RoleBadge role={m.role} /></TableCell>
              <TableCell>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "hsl(var(--success))" }} />
                  <span style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Active</span>
                </div>
              </TableCell>
              <TableCell style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{m.joined}</TableCell>
              <TableCell>
                {m.role !== "Owner" && (
                  <Button variant="ghost" size="sm" style={{ fontSize: 10, color: "hsl(var(--destructive))", fontFamily: "'Inter', sans-serif" }}
                    onClick={() => onRemove(m.email, m.name)}>Remove</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pending invitations */}
      <div style={{ marginTop: 20 }}>
        <SectionHeader title="Pending invitations">
          <Button variant="ghost" size="sm" style={{ fontSize: 10, fontFamily: "'Inter', sans-serif" }} onClick={onInvite}>+ Invite more</Button>
        </SectionHeader>
        {pendingMembers.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", border: "1px dashed hsl(var(--border-secondary))", borderRadius: "var(--radius)", color: "hsl(var(--muted-foreground))" }}>
            <div style={{ fontSize: 12, marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>No pending invitations</div>
            <Button variant="outline" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }} onClick={onInvite}>Invite a team member</Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingMembers.map(m => (
              <div key={m.email} style={{ padding: "10px 14px", border: "1px solid hsl(var(--border-secondary))", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "hsl(var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{m.initials}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{m.email}</div>
                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>
                      Invited · {m.role} role
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "hsl(var(--amber))" }} />
                        <span>Pending</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant="ghost" size="sm" style={{ fontSize: 10, fontFamily: "'Inter', sans-serif" }} onClick={() => onResend(m.email)}>Resend</Button>
                  <Button variant="ghost" size="sm" style={{ fontSize: 10, color: "hsl(var(--destructive))", fontFamily: "'Inter', sans-serif" }} onClick={() => onRevoke(m.email)}>Revoke</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── NOTIFICATIONS ─── */
const notifItems = [
  { key: "agentRun", title: "Agent run completed", sub: "Get notified when an agent finishes running" },
  { key: "signal", title: "High-intent signal detected", sub: "Alert when a prospect shows strong buying signals" },
  { key: "reply", title: "Reply received", sub: "Notify when a prospect responds to outreach" },
  { key: "meeting", title: "Meeting booked", sub: "Alert when a meeting is successfully scheduled" },
  { key: "creditLow", title: "Credit balance low", sub: "Warn when credits drop below threshold" },
  { key: "agentError", title: "Agent error", sub: "Alert on agent failures or errors" },
  { key: "newMember", title: "New team member", sub: "Notify when someone joins the workspace" },
  { key: "weekly", title: "Weekly summary", sub: "Weekly digest of all GTM activity" },
  { key: "product", title: "Product updates", sub: "New features and platform updates" },
  { key: "billing", title: "Billing alerts", sub: "Invoice and payment notifications" },
];

const NotificationsSection = ({ notifs, toggleNotif }: { notifs: Record<string, boolean>; toggleNotif: (k: string) => void }) => (
  <div style={{ maxWidth: 580 }}>
    <SectionHeader title="Email notifications" />
    {notifItems.slice(0, 5).map(n => (
      <div key={n.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid hsl(var(--border-secondary))" }}>
        <div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{n.title}</div><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{n.sub}</div></div>
        <ToggleSwitch checked={notifs[n.key]} onChange={() => toggleNotif(n.key)} />
      </div>
    ))}

    <div style={{ marginTop: 20 }}>
      <SectionHeader title="Slack notifications">
        <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>#outmate-alerts</span>
      </SectionHeader>
      {notifItems.slice(5).map(n => (
        <div key={n.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid hsl(var(--border-secondary))" }}>
          <div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{n.title}</div><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{n.sub}</div></div>
          <ToggleSwitch checked={notifs[n.key]} onChange={() => toggleNotif(n.key)} />
        </div>
      ))}
    </div>
  </div>
);

/* ─── SECURITY ─── */
const SecuritySection = () => {
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [sessions, setSessions] = useState([
    { device: "Chrome on macOS", time: "Current session", current: true },
    { device: "Safari on iPhone", time: "2 hours ago", current: false },
  ]);

  return (
    <div style={{ maxWidth: 520 }}>
      <SectionHeader title="Password" />
      <FormRow><FormField label="Current password" type="password" placeholder="••••••••" /></FormRow>
      <FormRow cols={2}>
        <FormField label="New password" type="password" placeholder="••••••••" />
        <FormField label="Confirm new password" type="password" placeholder="••••••••" />
      </FormRow>
      <Button size="sm" style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, marginBottom: 24, fontFamily: "'Inter', sans-serif" }}
        onClick={() => toast({ title: "Password updated", description: "Your password has been changed successfully." })}>Update password</Button>

      <SectionHeader title="Two-factor authentication" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid hsl(var(--border-secondary))", borderRadius: "var(--radius)", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>Authenticator app</div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>
            {twoFaEnabled ? "2FA is enabled — your account is extra secure" : "Use an authenticator app for 2FA codes"}
          </div>
        </div>
        <Button size="sm" variant={twoFaEnabled ? "destructive" : "outline"} style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}
          onClick={() => {
            setTwoFaEnabled(!twoFaEnabled);
            toast({ title: twoFaEnabled ? "2FA disabled" : "2FA enabled", description: twoFaEnabled ? "Two-factor authentication has been disabled." : "Scan the QR code with your authenticator app." });
          }}>
          {twoFaEnabled ? "Disable" : "Enable"}
        </Button>
      </div>

      <SectionHeader title="Active sessions" />
      {sessions.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid hsl(var(--border-secondary))" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{s.device}</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{s.time}</div>
          </div>
          {s.current ? <Badge variant="secondary" style={{ fontSize: 9, fontFamily: "'Inter', sans-serif" }}>Current</Badge> : (
            <Button variant="ghost" size="sm" style={{ fontSize: 10, color: "hsl(var(--destructive))", fontFamily: "'Inter', sans-serif" }}
              onClick={() => {
                setSessions(prev => prev.filter((_, idx) => idx !== i));
                toast({ title: "Session revoked", description: `${s.device} session has been terminated.` });
              }}>Revoke</Button>
          )}
        </div>
      ))}
    </div>
  );
};

/* ─── BILLING ─── */
const BillingSection = () => {
  const [currentPlan, setCurrentPlan] = useState("Growth");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>Outmate</span>
        <span style={{ fontSize: 10, fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: "2px 8px", borderRadius: 6, backgroundColor: "#4F46E5", color: "white" }}>{currentPlan} plan</span>
        <span style={{ fontSize: 12, cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
          onClick={() => toast({ title: "Edit organization", description: "Go to Organization settings to edit." })}>✎</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Credits available", value: "22,400", sub: "of 75,000" },
          { label: "Credits used", value: "52,600", sub: "this cycle" },
          { label: "Seats", value: "4", sub: "of 10" },
          { label: "Agents", value: "8", sub: "active" },
        ].map(s => (
          <div key={s.label} style={{ padding: "12px 14px", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border-secondary))" }}>
            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Plans" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { name: "Starter", price: "$499", credits: "30K credits", seats: "5 seats", desc: "All core agents", current: false, popular: false },
          { name: "Growth", price: "$699", credits: "75K credits", seats: "10 seats", desc: "Priority support", current: false, popular: false },
          { name: "Scale", price: "$799", credits: "150K credits", seats: "Unlimited seats", desc: "Custom integrations", current: false, popular: true },
        ].map(p => {
          const isCurrent = p.name === currentPlan;
          return (
            <div key={p.name} style={{
              padding: "16px", borderRadius: "var(--radius)",
              border: isCurrent ? "1.5px solid #4F46E5" : p.popular ? "1px solid hsl(var(--info))" : "1px solid hsl(var(--border-secondary))",
              backgroundColor: "hsl(var(--card))", position: "relative",
            }}>
              {p.popular && <span style={{ position: "absolute", top: -8, right: 12, fontSize: 9, fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: "2px 8px", borderRadius: 6, backgroundColor: "hsl(var(--info) / .1)", color: "hsl(var(--info))" }}>POPULAR</span>}
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, fontFamily: "'Inter', sans-serif" }}>{p.name}</div>
              <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>{p.price}<span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>/mo</span></div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12, lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
                {p.credits} · {p.seats}<br />{p.desc}
              </div>
              <Button size="sm" variant={isCurrent ? "default" : "outline"} style={{ width: "100%", fontSize: 11, fontFamily: "'Inter', sans-serif", ...(isCurrent ? { backgroundColor: "#4F46E5", color: "white" } : {}) }}
                onClick={() => {
                  if (!isCurrent) {
                    setCurrentPlan(p.name);
                    toast({ title: `Switched to ${p.name}`, description: `Your plan has been changed to ${p.name} at ${p.price}/mo.` });
                  }
                }}>
                {isCurrent ? "Current plan" : p.name === "Starter" ? "Downgrade" : "Upgrade"}
              </Button>
            </div>
          );
        })}
      </div>

      <SectionHeader title="Payment method" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid hsl(var(--border-secondary))", borderRadius: "var(--radius)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 24, borderRadius: 4, backgroundColor: "hsl(var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>VISA</div>
          <div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>•••• •••• •••• 4242</div><div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>Expires 12/2026</div></div>
        </div>
        <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}
          onClick={() => toast({ title: "Update payment", description: "Payment method update dialog would open here." })}>Update</Button>
      </div>
    </div>
  );
};

/* ─── USAGE ─── */
const UsageSection = () => (
  <div>
    <SectionHeader title="Credit usage" />
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>
        <span style={{ fontWeight: 500 }}>52,600 / 75,000 credits used</span>
        <span style={{ color: "hsl(var(--muted-foreground))" }}>Resets in 12 days</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, backgroundColor: "hsl(var(--secondary))", overflow: "hidden" }}>
        <div style={{ height: "100%", width: "70%", borderRadius: 3, backgroundColor: "#4F46E5" }} />
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20, marginTop: 14 }}>
      {[
        { label: "Agent runs", value: "3,580" },
        { label: "Enrichment lookups", value: "8,200" },
        { label: "Email sends", value: "4,120" },
      ].map(s => (
        <div key={s.label} style={{ padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid hsl(var(--border-secondary))" }}>
          <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
          <div style={{ fontSize: 16, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
        </div>
      ))}
    </div>

    <SectionHeader title="Credits by agent" />
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Agent</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Runs</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Last run</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Credits used</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          { name: "AI SDR", runs: 1240, lastRun: "2 min ago", credits: 18600 },
          { name: "Intent Radar", runs: 890, lastRun: "5 min ago", credits: 13350 },
          { name: "Prospect Brief", runs: 620, lastRun: "1 hr ago", credits: 9300 },
          { name: "Reply Handler", runs: 410, lastRun: "30 min ago", credits: 6150 },
          { name: "Personal Opener", runs: 280, lastRun: "2 hrs ago", credits: 3500 },
          { name: "CRM Auto-Fill", runs: 140, lastRun: "4 hrs ago", credits: 1700 },
        ].map(a => (
          <TableRow key={a.name}>
            <TableCell style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{a.name}</TableCell>
            <TableCell style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>{a.runs.toLocaleString()}</TableCell>
            <TableCell style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{a.lastRun}</TableCell>
            <TableCell style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>{a.credits.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

/* ─── INVOICES ─── */
const InvoicesSection = () => (
  <div>
    <SectionHeader title="Invoice history" />
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Date</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Amount</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Status</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          { date: "Mar 1, 2025", amount: "$699.00", status: "Paid" },
          { date: "Feb 1, 2025", amount: "$699.00", status: "Paid" },
          { date: "Jan 1, 2025", amount: "$699.00", status: "Paid" },
          { date: "Dec 1, 2024", amount: "$499.00", status: "Paid" },
          { date: "Nov 1, 2024", amount: "$499.00", status: "Paid" },
        ].map((inv, i) => (
          <TableRow key={i}>
            <TableCell style={{ fontSize: 12, fontFamily: "'Inter', sans-serif" }}>{inv.date}</TableCell>
            <TableCell style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{inv.amount}</TableCell>
            <TableCell><span style={{ fontSize: 10, fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: "2px 8px", borderRadius: 6, backgroundColor: "hsl(var(--success) / .1)", color: "hsl(var(--success))" }}>{inv.status}</span></TableCell>
            <TableCell>
              <span style={{ fontSize: 11, color: "#4F46E5", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                onClick={() => toast({ title: "Downloading", description: `Invoice for ${inv.date} is being downloaded.` })}>Download PDF</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    <div style={{ marginTop: 20 }}>
      <SectionHeader title="Billing details" />
      <FormRow><FormField label="Billing email" value="billing@outmate.ai" /></FormRow>
      <FormRow cols={2}>
        <FormField label="Company name" value="Outmate Technologies Pvt Ltd" />
        <FormField label="GST / Tax ID" value="22AAAAA0000A1Z5" />
      </FormRow>
      <Button size="sm" style={{ backgroundColor: "#4F46E5", color: "white", fontSize: 11, marginTop: 4, fontFamily: "'Inter', sans-serif" }}
        onClick={() => toast({ title: "Billing details saved", description: "Your billing information has been updated." })}>Save</Button>
    </div>
  </div>
);

/* ─── ORGANIZATION ─── */
const OrganizationSection = () => (
  <div style={{ maxWidth: 580 }}>
    <SectionHeader title="Organization details" />
    <FormRow cols={2}>
      <FormField label="Organization name" value="Outmate" />
      <FormField label="Industry" value="B2B SaaS" />
    </FormRow>
    <FormRow cols={2}>
      <FormField label="Website" value="outmate.ai" />
      <FormField label="Team size" value="10-50" />
    </FormRow>

    <div style={{ marginTop: 20 }}>
      <SectionHeader title="ICP settings" />
      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>Agents use these settings for targeting and personalization.</div>
      <FormRow><FormField label="Target industries" value="B2B SaaS, FinTech, MarTech, DevTools" /></FormRow>
      <FormRow cols={2}>
        <FormField label="Company size" value="50-500 employees" />
        <FormField label="Funding stage" value="Series A - Series C" />
      </FormRow>
      <FormRow><FormField label="Geographies" value="US, UK, India, DACH" /></FormRow>
      <FormRow><FormField label="Seniority targets" value="VP, Director, C-Suite, Head of" /></FormRow>
    </div>
  </div>
);

/* ─── PREFERENCES ─── */
const prefItems = [
  { key: "dark", title: "Dark mode", sub: "Switch to dark theme" },
  { key: "compact", title: "Compact view", sub: "Reduce spacing and padding" },
  { key: "animations", title: "Agent animations", sub: "Show animated transitions for agents" },
  { key: "autoRun", title: "Auto-run on signal", sub: "Automatically run agents when signals detected" },
  { key: "copilot", title: "Co-pilot suggestions", sub: "Show AI suggestions in the copilot" },
  { key: "usageAlerts", title: "Usage alerts", sub: "Alert when approaching credit limits" },
];

const PreferencesSection = ({ prefs, togglePref }: { prefs: Record<string, boolean>; togglePref: (k: string) => void }) => (
  <div style={{ maxWidth: 520 }}>
    <SectionHeader title="Workspace preferences" />
    {prefItems.map(p => (
      <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid hsl(var(--border-secondary))" }}>
        <div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{p.title}</div><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{p.sub}</div></div>
        <ToggleSwitch checked={prefs[p.key]} onChange={() => togglePref(p.key)} />
      </div>
    ))}

    <div style={{ marginTop: 20 }}>
      <SectionHeader title="Default AI model" />
      <Select defaultValue="claude">
        <SelectTrigger style={{ fontSize: 12, maxWidth: 300 }}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="claude">Claude Sonnet 4.6</SelectItem>
          <SelectItem value="gpt4">GPT-4o</SelectItem>
          <SelectItem value="gemini">Google Gemini Pro</SelectItem>
          <SelectItem value="perplexity">Perplexity Sonar</SelectItem>
        </SelectContent>
      </Select>
      <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>Used as default for all agent runs and co-pilot conversations</div>
    </div>
  </div>
);

/* ─── API & WEBHOOKS ─── */
const ApiSection = ({ showKey, setShowKey }: { showKey: boolean; setShowKey: (v: boolean) => void }) => (
  <div>
    <SectionHeader title="API keys" />
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Label</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Key</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Created</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Last used</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>Production key</TableCell>
          <TableCell>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <code style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, backgroundColor: "hsl(var(--secondary))", fontFamily: "'Courier New', monospace" }}>
                {showKey ? "sk-outmate-a8f3k2m9x1p4q7w5XZ9" : "sk-outmate-••••••••••••••XZ9"}
              </code>
              <span style={{ cursor: "pointer", fontSize: 12 }} onClick={() => setShowKey(!showKey)}>{showKey ? "◉" : "◎"}</span>
              <span style={{ cursor: "pointer", fontSize: 10, color: "#4F46E5", fontFamily: "'Inter', sans-serif" }}
                onClick={() => {
                  navigator.clipboard.writeText("sk-outmate-a8f3k2m9x1p4q7w5XZ9");
                  toast({ title: "Copied", description: "API key copied to clipboard." });
                }}>Copy</span>
            </div>
          </TableCell>
          <TableCell style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>Jan 15, 2025</TableCell>
          <TableCell style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>2 hours ago</TableCell>
          <TableCell><Button variant="ghost" size="sm" style={{ fontSize: 10, color: "hsl(var(--destructive))", fontFamily: "'Inter', sans-serif" }}
            onClick={() => toast({ title: "Key revoked", description: "This API key has been revoked. Generate a new one.", variant: "destructive" })}>Revoke</Button></TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <div style={{ marginTop: 24 }}>
      <SectionHeader title="Webhooks" />
      <div style={{ padding: "24px", textAlign: "center", border: "1px dashed hsl(var(--border-secondary))", borderRadius: "var(--radius)", color: "hsl(var(--muted-foreground))" }}>
        <div style={{ fontSize: 12, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>No webhooks configured</div>
        <Button variant="outline" size="sm" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}
          onClick={() => toast({ title: "Add webhook", description: "Webhook configuration form would open here." })}>Add endpoint</Button>
      </div>
    </div>
  </div>
);

/* ─── AUDIT LOGS ─── */
const typeBadgeColor: Record<string, { bg: string; text: string }> = {
  Agent: { bg: "hsl(var(--primary) / .1)", text: "#4F46E5" },
  Team: { bg: "hsl(var(--green-light))", text: "hsl(var(--green-text))" },
  Config: { bg: "hsl(var(--amber-light))", text: "hsl(var(--amber-text))" },
  Integration: { bg: "hsl(var(--purple-light))", text: "hsl(var(--purple-text))" },
  Billing: { bg: "hsl(var(--orange-light))", text: "hsl(var(--orange-text))" },
  API: { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))" },
};

const AuditSection = () => (
  <div>
    <SectionHeader title="Recent activity" />
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>User</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Action</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Type</TableHead>
          <TableHead style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          { user: "Gautam Singh", action: "Deployed AI SDR agent", type: "Agent", time: "2 hours ago" },
          { user: "Rithik Kumar", action: "Invited sara@outmate.ai", type: "Team", time: "5 hours ago" },
          { user: "Gautam Singh", action: "Updated ICP settings", type: "Config", time: "1 day ago" },
          { user: "Mudit Dubey", action: "Connected HubSpot", type: "Integration", time: "2 days ago" },
          { user: "Gautam Singh", action: "Upgraded to Growth plan", type: "Billing", time: "5 days ago" },
          { user: "Rithik Kumar", action: "Created new API key", type: "API", time: "1 week ago" },
        ].map((l, i) => {
          const c = typeBadgeColor[l.type] || typeBadgeColor.API;
          return (
            <TableRow key={i}>
              <TableCell style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{l.user}</TableCell>
              <TableCell style={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}>{l.action}</TableCell>
              <TableCell><span style={{ fontSize: 9, fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: "2px 7px", borderRadius: 6, backgroundColor: c.bg, color: c.text }}>{l.type}</span></TableCell>
              <TableCell style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{l.time}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

/* ─── DANGER ZONE ─── */
const dangerItems = [
  { title: "Export data", desc: "Download all your workspace data", action: "Export", danger: false, toastMsg: "Data export started. You'll receive a download link via email." },
  { title: "Transfer ownership", desc: "Transfer this organization to another user", action: "Transfer", danger: false, toastMsg: "Ownership transfer initiated." },
  { title: "Pause all agents", desc: "Immediately stop all running agents", action: "Pause all", danger: true, toastMsg: "All agents have been paused." },
  { title: "Reset workspace", desc: "Clear all agents, knowledge, and configs", action: "Reset", danger: true, toastMsg: "Workspace has been reset." },
  { title: "Delete organization", desc: "Permanently delete this organization and all data", action: "Delete", danger: true, toastMsg: "Organization has been scheduled for deletion." },
];

const DangerSection = ({ openConfirm }: { openConfirm: (title: string, desc: string, action: string, onConfirm: () => void, danger?: boolean) => void }) => (
  <div>
    <div style={{ padding: "12px 14px", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--amber-light))", border: "1px solid hsl(var(--amber) / .3)", marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--amber-text))", fontFamily: "'Inter', sans-serif" }}>⚠ Proceed with caution</div>
      <div style={{ fontSize: 11, color: "hsl(var(--amber-text))", opacity: .8, fontFamily: "'Inter', sans-serif" }}>Actions in this section can have irreversible consequences.</div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {dangerItems.map(d => (
        <div key={d.title} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "var(--radius)",
          border: `1px solid ${d.danger ? "hsl(var(--destructive) / .3)" : "hsl(var(--border-secondary))"}`,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif", color: d.danger ? "hsl(var(--destructive))" : "hsl(var(--foreground))" }}>{d.title}</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "'Inter', sans-serif" }}>{d.desc}</div>
          </div>
          <Button variant="outline" size="sm" style={{
            fontSize: 11, fontFamily: "'Inter', sans-serif",
            ...(d.danger ? { borderColor: "hsl(var(--destructive) / .4)", color: "hsl(var(--destructive))" } : {}),
          }}
            onClick={() => {
              if (d.danger) {
                openConfirm(d.title, `Are you sure you want to ${d.action.toLowerCase()}? ${d.desc.toLowerCase()}.`, d.action, () => {
                  toast({ title: d.title, description: d.toastMsg, variant: d.danger ? "destructive" : undefined });
                }, true);
              } else {
                toast({ title: d.title, description: d.toastMsg });
              }
            }}>
            {d.action}
          </Button>
        </div>
      ))}
    </div>
  </div>
);

export default SettingsPage;
