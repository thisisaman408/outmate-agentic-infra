"use client"

import React, { useState, useMemo } from "react"
import { 
  Search, Plus, MoreHorizontal, Users, Building2, Filter, 
  Star, Trash2, Download, Upload, Edit2, Eye, LayoutGrid 
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── types ─── */
interface ListItem {
  id: string
  name: string
  description: string
  type: "companies" | "people" | "mixed"
  count: number
  source: string
  updatedAt: string
  starred: boolean
  tags: string[]
}

/* ─── data ─── */
const listsData: ListItem[] = [
  { id: "l1", name: "Enterprise Target Accounts", description: "Series B+ SaaS companies with 200+ employees", type: "companies", count: 247, source: "AI Node", updatedAt: "2h ago", starred: true, tags: ["ICP", "Tier 1"] },
  { id: "l2", name: "Hot Website Visitors", description: "Engaged companies from website traffic", type: "companies", count: 47, source: "Pixel", updatedAt: "5m ago", starred: true, tags: ["Hot", "Auto"] },
  { id: "l3", name: "Sales Leaders", description: "VP/Director roles at target accounts", type: "people", count: 156, source: "Enrichment", updatedAt: "1d ago", starred: false, tags: ["Outbound"] },
]

const typeIcons: any = { companies: Building2, people: Users, mixed: LayoutGrid }

/* ─── component ─── */
export default function ListsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      {/* Header */}
      <div className="px-8 py-6 bg-card border-b border-border flex items-center justify-between">
         <div className="flex flex-col gap-1">
            <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">Segment Lists</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
               {listsData.length} active segments · {listsData.reduce((a,b) => a + b.count, 0).toLocaleString()} contacts
            </p>
         </div>
         <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 text-[10px] font-black uppercase tracking-widest border-border h-10 px-4 rounded-xl">
               <Upload className="w-3.5 h-3.5 opacity-40" />
               Import
            </Button>
            <Button className="gap-2 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground h-10 px-6 rounded-xl shadow-lg shadow-primary/20">
               <Plus className="w-3.5 h-3.5" />
               New Segment
            </Button>
         </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 no-scrollbar bg-muted/5">
         <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               {[
                  { label: "Total Segments", value: "34", color: "text-foreground" },
                  { label: "Company Lists", value: "18", color: "text-primary" },
                  { label: "People Lists", value: "12", color: "text-indigo-500" },
                  { label: "Auto-Updated", value: "8", color: "text-emerald-500" }
               ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-[24px] p-6 shadow-xl shadow-black/[0.02]">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">{s.label}</p>
                     <p className={cn("text-2xl font-black tracking-tighter", s.color)}>{s.value}</p>
                  </div>
               ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
               <div className="relative flex-1 max-w-md group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                  <input 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Search segments..." 
                     className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-2xl text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                  />
               </div>
               <Button variant="outline" className="h-12 px-6 rounded-2xl border-border gap-2 text-[11px] font-black uppercase tracking-widest">
                  <Filter className="w-4 h-4 opacity-40" />
                  Filter
               </Button>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-[32px] overflow-hidden shadow-xl shadow-black/[0.02]">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-muted/30 border-b border-border">
                        <th className="p-6 w-12"></th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Segment Name</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Type</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Records</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Source</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                     {listsData.map(list => {
                        const Icon = typeIcons[list.type]
                        return (
                           <tr key={list.id} className="group hover:bg-muted/10 transition-colors cursor-pointer">
                              <td className="p-6">
                                 <Star className={cn("w-4 h-4 transition-colors", list.starred ? "fill-amber-500 text-amber-500" : "text-muted-foreground/20 group-hover:text-muted-foreground/40")} />
                              </td>
                              <td className="p-6">
                                 <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                       <span className="text-[13px] font-black text-foreground uppercase tracking-tight">{list.name}</span>
                                       {list.tags.map(tag => (
                                          <span key={tag} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/5 text-primary border border-primary/20 rounded-full">
                                             {tag}
                                          </span>
                                       ))}
                                    </div>
                                    <p className="text-[11px] font-medium text-muted-foreground/60 truncate max-w-xs">{list.description}</p>
                                 </div>
                              </td>
                              <td className="p-6">
                                 <div className="flex items-center gap-2">
                                    <Icon className="w-3.5 h-3.5 text-muted-foreground/40" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{list.type}</span>
                                 </div>
                              </td>
                              <td className="p-6">
                                 <span className="text-[13px] font-black text-foreground">{list.count.toLocaleString()}</span>
                              </td>
                              <td className="p-6">
                                 <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-muted rounded-lg text-muted-foreground/60 border border-border">
                                    {list.source}
                                 </span>
                              </td>
                              <td className="p-6 text-right">
                                 <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary"><Eye className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>
                                 </div>
                              </td>
                           </tr>
                        )
                     })}
                  </tbody>
               </table>
            </div>

         </div>
      </main>
    </div>
  )
}

function Button({ children, variant = "primary", size = "default", className, ...props }: any) {
  const variants: any = {
    primary: "bg-primary text-primary-foreground",
    outline: "border border-border bg-transparent hover:bg-muted/50",
    ghost: "hover:bg-muted",
  }
  const sizes: any = {
    default: "h-10 px-4",
    sm: "h-8 px-3",
    icon: "h-8 w-8 p-0",
  }
  return (
    <button className={cn("inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors disabled:opacity-50", variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}
