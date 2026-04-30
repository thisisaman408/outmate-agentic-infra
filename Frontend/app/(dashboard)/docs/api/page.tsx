"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ExternalLink, BookOpen, Code, Key, Shield, Zap, Clock, BarChart3 } from "lucide-react"
import Link from "next/link"

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/integrations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Link>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
              <Key className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">API Documentation</h1>
            <p className="text-muted-foreground">Complete API reference for Outmate platform</p>
          </div>
        </div>

        {/* Documentation Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">API Key Authentication</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  All API requests must include an API key in the Authorization header:
                </p>
                <div className="bg-muted rounded-lg p-4">
                  <code className="text-sm">
                    Authorization: Bearer sk-outmate-your-api-key
                  </code>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Getting Your API Key</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Navigate to Settings &gt; API & Webhooks to create and manage your API keys.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Core Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Companies API</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Search and retrieve company information
                </p>
                <div className="bg-muted rounded-lg p-4">
                  <code className="text-sm">
                    GET /api/v1/companies/search
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Query parameters: industry, location, size, etc.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">People API</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Search and retrieve people/prospect information
                </p>
                <div className="bg-muted rounded-lg p-4">
                  <code className="text-sm">
                    GET /api/v1/people/search
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Query parameters: title, company, location, skills, etc.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Rate Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Limits</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Requests per day:</span>
                    <span>10,000</span>
                  </div>
                  <div>
                    <span className="font-medium">Requests per minute:</span>
                    <span>7</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Rate Limit Headers</h3>
                <p className="text-sm text-muted-foreground">
                  When rate limits are exceeded, the API will return appropriate headers:
                </p>
                <div className="bg-muted rounded-lg p-4">
                  <code className="text-sm">
                    X-RateLimit-Limit: 10000
                    X-RateLimit-Remaining: 9999
                    X-RateLimit-Reset: 1640995200
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Code Examples */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Code Examples
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">JavaScript/Node.js</h3>
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-sm overflow-x-auto">
                    <code>{`const response = await fetch('https://your-domain.com/api/v1/companies/search', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-outmate-your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    industry: 'technology',
    location: 'San Francisco',
    size: '50-100'
  })
})

const data = await response.json()
console.log(data)`}</code>
                </pre>
              </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Python</h3>
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-sm overflow-x-auto">
                    <code>{`import requests

response = requests.post(
    'https://your-domain.com/api/v1/companies/search',
    headers={
        'Authorization': 'Bearer sk-outmate-your-api-key',
        'Content-Type': 'application/json'
    },
    json={
        'industry': 'technology',
        'location': 'San Francisco',
        'size': '50-100'
    }
)

data = response.json()
print(data)`}</code>
                </pre>
              </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhooks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Real-time Events</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure webhooks to receive real-time notifications when events occur in your Outmate workspace.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Supported Events</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Company created</li>
                  <li>• Person added</li>
                  <li>• Campaign launched</li>
                  <li>• Integration connected</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Webhook Configuration</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Send webhook events to your configured endpoint:
                </p>
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-sm overflow-x-auto">
                    <code>{`POST /webhooks/outmate
Content-Type: application/json
X-Outmate-Signature: sha256=webhook_secret

{
  "event": "company.created",
  "data": {
    "company_id": "12345",
    "name": "Tech Corp",
    "created_at": "2024-01-15T10:30:00Z"
  }
}`}</code>
                </pre>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
