"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, Mail, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Lead } from "@/lib/api/leads"
import { Skeleton } from "@/components/ui/skeleton"
import { leadsApi } from "@/lib/api/leads"
import { useToast } from "@/hooks/use-toast"

interface LeadsTableProps {
  leads: Lead[]
  isLoading?: boolean
  onLeadsChange?: () => void
}

export function LeadsTable({ leads, isLoading, onLeadsChange }: LeadsTableProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleStatusChange = async (leadId: string, newStatus: Lead["status"]) => {
    try {
      await leadsApi.updateLeadStatus(leadId, newStatus)
      toast({
        title: "Success",
        description: "Lead status updated successfully",
      })
      onLeadsChange?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: Lead["status"]) => {
    switch (status) {
      case "new":
        return "default"
      case "contacted":
        return "secondary"
      case "qualified":
        return "outline"
      case "unqualified":
        return "destructive"
      default:
        return "default"
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Leads ({filteredLeads.length})</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="unqualified">Unqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">No leads found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters or generate new leads</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Company</TableHead>
                  <TableHead className="w-[250px]">Contact</TableHead>
                  <TableHead className="w-[150px]">Industry</TableHead>
                  <TableHead className="w-[150px]">Location</TableHead>
                  <TableHead className="w-[80px] text-center">Signals</TableHead>
                  <TableHead className="w-[80px] text-center">Score</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium truncate">{lead.companyName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[230px]">{lead.contactName}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[230px]">{lead.title}</span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground truncate">{lead.email}</span>
                          {lead.linkedin && (
                            <a href={`https://${lead.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                              <span className="sr-only">LinkedIn</span>
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 21.227.792 22 1.771 22h20.451C23.2 22 24 21.227 24 20.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="truncate">{lead.industry}</TableCell>
                    <TableCell className="truncate">{lead.location}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{lead.signalsCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={lead.score >= 90 ? "default" : "outline"}>{lead.score}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(lead.status)} className="capitalize">
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "contacted")}>
                              Mark as Contacted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "qualified")}>
                              Mark as Qualified
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "unqualified")}>
                              Mark as Unqualified
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
