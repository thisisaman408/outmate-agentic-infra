import { useEffect, useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePatchUpdateFlow } from "@/controllers/API/queries/flows/use-patch-update-flow";
import { useIntegrationsStatus } from "@/controllers/API/queries/integrations/use-integrations-status";
import useAlertStore from "@/stores/alertStore";
import useAuthStore from "@/stores/authStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { FlowType, WorkflowMetadata } from "@/types/flow";
import { cn } from "@/utils/utils";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const DEFAULT_META: Required<WorkflowMetadata> = {
  timezone: "Asia/Kolkata",
  business_hours_only: true,
  skip_weekends: true,
  max_runs_per_record: "Unlimited",
  re_enrollment_rule: "Once per 30 days",
  notify_owner_on_exit: false,
  slack_alerts: true,
  email_notifications: false,
  error_alerts: true,
  target_object: "People",
};

const INTEGRATION_COLORS: Record<string, string> = {
  predict: "bg-violet-500",
  "people-data-labs": "bg-blue-500",
  zoominfo: "bg-sky-500",
  clearbit: "bg-blue-600",
  hunter: "bg-amber-500",
  apollo: "bg-violet-600",
  hubspot: "bg-orange-500",
  salesforce: "bg-sky-600",
  smartlead: "bg-violet-500",
  slack: "bg-rose-500",
  twilio: "bg-rose-600",
  zoom: "bg-sky-500",
  webhook: "bg-slate-500",
  "rest-api": "bg-slate-600",
};

type Card = { children: React.ReactNode; title: string };

const SettingsCard = ({ title, children }: Card) => (
  <div className="flex flex-col gap-5 rounded-2xl border border-border/40 bg-card/50 p-6">
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {title}
    </h3>
    {children}
  </div>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {label}
    </label>
    {children}
  </div>
);

const ToggleRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-foreground">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

type SettingsTabProps = {
  flowId: string;
};

