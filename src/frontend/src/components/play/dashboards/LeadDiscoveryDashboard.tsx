import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import type { AgentDashboardProps } from "./registry";
import {
  parseLeadDiscoveryOutput,
  type Lead,
  type LeadDiscoveryData,
} from "./parse-lead-discovery";
import SmartResultRenderer from "@/components/core/chatComponents/SmartResultRenderer";

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-gradient-to-b from-muted/20 to-transparent px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        <ForwardedIconComponent name={icon} className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
    >
      <ForwardedIconComponent name={copied ? "Check" : "Copy"} className="h-3 w-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function PostCard({ url, topic, date }: { url: string; topic: string; date: string }) {
  const isRealUrl = url.startsWith("http");
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/20 border border-border/20 px-3 py-2">
      <ForwardedIconComponent name="FileText" className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{topic || "Post"}</p>
        <div className="flex items-center gap-2 mt-1">
          {date && <span className="text-xs text-muted-foreground">{date}</span>}
          {isRealUrl && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary/70 hover:text-primary hover:underline truncate"
            >
              View post
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function TweetCard({ text, likes, retweets, date }: { text: string; likes: number; retweets: number; date: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/20 border border-border/20 px-3 py-2">
      <ForwardedIconComponent name="Twitter" className="h-3.5 w-3.5 text-[#1DA1F2] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">&ldquo;{text}&rdquo;</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {likes > 0 && <span>{likes} likes</span>}
          {retweets > 0 && <span>{retweets} retweets</span>}
          {date && <span>{date}</span>}
        </div>
      </div>
    </div>
  );
}

function MessagePreview({ message }: { message: Lead["message"] }) {
  if (!message) return null;

  const isOverLimit = message.type.includes("300") && message.charCount > 300;

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-b from-muted/10 to-transparent p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ForwardedIconComponent name="MessageSquare" className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">{message.type}</span>
          {message.tone && (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">{message.tone}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isOverLimit ? "text-red-400" : "text-muted-foreground"}`}>
            {message.charCount} chars
          </span>
          <CopyButton text={message.text} />
        </div>
      </div>
      <div className="rounded-lg bg-background/60 border border-border/20 p-3 text-sm leading-relaxed">
        {message.text}
      </div>
      {message.referencedPost && (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Referenced:</span> {message.referencedPost}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, index }: { lead: Lead; index: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl border border-border/40 bg-gradient-to-b from-muted/10 to-transparent overflow-hidden"
    >
      {/* Lead header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/10 transition-colors"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
          {lead.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{lead.name}</h3>
            {lead.linkedin && (
              <a
                href={lead.linkedin.startsWith("http") ? lead.linkedin : `https://${lead.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0A66C2] hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                <ForwardedIconComponent name="Linkedin" className="h-4 w-4" />
              </a>
            )}
            {lead.twitter && (
              <a
                href={lead.twitter.startsWith("http") ? lead.twitter : `https://x.com/${lead.twitter.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1DA1F2] hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                <ForwardedIconComponent name="Twitter" className="h-4 w-4" />
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {lead.title}{lead.company ? ` at ${lead.company}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lead.email && (
            <div className="flex items-center gap-1.5">
              <a
                href={`mailto:${lead.email}`}
                className={`text-xs hover:underline ${
                  lead.emailUnverified
                    ? "text-amber-500/80 hover:text-amber-500"
                    : "text-primary/70 hover:text-primary"
                }`}
                onClick={(e) => e.stopPropagation()}
                title={lead.emailUnverified ? "Hunter low-confidence guess — verify before sending" : undefined}
              >
                {lead.email}
              </a>
              {lead.emailUnverified && (
                <span
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-500"
                  title="This email is a Hunter low-confidence guess (confidence < 30). Verify before sending."
                >
                  unverified
                </span>
              )}
            </div>
          )}
          <ForwardedIconComponent
            name={expanded ? "ChevronUp" : "ChevronDown"}
            className="h-4 w-4 text-muted-foreground"
          />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border/20 pt-3">
          {/* Best hook */}
          {lead.bestHook && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
              <ForwardedIconComponent name="Zap" className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm">{lead.bestHook}</p>
            </div>
          )}

          {/* Recent posts */}
          {lead.posts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Posts</h4>
              <div className="flex flex-col gap-2">
                {lead.posts.map((post, i) => (
                  <PostCard key={i} {...post} />
                ))}
              </div>
            </div>
          )}

          {/* Recent tweets */}
          {lead.tweets.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Tweets</h4>
              <div className="flex flex-col gap-2">
                {lead.tweets.map((tweet, i) => (
                  <TweetCard key={i} {...tweet} />
                ))}
              </div>
            </div>
          )}

          {/* Company intel */}
          {lead.companyIntel && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <ForwardedIconComponent name="Building2" className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{lead.companyIntel}</span>
            </div>
          )}

          {/* LinkedIn message */}
          {lead.message && <MessagePreview message={lead.message} />}
        </div>
      )}
    </motion.div>
  );
}

export default function LeadDiscoveryDashboard({ output }: AgentDashboardProps) {
  const data: LeadDiscoveryData = useMemo(() => parseLeadDiscoveryOutput(output), [output]);

  // If parsing found no structured leads, show the raw output nicely
  if (data.leads.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SmartResultRenderer
          text={output}
          fallback={
            <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {output}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Keyword header */}
      {data.keyword && (
        <div className="flex items-center gap-2">
          <ForwardedIconComponent name="Search" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Topic: <span className="font-medium text-foreground">{data.keyword}</span>
          </span>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon="Crosshair"
          label="Leads Found"
          value={data.summary.totalLeads}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon="Mail"
          label="With Email"
          value={data.summary.withEmail}
          color="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          icon="FileText"
          label="With Posts"
          value={data.summary.withPosts}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          icon="MessageSquare"
          label="Messages Written"
          value={data.summary.withMessages}
          color="bg-purple-500/10 text-purple-500"
        />
      </div>

      {/* Lead cards */}
      <div className="flex flex-col gap-4">
        {data.leads.map((lead, i) => (
          <LeadCard key={`${lead.name}-${i}`} lead={lead} index={i} />
        ))}
      </div>
    </div>
  );
}
