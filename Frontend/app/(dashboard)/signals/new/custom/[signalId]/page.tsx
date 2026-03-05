"use client"

import { useState, use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ArrowLeft, ChevronRight, Rocket, Settings, Info, X, Check, Search, RefreshCw, ExternalLink, Globe } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { signalsApi } from "@/lib/api/signals"

interface SignalWizardPageProps {
    params: Promise<{
        signalId: string
    }>
}

type FieldType = 'text' | 'textarea' | 'number' | 'dropdown' | 'multi-select' | 'boolean' | 'single-select' | 'number-range';

interface FieldConfig {
    id: string;
    label: string;
    type: FieldType;
    description?: string;
    options?: string[];
    source?: string;
    supportsIncludeExclude?: boolean;
    min?: number;
    max?: number;
    placeholder?: string;
    showWhen?: { field: string; isOneOf: string[] };
    required?: boolean;
}

interface SignalDef {
    title: string;
    description: string;
    fields: FieldConfig[];
}

const SIGNAL_CONFIGS: Record<string, SignalDef> = {
    'monitor-professional-posts': {
        title: 'Monitor professional posts',
        description: 'Monitor professional posts based on mentions and authorship.',
        fields: [
            {
                id: 'postType',
                label: 'Post type',
                type: 'dropdown',
                options: ['Mentions companies', 'Posted by companies', 'Posted by companies\' employees'],
                required: true
            },
            {
                id: 'companies',
                label: 'Companies',
                type: 'multi-select',
                source: 'LinkedIn company pages',
                showWhen: {
                    field: 'postType',
                    isOneOf: ['Mentions companies', 'Posted by companies', 'Posted by companies\' employees']
                },
                required: true
            },
            {
                id: 'peopleFilter',
                label: 'People filter',
                type: 'dropdown',
                options: ['Mentions individuals', 'Posted by individuals']
            },
            {
                id: 'keywords',
                label: 'Keywords',
                type: 'text',
                supportsIncludeExclude: true,
                placeholder: 'Include and exclude keywords'
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top match']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last week']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-interactions-with-professional-posts': {
        title: 'Monitor interactions with professional posts',
        description: 'Monitor comments, reactions, or shares for a list of professional posts.',
        fields: [
            {
                id: 'postUrls',
                label: 'Post URLs',
                type: 'textarea',
                placeholder: 'Enter LinkedIn post URLs (one per line)...',
                description: 'Shares can only be found for activity posts (urn:li:activity), not UGC posts (urn:li:ugcPost).',
                required: true
            },
            {
                id: 'postInteractionType',
                label: 'Post interaction type',
                type: 'dropdown',
                options: ['Comments', 'Reactions', 'Shares'],
                required: true
            },
            {
                id: 'reactionType',
                label: 'Reaction type',
                type: 'multi-select',
                options: ['Like', 'Love', 'Celebrate', 'Support', 'Insightful', 'Curious'],
                showWhen: { field: 'postInteractionType', isOneOf: ['Reactions'] }
            },
            {
                id: 'duplicateHandling',
                label: 'How to handle duplicate interactions',
                type: 'dropdown',
                options: ['One interaction per person/company', 'One interaction per person/company per post', 'Include all interactions']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-post-audiences-on-linkedin': {
        title: 'Monitor post audiences',
        description: 'Monitor people engaging with professional posts on LinkedIn.',
        fields: [
            {
                id: 'postSource',
                label: 'Post source',
                type: 'multi-select',
                options: ['Post URLs', 'Company page posts', 'Employee posts'],
                required: true
            },
            {
                id: 'audienceType',
                label: 'Audience type',
                type: 'multi-select',
                options: ['Likers', 'Commenters', 'Reposters'],
                required: true
            },
            {
                id: 'peopleFilters',
                label: 'People filters',
                type: 'multi-select',
                options: ['Job title', 'Company', 'Seniority', 'Location']
            },
            {
                id: 'excludeLeads',
                label: 'Exclude existing leads',
                type: 'boolean'
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-for-ads-with-adbeat': {
        title: 'Monitor for ads',
        description: 'Track ads run by companies using Adbeat.',
        fields: [
            {
                id: 'companyFilter',
                label: 'Company filter',
                type: 'multi-select',
                options: ['Company domain', 'Industry'],
                required: true
            },
            {
                id: 'adPlatform',
                label: 'Ad platform',
                type: 'dropdown',
                options: ['Facebook', 'Google', 'LinkedIn', 'Twitter']
            },
            {
                id: 'adStatus',
                label: 'Ad status',
                type: 'dropdown',
                options: ['New', 'Active', 'Paused']
            },
            {
                id: 'keywordFilter',
                label: 'Keyword filter',
                type: 'text',
                placeholder: 'include and exclude keywords in ad copy',
                supportsIncludeExclude: true
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Highest spend']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-mentions-on-reddit': {
        title: 'Monitor Reddit mentions',
        description: 'Track keyword mentions in Reddit posts and comments.',
        fields: [
            {
                id: 'keywords',
                label: 'Keywords',
                type: 'text',
                supportsIncludeExclude: true,
                required: true
            },
            {
                id: 'subredditFilter',
                label: 'Subreddit filter',
                type: 'multi-select',
                options: ['Specific subreddits', 'All subreddits']
            },
            {
                id: 'mentionType',
                label: 'Mention type',
                type: 'dropdown',
                options: ['Post', 'Comment']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['New', 'Top']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'language',
                label: 'Language',
                type: 'dropdown',
                options: ['English', 'Spanish', 'French', 'Other']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-mentions-from-x': {
        title: 'Monitor X mentions',
        description: 'Track mentions of keywords, hashtags, or accounts on X (Twitter).',
        fields: [
            {
                id: 'keywordsHashtags',
                label: 'Keywords / hashtags',
                type: 'text',
                supportsIncludeExclude: true,
                required: true
            },
            {
                id: 'accountFilter',
                label: 'Account filter',
                type: 'multi-select',
                options: ['Verified only', 'Minimum followers', 'Specific accounts']
            },
            {
                id: 'language',
                label: 'Language',
                type: 'dropdown',
                options: ['English', 'Spanish', 'French', 'Other']
            },
            {
                id: 'excludeRetweets',
                label: 'Exclude retweets',
                type: 'boolean'
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top match']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-profiles-on-x-by-topic': {
        title: 'Monitor X profiles',
        description: 'Discover X profiles based on topics or keywords.',
        fields: [
            {
                id: 'topicsKeywords',
                label: 'Topics / keywords',
                type: 'text',
                required: true
            },
            {
                id: 'profileType',
                label: 'Profile type',
                type: 'dropdown',
                options: ['Individual', 'Company', 'Bot']
            },
            {
                id: 'minFollowers',
                label: 'Minimum followers',
                type: 'number'
            },
            {
                id: 'accountActivity',
                label: 'Account activity',
                type: 'dropdown',
                options: ['Active in last 24 hours', 'Active in last 7 days', 'Active in last 30 days']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-google-news-rss-feed': {
        title: 'Monitor news articles',
        description: 'Track news articles from Google News RSS based on keywords.',
        fields: [
            {
                id: 'keywords',
                label: 'Keywords',
                type: 'text',
                supportsIncludeExclude: true,
                required: true
            },
            {
                id: 'sourceFilter',
                label: 'Source filter',
                type: 'multi-select',
                options: ['Specific publishers', 'All publishers']
            },
            {
                id: 'language',
                label: 'Language',
                type: 'dropdown',
                options: ['English', 'Spanish', 'French', 'Other']
            },
            {
                id: 'region',
                label: 'Region',
                type: 'dropdown',
                options: ['Global', 'Country-specific']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Latest', 'Most relevant']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-followers-on-x': {
        title: 'Monitor X followers',
        description: 'Monitor new followers of specific X accounts.',
        fields: [
            {
                id: 'xAccount',
                label: 'X account',
                type: 'single-select',
                required: true
            },
            {
                id: 'followerFilters',
                label: 'Follower filters',
                type: 'multi-select',
                options: ['Job keywords in bio', 'Location', 'Minimum followers', 'Verified only']
            },
            {
                id: 'checkFrequency',
                label: 'Check frequency',
                type: 'dropdown',
                options: ['Hourly', 'Daily']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top match']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-profiles-followed-by-x-user': {
        title: 'Monitor X followings',
        description: 'Track new profiles followed by a specific X account.',
        fields: [
            {
                id: 'xAccount',
                label: 'X account',
                type: 'single-select',
                required: true
            },
            {
                id: 'profileFilters',
                label: 'Profile filters',
                type: 'multi-select',
                options: ['Job keywords in bio', 'Location', 'Minimum followers', 'Verified only']
            },
            {
                id: 'checkFrequency',
                label: 'Check frequency',
                type: 'dropdown',
                options: ['Hourly', 'Daily']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top match']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-activity-from-x-accounts': {
        title: 'Monitor X account activity',
        description: 'Track posts, replies, and engagement from specific X accounts.',
        fields: [
            {
                id: 'xAccounts',
                label: 'X accounts',
                type: 'multi-select',
                required: true
            },
            {
                id: 'activityType',
                label: 'Activity type',
                type: 'multi-select',
                options: ['Tweets', 'Replies', 'Retweets']
            },
            {
                id: 'keywordsFilter',
                label: 'Keywords filter',
                type: 'text',
                supportsIncludeExclude: true
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-for-youtube-videos-or-creators': {
        title: 'Monitor YouTube content',
        description: 'Track videos or creators on YouTube based on keywords, channels, or content type.',
        fields: [
            {
                id: 'keywords',
                label: 'Keywords',
                type: 'text',
                supportsIncludeExclude: true,
                required: true
            },
            {
                id: 'channelFilters',
                label: 'Channel filters',
                type: 'multi-select',
                options: ['Specific channels', 'All channels']
            },
            {
                id: 'videoType',
                label: 'Video type',
                type: 'dropdown',
                options: ['Video', 'Shorts', 'Live']
            },
            {
                id: 'subscriberRange',
                label: 'Subscriber range',
                type: 'number-range'
            },
            {
                id: 'publishDate',
                label: 'Publish date',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-profiles-followed-by-an-instagram-user': {
        title: 'Monitor Instagram followings',
        description: 'Track new profiles followed by a specific Instagram user.',
        fields: [
            {
                id: 'instagramAccount',
                label: 'Instagram account',
                type: 'single-select',
                required: true
            },
            {
                id: 'profileFilters',
                label: 'Profile filters',
                type: 'multi-select',
                options: ['Category', 'Minimum followers', 'Verified only', 'Location']
            },
            {
                id: 'checkFrequency',
                label: 'Check frequency',
                type: 'dropdown',
                options: ['Hourly', 'Daily']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top match']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-followers-on-instagram': {
        title: 'Monitor Instagram followers',
        description: 'Track new followers of a specific Instagram account.',
        fields: [
            {
                id: 'instagramAccount',
                label: 'Instagram account',
                type: 'single-select',
                required: true
            },
            {
                id: 'followerFilters',
                label: 'Follower filters',
                type: 'multi-select',
                options: ['Bio keywords', 'Minimum followers', 'Verified only', 'Location']
            },
            {
                id: 'checkFrequency',
                label: 'Check frequency',
                type: 'dropdown',
                options: ['Hourly', 'Daily']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top match']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-social-media-influencers-with-modash': {
        title: 'Monitor influencers',
        description: 'Discover influencers using Modash on multiple platforms.',
        fields: [
            {
                id: 'platform',
                label: 'Platform',
                type: 'dropdown',
                options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Twitter'],
                required: true
            },
            {
                id: 'audienceSize',
                label: 'Audience size',
                type: 'number-range'
            },
            {
                id: 'audienceCountry',
                label: 'Audience country',
                type: 'dropdown',
                options: ['All countries', 'Specific countries']
            },
            {
                id: 'category',
                label: 'Category / niche',
                type: 'multi-select'
            },
            {
                id: 'engagementRate',
                label: 'Engagement rate',
                type: 'number'
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-social-media-micro-influencers-with-upfluence': {
        title: 'Monitor micro-influencers',
        description: 'Discover micro-influencers using Upfluence platform based on audience, engagement, and niche.',
        fields: [
            {
                id: 'platform',
                label: 'Platform',
                type: 'dropdown',
                options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Twitter'],
                required: true
            },
            {
                id: 'followerRange',
                label: 'Follower range',
                type: 'number-range',
                required: true
            },
            {
                id: 'engagementRate',
                label: 'Engagement rate',
                type: 'number',
                required: true
            },
            {
                id: 'category',
                label: 'Category / niche',
                type: 'multi-select'
            },
            {
                id: 'audienceLocation',
                label: 'Audience location',
                type: 'dropdown',
                options: ['Global', 'Specific countries']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-prospects-engaging-with-professional-posts-using-trigify': {
        title: 'Monitor prospects with Trigify',
        description: 'Track prospects engaging with professional posts (likes, comments, reposts) using Trigify.',
        fields: [
            {
                id: 'postSource',
                label: 'Post source',
                type: 'multi-select',
                options: ['Post URLs', 'Company page posts', 'Employee posts'],
                required: true
            },
            {
                id: 'engagementType',
                label: 'Engagement type',
                type: 'multi-select',
                options: ['Likes', 'Comments', 'Reposts'],
                required: true
            },
            {
                id: 'prospectFilters',
                label: 'People filters',
                type: 'multi-select',
                options: ['Job title', 'Company', 'Seniority', 'Location']
            },
            {
                id: 'duplicateHandling',
                label: 'How to handle duplicate interactions',
                type: 'dropdown',
                options: [
                    'One interaction per person/company',
                    'One interaction per person/company per post',
                    'Include all interactions'
                ]
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-stargazers-on-github': {
        title: 'Monitor GitHub stargazers',
        description: 'Track users who have starred a repository.',
        fields: [
            {
                id: 'repositoryUrl',
                label: 'Repository URL',
                type: 'text',
                required: true,
                placeholder: 'https://github.com/owner/repo'
            },
            {
                id: 'userFilters',
                label: 'User filters',
                type: 'multi-select',
                options: ['Company', 'Location', 'Account type (Individual/Organization)']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top activity']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-contributors-on-github': {
        title: 'Monitor GitHub contributors',
        description: 'Track contributors to a repository.',
        fields: [
            {
                id: 'repositoryUrl',
                label: 'Repository URL',
                type: 'text',
                required: true,
                placeholder: 'https://github.com/owner/repo'
            },
            {
                id: 'contributorFilters',
                label: 'Contributor filters',
                type: 'multi-select',
                options: ['Company', 'Location', 'Account type (Individual/Organization)']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top commits']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-forks-on-github': {
        title: 'Monitor GitHub forks',
        description: 'Track fork activity of a repository.',
        fields: [
            {
                id: 'repositoryUrl',
                label: 'Repository URL',
                type: 'text',
                required: true,
                placeholder: 'https://github.com/owner/repo'
            },
            {
                id: 'userFilters',
                label: 'User filters',
                type: 'multi-select',
                options: ['Company', 'Location', 'Account type (Individual/Organization)']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top activity']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-snowflake-data': {
        title: 'Monitor Snowflake data',
        description: 'Track activity or changes in Snowflake tables or queries.',
        fields: [
            {
                id: 'connection',
                label: 'Connection',
                type: 'single-select',
                options: ['Saved Snowflake connections'],
                required: true
            },
            {
                id: 'database',
                label: 'Database',
                type: 'dropdown',
                options: ['DEMO_DB', 'PROD_DB', 'STAGING_DB'],
                description: 'List of databases from connection'
            },
            {
                id: 'schema',
                label: 'Schema',
                type: 'dropdown',
                options: ['PUBLIC', 'INFORMATION_SCHEMA'],
                description: 'List of schemas in database'
            },
            {
                id: 'tableOrQuery',
                label: 'Table or query',
                type: 'text',
                placeholder: 'Table name or SQL query',
                required: true
            },
            {
                id: 'triggerCondition',
                label: 'Trigger condition',
                type: 'dropdown',
                options: ['New row added', 'Value threshold reached', 'Custom SQL condition']
            },
            {
                id: 'pollingFrequency',
                label: 'Polling frequency',
                type: 'dropdown',
                options: ['Hourly', 'Daily', 'Weekly']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-databricks-data': {
        title: 'Monitor Databricks data',
        description: 'Track activity or changes in Databricks tables or queries.',
        fields: [
            {
                id: 'connection',
                label: 'Connection',
                type: 'single-select',
                options: ['Saved Databricks connections'],
                required: true
            },
            {
                id: 'cluster',
                label: 'Cluster',
                type: 'dropdown',
                options: ['General Purpose', 'Data Science'],
                description: 'Active clusters'
            },
            {
                id: 'database',
                label: 'Database',
                type: 'dropdown',
                options: ['default', 'hive_metastore'],
                description: 'List of databases in cluster'
            },
            {
                id: 'tableOrQuery',
                label: 'Table or query',
                type: 'text',
                placeholder: 'Table name or SQL query',
                required: true
            },
            {
                id: 'triggerCondition',
                label: 'Trigger condition',
                type: 'dropdown',
                options: ['New row added', 'Value threshold reached', 'Custom SQL condition']
            },
            {
                id: 'pollingFrequency',
                label: 'Polling frequency',
                type: 'dropdown',
                options: ['Hourly', 'Daily', 'Weekly']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-profiles-from-a-mixpanel-cohort': {
        title: 'Monitor Mixpanel cohort',
        description: 'Track user profiles entering or leaving a Mixpanel cohort.',
        fields: [
            {
                id: 'project',
                label: 'Project',
                type: 'single-select',
                options: ['Mixpanel projects'],
                required: true
            },
            {
                id: 'cohort',
                label: 'Cohort',
                type: 'single-select',
                options: ['List of saved cohorts'],
                required: true
            },
            {
                id: 'eventType',
                label: 'Event type',
                type: 'dropdown',
                options: ['Entered cohort', 'Exited cohort']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-calls-from-gong': {
        title: 'Monitor Gong calls',
        description: 'Track calls by team or individual, with keyword and stage filtering.',
        fields: [
            {
                id: 'teamOrRep',
                label: 'Team or rep',
                type: 'multi-select',
                options: ['Sales Team', 'John Doe', 'Jane Smith'],
                required: true
            },
            {
                id: 'keywordMentions',
                label: 'Keyword mentions',
                type: 'text',
                supportsIncludeExclude: true,
                placeholder: 'include and exclude keywords in call transcripts'
            },
            {
                id: 'dealStage',
                label: 'Deal stage',
                type: 'dropdown',
                options: ['All stages', 'Prospecting', 'Qualified', 'Closed Won', 'Closed Lost']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Longest call', 'Most keyword matches']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-accounts-from-crossbeam': {
        title: 'Monitor Crossbeam accounts',
        description: 'Track accounts from Crossbeam partnerships.',
        fields: [
            {
                id: 'partner',
                label: 'Partner',
                type: 'single-select',
                options: ['List of Crossbeam partners'],
                required: true
            },
            {
                id: 'accountStatus',
                label: 'Account status',
                type: 'dropdown',
                options: ['Active', 'Inactive', 'New']
            },
            {
                id: 'category',
                label: 'Category',
                type: 'dropdown',
                options: ['Industry', 'Company size']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Top engagement']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-companies-with-buying-intent-by-trustradius': {
        title: 'Monitor TrustRadius companies',
        description: 'Track companies showing buying intent signals on TrustRadius.',
        fields: [
            {
                id: 'category',
                label: 'Category',
                type: 'dropdown',
                options: ['Software category', 'Industry', 'All categories']
            },
            {
                id: 'intentStrength',
                label: 'Intent strength',
                type: 'dropdown',
                options: ['High', 'Medium', 'Low']
            },
            {
                id: 'companySize',
                label: 'Company size',
                type: 'dropdown',
                options: ['Small', 'Medium', 'Large', 'Enterprise']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Highest intent']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-companies-by-product-usage-with-hg-insights': {
        title: 'Monitor HG Insights companies',
        description: 'Track companies using specific technologies or products.',
        fields: [
            {
                id: 'technology',
                label: 'Technology / Product',
                type: 'multi-select',
                options: ['Salesforce', 'AWS', 'Google Cloud', 'HubSpot', 'Azure'],
                required: true
            },
            {
                id: 'usageChange',
                label: 'Usage change',
                type: 'dropdown',
                options: ['New usage', 'Increased usage', 'Decreased usage']
            },
            {
                id: 'companySize',
                label: 'Company size',
                type: 'dropdown',
                options: ['Small', 'Medium', 'Large', 'Enterprise']
            },
            {
                id: 'industry',
                label: 'Industry',
                type: 'dropdown',
                options: ['All industries', 'Specific industries']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Largest usage change']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-local-businesses-using-openmart': {
        title: 'Monitor Openmart businesses',
        description: 'Track new or updated local businesses on Openmart.',
        fields: [
            {
                id: 'location',
                label: 'Location',
                type: 'dropdown',
                options: ['City', 'State', 'Country'],
                required: true
            },
            {
                id: 'category',
                label: 'Category',
                type: 'dropdown',
                options: ['Retail', 'Services', 'Restaurants', 'All']
            },
            {
                id: 'eventType',
                label: 'Event type',
                type: 'dropdown',
                options: ['New listing', 'Updated listing', 'Review added']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Highest rating']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-local-businesses-using-google-maps': {
        title: 'Monitor Google Maps businesses',
        description: 'Track new or updated local businesses from Google Maps.',
        fields: [
            {
                id: 'location',
                label: 'Location',
                type: 'dropdown',
                options: ['City', 'State', 'Country'],
                required: true
            },
            {
                id: 'category',
                label: 'Category',
                type: 'dropdown',
                options: ['Retail', 'Services', 'Restaurants', 'All']
            },
            {
                id: 'eventType',
                label: 'Event type',
                type: 'dropdown',
                options: ['New listing', 'Updated listing', 'Review added']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Highest rating']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-companies-with-store-leads': {
        title: 'Monitor Store Leads companies',
        description: 'Track companies using the Store Leads platform.',
        fields: [
            {
                id: 'ecommercePlatform',
                label: 'Ecommerce platform',
                type: 'dropdown',
                options: ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'All'],
                required: true
            },
            {
                id: 'revenueRange',
                label: 'Revenue range',
                type: 'dropdown',
                options: ['<$1M', '$1M–$10M', '$10M–$50M', '$50M+']
            },
            {
                id: 'companySize',
                label: 'Company size',
                type: 'dropdown',
                options: ['Small', 'Medium', 'Large', 'Enterprise']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Highest revenue']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-companies-from-pitchbook-shared-search': {
        title: 'Monitor Pitchbook companies',
        description: 'Track companies from a shared search in Pitchbook.',
        fields: [
            {
                id: 'savedSearch',
                label: 'Saved search',
                type: 'single-select',
                options: ['List of saved searches in Pitchbook'],
                required: true
            },
            {
                id: 'companyEventType',
                label: 'Company event type',
                type: 'dropdown',
                options: ['Funding', 'IPO', 'Acquisition', 'Partnership', 'Other']
            },
            {
                id: 'industry',
                label: 'Industry',
                type: 'dropdown',
                options: ['All industries', 'Specific industries']
            },
            {
                id: 'companySize',
                label: 'Company size',
                type: 'dropdown',
                options: ['Small', 'Medium', 'Large', 'Enterprise']
            },
            {
                id: 'sortBy',
                label: 'Sort by',
                type: 'dropdown',
                options: ['Most recent', 'Largest event']
            },
            {
                id: 'timeFrame',
                label: 'Time frame',
                type: 'dropdown',
                options: ['Last 24 hours', 'Last 7 days', 'Last 30 days']
            },
            {
                id: 'maxResults',
                label: 'Max number of results',
                type: 'number',
                min: 1,
                max: 500
            }
        ]
    },
    'monitor-rss-feed': {
        title: 'Monitor RSS Feed',
        description: 'Monitor any RSS feed for new items.',
        fields: [
            { id: 'feedUrl', label: 'Feed URL', type: 'text' },
            { id: 'keywordsFilter', label: 'Keywords filter', type: 'text' }
        ]
    },
    'monitor-google-search-results': {
        title: 'Monitor Google Search results',
        description: 'Monitor Google Search results for news and updates.',
        fields: [
            { id: 'keyword', label: 'Keyword', type: 'text' },
            { id: 'region', label: 'Region', type: 'dropdown' }
        ]
    },
    'monitor-leads-from-phantombuster': {
        title: 'Monitor leads from Phantombuster',
        description: 'Monitor leads from Phantombuster.',
        fields: [
            { id: 'actor', label: 'Actor', type: 'single-select' },
            { id: 'executionId', label: 'Execution ID', type: 'text' }
        ]
    },
    'monitor-data-from-apify-actor': {
        title: 'Monitor data from Apify actor',
        description: 'Monitor data from Apify actor.',
        fields: [
            { id: 'actorId', label: 'Actor ID', type: 'text' },
            { id: 'dataset', label: 'Dataset', type: 'text' }
        ]
    },
    'monitor-and-enrich-your-data-from-airtable': {
        title: 'Monitor and enrich your data from Airtable',
        description: 'Monitor and enrich your data from Airtable.',
        fields: [
            { id: 'base', label: 'Base', type: 'single-select' },
            { id: 'table', label: 'Table', type: 'single-select' },
            { id: 'triggerType', label: 'Trigger type', type: 'dropdown' }
        ]
    },
    'monitor-data-from-an-http-api': {
        title: 'Monitor data from an HTTP API',
        description: 'Monitor data from an HTTP API.',
        fields: [
            { id: 'endpointUrl', label: 'Endpoint URL', type: 'text' },
            { id: 'authMethod', label: 'Auth method', type: 'dropdown', options: ['None', 'API key', 'Bearer token'] },
            { id: 'pollingInterval', label: 'Polling interval', type: 'dropdown' },
            { id: 'triggerCondition', label: 'Trigger condition', type: 'text' }
        ]
    }
};

const MultiSelect = ({ label, options, source, value, onChange }: {
    label: string,
    options?: string[],
    source?: string,
    value: string[],
    onChange: (val: string[]) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredOptions = (options || []).filter(o => o.toLowerCase().includes(search.toLowerCase()));

    const toggleOption = (opt: string) => {
        if (value.includes(opt)) {
            onChange(value.filter(v => v !== opt));
        } else {
            onChange([...value, opt]);
        }
    };

    return (
        <div className="space-y-2">
            <Label className="text-base font-semibold flex items-center justify-between">
                {label}
                {source && <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Source: {source}</span>}
            </Label>

            <div className="min-h-[40px] p-2 border rounded-md bg-background flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all cursor-text" onClick={() => setIsOpen(true)}>
                {value.length === 0 && <span className="text-muted-foreground text-sm py-1 px-2">Select options...</span>}
                {value.map(v => (
                    <Badge key={v} variant="secondary" className="flex items-center gap-1">
                        {v}
                        <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={(e) => { e.stopPropagation(); toggleOption(v); }} />
                    </Badge>
                ))}
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
                    <Card className="w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xl">Select {label}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search options..."
                                    className="pl-9"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
                                {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                                    <div
                                        key={opt}
                                        className={cn(
                                            "flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer",
                                            value.includes(opt) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                        )}
                                        onClick={() => toggleOption(opt)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Checkbox checked={value.includes(opt)} className="pointer-events-none" />
                                            <span className="text-sm font-medium">{opt}</span>
                                        </div>
                                        {value.includes(opt) && <Check className="h-4 w-4" />}
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm italic border border-dashed rounded-lg">
                                        {options ? "No results found." : "Start typing to add new values."}
                                        {!options && (
                                            <Button
                                                variant="link"
                                                className="block mx-auto mt-2"
                                                onClick={() => { if (search) { toggleOption(search); setSearch(""); } }}
                                            >
                                                Add "{search}"
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex justify-end border-t">
                                <Button onClick={() => setIsOpen(false)}>Done</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default function SignalWizardPage({ params }: SignalWizardPageProps) {
    const { signalId } = use(params)
    const router = useRouter()

    const [step, setStep] = useState(2)
    const [isLoading, setIsLoading] = useState(false)
    const [previewResults, setPreviewResults] = useState<any[]>([])
    const [formData, setFormData] = useState<Record<string, any>>({
        frequency: "weekly",
        destination: "new_table",
    })

    const config = SIGNAL_CONFIGS[signalId] || {
        title: signalId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
        description: 'Configure your signal parameters below.',
        fields: [
            { id: 'target', label: 'Target URL or Keywords', type: 'text' },
            { id: 'maxResults', label: 'Max number of results', type: 'number' }
        ]
    }

    const handleNext = () => {
        if (step === 2) {
            // Validation
            const missingFields = config.fields.filter(f => {
                if (!f.required) return false;

                // If it has showWhen, check if it's visible
                if (f.showWhen) {
                    const depVal = formData[f.showWhen.field];
                    if (!f.showWhen.isOneOf.includes(depVal)) return false;
                }

                const val = formData[f.id];
                return !val || (Array.isArray(val) && val.length === 0);
            });

            if (missingFields.length > 0) {
                toast.error(`Please fill in required fields: ${missingFields.map(f => f.label).join(', ')}`);
                return;
            }

            setStep(3);
            fetchPreview();
        } else if (step === 3) {
            setStep(4)
        } else if (step === 4) {
            handleCreate()
        }
    }

    const fetchPreview = async () => {
        setIsLoading(true);
        try {
            const data = await signalsApi.previewSignal(signalId, formData);
            setPreviewResults(data);
        } catch (error) {
            console.error("Preview failed", error);
            toast.error("Failed to fetch live preview");
        } finally {
            setIsLoading(false);
        }
    }

    const handleCreate = async () => {
        setIsLoading(true)
        try {
            const type = signalId.replace(/-/g, '_');
            await signalsApi.createSignal({
                name: `Signal: ${config.title}`,
                type: type as any,
                configuration: formData,
                status: 'active'
            })
            toast.success("Signal created and run successfully!")
            router.push('/signals')
        } catch (error) {
            console.error(error)
            toast.error("Failed to create signal")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto py-10 max-w-4xl">
            <Button
                variant="ghost"
                className="mb-6 pl-0 hover:pl-2 transition-all"
                onClick={() => step === 2 ? router.back() : setStep(step - 1)}
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {step === 2 ? "Back to Source Selection" : "Back to Step " + (step - 1)}
            </Button>

            {/* Progress Bar */}
            <div className="flex items-center gap-4 mb-8">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className="flex flex-1 items-center gap-4 group">
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0",
                            step === s ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_-3px_rgba(var(--primary),0.5)]" :
                                step > s ? "bg-primary/10 text-primary border-primary/50" :
                                    "bg-muted text-muted-foreground border-border"
                        )}>
                            {step > s ? <Check className="h-5 w-5" /> : s}
                        </div>
                        {s < 4 && <div className={cn("h-1 flex-1 rounded-full transition-all", step > s ? "bg-primary" : "bg-muted")} />}
                    </div>
                ))}
            </div>

            <div className="grid gap-8">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-3">
                        Step {step}
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                        {step === 2 ? config.title :
                            step === 3 ? "Preview results" :
                                "Save & activate"}
                    </h1>
                    <p className="text-muted-foreground text-xl leading-relaxed">
                        {step === 2 ? config.description :
                            step === 3 ? "Review the raw data found for your signal before finalizing." :
                                "Choose where to save your data and how often to run."}
                    </p>
                </div>

                {step === 2 && (
                    <Card className="border-border/50 shadow-lg overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                        <CardHeader>
                            <CardTitle className="text-2xl">Setup Inputs</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8 p-8">
                            {config.fields.map(field => {
                                // Conditional rendering logic
                                if (field.showWhen) {
                                    const dependentValue = formData[field.showWhen.field];
                                    if (!field.showWhen.isOneOf.includes(dependentValue)) {
                                        return null;
                                    }
                                }

                                return (
                                    <div key={field.id} className="space-y-3">
                                        {field.type === 'text' && (
                                            <div className="space-y-2">
                                                <Label htmlFor={field.id} className="text-base font-semibold">{field.label}</Label>
                                                <Input
                                                    id={field.id}
                                                    placeholder={field.placeholder || "Enter value..."}
                                                    value={formData[field.id] || ""}
                                                    onChange={e => setFormData({ ...formData, [field.id]: e.target.value })}
                                                    className="h-11 shadow-sm"
                                                />
                                                {field.supportsIncludeExclude && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Info className="h-3 w-3" /> Supports include and exclude keywords
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {field.type === 'textarea' && (
                                            <div className="space-y-2">
                                                <Label htmlFor={field.id} className="text-base font-semibold">{field.label}</Label>
                                                <Textarea
                                                    id={field.id}
                                                    placeholder={field.placeholder || "Enter values (one per line)..."}
                                                    value={formData[field.id] || ""}
                                                    onChange={e => setFormData({ ...formData, [field.id]: e.target.value })}
                                                    className="min-h-[120px] shadow-sm font-mono text-sm"
                                                />
                                                {field.description && (
                                                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                                                        <Info className="h-3 w-3 mt-0.5 shrink-0" /> {field.description}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {field.type === 'number' && (
                                            <div className="space-y-2">
                                                <Label htmlFor={field.id} className="text-base font-semibold">{field.label}</Label>
                                                <Input
                                                    id={field.id}
                                                    type="number"
                                                    min={field.min}
                                                    max={field.max}
                                                    value={formData[field.id] || ""}
                                                    onChange={e => setFormData({ ...formData, [field.id]: e.target.value })}
                                                    className="h-11 w-full sm:w-1/3"
                                                />
                                                {field.description && <p className="text-xs text-muted-foreground italic px-1">({field.description})</p>}
                                            </div>
                                        )}

                                        {field.type === 'dropdown' && (
                                            <div className="space-y-2">
                                                <Label htmlFor={field.id} className="text-base font-semibold">{field.label}</Label>
                                                <Select
                                                    value={formData[field.id]}
                                                    onValueChange={v => setFormData({ ...formData, [field.id]: v })}
                                                >
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder="Select an option..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(field.options || []).map(opt => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {field.type === 'multi-select' && (
                                            <MultiSelect
                                                label={field.label}
                                                options={field.options}
                                                source={field.source}
                                                value={formData[field.id] || []}
                                                onChange={val => setFormData({ ...formData, [field.id]: val })}
                                            />
                                        )}

                                        {field.type === 'boolean' && (
                                            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 group hover:border-primary/30 transition-colors">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-semibold">{field.label}</Label>
                                                    <p className="text-sm text-muted-foreground">Toggle this on to exclude matches.</p>
                                                </div>
                                                <Switch
                                                    checked={formData[field.id] || false}
                                                    onCheckedChange={v => setFormData({ ...formData, [field.id]: v })}
                                                />
                                            </div>
                                        )}

                                        {field.type === 'single-select' && (
                                            <div className="space-y-2">
                                                <Label className="text-base font-semibold">{field.label}</Label>
                                                <div className="p-4 border border-dashed rounded-lg text-center bg-muted/10 group hover:bg-muted/20 transition-all cursor-pointer">
                                                    <div className="mx-auto w-10 h-10 rounded-full bg-background border flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                        <Search className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                    <span className="text-sm font-medium text-muted-foreground">Search and connect account</span>
                                                </div>
                                            </div>
                                        )}

                                        {field.type === 'number-range' && (
                                            <div className="space-y-2">
                                                <Label className="text-base font-semibold">{field.label}</Label>
                                                <div className="flex items-center gap-4">
                                                    <Input
                                                        type="number"
                                                        placeholder="Min"
                                                        className="h-11"
                                                        onChange={e => setFormData({ ...formData, [field.id + '_min']: e.target.value })}
                                                    />
                                                    <span className="text-muted-foreground font-medium">to</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="Max"
                                                        className="h-11"
                                                        onChange={e => setFormData({ ...formData, [field.id + '_max']: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="pt-8 border-t flex justify-end">
                                <Button size="lg" onClick={handleNext} className="px-8 h-12 text-base font-bold shadow-lg shadow-primary/20">
                                    Next: Preview <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {step === 3 && (
                    <Card className="border-border/50 shadow-lg overflow-hidden">
                        <CardHeader className="border-b bg-muted/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Live Data Preview</CardTitle>
                                    <CardDescription>Results found based on your current configuration.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-background">{previewResults.length} results found</Badge>
                                    <Button variant="outline" size="sm" onClick={fetchPreview} disabled={isLoading}>
                                        <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                                        Refresh
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-20 text-center space-y-4">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                                        <Settings className="h-8 w-8 text-primary animate-spin" />
                                    </div>
                                    <h3 className="text-xl font-bold">Scanning Live Sources...</h3>
                                    <p className="text-muted-foreground max-w-xs mx-auto">
                                        We're searching across {config.title} to find matches for your configuration.
                                    </p>
                                </div>
                            ) : previewResults.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-[40%]">Result</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="w-[100px]">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewResults.map((result, i) => (
                                                <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-semibold align-top py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span>{result.title}</span>
                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                                <Globe className="h-3 w-3" /> {result.source || 'Search Engine'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground leading-relaxed py-4">
                                                        {result.snippet || 'No description available'}
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        <Button variant="ghost" size="sm" asChild>
                                                            <a href={result.link} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-32 text-center space-y-4 bg-muted/5">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                        <Search className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-xl font-bold">No results found</h3>
                                    <p className="text-muted-foreground max-w-sm mx-auto">
                                        We couldn't find any results with your current filters. Try broadening your keywords or removing some filters.
                                    </p>
                                    <Button variant="outline" onClick={() => setStep(2)}>
                                        <ArrowLeft className="h-4 w-4 mr-2" /> Adjust Configuration
                                    </Button>
                                </div>
                            )}

                            <div className="p-6 bg-muted/30 border-t flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">
                                    {previewResults.length > 0 ? "Happy with these results? Finalize your signal below." : "Try adjusting your settings if the results aren't what you expected."}
                                </p>
                                <Button onClick={handleNext} size="lg" disabled={previewResults.length === 0} className="px-8 font-bold">
                                    Next: Save & Activate <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {step === 4 && (
                    <div className="grid gap-6 animate-in zoom-in-95 duration-300">
                        <Card className="border-border/50 shadow-lg group hover:border-primary/30 transition-all">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Rocket className="h-5 w-5 text-primary" />
                                    Data Destination
                                </CardTitle>
                                <CardDescription>Where should we save the new signals found?</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Tabs defaultValue="new" value={formData.destination} onValueChange={(v) => setFormData({ ...formData, destination: v })}>
                                    <TabsList className="grid w-full grid-cols-2 p-1 bg-muted">
                                        <TabsTrigger value="new" className="data-[state=active]:shadow-sm">Create New Table</TabsTrigger>
                                        <TabsTrigger value="existing" className="data-[state=active]:shadow-sm">Add to Existing Table</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="new" className="pt-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="font-semibold">Table Name</Label>
                                            <Input defaultValue={`${config.title} Results`} className="h-11" />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="existing" className="pt-4">
                                        <div className="p-12 border-2 border-dashed rounded-xl text-center text-muted-foreground bg-muted/20">
                                            <Info className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                            No existing tables found.
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        <Card className="border-border/50 shadow-lg group hover:border-primary/30 transition-all">
                            <CardHeader>
                                <CardTitle>Choose run frequency</CardTitle>
                                <CardDescription>
                                    We'll check the signal on your selected schedule and add any new results we find.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4">
                                    {['daily', 'weekly', 'monthly'].map((freq) => (
                                        <div
                                            key={freq}
                                            className={cn(
                                                "cursor-pointer border-2 rounded-xl p-6 text-center hover:bg-muted/50 transition-all duration-200",
                                                formData.frequency === freq ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-transparent bg-muted/40"
                                            )}
                                            onClick={() => setFormData({ ...formData, frequency: freq })}
                                        >
                                            <div className="capitalize font-extrabold text-lg">{freq}</div>
                                            <div className="text-xs text-muted-foreground mt-1">Automatic updates</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end pt-4">
                            <Button size="lg" onClick={handleCreate} disabled={isLoading} className="w-full sm:w-auto h-16 px-12 text-xl font-black rounded-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                {isLoading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Activating...
                                    </div>
                                ) : (
                                    <>
                                        <Rocket className="mr-3 h-6 w-6" /> Save & Activate Signal
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}