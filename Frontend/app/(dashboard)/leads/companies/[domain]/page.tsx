'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, Globe, Users, DollarSign, Calendar, MapPin, Phone, Mail, 
  Share2, Twitter, Facebook, ExternalLink, Lock, Unlock, TrendingUp, 
  Zap, Award, Code, Briefcase, Target, Activity, RefreshCw, Check, Eye
} from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { searchCache } from "@/lib/cache/search-cache";

// Insight badge configuration (same as table)
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

export default function CompanyProfilePage() {
  const params = useParams();
  const domain = params.domain as string;
  const { toast } = useToast();

  const [company, setCompany] = useState<any>(null);
  const [comprehensiveData, setComprehensiveData] = useState<any>(null);
  const [decisionMakers, setDecisionMakers] = useState<any[]>([]);
  const [SocialPosts, setSocialPosts] = useState<any[]>([]);
  const [SocialInsights, setSocialInsights] = useState<any>(null);
  const [technographics, setTechnographics] = useState<any>(null);
  const [socialMediaPresence, setSocialMediaPresence] = useState<any>(null);
  const [businessIntent, setBusinessIntent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedContacts, setRevealedContacts] = useState<{ phone?: string; email?: string }>({});
  const [enrichedProfiles, setEnrichedProfiles] = useState<{ [key: string]: any }>({});

  // Fetch comprehensive company data when domain changes
  useEffect(() => {
    if (domain && domain !== company?.domain) {
      (async () => {
        try {
          setLoading(true);
          setError(null);
          
          // Check cache first for base company data
          const cachedData = searchCache.get(domain);
          let companyData = null;
          let cachedHit = false;
          let decisionMakersData: any[] = [];
          let SocialPostsData: any[] = [];
          let SocialInsightsData = null;

          if (cachedData && !searchCache.isExpired(cachedData.timestamp)) {
            console.log('Using cached company data for domain:', domain);
            companyData = cachedData.data;
            cachedHit = true;
          } else {
            console.log('Cache miss or expired, fetching fresh data for domain:', domain);

            // Load ContactOut first, then enrich with Explorium endpoints
          }

          // If explorium failed, try ContactOut API
          if (!companyData) {
            try {
              const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
              const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
              const contactOutResponse = await fetch(`/api/contactout/company/${encodeURIComponent(domain)}`, { headers: fetchHeaders });
              if (contactOutResponse.ok) {
                const contactOutData = await contactOutResponse.json();
                if (contactOutData.success && contactOutData.data) {
                  companyData = contactOutData.data;
                  // Derive missing fields from ContactOut raw_data
                  try {
                    const coRaw = companyData?.raw_data || {};
                    if (!companyData.employee_count_exact && !companyData.employee_count_range) {
                      const sz = coRaw?.size;
                      if (typeof sz === 'number' && sz > 0) {
                        companyData.employee_count_exact = sz;
                      }
                    }
                    if (!companyData.revenue_range && typeof companyData.revenue === 'string' && companyData.revenue.trim()) {
                      companyData.revenue_range = companyData.revenue;
                    }
                  } catch {}
                  setComprehensiveData({ companies: [contactOutData.data] });
                }
              }
            } catch (contactOutError) {
              console.log('ContactOut API also failed:', contactOutError);
            }
          }

          if (!companyData) {
            setCompany({ domain });
          } else {
            setCompany(companyData);
          }

          // Fetch decision makers from ContactOut API (using company endpoint which returns both company + decision makers)
          try {
            console.log('Fetching decision makers from company endpoint for domain:', domain);
            const token2 = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const companyResponse = await fetch(`/api/contactout/company/${encodeURIComponent(domain)}`, { headers: { 'Content-Type': 'application/json', ...(token2 ? { 'Authorization': `Bearer ${token2}` } : {}) } });
            console.log('Company response status:', companyResponse.status);
            
            if (companyResponse.ok) {
              const companyResult = await companyResponse.json();
              if (companyResult.success && companyResult.data) {
                // New flat shape: data.decision_makers (waterfall result)
                decisionMakersData = companyResult.data.decision_makers || [];
                console.log(`Decision makers fetched (source=${companyResult.data.decision_makers_source}): ${decisionMakersData.length}`);
              } else {
                console.log('Company API returned success=false:', companyResult?.error);
              }
            } else {
              console.log('Company API error:', companyResponse.status);
            }
          } catch (error) {
            console.log('Failed to fetch decision makers:', error);
          }

          // Only re-enrich from Explorium if data was not loaded from search cache
          if (!cachedHit) {

          const enrichToken = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
          const enrichHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(enrichToken ? { 'Authorization': `Bearer ${enrichToken}` } : {}),
          }

          // Fetch Social posts via Explorium (insights)
          try {
            const postsResponse = await fetch(`/api/explorium/linkedin-insights`, {
              method: 'POST',
              headers: enrichHeaders,
              body: JSON.stringify({ domain, include_posts: true, posts_limit: 10 }),
            });
            if (postsResponse.ok) {
              const postsResult = await postsResponse.json();
              if (postsResult.success && postsResult.data) {
                SocialPostsData = Array.isArray(postsResult.data) ? postsResult.data : (postsResult.data.posts || []);
              }
            }
          } catch (error) {
            console.log('Failed to fetch Social posts (Explorium):', error);
          }

          // Fetch Social insights from Explorium API
          try {
            const insightsResponse = await fetch(`/api/explorium/linkedin-insights`, {
              method: 'POST',
              headers: enrichHeaders,
              body: JSON.stringify({
                domain,
                include_posts: true,
                posts_limit: 10
              }),
            });
            if (insightsResponse.ok) {
              const insightsResult = await insightsResponse.json();
              if (insightsResult.success && insightsResult.data) {
                SocialInsightsData = insightsResult.data;
                // if posts were not fetched above, extract from insights payload
                if (SocialPostsData.length === 0) {
                  const extracted = Array.isArray(insightsResult.data) ? insightsResult.data : (insightsResult.data.posts || []);
                  SocialPostsData = extracted || [];
                }
              }
            }
          } catch (error) {
            console.log('Failed to fetch Social insights:', error);
          }

          // Fetch Technographics from Explorium API
          try {
            const techResponse = await fetch(`/api/explorium/technographics`, {
              method: 'POST',
              headers: enrichHeaders,
              body: JSON.stringify({
                domain,
              }),
            });
            if (techResponse.ok) {
              const techResult = await techResponse.json();
              if (techResult.success && techResult.data) {
                setTechnographics(techResult.data);
                const stack = Array.isArray(techResult.data?.full_tech_stack) ? techResult.data.full_tech_stack : [];
                if (stack.length) {
                  setCompany((prev: any) => ({
                    ...(prev || {}),
                    technologies: stack,
                    specialties: Array.isArray(prev?.specialties) && prev.specialties.length ? prev.specialties : stack,
                  }));
                }
              }
            }
          } catch (error) {
            console.log('Failed to fetch technographics:', error);
          }

          // Fetch Firmographics from Explorium API
          try {
            const firmoResponse = await fetch(`/api/explorium/firmographics`, {
              method: 'POST',
              headers: enrichHeaders,
              body: JSON.stringify({ domain }),
            });
            if (firmoResponse.ok) {
              const firmoResult = await firmoResponse.json();
              if (firmoResult.success && firmoResult.data) {
                setComprehensiveData((prev: any) => ({ ...(prev || {}), firmographics: firmoResult.data }));
                // Merge key firmographics fields into company to fill header metrics
                const f = firmoResult.data;
                setCompany((prev: any) => ({
                  ...(prev || {}),
                  employee_count_range: f.number_of_employees_range || prev?.employee_count_range,
                  revenue_range: f.yearly_revenue_range || prev?.revenue_range,
                  revenue_exact: f.yearly_revenue_exact || f.yearly_revenue || prev?.revenue_exact,
                  industry: f.naics_description || f.sic_code_description || f.linkedin_industry_category || prev?.industry,
                  linkedin_industry_category: f.linkedin_industry_category || prev?.linkedin_industry_category,
                  linkedin_url: f.linkedin_profile || prev?.linkedin_url,
                  website: f.website || prev?.website,
                  description: f.company_description || f.description || prev?.description,
                  headquarters_country: f.country_name || prev?.headquarters_country,
                  headquarters_city: f.city_name || prev?.headquarters_city,
                  headquarters_state: f.region_name || prev?.headquarters_state,
                  street: f.street || prev?.street,
                  zip_code: f.zip_code || prev?.zip_code,
                  location_display: f.location_display || prev?.location_display,
                  locations: Array.isArray(f.locations) && f.locations.length ? f.locations : prev?.locations,
                  naics: f.naics_code || prev?.naics,
                  sic_code_description: f.sic_code_description || prev?.sic_code_description,
                  founded_year: f.year_founded || f.founded_year || prev?.founded_year,
                  logo_url: f.logo_url || f.linkedin_logo_url || prev?.logo_url,
                }));
              }
            }
          } catch (error) {
            console.log('Failed to fetch firmographics:', error);
          }

          // Fetch Funding & Acquisition from Explorium API
          try {
            const fundingResponse = await fetch(`/api/explorium/funding`, {
              method: 'POST',
              headers: enrichHeaders,
              body: JSON.stringify({ domain }),
            })
            if (fundingResponse.ok) {
              const fundingResult = await fundingResponse.json()
              if (fundingResult.success && fundingResult.data) {
                const fa = fundingResult.data
                setCompany((prev: any) => {
                  const merged = { ...(prev || {}) }
                  const investors = Array.isArray(fa?.investors) ? fa.investors.filter(Boolean) : []
                  if (investors.length) {
                    merged.investors = investors
                    merged.investors_count = investors.length
                  }
                  if (fa?.known_funding_total_value) merged.funding_total = fa.known_funding_total_value
                  if (fa?.last_funding_round_date || fa?.first_funding_round_date) merged.last_funding_date = fa.last_funding_round_date || fa.first_funding_round_date
                  if (fa?.last_funding_round_type || fa?.first_funding_round_type) merged.funding_stage = fa.last_funding_round_type || fa.first_funding_round_type
                  return merged
                })
              }
            }
          } catch (error) {
            console.log('Failed to fetch funding info:', error)
          }

          // Fetch Explorium normalized company profile to fill exact revenue/company_type/logo/description
          try {
            const searchResponse = await fetch(`/api/explorium/company/search`, {
              method: 'POST',
              headers: enrichHeaders,
              body: JSON.stringify({ filters: { domain }, options: { limit: 1, page: 1 } }),
            })
            if (searchResponse.ok) {
              const searchResult = await searchResponse.json()
              const c = Array.isArray(searchResult?.data?.companies) ? searchResult.data.companies[0] : null
              if (c) {
                setCompany((prev: any) => {
                  const merged = { ...(prev || {}) }
                  // Only take non-empty values
                  const take = (existing: any, incoming: any) => {
                    if (existing === undefined || existing === null || existing === '' || (Array.isArray(existing) && existing.length === 0)) {
                      return incoming
                    }
                    return existing
                  }
                  merged.company_type = take(merged.company_type, c.company_type)
                  merged.description = take(merged.description, c.description)
                  merged.logo_url = take(merged.logo_url, c.logo_url)
                  merged.revenue_exact = take(merged.revenue_exact, c.revenue_exact)
                  merged.headquarters_city = take(merged.headquarters_city, c.headquarters_city)
                  return merged
                })
              }
            }
          } catch (error) {
            console.log('Failed to fetch explorium company profile:', error)
          }

          } // end !cachedHit

          // Fetch Social Media Presence from Explorium API
          try {
            const socialToken = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const socialResponse = await fetch(`/api/explorium/social-media-presence`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(socialToken ? { 'Authorization': `Bearer ${socialToken}` } : {}),
              },
              body: JSON.stringify({
                domain,
                include_posts: true,
                posts_limit: 20,
              }),
            });
            if (socialResponse.ok) {
              const socialResult = await socialResponse.json();
              if (socialResult.success && socialResult.data) {
                setSocialMediaPresence(socialResult.data);
              }
            }
          } catch (error) {
            console.log('Failed to fetch social media presence:', error);
          }

          // Fetch Business Intent Topics from Explorium API
          try {
            const intentToken = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const intentResponse = await fetch(`/api/explorium/business-intent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(intentToken ? { 'Authorization': `Bearer ${intentToken}` } : {}),
              },
              body: JSON.stringify({
                domain,
                min_score: 60,
              }),
            });
            if (intentResponse.ok) {
              const intentResult = await intentResponse.json();
              if (intentResult.success && intentResult.data) {
                const raw = intentResult.data;
                let topics: any[] = [];
                try {
                  const parsed = typeof raw.intent_topics === 'string' ? JSON.parse(raw.intent_topics) : raw.intent_topics;
                  if (Array.isArray(parsed)) topics = parsed;
                } catch {
                  topics = [];
                }
                setBusinessIntent({
                  topics,
                  business_id: raw.business_id,
                  company_name: raw.company_name,
                });
              }
            }
          } catch (error) {
            console.log('Failed to fetch business intent:', error);
          }

          setDecisionMakers(decisionMakersData);
          setSocialPosts(SocialPostsData);
          setSocialInsights(SocialInsightsData);
          setLoading(false);
          
          console.log('All data fetched successfully:', {
            company: companyData?.name,
            decisionMakers: decisionMakersData.length,
            SocialPosts: SocialPostsData.length,
            SocialInsights: SocialInsightsData ? 'available' : 'not available',
            decisionMakersData: decisionMakersData
          });
        } catch (err) {
          console.error('Error fetching comprehensive data:', err);
          setError('Failed to load company data. Please try again.');
          setLoading(false);
        }
      })();
    }
  }, [domain]);

  const [revealing, setRevealing] = useState<string | null>(null); // key = `${type}:${linkedin_url}`

  // Defined here so it's available in the DM cards
  const revealContact = async (person: any) => {
    if (!person?.linkedin_url) {
      toast({ title: 'Error', description: 'No Social profile available for this contact', variant: 'destructive' });
      return;
    }
    const key = `email:${person.linkedin_url}`;
    setRevealing(key);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null;
      const res = await fetch('/api/contactout/reveal-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ linkedin_url: person.linkedin_url, include_phone: true }),
      });
      if (!res.ok) throw new Error('Reveal failed');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Reveal failed');
      const email = data.data?.emails?.[0] || data.data?.work_emails?.[0] || data.data?.personal_emails?.[0] || '';
      const phone = data.data?.phones?.[0] || '';
      setRevealedPersonContacts(prev => ({
        ...prev,
        [person.linkedin_url]: { email: email || prev[person.linkedin_url]?.email, phone: phone || prev[person.linkedin_url]?.phone },
      }));
      toast({ title: 'Contact Revealed', description: email || phone || 'No contact found' });
    } catch (err: any) {
      toast({ title: 'Reveal Failed', description: err.message || 'Could not reveal contact', variant: 'destructive' });
    } finally {
      setRevealing(null);
    }
  };
  const [revealedPersonContacts, setRevealedPersonContacts] = useState<Record<string, { phone?: string; email?: string }>>({})

  const enrichSocialProfile = async (person: any) => {
    if (!person.linkedin_url || enrichedProfiles[person.linkedin_url]) {
      return enrichedProfiles[person.linkedin_url] || person;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
      const response = await fetch(`/api/contactout/linkedin-enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          linkedin_url: person.linkedin_url,
          include_experience: true,
          include_education: true,
          include_skills: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.profile) {
          setEnrichedProfiles(prev => ({
            ...prev,
            [person.linkedin_url]: data.profile
          }));
          return data.profile;
        }
      }
    } catch (error) {
      console.log('Failed to enrich Social profile:', error);
    }
    
    return person;
  };

  const revealCompanyContact = async (type: 'phone' | 'email', person: any) => {
    try {
      setRevealing(type);

      if (!person?.linkedin_url) {
        throw new Error('No Social profile available');
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
      const revealRes = await fetch('/api/contactout/reveal-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          linkedin_url: person.linkedin_url,
          include_phone: type === 'phone',
        }),
      });

      if (!revealRes.ok) throw new Error('Reveal failed');
      const revealData = await revealRes.json();
      if (!revealData.success) throw new Error(revealData.error || 'Reveal failed');

      let revealedValue = 'Not found';
      if (type === 'phone') {
        revealedValue = revealData.data.phones?.[0] || 'No phone';
      } else {
        revealedValue =
          revealData.data.emails?.[0] ||
          revealData.data.work_emails?.[0] ||
          revealData.data.personal_emails?.[0] ||
          'No email';
      }

      setRevealedPersonContacts((prev) => ({
        ...prev,
        [person.linkedin_url]: { ...(prev[person.linkedin_url] || {}), [type]: revealedValue }
      }))
      toast({ title: 'Success', description: `${person.full_name || 'Contact'} ${type}: ${revealedValue}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to reveal contact', variant: 'destructive' });
    } finally {
      setRevealing(null);
    }
  };

  const parsePercent = (v: any): number | null => {
    if (v === undefined || v === null || v === '' || v === 'N/A') return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const cleaned = v.replace(/%/g, '').replace(/\+/g, '').trim();
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const getNested = (obj: any, path: string) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
  };

  const firstDefined = (...values: any[]) => {
    for (const v of values) {
      if (v !== undefined && v !== null && v !== '' && v !== 'N/A') return v;
    }
    return undefined;
  };

  const normalizeStringArray = (v: any): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter((x) => x && x !== 'N/A');
  };

  const pickStringArray = (raw: any, paths: string[]): string[] => {
    for (const p of paths) {
      const v = p.includes('.') ? getNested(raw, p) : raw?.[p];
      const arr = normalizeStringArray(v);
      if (arr.length) return arr;
    }
    return [];
  };

  const formatRevenueRange = (lower?: any, upper?: any) => {
    const lo = typeof lower === 'number' ? lower : Number(lower);
    const hi = typeof upper === 'number' ? upper : Number(upper);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= 0) return undefined;

    const fmt = (n: number) => {
      if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} BILLION`;
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MILLION`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(1)} THOUSAND`;
      return String(Math.round(n));
    };

    return `${fmt(lo)} - ${fmt(hi)}`;
  };

  const computeGrowthCategory = (growth6m?: number | null, growth12m?: number | null) => {
    const g = typeof growth12m === 'number' ? growth12m : typeof growth6m === 'number' ? growth6m : null;
    if (g === null) return 'N/A';
    if (g >= 30) return 'High Growth';
    if (g >= 10) return 'Moderate Growth';
    if (g >= 0) return 'Stable';
    return 'Declining';
  };

  const isTechHeavy = (tech?: unknown) => {
    if (!Array.isArray(tech)) return false;
    const cleaned = tech.filter((t) => t && t !== 'N/A');
    return cleaned.length >= 5;
  };

  const hasRecentFunding = (lastFundingDate?: string | null) => {
    if (!lastFundingDate || lastFundingDate === 'N/A') return false;
    const d = new Date(lastFundingDate);
    if (Number.isNaN(d.getTime())) return false;
    const diffMs = Date.now() - d.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    return days <= 365;
  };

  const normalizeCrustdataCompany = (raw: any) => {
    if (!raw) return null;

    const SocialUrl = raw.linkedin_profile_url || raw.company_linkedin_url || raw.linkedin_url;
    const website = raw.company_website || raw.company_website_url || raw.website || raw.company_domain;

    const employeeCountExact =
      raw.Social_headcount ??
      raw.headcount?.Social_headcount ??
      raw.headcount?.headcount ??
      raw.headcount?.employee_count ??
      raw.employee_count_exact;

    const employeeGrowth6mPercent = parsePercent(firstDefined(
      raw.employee_growth_6m_percent,
      getNested(raw, 'employee_metrics.growth_6m_percent'),
      getNested(raw, 'employee_metrics.growth_6m'),
      getNested(raw, 'headcount.growth_6m_percent'),
      getNested(raw, 'headcount.growth_6m'),
    ));

    const followerCount =
      raw.Social_followers?.follower_count ??
      raw.Social_followers?.followers ??
      raw.follower_count;

    const industry =
      (Array.isArray(raw.Social_industries) ? raw.Social_industries[0] : raw.Social_industries) ??
      raw.industry;

    const employeeCountRange = raw.employee_count_range ?? raw.employee_range ?? raw.employee_count ?? raw.employee_count_range;

    const employeeGrowth12mPercent = parsePercent(firstDefined(
      raw.employee_growth_12m_percent,
      getNested(raw, 'employee_metrics.growth_12m_percent'),
      getNested(raw, 'employee_metrics.growth_12m'),
      getNested(raw, 'headcount.growth_12m_percent'),
      getNested(raw, 'headcount.growth_12m'),
    ));

    const technologies = pickStringArray(raw, [
      'technologies',
      'specialties',
      'tech_stack',
      'technology_stack',
      'taxonomy.technologies',
      'seo.technologies',
      'seo.technologies_used',
    ]);

    const revenueRangeDerived = formatRevenueRange(
      firstDefined(raw.estimated_revenue_lower_bound_usd, getNested(raw, 'funding_and_investment.estimated_revenue_lower_bound_usd')),
      firstDefined(raw.estimated_revenue_upper_bound_usd, getNested(raw, 'funding_and_investment.estimated_revenue_upper_bound_usd')),
    );

    const revenueRange = firstDefined(raw.revenue_range, raw.estimated_revenue_range, revenueRangeDerived);

    const fundingStage = firstDefined(
      getNested(raw, 'funding_and_investment.last_funding_round_type'),
      raw.funding_stage,
      raw.last_funding_round_type,
    );

    const fundingTotal = firstDefined(
      getNested(raw, 'funding_and_investment.crunchbase_total_investment_usd'),
      raw.funding_total,
      raw.crunchbase_total_investment_usd,
    );

    const lastFundingDate = firstDefined(
      getNested(raw, 'funding_and_investment.last_funding_date'),
      raw.last_funding_date,
    );

    return {
      name: raw.company_name || raw.name,
      domain: raw.company_website_domain || raw.company_domain,
      logo_url: raw.linkedin_logo_url || raw.logo_url,
      website,
      linkedin_url: SocialUrl,
      description: raw.description || raw.company_description,
      industry,
      company_type: raw.company_type,
      founded_year: raw.year_founded || raw.founded_year,
      headquarters_city: raw.hq_city || raw.headquarters_city,
      headquarters_state: raw.hq_state || raw.headquarters_state,
      headquarters_country: raw.hq_country || raw.headquarters_country,
      revenue_range: revenueRange,
      employee_count_exact: employeeCountExact,
      employee_count_range: employeeCountRange,
      employee_growth_6m_percent: employeeGrowth6mPercent,
      employee_growth_12m_percent: employeeGrowth12mPercent,
      follower_count: followerCount,
      technologies,
      funding_stage: fundingStage,
      funding_total: fundingTotal,
      last_funding_date: lastFundingDate,
      twitter_url: raw.twitter_url,
      facebook_url: raw.facebook_url,
      insights: raw.insights,
      quality_score: raw.quality_score,
      crustdata_raw: raw,
    };
  };

  const normalizeBackendCompany = (raw: any) => {
    if (!raw) return null;

    return {
      id: raw.id,
      name: raw.name,
      domain: raw.domain,
      website: raw.website,
      logo_url: raw.logo_url,
      description: raw.description,
      industry: raw.industry,
      company_type: raw.company_type,
      founded_year: raw.founded_year,

      employee_count_exact: raw.employee_count_exact,
      employee_count_range: raw.employee_range || raw.employee_count_range,
      employee_growth_6m_percent: raw.employee_growth_6m_percent,
      employee_growth_12m_percent: raw.employee_growth_12m_percent,

      revenue_range: raw.revenue_range || raw.revenue,
      funding_stage: raw.funding_stage,
      funding_total: raw.funding_total,
      last_funding_date: raw.last_funding_date,

      headquarters_country: raw.headquarters_country,
      headquarters_state: raw.headquarters_state,
      headquarters_city: raw.headquarters_city,

      phone: raw.phone,
      email: raw.email,
      linkedin_url: raw.linkedin_url,
      twitter_url: raw.twitter_url,
      facebook_url: raw.facebook_url,
      follower_count: raw.follower_count,

      technologies: Array.isArray(raw.technologies) && raw.technologies.length
        ? raw.technologies
        : Array.isArray(raw.specialties) && raw.specialties.length
          ? raw.specialties
          : [],

      decision_makers_count: raw.decision_makers_count,
      quality_score: raw.quality_score,
      provider_source: raw.provider_source,
      enriched: raw.enriched,
    };
  };

  const computeInsights = (c: any): string[] => {
    const out: string[] = [];
    const growth = typeof c?.employee_growth_12m_percent === 'number'
      ? c.employee_growth_12m_percent
      : typeof c?.employee_growth_6m_percent === 'number'
        ? c.employee_growth_6m_percent
        : null;

    if (typeof growth === 'number' && growth >= 30 && (c?.funding_total || 0) > 0) out.push('high-growth-funded');
    if (typeof growth === 'number' && growth >= 20) out.push('organic-growth');
    if (c?.is_tech_heavy) out.push('tech-forward');
    if (c?.has_recent_funding) out.push('recently-funded');
    return Array.from(new Set(out));
  };

  const mergeCompanyData = (primary: any, fallback: any) => {
    if (!primary && !fallback) return null;
    if (!primary) return fallback;
    if (!fallback) return primary;

    const merged: any = { ...fallback, ...primary };

    // Fill missing/empty primary fields from fallback
    for (const key of Object.keys(fallback)) {
      const pv = primary?.[key];
      const fv = fallback?.[key];

      const primaryMissing =
        pv === undefined ||
        pv === null ||
        pv === '' ||
        pv === 'N/A' ||
        (Array.isArray(pv) && pv.length === 0);

      const fallbackHasValue =
        fv !== undefined &&
        fv !== null &&
        fv !== '' &&
        fv !== 'N/A' &&
        (!Array.isArray(fv) || fv.length > 0);

      if (primaryMissing && fallbackHasValue) {
        merged[key] = fv;
      }
    }

    return merged;
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

  const phoneValue = revealedContacts.phone || company.phone || '***-***-****';
  const emailValue = revealedContacts.email || company.email || 'contact@***';
  const isPhoneBlurred = phoneValue.includes('***');
  const isEmailBlurred = emailValue.includes('***') || emailValue.includes('contact@');

  // Defined variables to fix reference errors
  const posts = Array.isArray(SocialPosts) ? SocialPosts : [];
  const reactionsSum = posts.reduce((acc: number, p: any) => {
    const likes = typeof p?.likes === 'number' ? p.likes : (typeof p?.total_reactions === 'number' ? p.total_reactions : 0);
    return acc + likes;
  }, 0);
  const commentsSum = posts.reduce((acc: number, p: any) => {
    const comments = typeof p?.comments === 'number' ? p.comments : (typeof p?.total_comments === 'number' ? p.total_comments : 0);
    return acc + comments;
  }, 0);
  const sharesSum = posts.reduce((acc: number, p: any) => {
    const shares = typeof p?.shares === 'number' ? p.shares : (typeof p?.num_shares === 'number' ? p.num_shares : 0);
    return acc + shares;
  }, 0);
  const avgReactions = posts.length ? Math.round(reactionsSum / posts.length) : 0;
  const avgComments = posts.length ? Math.round(commentsSum / posts.length) : 0;
  const avgShares = posts.length ? Math.round(sharesSum / posts.length) : 0;
  const latestPostDate = (() => {
    const p = posts.find((x: any) => x?.date_posted || x?.created_at || x?.date);
    return p?.date_posted || p?.created_at || p?.date || null;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* Hero Header */}
        <Card className="overflow-hidden border-border/50 shadow-xl">
          <div className="h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-background relative">
            <div className="absolute -bottom-12 left-8">
              <div className="h-28 w-28 rounded-xl overflow-hidden border-4 border-background shadow-lg bg-white flex items-center justify-center">
                {company.logo_url ? (
                  <Image 
                    src={company.logo_url} 
                    alt={company.name || domain} 
                    width={112} 
                    height={112} 
                    className="object-contain p-2" 
                    onError={(e) => {
                      // Fallback to initial on error
                      const target = e.currentTarget;
                      const parent = target.parentElement;
                      if (parent) {
                        target.style.display = 'none';
                        const initial = document.createElement('div');
                        initial.className = "text-4xl font-bold text-primary";
                        initial.innerText = (company.name || domain || 'C').charAt(0).toUpperCase();
                        parent.appendChild(initial);
                      }
                    }}
                  />
                ) : (
                  <div className="text-4xl font-bold text-primary">
                    {(company.name || domain || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-8 pt-20">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold tracking-tight">{company.name || domain}</h1>

                {/* Badges Row */}
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {company.industry && <Badge variant="secondary" className="text-sm px-3 py-1">{company.industry}</Badge>}
                  {company.linkedin_industry_category && company.linkedin_industry_category !== "N/A" && <Badge variant="secondary" className="text-sm px-3 py-1">{company.linkedin_industry_category}</Badge>}
                  {company.company_type && company.company_type !== "N/A" && <Badge variant="outline" className="text-sm px-3 py-1">{company.company_type}</Badge>}
                  {(company.domain || domain) && <Badge variant="outline" className="text-sm px-3 py-1">{company.domain || domain}</Badge>}
                  {company.growth_category && company.growth_category !== 'N/A' && <Badge variant="secondary" className="text-sm px-3 py-1">{company.growth_category}</Badge>}
                  {company.enriched !== undefined && <Badge variant={company.enriched ? "default" : "secondary"} className={company.enriched ? "bg-green-500" : ""}>{company.enriched ? 'Enriched' : 'Not Enriched'}</Badge>}
                  {company.founded_year && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Founded {company.founded_year}
                    </div>
                  )}
                </div>

                {/* Insights */}
                {company.insights && company.insights.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Insights</p>
                    <div className="flex flex-wrap gap-2">
                      {company.insights.map((insight: string) => {
                        const config = INSIGHT_BADGES[insight as keyof typeof INSIGHT_BADGES] || { label: insight, color: 'bg-gray-500', icon: Award };
                        const Icon = config.icon;
                        return (
                          <Badge key={insight} className={`${config.color} text-white text-xs px-2 py-1 gap-1.5`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Description */}
                {company.description && company.description !== "N/A" && (
                  <p className="mt-4 text-muted-foreground leading-relaxed max-w-3xl">{company.description}</p>
                )}
              </div>

              {/* Quick Actions */}
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
                      <Share2 className="h-4 w-4" />
                      Social
                    </a>
                  </Button>
                )}
                              </div>
            </div>
          </div>
        </Card>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-6 text-center hover:shadow-md transition-shadow">
            <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Employees</p>
            <p className="text-2xl font-bold mt-1">
              {company.employee_count_exact ? Number(company.employee_count_exact).toLocaleString() : (company.employee_count_range || 'N/A')}
            </p>
          </Card>
          <Card className="p-6 text-center hover:shadow-md transition-shadow">
            <Briefcase className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-muted-foreground">Decision Makers</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {company.decision_makers_count ? Number(company.decision_makers_count).toLocaleString() : (decisionMakers.length || 0)}
            </p>
          </Card>
          <Card className="p-6 text-center hover:shadow-md transition-shadow">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-lg font-bold mt-1">
              {(typeof company.revenue_exact === 'number' && company.revenue_exact > 0)
                ? `$${Number(company.revenue_exact).toLocaleString()}`
                : (typeof company.revenue_exact === 'string' && company.revenue_exact.trim()
                    ? company.revenue_exact
                    : (company.revenue_range || 'N/A'))}
            </p>
          </Card>
          {typeof company.quality_score === 'number' && (
            <Card className="p-6 text-center hover:shadow-md transition-shadow">
              <Award className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-sm text-muted-foreground">Quality Score</p>
              <p className="text-2xl font-bold mt-1 text-purple-600">{company.quality_score}/100</p>
            </Card>
          )}
          {company.funding_total && company.funding_total > 0 ? (
            <Card className="p-6 text-center hover:shadow-md transition-shadow">
              <Zap className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <p className="text-sm text-muted-foreground mb-2">Total Funding</p>
              <p className="font-bold text-lg">${(company.funding_total / 1000000).toFixed(1)}M</p>
            </Card>
          ) : null}
          {company.founded_year && (
            <Card className="p-6 text-center hover:shadow-md transition-shadow">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-muted-foreground">Founded</p>
              <p className="text-2xl font-bold mt-1">{company.founded_year}</p>
            </Card>
          )}
          {company.follower_count > 0 && (
            <Card className="p-6 text-center hover:shadow-md transition-shadow">
              <Users className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <p className="text-sm text-muted-foreground">Followers</p>
              <p className="text-2xl font-bold mt-1">{company.follower_count.toLocaleString()}</p>
            </Card>
          )}
        </div>

        
        
        {/* Realtime Social Insights */}
        {(posts.length > 0 || company.follower_count) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Realtime Social Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid ${company.follower_count ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
                {company.follower_count && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Followers</p>
                    <p className="text-xl font-semibold">{Number(company.follower_count).toLocaleString()}</p>
                  </div>
                )}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Posts Fetched</p>
                  <p className="text-xl font-semibold">{posts.length || 0}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Latest Post</p>
                  <p className="text-xl font-semibold">
                    {latestPostDate ? new Date(latestPostDate).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            {/* Company Phone */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Company Phone</p>
                  {isPhoneBlurred ? (
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-blue-600 hover:text-blue-800 font-medium" onClick={() => revealCompanyContact('phone', company)} disabled={revealing === 'phone'}>
                      <Lock className="h-3 w-3 mr-1" />
                      {revealing === 'phone' ? 'Revealing...' : 'Click to Reveal'}
                    </Button>
                  ) : (
                    <p className="font-medium text-green-700 flex items-center gap-1.5">
                      <Unlock className="h-3.5 w-3.5" />
                      {phoneValue}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Company Email */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Company Email</p>
                  {isEmailBlurred ? (
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-blue-600 hover:text-blue-800 font-medium" onClick={() => revealCompanyContact('email', company)} disabled={revealing === 'email'}>
                      <Lock className="h-3 w-3 mr-1" />
                      {revealing === 'email' ? 'Revealing...' : 'Click to Reveal'}
                    </Button>
                  ) : (
                    <p className="font-medium text-green-700 flex items-center gap-1.5">
                      <Unlock className="h-3.5 w-3.5" />
                      {emailValue}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        {(company.headquarters_country || company.headquarters_city) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium text-lg">
                      {[company.headquarters_city, company.headquarters_state, company.headquarters_country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {company.street && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="font-medium">{company.street}</p>
                    </div>
                  )}
                  {company.zip_code && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground">ZIP</p>
                      <p className="font-medium">{company.zip_code}</p>
                    </div>
                  )}
                  {company.location_display && company.location_display !== 'N/A' && (
                    <div className="p-3 bg-muted/30 rounded-lg md:col-span-2">
                      <p className="text-xs text-muted-foreground">Location Display</p>
                      <p className="font-medium">{company.location_display}</p>
                    </div>
                  )}
                  {Array.isArray(company.locations) && company.locations.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg md:col-span-2">
                      <p className="text-xs text-muted-foreground">Locations ({company.locations.length})</p>
                      <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {company.locations.slice(0, 4).map((loc: string, i: number) => (
                          <p key={i} className="text-sm">{loc}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Funding */}
        {(company.funding_stage !== "N/A" || company.funding_total || company.last_funding_date !== "N/A") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Funding Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6">
              {company.funding_stage !== "N/A" && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Stage</p>
                  <p className="font-semibold text-lg">{company.funding_stage}</p>
                </div>
              )}
              {company.funding_total > 0 && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Funding</p>
                  <p className="font-semibold text-lg">${company.funding_total.toLocaleString()}</p>
                </div>
              )}
              {company.last_funding_date !== "N/A" && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Last Funding</p>
                  <p className="font-semibold text-lg">{company.last_funding_date}</p>
                </div>
              )}
              {hasRecentFunding(company.last_funding_date) && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Recent Funding</p>
                  <Badge variant="secondary">Yes</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Technologies */}
        {Array.isArray(company.technologies) && company.technologies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Technologies{` (${company.technologies.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {company.technologies.map((tech: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-sm px-3 py-1.5">
                    {tech}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Technographics */}
        {technographics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Technology Stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(technographics.full_tech_stack) && technographics.full_tech_stack.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {technographics.full_tech_stack.slice(0, 12).map((tech: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                          <Code className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tech.name || tech}</p>
                          <p className="text-xs text-muted-foreground">{tech.category || 'Software'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {technographics.full_tech_stack.length > 12 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{technographics.full_tech_stack.length - 12} more technologies
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No technology data available.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Social Media Presence */}
        {socialMediaPresence && Array.isArray(socialMediaPresence.posts) && socialMediaPresence.posts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Social Media Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Total Posts</p>
                    <p className="text-2xl font-bold text-blue-600">{socialMediaPresence.posts.length}</p>
                  </div>
                  {typeof socialMediaPresence.average_engagement === 'number' && (
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Avg Engagement</p>
                      <p className="text-2xl font-bold text-green-600">
                        {socialMediaPresence.average_engagement}
                      </p>
                    </div>
                  )}
                  {Array.isArray(socialMediaPresence.top_topics) && socialMediaPresence.top_topics.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Top Topics</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {socialMediaPresence.top_topics.length}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-lg">Recent Posts</h4>
                  {socialMediaPresence.posts.slice(0, 3).map((post: any, i: number) => (
                    <div key={i} className="p-3 bg-muted/20 rounded-lg">
                      <p className="text-sm line-clamp-3">{post.post_text || post.content || ''}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>👍 {typeof post.likes === 'number' ? post.likes : 0}</span>
                        <span>💬 {typeof post.comments === 'number' ? post.comments : 0}</span>
                        <span>🔄 {typeof post.shares === 'number' ? post.shares : 0}</span>
                        <span>📅 {post.date || post.created_at ? new Date(post.date || post.created_at).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Business Intent Topics */}
        {businessIntent && Array.isArray(businessIntent.topics) && businessIntent.topics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Business Intent Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Topics this company is actively researching online (Business intent intelligence):
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {businessIntent.topics.slice(0, 9).map((topic: any, i: number) => (
                    <div key={i} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm truncate">{topic.topic}</p>
                        {typeof topic.composite_score === 'number' && (
                          <Badge variant="secondary" className="text-xs">
                            Score: {topic.composite_score}
                          </Badge>
                        )}
                      </div>
                      {typeof topic.week === 'string' && topic.week.trim() && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Week: {topic.week}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {businessIntent.topics.length > 9 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{businessIntent.topics.length - 9} more topics
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Social Links */}
        {(company.linkedin_url !== "N/A" || company.twitter_url !== "N/A" || company.facebook_url !== "N/A") && (
          <Card>
            <CardHeader>
              <CardTitle>Social Presence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {company.linkedin_url && company.linkedin_url !== "N/A" && (
                  <Button variant="outline" asChild className="gap-2">
                    <a href={company.linkedin_url.startsWith('http') ? company.linkedin_url : `https://${company.linkedin_url}`} target="_blank" rel="noopener noreferrer">
                      <Share2 className="h-4 w-4" />
                      Social
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                {company.twitter_url && company.twitter_url !== "N/A" && (
                  <Button variant="outline" asChild className="gap-2">
                    <a href={company.twitter_url} target="_blank" rel="noopener noreferrer">
                      <Twitter className="h-4 w-4" />
                      Twitter
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                {company.facebook_url && company.facebook_url !== "N/A" && (
                  <Button variant="outline" asChild className="gap-2">
                    <a href={company.facebook_url} target="_blank" rel="noopener noreferrer">
                      <Facebook className="h-4 w-4" />
                      Facebook
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Investors & Funding Details */}
        {(company.investors && company.investors.length > 0) || company.funding_stage || company.funding_total || company.investors_count ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Investors & Funding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4">
                {company.investors_count !== undefined && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Investors Count</p>
                    <p className="text-2xl font-bold">{company.investors_count}</p>
                  </div>
                )}
                {company.funding_stage && company.funding_stage !== 'N/A' ? (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Funding Stage</p>
                    <Badge className="mt-1">{company.funding_stage}</Badge>
                  </div>
                ) : null}
                {company.funding_total && company.funding_total > 0 ? (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Total Funding</p>
                    <p className="font-bold text-lg">${(company.funding_total / 1000000).toFixed(1)}M</p>
                  </div>
                ) : null}
                {company.last_funding_date && company.last_funding_date !== 'N/A' ? (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Last Funding Date</p>
                    <p className="font-semibold">{company.last_funding_date}</p>
                  </div>
                ) : null}
              </div>
              
              {company.investors && company.investors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3">Top Investors</p>
                  <div className="flex flex-wrap gap-2">
                    {company.investors.slice(0, 8).map((investor: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-sm px-3 py-1.5">
                        {investor}
                      </Badge>
                    ))}
                    {company.investors.length > 8 && (
                      <Badge variant="secondary" className="text-sm px-3 py-1.5">
                        +{company.investors.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Competitors */}
        {company.competitors && company.competitors.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Competitors ({company.competitors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {company.competitors.slice(0, 10).map((competitor: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-sm px-3 py-1.5">
                    {competitor}
                  </Badge>
                ))}
                {company.competitors.length > 10 && (
                  <Badge variant="secondary" className="text-sm px-3 py-1.5">
                    +{company.competitors.length - 10} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Company Metrics & Intelligence */}
        {(company.job_openings_count || company.web_traffic || company.seo_score || company.quality_score || company.decision_makers_count) ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Company Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                {company.quality_score !== undefined && (
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-2">Quality Score</p>
                    <p className="text-2xl font-bold text-primary">{company.quality_score}/100</p>
                  </div>
                )}
                {company.decision_makers_count !== undefined && company.decision_makers_count > 0 ? (
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-2">Decision Makers</p>
                    <p className="text-2xl font-bold text-blue-600">{company.decision_makers_count}</p>
                  </div>
                ) : null}
                {company.job_openings_count ? (
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-2">Open Positions</p>
                    <p className="text-2xl font-bold text-green-600">{company.job_openings_count}</p>
                  </div>
                ) : null}
                {company.web_traffic ? (
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-2">Web Traffic</p>
                    <p className="text-sm font-semibold">{typeof company.web_traffic === 'object' ? company.web_traffic.visits?.toLocaleString() || 'N/A' : company.web_traffic}</p>
                  </div>
                ) : null}
                {company.seo_score ? (
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-2">SEO Score</p>
                    <p className="text-2xl font-bold text-orange-600">{company.seo_score}</p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Organization Structure */}
        {(company.founders_profiles?.length > 0 || company.cxos?.length > 0) ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Organization Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {company.founders_profiles && company.founders_profiles.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Founders ({company.founders_profiles.length})
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {company.founders_profiles.map((founder: any, i: number) => (
                      <div key={i} className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-medium">{founder.name || 'Unknown'}</p>
                        {founder.title && <p className="text-sm text-muted-foreground">{founder.title}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {company.cxos && company.cxos.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Executives ({company.cxos.length})
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {company.cxos.map((exec: any, i: number) => (
                      <div key={i} className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-medium">{exec.name || 'Unknown'}</p>
                        {exec.title && <p className="text-sm text-muted-foreground">{exec.title}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Taxonomy & Classification */}
        {company.taxonomy && company.taxonomy.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Industry Classification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3 mb-4">
                {company.naics && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">NAICS</p>
                    <p className="font-medium">{company.naics}</p>
                  </div>
                )}
                {company.sic_code_description && company.sic_code_description !== 'N/A' && (
                  <div className="p-3 bg-muted/30 rounded-lg md:col-span-2">
                    <p className="text-xs text-muted-foreground">SIC Description</p>
                    <p className="font-medium">{company.sic_code_description}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {company.taxonomy.map((code: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-sm px-3 py-1.5">
                    {code}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

         {/* Company ID removed as requested */}


        {/* Decision Makers */}
        {decisionMakers.length > 0 && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-5 w-5 text-primary" />
                  Key Decision Makers
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{decisionMakers.length} found</Badge>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {decisionMakers.map((person: any, index: number) => {
                  const revealed = revealedPersonContacts[person.linkedin_url] || {};
                  const revealKey = `email:${person.linkedin_url}`;
                  const isRevealing = revealing === revealKey;
                  const hasEmail = revealed.email && !revealed.email.includes('***');
                  const hasPhone = revealed.phone && !revealed.phone.includes('***');
                  const initials = (person.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div key={index} className="flex items-start gap-4 p-5 hover:bg-muted/20 transition-colors">
                      {/* Avatar */}
                      <div className="shrink-0">
                        {person.profile_picture_url ? (
                          <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-border/50 shadow-sm">
                            <Image src={person.profile_picture_url} alt={person.full_name || ''} width={48} height={48} className="object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                            {initials}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-semibold text-sm truncate">{person.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate">{person.title || person.headline || 'N/A'}</p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {person.linkedin_url && (
                              <a href={person.linkedin_url.startsWith('http') ? person.linkedin_url : `https://${person.linkedin_url}`} target="_blank" rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors">
                                <Share2 className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Location + seniority */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {person.location && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{person.location}</span>}
                          {person.seniority && <Badge variant="outline" className="text-[10px] py-0 h-4">{person.seniority}</Badge>}
                          {person.job_function && <Badge variant="outline" className="text-[10px] py-0 h-4">{person.job_function}</Badge>}
                        </div>

                        {/* Revealed contacts */}
                        {(hasEmail || hasPhone) && (
                          <div className="flex gap-3 mt-2 flex-wrap">
                            {hasEmail && (
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                <Mail className="h-3 w-3" />{revealed.email}
                              </span>
                            )}
                            {hasPhone && (
                              <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                <Phone className="h-3 w-3" />{revealed.phone}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Direct email on profile */}
                        {person.email && !hasEmail && (
                          <span className="flex items-center gap-1 text-xs text-green-700 mt-1.5">
                            <Mail className="h-3 w-3" />{person.email}
                          </span>
                        )}

                        {/* Actions */}
                        {!hasEmail && !hasPhone && person.linkedin_url && (
                          <Button
                            variant="outline" size="sm"
                            className="mt-2 h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                            onClick={() => revealContact(person)}
                            disabled={isRevealing}
                          >
                            {isRevealing ? <><Zap className="h-3 w-3 animate-pulse" /> Revealing...</> : <><Unlock className="h-3 w-3" /> Reveal Contact</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Social Posts */}
        {Array.isArray(SocialPosts) && SocialPosts.length > 0 && (
          <Card className="border-border/50 shadow-2xl hover:shadow-3xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                <Activity className="h-6 w-6" />
                Recent Social Activity
                <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-800">
                  {SocialPosts.length} Posts
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {/* Posts Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Posts</p>
                  <p className="text-2xl font-bold text-blue-600">{SocialPosts.length}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl text-center">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-medium text-muted-foreground mb-1">Latest Post</p>
                  <p className="text-lg font-bold text-green-600">
                    {SocialPosts.length > 0 ? new Date(SocialPosts[0]?.date || SocialPosts[0]?.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-sm font-medium text-muted-foreground mb-1">Avg. Engagement</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {SocialPosts.length > 0 ? Math.round(SocialPosts.reduce((sum: number, post: any) => sum + (post.likes || post.reactions || 0), 0) / SocialPosts.length) : 0}
                  </p>
                </div>
              </div>

              {/* Posts Grid */}
              <div className="space-y-4">
                {SocialPosts.slice(0, 6).map((post: any, idx: number) => {
                  const postDate = new Date(post.date || post.created_at);
                  const isRecent = postDate.getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
                  
                  return (
                    <Card key={idx} className={`group overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-105 border-gradient-to-br ${isRecent ? 'from-blue-50 to-indigo-50 border-blue-200' : 'from-gray-50 to-white border-gray-200'}`}>
                      <CardContent className="p-6">
                        {/* Post Header */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            {post.display_name ? (
                              <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-bold text-sm">
                                    {post.display_name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-semibold text-lg">{post.display_name}</p>
                                  <p className="text-sm text-muted-foreground">{post.title || 'Posted an update'}</p>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="font-semibold text-lg">{company?.name || domain}</p>
                                <p className="text-sm text-muted-foreground">Company Post</p>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {postDate.toLocaleDateString()}
                            </p>
                            {isRecent && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                Recent
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line bg-white/50 p-4 rounded-lg border border-gray-200">
                            {String(post.post_text || post.content || '').slice(0, 500)}
                            {String(post.post_text || post.content || '').length > 500 && '...'}
                          </p>
                          
                          {/* Engagement Metrics */}
                          {(post.likes || post.reactions || post.comments || post.shares) && (
                            <div className="flex items-center gap-4 pt-3 border-t border-gray-200">
                              {post.likes && (
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                    <span className="text-red-600 text-sm font-bold">❤️</span>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Likes</p>
                                    <p className="text-sm font-semibold text-red-600">{post.likes}</p>
                                  </div>
                                </div>
                              )}
                              
                              {post.comments && (
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-blue-600 text-sm font-bold">💬</span>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Comments</p>
                                    <p className="text-sm font-semibold text-blue-600">{post.comments}</p>
                                  </div>
                                </div>
                              )}
                              
                              {post.shares && (
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                    <span className="text-green-600 text-sm font-bold">🔄</span>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Shares</p>
                                    <p className="text-sm font-semibold text-green-600">{post.shares}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* View More Button */}
              {SocialPosts.length > 6 && (
                <div className="text-center mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // Load more posts logic
                      const morePosts = SocialPosts.slice(6);
                      setSocialPosts([...SocialPosts, ...morePosts]);
                    }}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    Load More Posts
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        </div>
    </div>
  );
}