const SettingsTab = ({ flowId }: SettingsTabProps) => {
  const flows = useFlowsManagerStore((s) => s.flows);
  const setFlows = useFlowsManagerStore((s) => s.setFlows);
  const setSuccessData = useAlertStore((s) => s.setSuccessData);
  const setErrorData = useAlertStore((s) => s.setErrorData);
  const userData = useAuthStore((s) => s.userData);
  const { mutate: patchFlow, isPending } = usePatchUpdateFlow();
  const { data: integrationsStatus } = useIntegrationsStatus();
  const integrations = useMemo(
    () =>
      (integrationsStatus ?? [])
        .filter((i) => i.connected)
        .map((i) => ({
          id: i.id,
          name: i.name,
          category: i.sub_label ?? "",
          initial: i.name.charAt(0).toUpperCase(),
          color: INTEGRATION_COLORS[i.id] ?? "bg-slate-500",
        })),
    [integrationsStatus],
  );

  const flow = useMemo<FlowType | undefined>(
    () => flows?.find((f) => f.id === flowId),
    [flows, flowId],
  );

  const meta = useMemo<Required<WorkflowMetadata>>(
    () => ({ ...DEFAULT_META, ...(flow?.workflow_metadata ?? {}) }),
    [flow?.workflow_metadata],
  );

  // Local edit state for the basic fields (so typing doesn't cause a PATCH per keystroke)
  const [name, setName] = useState(flow?.name ?? "");
  const [description, setDescription] = useState(flow?.description ?? "");

  useEffect(() => {
    setName(flow?.name ?? "");
    setDescription(flow?.description ?? "");
  }, [flow?.id]);

  if (!flow) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading workflow…
      </div>
    );
  }

  const persist = (
    payload: Partial<{
      name: string;
      description: string;
      workflow_metadata: Record<string, any>;
    }>,
    successTitle?: string,
  ) => {
    patchFlow(
      { id: flowId, ...payload },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId
                  ? {
                      ...f,
                      ...(payload.name !== undefined ? { name: payload.name } : {}),
                      ...(payload.description !== undefined
                        ? { description: payload.description }
                        : {}),
                      ...(payload.workflow_metadata !== undefined
                        ? {
                            workflow_metadata: {
                              ...(f.workflow_metadata ?? {}),
                              ...payload.workflow_metadata,
                            },
                          }
                        : {}),
                    }
                  : f,
              ),
            );
          }
          if (successTitle) setSuccessData({ title: successTitle });
        },
        onError: () => setErrorData({ title: "Failed to save settings" }),
      },
    );
  };

  const updateMeta = (key: keyof WorkflowMetadata, value: any) => {
    const nextMeta = { ...meta, [key]: value };
    persist({ workflow_metadata: nextMeta });
  };

  const onNameBlur = () => {
    if (name && name !== flow.name) {
      persist({ name }, "Workflow name updated");
    }
  };

  const onDescriptionBlur = () => {
    if (description !== flow.description) {
      persist({ description });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Workflow Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure execution rules, notifications, and connected integrations.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Workflow Basics */}
          <SettingsCard title="Workflow Basics">
            <Field label="Workflow Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={onNameBlur}
                className="bg-muted/40"
                data-testid="settings-workflow-name"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={onDescriptionBlur}
                className="min-h-[72px] bg-muted/40"
                data-testid="settings-workflow-description"
              />
            </Field>
            <Field label="Owner">
              <Input
                value={(userData as any)?.username ?? "—"}
                disabled
                className="bg-muted/40"
              />
            </Field>
            <Field label="Target Object">
              <Select
                value={meta.target_object}
                onValueChange={(v) => updateMeta("target_object", v)}
              >
                <SelectTrigger className="bg-muted/40" data-testid="settings-target-object">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="People">People</SelectItem>
                  <SelectItem value="Companies">Companies</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </SettingsCard>

          {/* Execution Rules */}
          <SettingsCard title="Execution Rules">
            <Field label="Timezone">
              <Select
                value={meta.timezone}
                onValueChange={(v) => updateMeta("timezone", v)}
              >
                <SelectTrigger className="bg-muted/40" data-testid="settings-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <ToggleRow
              label="Business hours only"
              checked={meta.business_hours_only}
              onChange={(v) => updateMeta("business_hours_only", v)}
            />
            <ToggleRow
              label="Skip weekends"
              checked={meta.skip_weekends}
              onChange={(v) => updateMeta("skip_weekends", v)}
            />
            <Field label="Max Runs Per Record">
              <Select
                value={meta.max_runs_per_record}
                onValueChange={(v) => updateMeta("max_runs_per_record", v)}
              >
                <SelectTrigger className="bg-muted/40" data-testid="settings-max-runs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unlimited">Unlimited</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Re-Enrollment Rule">
              <Select
                value={meta.re_enrollment_rule}
                onValueChange={(v) => updateMeta("re_enrollment_rule", v)}
              >
                <SelectTrigger className="bg-muted/40" data-testid="settings-re-enrollment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Once">Once</SelectItem>
                  <SelectItem value="Once per 30 days">Once per 30 days</SelectItem>
                  <SelectItem value="Always">Always</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </SettingsCard>

          {/* Notifications */}
          <SettingsCard title="Notifications">
            <ToggleRow
              label="Notify owner on exit"
              checked={meta.notify_owner_on_exit}
              onChange={(v) => updateMeta("notify_owner_on_exit", v)}
            />
            <ToggleRow
              label="Slack alerts"
              checked={meta.slack_alerts}
              onChange={(v) => updateMeta("slack_alerts", v)}
            />
            <ToggleRow
              label="Email notifications"
              checked={meta.email_notifications}
              onChange={(v) => updateMeta("email_notifications", v)}
            />
            <ToggleRow
              label="Error alerts"
              checked={meta.error_alerts}
              onChange={(v) => updateMeta("error_alerts", v)}
            />
          </SettingsCard>

          {/* Connected Integrations */}
          <SettingsCard title="Connected Integrations">
            <div className="flex flex-col gap-2">
              {integrations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No integrations connected yet. Set the relevant API key
                  env var (e.g. <code>HUNTER_API_KEY</code>) on the agentic
                  backend, or save it in Variables.
                </p>
              )}
              {integrations.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold text-white",
                        it.color,
                      )}
                    >
                      {it.initial}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{it.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {it.category}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <ForwardedIconComponent
                      name="Circle"
                      className="h-2 w-2 fill-emerald-400 text-emerald-400"
                    />
                    Active
                  </span>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>

        {isPending && (
          <p className="mt-4 text-xs text-muted-foreground">Saving…</p>
        )}
      </div>
    </div>
  );
};

export default SettingsTab;
