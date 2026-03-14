"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { UserCircle, Download, Plus, Loader2, AlertCircle, AlertTriangle, Sparkles } from "lucide-react"
import { CsvImportButton } from "@/components/shared/csv-import-button"
import { FilterSidebar } from "@/components/leads/prospects/filter-sidebar"
import { ProspectsResultsTable } from "@/components/leads/prospects/prospects-results-table"
import { searchProspects, ProspectProfile, ProspectSearchFilters } from "@/lib/services/prospectService"
import { useToast } from "@/hooks/use-toast"
import { saveSearchToHistory, getSearchHistoryItem } from "@/lib/stores/searchHistoryStore"
import { NlpSearchBar } from "@/components/leads/nlp-search-bar"
import { enrichProspect, type ProspectEnrichmentResult } from "@/lib/services/betterContactService"
import { Zap } from "lucide-react"
import { normalizeCsvRecord } from "@/lib/utils/csv"

// IMPORTANT: Credit protection - limit results during testing
const MAX_RESULTS_LIMIT = 90 // Maximum total results to prevent credit wastage
const INITIAL_LIMIT = 3 // Results per search
const LOAD_MORE_LIMIT = 3 // Results per "Load More" click

function ProspectsPageContent() {
    const { toast } = useToast()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [profiles, setProfiles] = useState<ProspectProfile[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [totalCount, setTotalCount] = useState(0)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [currentFilters, setCurrentFilters] = useState<ProspectSearchFilters>({})
    const [filterOperators, setFilterOperators] = useState<Record<string, 'in' | 'not_in'>>({
        seniority_level: 'in',  // Default to include
    })
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

    // Enrichment state - field-specific like companies
    const [enrichingRows, setEnrichingRows] = useState<Record<string, boolean>>({})
    const [enrichedData, setEnrichedData] = useState<Record<string, { email?: ProspectEnrichmentResult, phone?: ProspectEnrichmentResult }>>({})
    const [isBulkEnriching, setIsBulkEnriching] = useState(false)

    // Export functionality
  const handleExport = async () => {
    if (profiles.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Please search for prospects first before exporting.",
        variant: "destructive"
      })
            return
        }

        try {
            // Create CSV content with proper typing
            const headers = [
                'Name', 'First Name', 'Last Name', 'Region', 'Headline', 
                'Summary', 'Skills', 'LinkedIn URL', 'Emails', 'Connections'
            ]
            
            const csvRows = profiles.map((profile: ProspectProfile) => [
                profile.name || '',
                profile.first_name || '',
                profile.last_name || '',
                profile.region || '',
                profile.headline || '',
                profile.summary || '',
                (profile.skills || []).join('; '),
                profile.linkedin_profile_url || '',
                (profile.emails || []).join('; '),
                profile.num_of_connections?.toString() || ''
            ])
            
            const csvContent = [
                headers.join(','),
                ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n')

            // Create and download CSV file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `prospects_${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            toast({
                title: "Export Successful",
                description: `Exported ${profiles.length} prospects to CSV file.`,
            })
        } catch (error) {
            console.error('Export error:', error)
            toast({
                title: "Export Failed",
                description: "Failed to export prospects. Please try again.",
                variant: "destructive"
            })
    }
  }

    const handleProspectImport = async (records: Record<string, string>[]) => {
    if (!records.length) {
      toast({
        title: "Empty file",
        description: "CSV must include at least one row with filter columns.",
        variant: "destructive"
      })
      return
    }

    const filters = normalizeCsvRecord(records[0])
    setCurrentFilters(filters as ProspectSearchFilters)
    setProfiles([])
    setError(null)
    setHasSearched(false)
    setIsSearching(true)
    setIsImporting(true)

    try {
      const response = await searchProspects({ ...filters, limit: INITIAL_LIMIT })
      const limitedProfiles = response.profiles.slice(0, INITIAL_LIMIT)
      setProfiles(limitedProfiles)
      setTotalCount(response.total_count)
      setNextCursor(response.next_cursor)
      setHasSearched(true)
      toast({
        title: "Import complete",
        description: `Imported ${limitedProfiles.length} prospects from CSV filters.`
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import CSV filters."
      setError(message)
      toast({
        title: "Import failed",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsSearching(false)
      setIsImporting(false)
    }
  }

    // Restore search from history if historyId is in URL params
    useEffect(() => {
        const historyId = searchParams.get('historyId')
        if (historyId) {
            const historyItem = getSearchHistoryItem(historyId)
            if (historyItem) {
                // Restore the search results
                setProfiles((historyItem.results || []).slice(0, INITIAL_LIMIT))
                setTotalCount(historyItem.totalCount)
                setNextCursor(historyItem.nextCursor)
                setCurrentFilters(historyItem.filters)
                setHasSearched(true)

                toast({
                    title: "Search Restored",
                    description: `Restored search with ${historyItem.totalCount.toLocaleString()} results`,
                })

                // Clean URL (remove historyId param)
                router.replace('/leads/prospects')
            }
        }
    }, [searchParams])

    // Handle filter application from sidebar
    const handleApplyFilters = async (filters: Record<string, any>) => {
        setError(null)
        setIsSearching(true)
        setHasSearched(true)

        try {
            // Helper function to extract values from dual-mode filters
            const extractFilterValue = (filterId: string, filterValue: any) => {
                // Check if this is a dual-mode value (has included/excluded)
                if (filterValue && typeof filterValue === 'object' && ('included' in filterValue || 'excluded' in filterValue)) {
                    const dualValue = filterValue as { included: string[], excluded: string[] }

                    // Determine operator and values based on which list has items
                    if (dualValue.excluded.length > 0 && dualValue.included.length === 0) {
                        // Only excluded items - use not_in operator
                        setFilterOperators(prev => ({ ...prev, [filterId]: 'not_in' }))
                        return { values: dualValue.excluded, operator: 'not_in' }
                    } else if (dualValue.included.length > 0) {
                        // Has included items (with or without excluded) - included takes precedence
                        setFilterOperators(prev => ({ ...prev, [filterId]: 'in' }))
                        return { values: dualValue.included, operator: 'in' }
                    }
                    return null
                }
                // Regular array value
                return { values: filterValue, operator: filterOperators[filterId] || 'in' }
            }

            // Extract seniority level with dual-mode support
            const seniorityData = filters.seniority_level
                ? extractFilterValue('seniority_level', filters.seniority_level)
                : null

            // Map filter IDs to API parameters
            const searchFilters: ProspectSearchFilters = {
                current_title: filters.current_title || undefined,
                past_title: filters.past_title || undefined,
                location: filters.location || undefined,
                industry: filters.industry || undefined,
                functions: filters.function || undefined,
                seniority_level: seniorityData?.values || undefined,
                seniority_level_operator: (seniorityData?.operator || filterOperators.seniority_level || 'in') as 'in' | 'not_in',
                // New Filters
                first_name: filters.first_name || undefined,
                last_name: filters.last_name || undefined,
                profile_languages: filters.profile_languages || undefined,
                company: filters.company || undefined,
                employees: filters.employees || undefined,
                // Keyword is a string, not an array - extract from array if needed
                keyword: Array.isArray(filters.keyword)
                    ? (filters.keyword[0] || undefined)
                    : (filters.keyword || undefined),
                limit: INITIAL_LIMIT, // Limited for credit protection
            }

            setCurrentFilters(searchFilters)
            const response = await searchProspects(searchFilters)

            const limitedProfiles = response.profiles.slice(0, INITIAL_LIMIT)
            setProfiles(limitedProfiles)
            setTotalCount(response.total_count)
            setNextCursor(response.next_cursor || null)
            setEnrichedData({}) // Reset enrichment on new search

            // Store in localStorage for profile detail page access
            localStorage.setItem("prospect_search_results", JSON.stringify(limitedProfiles))

            // Save to search history for easy restoration
            saveSearchToHistory(
                searchFilters,
                limitedProfiles,
                response.total_count,
                response.next_cursor || null
            )

            toast({
                title: "Search Complete",
                description: `Found ${response.total_count.toLocaleString()} prospects. Showing ${limitedProfiles.length} (max ${MAX_RESULTS_LIMIT} total to save credits)`,
            })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to search prospects"
            setError(errorMessage)
            toast({
                title: "Search Failed",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsSearching(false)
        }
    }

    // Handle loading more results
    const handleLoadMore = async () => {
        if (!nextCursor) return

        // CREDIT PROTECTION: Check if we're at the limit
        if (profiles.length >= MAX_RESULTS_LIMIT) {
            toast({
                title: "Result Limit Reached",
                description: `Maximum of ${MAX_RESULTS_LIMIT} results reached to save credits. Refine your filters for different results.`,
                variant: "destructive",
            })
            return
        }

        setIsLoadingMore(true)
        try {
            // Calculate how many more we can load without exceeding limit
            const remainingSlots = MAX_RESULTS_LIMIT - profiles.length
            const loadLimit = Math.min(LOAD_MORE_LIMIT, remainingSlots)

            const response = await searchProspects({
                ...currentFilters,
                cursor: nextCursor,
                limit: loadLimit,
            })

            const newProfiles = [...profiles, ...response.profiles]
            setProfiles(newProfiles)

            // Stop pagination if we've hit the limit
            if (newProfiles.length >= MAX_RESULTS_LIMIT) {
                setNextCursor(null)
            } else {
                setNextCursor(response.next_cursor || null)
            }

            // Update localStorage
            localStorage.setItem("prospect_search_results", JSON.stringify(newProfiles))

            const reachedLimit = newProfiles.length >= MAX_RESULTS_LIMIT
            toast({
                title: reachedLimit ? "Limit Reached" : "Loaded More Results",
                description: reachedLimit
                    ? `Loaded ${response.profiles.length} more. Total: ${newProfiles.length}/${MAX_RESULTS_LIMIT} (credit limit reached)`
                    : `${response.profiles.length} more loaded. Total: ${newProfiles.length}/${MAX_RESULTS_LIMIT}`,
            })
        } catch (err) {
            toast({
                title: "Failed to Load More",
                description: err instanceof Error ? err.message : "Please try again",
                variant: "destructive",
            })
        } finally {
            setIsLoadingMore(false)
        }
    }

    // NLP search: takes LLM-extracted filters and calls the prospect search API (max 3 results)
    const handleNlpSearch = async (filters: Record<string, any>) => {
        setError(null)
        setIsSearching(true)
        setHasSearched(true)

        try {
            // Map NLP filter keys to ProspectSearchFilters
            // NOTE: Don't pass keywords — CrustData's KEYWORD filter_type mixes
            // badly with column-based filters and the LLM often extracts non-searchable
            // terms like "verified emails". The structured filters are sufficient.
            const searchFilters: ProspectSearchFilters = {
                current_title: filters.current_title || undefined,
                location: filters.location || undefined,
                industry: filters.industry || undefined,
                limit: 3,
            }

            // Add company_size as employees filter if present
            if (filters.company_size && Array.isArray(filters.company_size) && filters.company_size.length > 0) {
                searchFilters.employees = filters.company_size
            }

            setCurrentFilters(searchFilters)
            const response = await searchProspects(searchFilters)
            const limitedProfiles = response.profiles.slice(0, INITIAL_LIMIT)
            setEnrichedData({}) // Reset enrichment on new search
            setProfiles(limitedProfiles)
            setTotalCount(response.total_count)
            setNextCursor(response.next_cursor || null)

            localStorage.setItem("prospect_search_results", JSON.stringify(limitedProfiles))

            saveSearchToHistory(
                searchFilters,
                limitedProfiles,
                response.total_count,
                response.next_cursor || null
            )

            toast({
                title: "AI Search Complete",
                description: `Found ${response.total_count.toLocaleString()} prospects. Showing ${limitedProfiles.length}.`,
            })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to search prospects"
            setError(errorMessage)
            toast({
                title: "Search Failed",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsSearching(false)
        }
    }


    const enrichedCount = Object.values(enrichedData).filter(r => (r.email?.success && !r.email?.not_found) || (r.phone?.success && !r.phone?.not_found)).length

    // Field-specific enrichment handler
    const onEnrichReveal = async (profile: ProspectProfile, field: 'email' | 'phone') => {
        const linkedinKey = profile.linkedin_profile_url || profile.flagship_profile_url
        if (!linkedinKey) return

        const enrichmentKey = `${linkedinKey}-${field}`
        if (enrichingRows[enrichmentKey]) return

        const firstName = profile.first_name || profile.name?.split(" ")[0] || ""
        const lastName = profile.last_name || profile.name?.split(" ").slice(1).join(" ") || ""
        const employer = profile.current_employers?.[0]
        const companyName = employer?.name || ""
        const companyDomain = employer?.company_website_domain || ""
        const linkedinUrl = linkedinKey

        setEnrichingRows(prev => ({ ...prev, [enrichmentKey]: true }))
        const result = await enrichProspect(firstName, lastName, companyName, companyDomain, linkedinUrl, field)
        setEnrichedData(prev => ({
            ...prev,
            [linkedinKey]: {
                email: field === 'email' ? result : prev[linkedinKey]?.email,
                phone: field === 'phone' ? result : prev[linkedinKey]?.phone,
            },
        }))
        setEnrichingRows(prev => ({ ...prev, [enrichmentKey]: false }))
    }

    const handleWaterfallResult = (linkedinUrl: string, field: 'email' | 'phone', result: Record<string, any>) => {
        if (!linkedinUrl || !result) return
        setEnrichedData(prev => {
            const existing = prev[linkedinUrl] || {}
            const updated = { ...existing }
            if (result.email) {
                updated.email = {
                    email: result.email,
                    credits_consumed: result.credits_consumed,
                }
            }
            if (result.phone) {
                updated.phone = {
                    phone: result.phone,
                    credits_consumed: result.credits_consumed,
                }
            }
            if (!result.email && field === 'email') {
                updated.email = result
            }
            if (!result.phone && field === 'phone') {
                updated.phone = result
            }
            return {
                ...prev,
                [linkedinUrl]: updated,
            }
        })
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
            {/* Left Sidebar - Filters */}
            <FilterSidebar
                onApplyFilters={handleApplyFilters}
                filterOperators={filterOperators}
                onOperatorChange={(filterId, operator) => {
                    setFilterOperators(prev => ({
                        ...prev,
                        [filterId]: operator
                    }))
                }}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/5">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                <UserCircle className="h-8 w-8 text-primary" />
                                Prospects
                            </h1>
                            <p className="text-muted-foreground mt-1 text-lg">
                                Find and manage your key decision makers.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <CsvImportButton label="Import filters" onRecordsParsed={handleProspectImport} />
                            {isImporting && <span className="text-xs text-muted-foreground">Applying filters...</span>}
                            {profiles.length > 0 && (
                                <Button variant="outline" className="gap-2 bg-background" onClick={handleExport}>
                                    <Download className="h-4 w-4" />
                                    Export
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* NLP Search Bar */}
                    <div className="rounded-lg border bg-card p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">AI Search</span>
                            <span className="text-xs text-muted-foreground">Describe the people you&apos;re looking for in plain English</span>
                        </div>
                        <NlpSearchBar intent="prospect" onFiltersExtracted={handleNlpSearch} />
                    </div>

                    {/* Credit Limit Warning */}
                    {profiles.length > 0 && (
                        <Card className="p-4 border-amber-500/50 bg-amber-500/5">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">Credit Protection Active</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Showing {profiles.length} of {MAX_RESULTS_LIMIT} max results to save credits during testing
                                        {profiles.length >= MAX_RESULTS_LIMIT && " - Limit reached!"}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {error && (
                        <Card className="p-6 border-destructive/50 bg-destructive/5">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <div>
                                    <h3 className="font-semibold text-destructive">Search Error</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {isSearching ? (
                        <Card className="flex-1 p-0 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <h3 className="text-lg font-semibold">Searching for prospects...</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                This may take a few seconds
                            </p>
                        </Card>
                    ) : profiles.length > 0 ? (
                        <ProspectsResultsTable
                            profiles={profiles}
                            totalCount={totalCount}
                            hasMore={!!nextCursor && profiles.length < MAX_RESULTS_LIMIT}
                            onLoadMore={handleLoadMore}
                            isLoadingMore={isLoadingMore}
                            enableContactReveal={true}
                            onEnrichReveal={onEnrichReveal}
                            onWaterfallResult={handleWaterfallResult}
                            enrichCache={enrichedData}
                        />
                    ) : hasSearched ? (
                        <Card className="flex-1 p-0 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                            <div className="text-center space-y-4 p-8 max-w-md mx-auto">
                                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-semibold">No prospects found</h3>
                                <p className="text-muted-foreground">
                                    Try adjusting your filters or search criteria to find more results.
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <Card className="flex-1 p-0 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                            <div className="text-center space-y-4 p-8 max-w-md mx-auto">
                                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                    <UserCircle className="h-8 w-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold">Find your ideal prospects</h3>
                                <p className="text-muted-foreground">
                                    Use the filters on the left to refine your search by job title, location, and more.
                                    Then click <strong>"Apply Filters"</strong> to start searching.
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function ProspectsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProspectsPageContent />
        </Suspense>
    )
}
