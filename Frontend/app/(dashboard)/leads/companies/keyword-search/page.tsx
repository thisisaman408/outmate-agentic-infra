"use client"

import { useState, useEffect, useRef } from "react"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { 
  Search, 
  Hash, 
  MessageSquare, 
  Globe, 
  Linkedin, 
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Heart,
  MessageCircle,
  Share,
  Eye,
  Calendar,
  User,
  Filter,
  Building
} from "lucide-react"

interface KeywordSearchPost {
  backend_urn: string
  actor_backend_urn: string | null
  share_urn: string
  share_url: string
  text: string
  actor_name: string
  date_posted: string
  hyperlinks: {
    company_linkedin_urls: string[]
    person_linkedin_urls: string[]
    other_urls: string[]
  }
  total_reactions: number
  total_comments: number
  reactions_by_type: {
    LIKE: number
    EMPATHY: number
    PRAISE: number
    INTEREST: number
  }
  num_shares: number
  is_repost_without_thoughts: boolean
  reactors?: Array<{
    name: string
    linkedin_profile_url: string
    reaction_type: string
    profile_image_url: string
    title: string
    location: string
  }>
  comments?: Array<{
    author_name: string
    text: string
    created_at: string
  }>
}

interface FilterOption {
  filter_type: string
  type: string
  value: string | string[]
}

