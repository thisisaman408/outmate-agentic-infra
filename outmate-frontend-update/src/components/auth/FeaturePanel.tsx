import { Zap, Bot, FileText, MessageCircle } from 'lucide-react';

const features = [
  {
    icon: Zap,
    bg: '#EEF2FF',
    color: '#4F46E5',
    title: 'Intent Radar',
    sub: 'Detects buying signals from G2, LinkedIn, and job boards — fires outreach automatically',
  },
  {
    icon: Bot,
    bg: '#DCFCE7',
    color: '#16A34A',
    title: 'AI SDR',
    sub: 'Autonomous outbound — prospects, personalises, sends, and follows up with no human needed',
  },
  {
    icon: FileText,
    bg: '#FEF9C3',
    color: '#CA8A04',
    title: 'Prospect Brief',
    sub: 'Full contact dossier from LinkedIn and website — ready 30 seconds before any call or email',
  },
  {
    icon: MessageCircle,
    bg: '#FCE7F3',
    color: '#DB2777',
    title: 'Reply Handler',
    sub: 'Classifies inbound replies and books meetings automatically — zero manual triage',
  },
];

const avatars = [
  { initials: 'GS', bg: '#4F46E5' },
  { initials: 'MK', bg: '#0EA5E9' },
  { initials: 'PW', bg: '#10B981' },
  { initials: 'DJ', bg: '#F59E0B' },
];

export default function FeaturePanel() {
  return (
    <div className="hidden lg:flex flex-col justify-center max-w-[480px] px-10 py-10">
      <h2 className="text-[32px] font-bold text-foreground leading-[1.15]" style={{ letterSpacing: '-0.03em' }}>
        Your AI GTM team.<br />Always working.
      </h2>
      <p className="text-sm text-muted-foreground leading-[1.7] max-w-[380px] mt-3 mb-8">
        Outmate deploys AI agents that detect signals, enrich contacts, write personalised emails, and book meetings — while you focus on closing.
      </p>

      <div className="flex flex-col gap-5">
        {features.map((f) => (
          <div key={f.title} className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0"
              style={{ background: f.bg }}
            >
              <f.icon size={18} color={f.color} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3.5 mt-8">
        <div className="flex -space-x-2.5">
          {avatars.map((a) => (
            <div
              key={a.initials}
              className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: a.bg }}
            >
              {a.initials}
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Join 1,200+ sales teams already automating their GTM on Outmate
        </span>
      </div>
    </div>
  );
}
