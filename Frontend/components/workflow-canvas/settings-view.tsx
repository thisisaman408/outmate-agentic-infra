import { useTheme } from "./tokens";
import { INTEGRATIONS } from "./data";
import { InputField, SelectField, TextareaField, ToggleRow } from "./form-controls";

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  const T = useTheme();
  return (
    <div className="rounded-2xl p-7" style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      boxShadow: "0 2px 8px rgba(0,0,0,.08)",
    }}>
      <div className="text-[9px] font-bold uppercase tracking-[.14em] mb-6" style={{ color: T.text50 }}>{title}</div>
      {children}
    </div>
  );
}

export function SettingsView({ workflowName, onNameChange }: { workflowName: string; onNameChange: (v: string) => void }) {
  const T = useTheme();
  return (
    <div className="flex-1 overflow-auto" style={{ background: T.bg }}>
      <div className="max-w-[860px] mx-auto py-14 px-12">
        <div className="text-[22px] font-semibold tracking-[-0.04em] mb-1.5" style={{ color: T.text }}>Workflow Settings</div>
        <div className="text-[12px] mb-12" style={{ color: T.text35 }}>Configure execution rules, notifications, and connected integrations.</div>

        <div className="grid grid-cols-2 gap-8">
          <SettingsCard title="Workflow Basics">
            <InputField label="Workflow name" value={workflowName} onChange={e => onNameChange(e.target.value)} />
            <TextareaField label="Description" defaultValue="Automated GTM workflow for ICP outbound engagement." rows={3} />
            <InputField label="Owner" defaultValue="Gautam Singh" />
            <SelectField label="Target object" options={["People", "Companies", "Deals"]} defaultValue="People" />
          </SettingsCard>

          <SettingsCard title="Execution Rules">
            <SelectField label="Timezone" options={["IST (Asia/Kolkata)", "UTC", "EST (US/Eastern)", "PST (US/Pacific)"]} defaultValue="IST (Asia/Kolkata)" />
            <ToggleRow label="Business hours only" defaultOn={true} />
            <ToggleRow label="Skip weekends" defaultOn={true} />
            <SelectField label="Max runs per record" options={["Unlimited", "Once", "Once per day"]} defaultValue="Unlimited" />
            <SelectField label="Re-enrollment rule" options={["Once per 30 days", "Once per record", "Unlimited"]} defaultValue="Once per 30 days" />
          </SettingsCard>

          <SettingsCard title="Notifications">
            <ToggleRow label="Notify owner on exit" defaultOn={false} />
            <ToggleRow label="Slack alerts" defaultOn={true} />
            <ToggleRow label="Email notifications" defaultOn={false} />
            <ToggleRow label="Error alerts" defaultOn={true} />
          </SettingsCard>

          <SettingsCard title="Connected Integrations">
            <div className="flex flex-col gap-2.5">
              {INTEGRATIONS.filter(i => i.connected).map(integ => (
                <div key={integ.name} className="flex items-center gap-3.5 px-4 py-3 rounded-xl" style={{
                  background: T.text10, border: `1px solid ${T.border}`,
                }}>
                  <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[9px] font-bold text-white" style={{ background: integ.iconBg }}>{integ.iconLetter}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10.5px] font-medium" style={{ color: T.text70 }}>{integ.name}</div>
                    <div className="text-[8.5px]" style={{ color: T.text35 }}>{integ.category}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-[5px] h-[5px] rounded-full" style={{ background: T.greenText }} />
                    <span className="text-[8px] font-medium" style={{ color: T.greenText }}>Active</span>
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
