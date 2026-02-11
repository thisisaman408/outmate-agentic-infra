"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Eye, Linkedin, Mail, MoreVertical, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProspectProfile } from "@/lib/services/prospectService"
import { getInitials } from "@/lib/services/prospectService"

interface ProspectsResultsTableProps {
    profiles: ProspectProfile[]
    isLoading?: boolean
    totalCount?: number
    hasMore?: boolean
    onLoadMore?: () => void
    isLoadingMore?: boolean
}

export function ProspectsResultsTable({
    profiles,
    isLoading,
    totalCount = 0,
    hasMore = false,
    onLoadMore,
    isLoadingMore = false,
}: ProspectsResultsTableProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")

    // Filter profiles by search term
    const filteredProfiles = profiles.filter((profile) => {
        const searchLower = searchTerm.toLowerCase()
        return (
            profile.name.toLowerCase().includes(searchLower) ||
            profile.headline.toLowerCase().includes(searchLower) ||
            profile.region.toLowerCase().includes(searchLower) ||
            (profile.current_employers?.[0]?.name || "").toLowerCase().includes(searchLower)
        )
    })

    // Handle row click to navigate to profile detail
    const handleProfileClick = (personId: number) => {
        router.push(`/leads/prospects/${personId}`)
    }

    // Loading skeleton
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Prospects</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Empty state
    if (profiles.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Prospects (0)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="bg-muted rounded-full p-4 mb-4">
                            <Eye className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium text-muted-foreground">No prospects found</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Try adjusting your filters or search criteria
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        Prospects
                        <Badge variant="secondary" className="ml-2">
                            {totalCount.toLocaleString()} total
                        </Badge>
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead className="w-[220px]">Name</TableHead>
                                <TableHead className="w-[200px]">Current Title</TableHead>
                                <TableHead className="w-[200px]">Company</TableHead>
                                <TableHead className="w-[150px]">Location</TableHead>
                                <TableHead className="w-[120px]">Experience</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProfiles.map((prospect) => {
                                // Support both In-DB API (current_employers) and Realtime API (employer)
                                const currentEmployer = prospect.current_employers?.[0] ||
                                    (prospect.employer as any)?.[0]
                                const initials = getInitials(prospect.name)

                                return (
                                    <TableRow
                                        key={prospect.person_id || prospect.linkedin_profile_urn}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleProfileClick(prospect.person_id || prospect.linkedin_profile_urn)}
                                    >
                                        {/* Profile Image */}
                                        <TableCell>
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage
                                                    src={prospect.profile_picture_url || ""}
                                                    alt={prospect.name}
                                                />
                                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                    {initials}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TableCell>

                                        {/* Name & Headline */}
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm truncate max-w-[200px] text-foreground">
                                                    {prospect.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {prospect.num_of_connections.toLocaleString()} connections
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Current Title */}
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm truncate max-w-[190px]">
                                                    {currentEmployer?.title || "N/A"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {currentEmployer?.seniority_level || ""}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Company */}
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium truncate max-w-[190px]">
                                                    {currentEmployer?.name || "N/A"}
                                                </span>
                                                {currentEmployer?.company_linkedin_industry && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-[190px]">
                                                        {currentEmployer.company_linkedin_industry}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Location */}
                                        <TableCell>
                                            <span className="text-sm truncate inline-block max-w-[140px]">
                                                {prospect.location_details?.country || prospect.region || "N/A"}
                                            </span>
                                        </TableCell>

                                        {/* Experience */}
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal">
                                                {prospect.years_of_experience}
                                            </Badge>
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleProfileClick(prospect.person_id || prospect.linkedin_profile_urn)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    <span className="sr-only">View Profile</span>
                                                </Button>
                                                {prospect.flagship_profile_url && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                                        asChild
                                                    >
                                                        <a
                                                            href={prospect.flagship_profile_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <Linkedin className="h-4 w-4" />
                                                            <span className="sr-only">LinkedIn Profile</span>
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Load More Button */}
                {hasMore && (
                    <div className="flex justify-center mt-6">
                        <Button
                            variant="outline"
                            onClick={onLoadMore}
                            disabled={isLoadingMore}
                            className="min-w-[200px]"
                        >
                            {isLoadingMore ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading more...
                                </>
                            ) : (
                                `Load More Results`
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
