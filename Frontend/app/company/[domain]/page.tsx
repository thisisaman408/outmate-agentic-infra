'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, Globe, Users, DollarSign, Calendar, MapPin, Phone, Mail, 
  Linkedin, Twitter, Facebook, ExternalLink, Lock, Unlock, TrendingUp, 
  Zap, Award, Code, Activity
} from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

const INSIGHT_BADGES = {
  'high-growth-funded': { label: 'High Growth + Funded', color: 'bg-purple-500', icon: TrendingUp },
  'scaling-tech': { label: 'Scaling Tech', color: 'bg-blue-500', icon: Zap },
  'recently-funded': { label: 'Recently Funded', color: 'bg-green-500', icon: DollarSign },
  'social-active': { label: 'Social Active', color: 'bg-orange-500', icon: Award },
  'organic-growth': { label: 'Organic Growth', color: 'bg-teal-500', icon: TrendingUp },
  'enterprise': { label: 'Enterprise', color: 'bg-gray-700', icon: Building2 },
  'mid-market': { label: 'Mid-Market', color: 'bg-gray-600', icon: Building2 },
  'smb': { label: 'SMB', color: 'bg-gray-500', icon: Building2 },
  'startup': { label: 'Startup', color: 'bg-indigo-500', icon: Zap },
  'tech-forward': { label: 'Tech Forward', color: 'bg-cyan-500', icon: Zap },
};

export default function PublicCompanyPage() {
  const params = useParams();
  const domain = params.domain as string;
  const { toast } = useToast();

  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedContacts, setRevealedContacts] = useState<{ phone?: string; email?: string }>({});
  const [revealing, setRevealing] = useState<'phone' | 'email' | null>(null);
  const [showAllFields, setShowAllFields] = useState(false);

  useEffect(() => {
    if (!domain) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${BASE}/api/explorium/company/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: { domain },
            options: { limit: 1, page: 1 },
          }),
        });
        if (!response.ok) throw new Error(`Failed to fetch company data: ${response.statusText}`);
        const data = await response.json();
        const record = data?.data?.companies?.[0] || null;
        setCompany(record);
      } catch (err: any) {
        setError(err.message || 'Failed to load company data');
      } finally {
        setLoading(false);
      }
    })();
  }, [domain]);

  const phoneValue = revealedContacts.phone || company?.phone || '***-***-****';
  const emailValue = revealedContacts.email || company?.email || 'contact@***';
  const isPhoneBlurred = phoneValue?.includes('***');
  const isEmailBlurred = emailValue?.includes('***') || emailValue?.includes('contact@');

  const revealCompanyContact = async (type: 'phone' | 'email') => {
    try {
      setRevealing(type);
      toast({ title: 'Info', description: 'Contact reveal is gated via ContactOut integration' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to reveal contact', variant: 'destructive' });
    } finally {
      setRevealing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg font-medium text-foreground">Loading {domain} profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-lg w-full border-red-200 bg-red-50/50">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-red-700 mb-4">Error Loading Profile</h2>
            <p className="text-red-600 mb-6">{error}</p>
            <p className="text-sm text-muted-foreground">Please try again or check if the domain is correct.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-lg w-full">
          <CardContent className="p-12 text-center">
            <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Company Not Found</h2>
            <p className="text-muted-foreground">No data available for <strong>{domain}</strong></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const posts = Array.isArray(company.linkedin_posts) ? company.linkedin_posts : [];
  const reactionsSum = posts.reduce((acc, p) => acc + (typeof p?.total_reactions === 'number' ? p.total_reactions : 0), 0);
  const commentsSum = posts.reduce((acc, p) => acc + (typeof p?.total_comments === 'number' ? p.total_comments : 0), 0);
  const sharesSum = posts.reduce((acc, p) => acc + (typeof p?.num_shares === 'number' ? p.num_shares : 0), 0);
  const avgReactions = posts.length ? Math.round(reactionsSum / posts.length) : 0;
  const avgComments = posts.length ? Math.round(commentsSum / posts.length) : 0;
  const avgShares = posts.length ? Math.round(sharesSum / posts.length) : 0;
  const latestPostDate = posts.find((p) => p?.date_posted)?.date_posted;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="overflow-hidden border-border/50 shadow-xl">
          <div className="h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-background relative">
            {company.logo_url && (
              <div className="absolute -bottom-12 left-8">
                <div className="h-28 w-28 rounded-xl overflow-hidden border-4 border-background shadow-lg bg-white">
                  <Image src={company.logo_url} alt={company.name || domain} width={112} height={112} className="object-contain p-2" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              </div>
            )}
          </div>

          <div className="p-8 pt-20">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold tracking-tight">{company.name || domain}</h1>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {company.industry && <Badge variant="secondary" className="text-sm px-3 py-1">{company.industry}</Badge>}
                  {company.company_type && company.company_type !== "N/A" && <Badge variant="outline" className="text-sm px-3 py-1">{company.company_type}</Badge>}
                  {(company.domain || domain) && <Badge variant="outline" className="text-sm px-3 py-1">{company.domain || domain}</Badge>}
                  {company.enriched !== undefined && <Badge variant={company.enriched ? "default" : "secondary"} className={company.enriched ? "bg-green-500" : ""}>{company.enriched ? 'Enriched' : 'Not Enriched'}</Badge>}
                </div>
                {company.description && company.description !== "N/A" && (
                  <p className="mt-4 text-muted-foreground leading-relaxed max-w-3xl">{company.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {company.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <Globe className="h-4 w-4" />
                      Website
                    </a>
                  </Button>
                )}
                {company.linkedin_url && company.linkedin_url !== "N/A" && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.linkedin_url.startsWith('http') ? company.linkedin_url : `https://${company.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowAllFields((v) => !v)}>
                  {showAllFields ? 'Hide Fields' : 'View Fields'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-6 text-center hover:shadow-md transition-shadow">
            <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Employees</p>
            <p className="text-2xl font-bold mt-1">
              {company.employee_count_exact ? Number(company.employee_count_exact).toLocaleString() : (company.employee_count_range || 'N/A')}
            </p>
          </Card>
          <Card className="p-6 text-center hover:shadow-md transition-shadow">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-lg font-bold mt-1">{company.revenue_range && company.revenue_range !== 'N/A' ? company.revenue_range : 'N/A'}</p>
          </Card>
          {company.founded_year && (
            <Card className="p-6 text-center hover:shadow-md transition-shadow">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-muted-foreground">Founded</p>
              <p className="text-2xl font-bold mt-1">{company.founded_year}</p>
            </Card>
          )}
        </div>

        {(posts.length > 0 || company.follower_count) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Linkedin className="h-5 w-5" />
                Realtime LinkedIn Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Followers</p>
                  <p className="text-xl font-semibold">{company.follower_count ? Number(company.follower_count).toLocaleString() : 'N/A'}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Posts Fetched</p>
                  <p className="text-xl font-semibold">{posts.length || 0}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Latest Post</p>
                  <p className="text-xl font-semibold">{latestPostDate || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showAllFields && (
          <Card>
            <CardHeader>
              <CardTitle>All Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[700px] overflow-auto rounded-lg bg-muted/30 p-4 text-xs leading-relaxed">
                {JSON.stringify(company, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