export default function KeywordSearchPage() {
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<KeywordSearchPost[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState("1")
  const [limit, setLimit] = useState("5")
  const [sortBy, setSortBy] = useState("relevance")
  const [datePosted, setDatePosted] = useState("past-month")
  const [exactKeywordMatch, setExactKeywordMatch] = useState(false)
  const [fields, setFields] = useState("")
  const [maxReactors, setMaxReactors] = useState("100")
  const [maxComments, setMaxComments] = useState("100")
  
  // Filter states
  const [authorIndustry, setAuthorIndustry] = useState("")
  const [authorTitle, setAuthorTitle] = useState("")
  const [mentioningCompany, setMentioningCompany] = useState("")
  // removed unsupported content-type filter (backend does not accept it)
  const [members, setMembers] = useState("")

  // ── Copilot automation agent bridge ──────────────────────────────────
  const copilotFilters = useCoPilotAgentStore(s => s.appliedFilters?.['social_keyword_search'])
  const lastCopilotKeyRef = useRef('')

  const handleCopilotKeywordSearch = async (cf: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    setPosts([])

    try {
      const params = new URLSearchParams()
      if (cf.keyword) params.append('keyword', String(cf.keyword))
      if (cf.exact_match) params.append('exact_keyword_match', 'true')
      params.append('sort_by', String(cf.sort_by || 'relevance'))
      params.append('date_posted', String(cf.date_range || 'past-month'))
      params.append('page', String(cf.page || '1'))
      params.append('limit', String(cf.limit || '5'))

      const advFilters: Array<{filter_type: string; type: string; value: string[]}> = []
      if (cf.author_industry) advFilters.push({ filter_type: 'AUTHOR_INDUSTRY', type: 'in', value: String(cf.author_industry).split(',').map(s => s.trim()) })
      if (cf.author_title) advFilters.push({ filter_type: 'AUTHOR_TITLE', type: 'in', value: String(cf.author_title).split(',').map(s => s.trim()) })
      if (advFilters.length > 0) params.append('filters', JSON.stringify(advFilters))

      const API = ""
      const body: Record<string, unknown> = {
        keyword: cf.keyword,
        exact_keyword_match: Boolean(cf.exact_match ?? false),
        sort_by: cf.sort_by || 'relevance',
        date_posted: cf.date_range || 'past-month',
        page: parseInt(String(cf.page || '1')),
        limit: parseInt(String(cf.limit || '5')),
      }
      if (advFilters.length > 0) body.filters = advFilters
      const response = await fetch(`${API}/api/v1/crustdata/linkedin_posts/keyword_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setPosts(data.posts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!copilotFilters || Object.keys(copilotFilters).length === 0) return
    const key = JSON.stringify(copilotFilters)
    if (key === lastCopilotKeyRef.current) return
    lastCopilotKeyRef.current = key

    if (copilotFilters.keyword) setKeyword(String(copilotFilters.keyword))
    if (copilotFilters.exact_match !== undefined) setExactKeywordMatch(Boolean(copilotFilters.exact_match))
    if (copilotFilters.sort_by) setSortBy(String(copilotFilters.sort_by))
    if (copilotFilters.date_range) setDatePosted(String(copilotFilters.date_range))
    if (copilotFilters.page) setPage(String(copilotFilters.page))
    if (copilotFilters.limit) setLimit(String(copilotFilters.limit))
    if (copilotFilters.author_industry) setAuthorIndustry(String(copilotFilters.author_industry))
    if (copilotFilters.author_title) setAuthorTitle(String(copilotFilters.author_title))

    handleCopilotKeywordSearch(copilotFilters as Record<string, unknown>)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotFilters])
  // ─────────────────────────────────────────────────────────────────────

  // content type filtering removed (unsupported)

  const buildFilters = (): FilterOption[] => {
    const filters: FilterOption[] = []

    if (authorIndustry) {
      filters.push({
        filter_type: "AUTHOR_INDUSTRY",
        type: "in",
        value: authorIndustry.split(",").map(s => s.trim())
      })
    }

    if (authorTitle) {
      filters.push({
        filter_type: "AUTHOR_TITLE",
        type: "in",
        value: authorTitle.split(",").map(s => s.trim())
      })
    }

    if (mentioningCompany) {
      filters.push({
        filter_type: "MENTIONING_COMPANY",
        type: "in",
        value: mentioningCompany.split(",").map(s => s.trim())
      })
    }

    // CONTENT_TYPE not supported by backend; skip

    if (members) {
      filters.push({
        filter_type: "MEMBER",
        type: "in",
        value: members.split(",").map(s => s.trim())
      })
    }

    return filters
  }

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setPosts([])

    try {
      const requestBody: any = {
        keyword: keyword,
        page: exactKeywordMatch ? undefined : parseInt(page),
        limit: exactKeywordMatch ? parseInt(limit) : undefined,
        sort_by: sortBy,
        date_posted: datePosted,
        exact_keyword_match: exactKeywordMatch,
        fields: fields || undefined,
        max_reactors: fields.includes('reactors') ? parseInt(maxReactors) : undefined,
        max_comments: fields.includes('comments') ? parseInt(maxComments) : undefined
      }

      const filters = buildFilters()
      if (filters.length > 0) {
        requestBody.filters = filters
      }

      const API = ""
      const response = await fetch(`${API}/api/v1/leads/linkedin-post-keyword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('🔍 Keyword search response:', data)
      console.log('🔍 Is array?', Array.isArray(data))
      console.log('🔍 Has posts?', data && (data as any).posts)
      
      if (Array.isArray(data)) {
        console.log('✅ Setting posts directly:', data)
        setPosts(data)
      } else if (data && Array.isArray((data as any).posts)) {
        console.log('✅ Setting posts from .posts:', (data as any).posts)
        setPosts((data as any).posts)
      } else if (data && (data as any).error) {
        console.log('❌ Error in response:', (data as any).error)
        const errVal = (data as any).error
        setError(typeof errVal === 'string' ? errVal : (errVal?.message || 'Search failed'))
      } else {
        console.log('❌ Unknown response format, setting empty posts')
        setPosts([])
      }

      if (!error && Array.isArray(posts) && posts.length === 0) {
        const fallbackBody: any = {
          keyword: keyword,
          page: 1,
          sort_by: 'relevance',
          date_posted: datePosted || 'past-month',
          exact_keyword_match: false
        }
        if (filters.length > 0) {
          fallbackBody.filters = filters
        }
        const fbRes = await fetch(`${API}/api/v1/crustdata/linkedin_posts/keyword_search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackBody)
        })
        if (fbRes.ok) {
          const fbData = await fbRes.json()
          if (Array.isArray(fbData)) {
            setPosts(fbData)
          } else if (fbData && Array.isArray((fbData as any).posts)) {
            setPosts((fbData as any).posts)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return <Heart className="h-3 w-3" />
      case 'EMPATHY': return <Heart className="h-3 w-3" />
      case 'PRAISE': return <Heart className="h-3 w-3" />
      case 'INTEREST': return <Eye className="h-3 w-3" />
      default: return <Heart className="h-3 w-3" />
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Hash className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Realtime Social Posts Keyword Search</h1>
          <p className="text-muted-foreground">Search social posts containing specific keywords</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Parameters
              </CardTitle>
              <CardDescription>
                Search for social posts by keywords and filters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Basic Search */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Keyword Search
                </h4>
                
                <div className="space-y-2">
                  <Label htmlFor="keyword">Keyword</Label>
                  <Textarea
                    id="keyword"
                    placeholder="e.g., AI innovation, OR machine learning, AND startup"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use AND, OR operators. Supports Boolean filtering.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="exact-match"
                    checked={exactKeywordMatch}
                    onCheckedChange={(checked) => setExactKeywordMatch(checked as boolean)}
                  />
                  <Label htmlFor="exact-match" className="text-sm">
                    Exact Keyword Match
                  </Label>
                </div>
              </div>

              {/* Search Options */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Search Options</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="sort-by">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date_posted">Date Posted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-posted">Date Range</Label>
                  <Select value={datePosted} onValueChange={setDatePosted}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="past-24h">Past 24 hours</SelectItem>
                      <SelectItem value="past-week">Past week</SelectItem>
                      <SelectItem value="past-month">Past month</SelectItem>
                      <SelectItem value="past-quarter">Past quarter</SelectItem>
                      <SelectItem value="past-year">Past year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!exactKeywordMatch && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="page">Page</Label>
                      <Select value={page} onValueChange={setPage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(p => (
                            <SelectItem key={p} value={p.toString()}>Page {p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="limit">Limit</Label>
                      <Select value={limit} onValueChange={setLimit}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Advanced Filters
                </h4>
                
                <div className="space-y-2">
                  <Label htmlFor="author-industry">Author Industry</Label>
                  <Input
                    id="author-industry"
                    placeholder="e.g., Software Development, Technology"
                    value={authorIndustry}
                    onChange={(e) => setAuthorIndustry(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated industries
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author-title">Author Title</Label>
                  <Input
                    id="author-title"
                    placeholder="e.g., CEO, Founder, Manager"
                    value={authorTitle}
                    onChange={(e) => setAuthorTitle(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated titles
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mentioning-company">Mentioning Companies</Label>
                  <Textarea
                    id="mentioning-company"
                    placeholder="e.g., https://linkedin.com/company/microsoft, https://linkedin.com/company/google"
                    value={mentioningCompany}
                    onChange={(e) => setMentioningCompany(e.target.value)}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Company profile URLs, one per line
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="members">Specific Members</Label>
                  <Textarea
                    id="members"
                    placeholder="e.g., https://linkedin.com/in/user1, https://linkedin.com/in/user2"
                    value={members}
                    onChange={(e) => setMembers(e.target.value)}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Profile URLs, one per line
                  </p>
                </div>

                {/* Content type filter removed (unsupported) */}
              </div>

              {/* Additional Fields */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Additional Data</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="fields">Fields (Optional)</Label>
                  <Input
                    id="fields"
                    placeholder="e.g., reactors,comments"
                    value={fields}
                    onChange={(e) => setFields(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include reactors and/or comments for detailed data
                  </p>
                </div>

                {fields && (
                  <div className="grid grid-cols-2 gap-2">
                    {fields.includes('reactors') && (
                      <div className="space-y-2">
                        <Label htmlFor="max-reactors">Max Reactors</Label>
                        <Select value={maxReactors} onValueChange={setMaxReactors}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="500">500</SelectItem>
                            <SelectItem value="1000">1000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {fields.includes('comments') && (
                      <div className="space-y-2">
                        <Label htmlFor="max-comments">Max Comments</Label>
                        <Select value={maxComments} onValueChange={setMaxComments}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="500">500</SelectItem>
                            <SelectItem value="1000">1000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button 
                onClick={handleSearch} 
                disabled={loading || !keyword}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search Posts
                  </>
                )}
              </Button>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Search Results ({posts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {posts.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No posts found for your keyword. Try different search terms.</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              <div className="space-y-6">
                {posts.map((post, index) => (
                  <Card key={post.backend_urn} className="border-l-4 border-l-purple-500">
                    <CardContent className="pt-6">
                      {/* Post Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{post.actor_name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(post.date_posted)}
                              {post.is_repost_without_thoughts && (
                                <Badge variant="outline" className="text-xs">Repost</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <a
                          href={post.share_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Post
                        </a>
                      </div>

                      {/* Post Content */}
                      <div className="mb-4">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {post.text}
                        </p>
                      </div>

                      {/* Links in Post */}
                      {(post.hyperlinks.company_linkedin_urls.length > 0 || 
                        post.hyperlinks.person_linkedin_urls.length > 0 || 
                        post.hyperlinks.other_urls.length > 0) && (
                        <div className="mb-4">
                          <h5 className="font-medium text-sm mb-2">Links in Post</h5>
                          <div className="flex flex-wrap gap-2">
                            {post.hyperlinks.company_linkedin_urls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                              >
                                <Linkedin className="h-3 w-3 inline mr-1" />
                                <Building className="h-3 w-3 inline mr-1" />
                                Company
                              </a>
                            ))}
                            {post.hyperlinks.person_linkedin_urls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                              >
                                <User className="h-3 w-3 inline mr-1" />
                                Person
                              </a>
                            ))}
                            {post.hyperlinks.other_urls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                              >
                                <Globe className="h-3 w-3 inline mr-1" />
                                Website
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Engagement Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <Heart className="h-4 w-4 mx-auto mb-1 text-red-500" />
                          <div className="font-semibold text-sm">{formatNumber(post.total_reactions)}</div>
                          <div className="text-xs text-muted-foreground">Reactions</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <MessageCircle className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                          <div className="font-semibold text-sm">{formatNumber(post.total_comments)}</div>
                          <div className="text-xs text-muted-foreground">Comments</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <Share className="h-4 w-4 mx-auto mb-1 text-green-500" />
                          <div className="font-semibold text-sm">{formatNumber(post.num_shares)}</div>
                          <div className="text-xs text-muted-foreground">Shares</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                          <div className="font-semibold text-sm">
                            {formatNumber(Object.values(post.reactions_by_type).reduce((a, b) => a + b, 0))}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Engagement</div>
                        </div>
                      </div>

                      {/* Reaction Breakdown */}
                      {Object.keys(post.reactions_by_type).length > 0 && (
                        <div className="mb-4">
                          <h5 className="font-medium text-sm mb-2">Reaction Breakdown</h5>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(post.reactions_by_type).map(([type, count]) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {getReactionIcon(type)}
                                <span className="ml-1">{type}: {count}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reactors */}
                      {post.reactors && post.reactors.length > 0 && (
                        <div className="mb-4">
                          <h5 className="font-medium text-sm mb-2">Top Reactors</h5>
                          <div className="space-y-2">
                            {post.reactors.slice(0, 3).map((reactor, i) => (
                              <div key={i} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                                <img
                                  src={reactor.profile_image_url}
                                  alt={reactor.name}
                                  className="w-8 h-8 rounded-full"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{reactor.name}</div>
                                  <div className="text-xs text-muted-foreground">{reactor.title}</div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {getReactionIcon(reactor.reaction_type)}
                                  <span className="ml-1">{reactor.reaction_type}</span>
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comments */}
                      {post.comments && post.comments.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm mb-2">Top Comments</h5>
                          <div className="space-y-3">
                            {post.comments.slice(0, 2).map((comment, i) => (
                              <div key={i} className="p-3 bg-muted rounded-lg">
                                <div className="font-medium text-sm mb-1">{comment.author_name}</div>
                                <div className="text-sm">{comment.text}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {formatDate(comment.created_at)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>


            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
