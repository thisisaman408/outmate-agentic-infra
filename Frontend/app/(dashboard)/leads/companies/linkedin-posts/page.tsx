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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
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
  User
} from "lucide-react"

interface LinkedInPost {
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

export default function LinkedInPostsPage() {
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<LinkedInPost[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [domain, setDomain] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [postUrl, setPostUrl] = useState("")
  const [fields, setFields] = useState("")
  const [page, setPage] = useState("1")
  const [limit, setLimit] = useState("5")
  const [postTypes, setPostTypes] = useState("repost, original")
  const [maxReactors, setMaxReactors] = useState("100")
  const [maxComments, setMaxComments] = useState("100")

  // ── Copilot automation agent bridge ──────────────────────────────────
  const copilotFilters = useCoPilotAgentStore(s => s.appliedFilters?.['company_social_posts'])
  const lastCopilotKeyRef = useRef('')

  const handleCopilotPostSearch = async (cf: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    setPosts([])

    try {
      const params = new URLSearchParams()
      if (cf.domain) params.append('company_domain', String(cf.domain))
      if (cf.company_name) params.append('company_name', String(cf.company_name))
      if (cf.company_id) params.append('company_id', String(cf.company_id))
      if (cf.profile_url) params.append('company_linkedin_url', String(cf.profile_url))
      if (cf.post_url) params.append('linkedin_post_url', String(cf.post_url))
      if (cf.fields) params.append('fields', String(cf.fields))
      params.append('page', String(cf.page || '1'))
      params.append('limit', String(cf.limit || '5'))
      params.append('post_types', String(cf.post_types || 'repost, original'))

      const API = ""
      const response = await fetch(`${API}/api/v1/crustdata/linkedin_posts?${params.toString()}`)
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

    if (copilotFilters.domain) setDomain(String(copilotFilters.domain))
    if (copilotFilters.company_name) setCompanyName(String(copilotFilters.company_name))
    if (copilotFilters.company_id) setCompanyId(String(copilotFilters.company_id))
    if (copilotFilters.profile_url) setLinkedinUrl(String(copilotFilters.profile_url))
    if (copilotFilters.post_url) setPostUrl(String(copilotFilters.post_url))
    if (copilotFilters.fields) setFields(String(copilotFilters.fields))
    if (copilotFilters.page) setPage(String(copilotFilters.page))
    if (copilotFilters.limit) setLimit(String(copilotFilters.limit))
    if (copilotFilters.post_types) setPostTypes(String(copilotFilters.post_types))

    handleCopilotPostSearch(copilotFilters as Record<string, unknown>)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotFilters])
  // ─────────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setPosts([])

    try {
      const params = new URLSearchParams()
      
      if (domain) params.append('company_domain', domain)
      if (companyName) params.append('company_name', companyName)
      if (companyId) params.append('company_id', companyId)
      if (linkedinUrl) params.append('company_linkedin_url', linkedinUrl)
      if (postUrl) params.append('linkedin_post_url', postUrl)
      if (fields) params.append('fields', fields)
      if (page) params.append('page', page)
      if (limit) params.append('limit', limit)
      if (postTypes) params.append('post_types', postTypes)
      if (fields.includes('reactors')) params.append('max_reactors', maxReactors)
      if (fields.includes('comments')) params.append('max_comments', maxComments)

      const API = ""
      const response = await fetch(`${API}/api/v1/crustdata/linkedin_posts?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setPosts(data.posts || [])
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
        <MessageSquare className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Realtime Social Posts by Company</h1>
          <p className="text-muted-foreground">Get recent social posts and engagement metrics for a specific company</p>
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
                Provide company identifier to fetch social posts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Company Domain</Label>
                <Input
                  id="domain"
                  placeholder="e.g., salesforce.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="e.g., Salesforce"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-id">Company ID</Label>
                <Input
                  id="company-id"
                  placeholder="e.g., 12345"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin-url">Profile URL</Label>
                <Input
                  id="linkedin-url"
                  placeholder="e.g., https://linkedin.com/company/salesforce"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-url">Post URL (Single Post)</Label>
                <Input
                  id="post-url"
                  placeholder="e.g., https://linkedin.com/posts/..."
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fields">Fields (Optional)</Label>
                <Input
                  id="fields"
                  placeholder="e.g., reactors,comments"
                  value={fields}
                  onChange={(e) => setFields(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Include reactors and/or comments for detailed engagement data
                </p>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="post-types">Post Types</Label>
                <Select value={postTypes} onValueChange={setPostTypes}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original Only</SelectItem>
                    <SelectItem value="repost">Reposts Only</SelectItem>
                    <SelectItem value="repost, original">Both</SelectItem>
                  </SelectContent>
                </Select>
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

              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Posts...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Fetch Social Posts
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
                Social Posts ({posts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {posts.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No social posts found. Provide a company identifier and try again.</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              <div className="space-y-6">
                {posts.map((post, index) => (
                  <Card key={post.backend_urn} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                      {/* Post Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Linkedin className="h-5 w-5 text-blue-600" />
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
                            {post.reactors.slice(0, 5).map((reactor, i) => (
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
                            {post.comments.slice(0, 3).map((comment, i) => (
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
