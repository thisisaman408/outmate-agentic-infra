"use client"

import * as React from "react"
import { ChevronDown, HelpCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface FilterSectionProps {
    title: string
    count?: number
    onClear?: () => void
    children: React.ReactNode
    defaultOpen?: boolean
    description?: string
}

export function FilterSection({
    title,
    count,
    onClear,
    children,
    defaultOpen = true,
    description
}: FilterSectionProps) {
    return (
        <Accordion type="single" collapsible defaultValue={defaultOpen ? "item-1" : undefined} className="w-full space-y-2">
            <AccordionItem value="item-1" className="border rounded-lg bg-card/50 px-3 shadow-sm">
                <AccordionTrigger className="hover:no-underline py-3 px-1 group [&_svg]:text-foreground/70 [&_svg]:h-5 [&_svg]:w-5 [&[data-state=open]_svg]:text-primary">
                    <div className="flex items-center justify-between w-full mr-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">
                                {title}
                            </span>
                            {count !== undefined && count > 0 && (
                                <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] text-[10px] bg-primary/10 text-primary border-0">
                                    {count}
                                </Badge>
                            )}
                            {description && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <HelpCircle className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-xs text-xs">{description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 px-1">
                    <div className="space-y-2">
                        {children}
                        {count !== undefined && count > 0 && onClear && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClear}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive w-full justify-start mt-2"
                            >
                                <X className="mr-1 h-3 w-3" />
                                Clear
                            </Button>
                        )}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}
