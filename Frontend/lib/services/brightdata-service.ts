/**
 * Brightdata Dataset API Service
 * Integrates with Brightdata datasets for Companies and People data
 * Provides fallback to existing REST APIs when Brightdata fails
 */

export interface BrightdataDataset {
  id: string
  name: string
  size: number
}

export interface BrightdataFilter {
  name: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'in' | 'not_in'
  value: any
}

export interface BrightdataSnapshotRequest {
  dataset_id: string
  records_limit?: number
  filter?: BrightdataFilter | {
    and?: BrightdataFilter[]
    or?: BrightdataFilter[]
  }
}

export interface BrightdataSnapshot {
  snapshot_id: string
  status: 'pending' | 'ready' | 'failed'
  created_at: string
  records_count?: number
}

export interface BrightdataRecord {
  [key: string]: any
}

export interface BrightdataResponse<T> {
  success: boolean
  data?: T
  error?: string
  from_fallback?: boolean
}

// Dataset IDs (these would be determined from the actual dataset list)
const DATASET_IDS = {
  COMPANIES: 'gd_l1vijqt9jfj7olije', // Crunchbase companies information
  PEOPLE: 'gd_l1vikfch901nx3by4'    // LinkedIn profiles (example)
} as const

class BrightdataService {
  private apiKey: string
  private baseUrl: string = 'https://api.brightdata.com'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_BRIGHTDATA_API_KEY || ''
  }

  /**
   * Get list of available datasets
   */
  async getDatasets(): Promise<BrightdataResponse<BrightdataDataset[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/datasets/list`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch datasets: ${response.statusText}`)
      }

      const datasets = await response.json()
      return { success: true, data: datasets }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get dataset metadata
   */
  async getDatasetMetadata(datasetId: string): Promise<BrightdataResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/datasets/${datasetId}/metadata`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch dataset metadata: ${response.statusText}`)
      }

      const metadata = await response.json()
      return { success: true, data: metadata }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Create a snapshot with filters
   */
  async createSnapshot(request: BrightdataSnapshotRequest): Promise<BrightdataResponse<BrightdataSnapshot>> {
    try {
      const response = await fetch(`${this.baseUrl}/datasets/filter`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`Failed to create snapshot: ${response.statusText}`)
      }

      const snapshot = await response.json()
      return { success: true, data: snapshot }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get snapshot status
   */
  async getSnapshotStatus(snapshotId: string): Promise<BrightdataResponse<BrightdataSnapshot>> {
    try {
      const response = await fetch(`${this.baseUrl}/datasets/snapshots/${snapshotId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get snapshot status: ${response.statusText}`)
      }

      const snapshot = await response.json()
      return { success: true, data: snapshot }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Download snapshot data
   */
  async downloadSnapshot(snapshotId: string, format: 'json' | 'csv' = 'json'): Promise<BrightdataResponse<BrightdataRecord[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/datasets/snapshots/${snapshotId}/download?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to download snapshot: ${response.statusText}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Search companies with filters
   */
  async searchCompanies(filters: Record<string, any>, limit: number = 100): Promise<BrightdataResponse<any[]>> {
    try {
      // Convert filters to Brightdata format
      const brightdataFilters = this.convertFiltersToBrightdata(filters)
      
      const request: BrightdataSnapshotRequest = {
        dataset_id: DATASET_IDS.COMPANIES,
        records_limit: limit,
        filter: brightdataFilters
      }

      // Create snapshot
      const snapshotResult = await this.createSnapshot(request)
      if (!snapshotResult.success || !snapshotResult.data) {
        throw new Error(snapshotResult.error || 'Failed to create snapshot')
      }

      // Wait for snapshot to be ready (polling)
      const snapshot = await this.waitForSnapshot(snapshotResult.data.snapshot_id)
      
      // Download data
      const downloadResult = await this.downloadSnapshot(snapshot.snapshot_id)
      if (!downloadResult.success || !downloadResult.data) {
        throw new Error(downloadResult.error || 'Failed to download data')
      }

      // Transform data to match expected format
      const transformedData = this.transformCompanyData(downloadResult.data)
      
      return { success: true, data: transformedData }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Search people with filters
   */
  async searchPeople(filters: Record<string, any>, limit: number = 100): Promise<BrightdataResponse<any[]>> {
    try {
      // Convert filters to Brightdata format
      const brightdataFilters = this.convertFiltersToBrightdata(filters)
      
      const request: BrightdataSnapshotRequest = {
        dataset_id: DATASET_IDS.PEOPLE,
        records_limit: limit,
        filter: brightdataFilters
      }

      // Create snapshot
      const snapshotResult = await this.createSnapshot(request)
      if (!snapshotResult.success || !snapshotResult.data) {
        throw new Error(snapshotResult.error || 'Failed to create snapshot')
      }

      // Wait for snapshot to be ready (polling)
      const snapshot = await this.waitForSnapshot(snapshotResult.data.snapshot_id)
      
      // Download data
      const downloadResult = await this.downloadSnapshot(snapshot.snapshot_id)
      if (!downloadResult.success || !downloadResult.data) {
        throw new Error(downloadResult.error || 'Failed to download data')
      }

      // Transform data to match expected format
      const transformedData = this.transformPeopleData(downloadResult.data)
      
      return { success: true, data: transformedData }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Wait for snapshot to be ready (polling mechanism)
   */
  private async waitForSnapshot(snapshotId: string, maxAttempts: number = 30, delay: number = 2000): Promise<BrightdataSnapshot> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResult = await this.getSnapshotStatus(snapshotId)
      
      if (!statusResult.success || !statusResult.data) {
        throw new Error(statusResult.error || 'Failed to get snapshot status')
      }

      const snapshot = statusResult.data
      if (snapshot.status === 'ready') {
        return snapshot
      } else if (snapshot.status === 'failed') {
        throw new Error('Snapshot processing failed')
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    throw new Error('Snapshot processing timed out')
  }

  /**
   * Convert app filters to Brightdata filter format
   */
  private convertFiltersToBrightdata(filters: Record<string, any>): BrightdataFilter | { and: BrightdataFilter[] } {
    const brightdataFilters: BrightdataFilter[] = []

    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        // Handle array filters (multiple selections)
        brightdataFilters.push({
          name: key,
          operator: 'in',
          value: value
        })
      } else if (value !== null && value !== undefined && value !== '') {
        // Handle single value filters
        brightdataFilters.push({
          name: key,
          operator: 'contains',
          value: value
        })
      }
    })

    return brightdataFilters.length > 1 
      ? { and: brightdataFilters }
      : brightdataFilters[0]
  }

  /**
   * Transform Brightdata company data to match app format
   */
  private transformCompanyData(data: BrightdataRecord[]): any[] {
    return data.map(record => ({
      id: record.id || record.company_id,
      name: record.name || record.company_name,
      domain: record.domain || record.website,
      description: record.description || record.company_description,
      industry: record.industry || record.category,
      size: record.size || record.employee_count,
      location: record.location || record.headquarters,
      founded: record.founded || record.founded_year,
      website: record.website || record.url,
      linkedin: record.linkedin_url || record.linkedin,
      funding: record.funding || record.total_funding,
      revenue: record.revenue || record.annual_revenue,
      // Add any other necessary field mappings
    }))
  }

  /**
   * Transform Brightdata people data to match app format
   */
  private transformPeopleData(data: BrightdataRecord[]): any[] {
    return data.map(record => ({
      id: record.id || record.profile_id,
      name: `${record.first_name || ''} ${record.last_name || ''}`.trim(),
      firstName: record.first_name,
      lastName: record.last_name,
      title: record.title || record.job_title,
      company: record.company || record.current_company,
      email: record.email,
      phone: record.phone || record.phone_number,
      location: record.location || record.city,
      linkedin: record.linkedin_url || record.linkedin,
      experience: record.experience || record.total_experience,
      skills: record.skills || Array.isArray(record.skill) ? record.skill : [],
      education: record.education || record.degree,
      summary: record.summary || record.about,
      // Add any other necessary field mappings
    }))
  }
}

// Export singleton instance
export const brightdataService = new BrightdataService()

// Export service class for testing or custom instances
export { BrightdataService }
