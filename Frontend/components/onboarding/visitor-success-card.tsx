"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Building2,
    MapPin,
    Link,
    Mail,
    CheckCircle2,
    User,
    ExternalLink,
    Send,
    Trophy,
    Loader2,
} from "lucide-react"

interface VisitorSuccessCardProps {
    visitor: any
    isDemo?: boolean
    onOutreach: () => void
    onViewProfile?: () => void
}

export function VisitorSuccessCard({ visitor, isDemo, onOutreach, onViewProfile }: VisitorSuccessCardProps) {
    const score = Math.round(visitor.intent_score * 100)
    const [isSending, setIsSending] = useState(false)
    const [outreachSent, setOutreachSent] = useState(false)

    const handleSendOutreach = async () => {
        setIsSending(true)
        try {
            await onOutreach()
            setOutreachSent(true)
        } catch (err) {
            console.error("Outreach failed:", err)
        } finally {
            setIsSending(false)
        }
    }
    
    return (
        <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="w-full bg-white rounded-2xl border-2 border-indigo-100 shadow-xl overflow-hidden relative"
        >
            {isDemo && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                    Demo Mode
                </div>
            )}
            
            <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                            <Building2 className="h-8 w-8" />
                        </div>
                        <div>
                            <h4 className="text-2xl font-bold text-[#1e1b4b] leading-none mb-1">{visitor.company}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Link className="h-3.5 w-3.5" />
                                <span>{visitor.domain}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        <div className="inline-flex flex-col items-end">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">ICP Match</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-green-500">{score}</span>
                                <span className="text-sm font-bold text-muted-foreground">/100</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">{visitor.geo?.city}, {visitor.geo?.country}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100">
                                {visitor.industry}
                            </Badge>
                            <Badge variant="secondary">
                                {visitor.employee_count_range} emp
                            </Badge>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Pages Viewed</span>
                        <ul className="space-y-1">
                            <li className="text-[11px] text-slate-600 font-medium truncate flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                /pricing
                            </li>
                            <li className="text-[11px] text-slate-600 font-medium truncate flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                /integrations
                            </li>
                        </ul>
                    </div>
                </div>

                {visitor.full_name && (
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-indigo-600 rounded-xl p-6 text-white mb-8 shadow-lg shadow-indigo-200"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                                    <User className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white leading-none mb-1">{visitor.full_name}</p>
                                    <p className="text-xs text-indigo-100">{visitor.job_title}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-bold text-indigo-200 mb-1">Identified Email</p>
                                <p className="text-xs font-mono font-bold">{visitor.email}</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="flex gap-4">
                    {outreachSent ? (
                        <Button
                            size="lg"
                            className="flex-1 h-14 bg-green-600 text-white font-bold text-lg gap-3 shadow-lg shadow-green-100 cursor-default"
                            disabled
                        >
                            <CheckCircle2 className="h-5 w-5" />
                            Outreach Sent!
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg gap-3 shadow-lg shadow-indigo-100"
                            onClick={handleSendOutreach}
                            disabled={isSending}
                        >
                            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            {isSending ? "Sending..." : "Send Personalised Outreach"}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-14 font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        onClick={onViewProfile}
                    >
                        View Profile
                    </Button>
                </div>
            </div>
            
            <div className="bg-green-50 p-4 border-t border-green-100 flex items-center justify-center gap-2">
                <Trophy className="h-4 w-4 text-green-600" />
                <span className="text-xs font-bold text-green-700">Moment of truth: That's a high-intent B2B lead identifies in real-time.</span>
            </div>
        </motion.div>
    )
}
