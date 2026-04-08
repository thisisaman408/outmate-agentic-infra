"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { BorderTrail } from "@/components/core/border-trail";
import { useToolDurations } from "@/components/core/playgroundComponent/chat-view/chat-messages/hooks/use-tool-durations";
import {
  friendlyToolName,
  getToolIcon,
} from "@/components/core/playgroundComponent/chat-view/chat-messages/utils/format";
import type { ContentBlock } from "@/types/chat";
import { cn } from "@/utils/utils";
import ForwardedIconComponent from "../../common/genericIconComponent";
import ContentDisplay from "./ContentDisplay";

interface ContentBlockDisplayProps {
  contentBlocks: ContentBlock[];
  isLoading?: boolean;
  state?: string;
  chatId: string;
  playgroundPage?: boolean;
  hideHeader?: boolean;
}

/**
 * Returns a color class for the tool icon based on tool name.
 * This gives visual distinction between different tool types.
 */
function getToolColor(rawName: string | undefined): {
  bg: string;
  text: string;
  dot: string;
} {
  if (!rawName) return { bg: "bg-zinc-500/10", text: "text-zinc-500", dot: "bg-zinc-400" };

  const n = rawName.toLowerCase();

  // Web search — blue
  if (/search|duckduckgo|tavily|google|serp|exa|perplexity|browse/.test(n))
    return { bg: "bg-blue-500/10", text: "text-blue-500", dot: "bg-blue-400" };

  // LinkedIn — indigo/blue
  if (/linkedin/.test(n))
    return { bg: "bg-[#0A66C2]/10", text: "text-[#0A66C2]", dot: "bg-[#0A66C2]" };

  // Apollo — orange
  if (/apollo/.test(n))
    return { bg: "bg-orange-500/10", text: "text-orange-500", dot: "bg-orange-400" };

  // Email / Hunter — emerald
  if (/hunter|email|mail|smtp/.test(n))
    return { bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-400" };

  // CRM tools — purple
  if (/hubspot|salesforce|zoho|crm/.test(n))
    return { bg: "bg-purple-500/10", text: "text-purple-500", dot: "bg-purple-400" };

  // Document tools — amber
  if (/notion|google.*docs|google.*sheets|document/.test(n))
    return { bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-400" };

  // Scraping / reading — teal
  if (/scrape|crawl|firecrawl|read|webpage/.test(n))
    return { bg: "bg-teal-500/10", text: "text-teal-500", dot: "bg-teal-400" };

  // Content generation — pink
  if (/generate|create|write|summar/.test(n))
    return { bg: "bg-pink-500/10", text: "text-pink-500", dot: "bg-pink-400" };

  // Voice / call — violet
  if (/voice|call|bland|phone/.test(n))
    return { bg: "bg-violet-500/10", text: "text-violet-500", dot: "bg-violet-400" };

  // Analysis — cyan
  if (/analy|sentiment|score|detect/.test(n))
    return { bg: "bg-cyan-500/10", text: "text-cyan-500", dot: "bg-cyan-400" };

  // Prospect / enrichment — rose
  if (/prospect|enrich|clearbit|contact/.test(n))
    return { bg: "bg-rose-500/10", text: "text-rose-500", dot: "bg-rose-400" };

  // Default — zinc
  return { bg: "bg-zinc-500/10", text: "text-zinc-500", dot: "bg-zinc-400" };
}

export function ContentBlockDisplay({
  contentBlocks,
  isLoading,
  state,
  chatId,
  playgroundPage,
  hideHeader = false,
}: ContentBlockDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const { toolElapsedTimes, toolItems } = useToolDurations(
    contentBlocks,
    isLoading ?? false,
  );

  if (!toolItems.length || !contentBlocks?.length) {
    return null;
  }

  const isPartial = state === "partial";
  const completedCount = toolItems.filter(
    ({ toolKey }) => toolElapsedTimes[toolKey] !== undefined || !isLoading,
  ).length;

  const toggleTool = (toolKey: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolKey)) next.delete(toolKey);
      else next.add(toolKey);
      return next;
    });
  };

  return (
    <div className="relative py-2">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* Toggle header */}
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 w-full text-left group mb-1"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isPartial ? (
              <div className="h-4 w-4 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
            ) : (
              <ForwardedIconComponent
                name="CheckCircle"
                className="h-4 w-4 text-emerald-500"
              />
            )}
            <span className="text-xs text-muted-foreground">
              {isPartial
                ? `Working... (${completedCount} of ${toolItems.length} steps)`
                : `${toolItems.length} step${toolItems.length > 1 ? "s" : ""} completed`}
            </span>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
          </motion.div>
        </button>

        {/* Expanded tool steps with connector line */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="relative ml-[7px]">
                {/* Vertical connector line */}
                <div className="absolute left-[8px] top-2 bottom-2 w-[1.5px] bg-border/40" />

                <div className="flex flex-col">
                  {toolItems.map(
                    ({ content, toolKey, blockIndex, contentIndex }, flatIdx) => {
                      const rawTitle =
                        content.header?.title ||
                        content.name ||
                        `Tool ${flatIdx + 1}`;
                      const rawNameStr = typeof rawTitle === "string" ? rawTitle : String(rawTitle);
                      const toolLabel = friendlyToolName(rawNameStr);
                      const toolIcon = getToolIcon(rawNameStr);
                      const colors = getToolColor(rawNameStr);
                      const isToolExpanded = expandedTools.has(toolKey);
                      const toolDone =
                        toolElapsedTimes[toolKey] !== undefined || !isLoading;
                      const isLast = flatIdx === toolItems.length - 1;

                      return (
                        <div key={toolKey} className="relative">
                          {/* Tool step row */}
                          <button
                            onClick={() => toggleTool(toolKey)}
                            className={cn(
                              "flex items-center gap-2.5 w-full text-left py-2 pl-0 pr-2 transition-colors group/tool",
                            )}
                          >
                            {/* Colored dot on the connector line */}
                            <div className="relative z-10 flex-shrink-0">
                              <div
                                className={cn(
                                  "h-[17px] w-[17px] rounded-full flex items-center justify-center",
                                  toolDone ? colors.bg : "bg-blue-500/10",
                                )}
                              >
                                {toolDone ? (
                                  <ForwardedIconComponent
                                    name={toolIcon}
                                    className={cn("h-3 w-3", colors.text)}
                                  />
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                )}
                              </div>
                            </div>

                            {/* Label */}
                            <span
                              className={cn(
                                "text-sm flex-1 min-w-0 truncate transition-colors",
                                toolDone
                                  ? "text-muted-foreground group-hover/tool:text-foreground"
                                  : "text-foreground font-medium",
                              )}
                            >
                              {toolLabel}
                            </span>

                            {/* Expand chevron */}
                            {toolDone && (
                              <ChevronRight
                                className={cn(
                                  "h-3 w-3 text-muted-foreground/30 transition-transform flex-shrink-0",
                                  isToolExpanded && "rotate-90",
                                )}
                              />
                            )}
                          </button>

                          {/* Expanded tool content */}
                          <AnimatePresence>
                            {isToolExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="ml-[25px] mr-2 mb-2 p-3 rounded-xl bg-muted/20 border border-border/40 text-sm text-muted-foreground max-h-[500px] overflow-auto">
                                  <ContentDisplay
                                    playgroundPage={playgroundPage}
                                    content={content}
                                    chatId={`${chatId}-${blockIndex}-${contentIndex}`}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle loading indicator when collapsed */}
        {isLoading && !isExpanded && (
          <div className="relative h-0.5 rounded-full overflow-hidden mt-1">
            <BorderTrail
              size={60}
              transition={{
                repeat: Infinity,
                duration: 8,
                ease: "linear",
              }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
