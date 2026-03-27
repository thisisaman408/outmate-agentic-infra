'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function CompanySignalsFeatures() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const handleInputChange = (tab: string, field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [field]: value,
      }
    }));
  };

  const handleSubmit = async (tab: string) => {
    setLoading(true);
    try {
      let endpoint = '';
      let body = formData[tab] || {};

      switch (tab) {
        case 'identification':
          endpoint = '/api/v1/leads/identify-company';
          break;
        case 'enrichment':
          endpoint = '/api/v1/leads/enrich-company';
          break;
        case 'in-db-search':
          endpoint = '/api/v1/leads/in-db-search';
          body = { filters: body };
          break;
        case 'realtime-search':
          endpoint = '/api/v1/leads/realtime-search';
          body = { filters: body };
          break;
        case 'realtime-linkedin-post':
          endpoint = '/api/v1/leads/realtime-linkedin-post';
          break;
        case 'linkedin-post-keyword':
          endpoint = '/api/v1/leads/linkedin-post-keyword';
          break;
      }

      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setResult(data);
      toast({ title: "Success", description: `${tab} completed` });
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Signals Features</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="identification">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="identification">Identification</TabsTrigger>
            <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
            <TabsTrigger value="in-db-search">In-DB Search</TabsTrigger>
            <TabsTrigger value="realtime-search">Realtime Search</TabsTrigger>
            <TabsTrigger value="realtime-linkedin-post">Realtime Social Post</TabsTrigger>
            <TabsTrigger value="linkedin-post-keyword">Social Keyword Post</TabsTrigger>
          </TabsList>

          <TabsContent value="identification">
            <div className="space-y-4">
              <Label>Company Name</Label>
              <Input onChange={(e) => handleInputChange('identification', 'name', e.target.value)} />
              <Label>Domain</Label>
              <Input onChange={(e) => handleInputChange('identification', 'domain', e.target.value)} />
              {/* Add other fields like linkedin_url, crunchbase_url, company_id */}
              <Button onClick={() => handleSubmit('identification')} disabled={loading}>Identify</Button>
            </div>
          </TabsContent>

          {/* Similar TabsContent for each feature with relevant inputs and submit */}
          {/* Example for Enrichment */}
          <TabsContent value="enrichment">
            <div className="space-y-4">
              <Label>Domain</Label>
              <Input onChange={(e) => handleInputChange('enrichment', 'domain', e.target.value)} />
              <Button onClick={() => handleSubmit('enrichment')} disabled={loading}>Enrich</Button>
            </div>
          </TabsContent>

          {/* Repeat for in-db-search, realtime-search, etc. */}
          {/* ... */}

          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
