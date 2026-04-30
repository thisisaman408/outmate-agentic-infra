/**
 * Unified Data Service
 * Integrates Brightdata Dataset API with existing REST APIs as fallback
 * Provides seamless switching between data sources
 */

import { brightdataService, BrightdataResponse } from './brightdata-service'
import { searchProspects, type ProspectSearchFilters, type ProspectSearchResponse } from './prospectService'
import { searchCompanies, type CompanySearchFilters, type CompanySearchResponse } from './company-service'
import { toast } from 'sonner'

export interface UnifiedSearchOptions {
  useBrightdata?: boolean
  enableFallback?: boolean
  timeout?: number
}

export interface UnifiedSearchResult<T> {
  data: T[]
  source: 'brightdata' | 'fallback'
  total: number
  hasMore: boolean
}

class UnifiedDataService {
  private brightdataEnabled: boolean = true
  private fallbackEnabled: boolean = true
  private defaultTimeout: number = 10000 // 10 seconds

  constructor() {
    // Check if Brightdata API key is available
    this.brightdataEnabled = !!process.env.NEXT_PUBLIC_BRIGHTDATA_API_KEY
  }

  /**
   * Search companies with Brightdata as primary and fallback to existing API
   */
  async searchCompanies(
    filters: CompanySearchFilters,
    options: UnifiedSearchOptions = {}
  ): Promise<UnifiedSearchResult<any>> {
    const {
      useBrightdata = this.brightdataEnabled,
      enableFallback = this.fallbackEnabled,
      timeout = this.defaultTimeout
    } = options

    // Try Brightdata first if enabled
    if (useBrightdata) {
      try {
        const brightdataResult = await this.withTimeout(
          brightdataService.searchCompanies(filters, 100),
          timeout
        )

        if (brightdataResult.success && brightdataResult.data) {
          console.log('✅ Brightdata companies search successful')
          return {
            data: brightdataResult.data,
            source: 'brightdata',
            total: brightdataResult.data.length,
            hasMore: brightdataResult.data.length >= 100
          }
        }
      } catch (error) {
        console.warn('⚠️ Brightdata companies search failed:', error)
        
        if (!enableFallback) {
          throw new Error('Brightdata search failed and fallback is disabled')
        }
      }
    }

    // Fallback to existing API
    if (enableFallback) {
      try {
        console.log('🔄 Falling back to existing companies API')
        const fallbackResult = await searchCompanies(filters)
        
        return {
          data: fallbackResult.companies || [],
          source: 'fallback',
          total: fallbackResult.total || 0,
          hasMore: fallbackResult.hasMore || false
        }
      } catch (error) {
        console.error('❌ Fallback companies API also failed:', error)
        throw new Error('Both Brightdata and fallback APIs failed')
      }
    }

    throw new Error('No data sources available')
  }

  /**
   * Search people with Brightdata as primary and fallback to existing API
   */
  async searchPeople(
    filters: ProspectSearchFilters,
    options: UnifiedSearchOptions = {}
  ): Promise<UnifiedSearchResult<any>> {
    const {
      useBrightdata = this.brightdataEnabled,
      enableFallback = this.fallbackEnabled,
      timeout = this.defaultTimeout
    } = options

    // Try Brightdata first if enabled
    if (useBrightdata) {
      try {
        const brightdataResult = await this.withTimeout(
          brightdataService.searchPeople(filters, 100),
          timeout
        )

        if (brightdataResult.success && brightdataResult.data) {
          console.log('✅ Brightdata people search successful')
          return {
            data: brightdataResult.data,
            source: 'brightdata',
            total: brightdataResult.data.length,
            hasMore: brightdataResult.data.length >= 100
          }
        }
      } catch (error) {
        console.warn('⚠️ Brightdata people search failed:', error)
        
        if (!enableFallback) {
          throw new Error('Brightdata search failed and fallback is disabled')
        }
      }
    }

    // Fallback to existing API
    if (enableFallback) {
      try {
        console.log('🔄 Falling back to existing people API')
        const fallbackResult = await searchProspects(filters)
        
        return {
          data: fallbackResult.profiles || [],
          source: 'fallback',
          total: fallbackResult.total_count || 0,
          hasMore: !!fallbackResult.next_cursor
        }
      } catch (error) {
        console.error('❌ Fallback people API also failed:', error)
        throw new Error('Both Brightdata and fallback APIs failed')
      }
    }

    throw new Error('No data sources available')
  }

  /**
   * Get available datasets from Brightdata
   */
  async getDatasets(): Promise<BrightdataResponse<any[]>> {
    if (!this.brightdataEnabled) {
      return { success: false, error: 'Brightdata not enabled' }
    }

    return brightdataService.getDatasets()
  }

  /**
   * Test Brightdata connectivity
   */
  async testBrightdataConnectivity(): Promise<{ success: boolean; message: string }> {
    if (!this.brightdataEnabled) {
      return { success: false, message: 'Brightdata API key not configured' }
    }

    try {
      const result = await brightdataService.getDatasets()
      if (result.success) {
        return { success: true, message: 'Brightdata connection successful' }
      } else {
        return { success: false, message: result.error || 'Connection failed' }
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get service status and configuration
   */
  getServiceStatus() {
    return {
      brightdata: {
        enabled: this.brightdataEnabled,
        configured: !!process.env.NEXT_PUBLIC_BRIGHTDATA_API_KEY
      },
      fallback: {
        enabled: this.fallbackEnabled
      },
      defaultTimeout: this.defaultTimeout
    }
  }

  /**
   * Enable/disable Brightdata
   */
  setBrightdataEnabled(enabled: boolean) {
    this.brightdataEnabled = enabled
  }

  /**
   * Enable/disable fallback
   */
  setFallbackEnabled(enabled: boolean) {
    this.fallbackEnabled = enabled
  }

  /**
   * Set default timeout
   */
  setDefaultTimeout(timeout: number) {
    this.defaultTimeout = timeout
  }

  /**
   * Wrapper to add timeout to promises
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }

  /**
   * Enhanced search with retry logic and user feedback
   */
  async searchCompaniesWithRetry(
    filters: CompanySearchFilters,
    options: UnifiedSearchOptions = {},
    maxRetries: number = 2
  ): Promise<UnifiedSearchResult<any>> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.searchCompanies(filters, options)
        
        // Show success message with source info
        if (attempt > 0) {
          toast.success(`Search successful using ${result.source} data source`)
        }
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < maxRetries) {
          console.log(`Retrying companies search (attempt ${attempt + 1}/${maxRetries + 1})`)
          toast.warning(`Search failed, retrying... (${attempt + 1}/${maxRetries + 1})`)
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    // All retries failed
    toast.error('Company search failed after multiple attempts')
    throw lastError || new Error('Search failed after multiple attempts')
  }

  /**
   * Enhanced people search with retry logic
   */
  async searchPeopleWithRetry(
    filters: ProspectSearchFilters,
    options: UnifiedSearchOptions = {},
    maxRetries: number = 2
  ): Promise<UnifiedSearchResult<any>> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.searchPeople(filters, options)
        
        // Show success message with source info
        if (attempt > 0) {
          toast.success(`Search successful using ${result.source} data source`)
        }
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < maxRetries) {
          console.log(`Retrying people search (attempt ${attempt + 1}/${maxRetries + 1})`)
          toast.warning(`Search failed, retrying... (${attempt + 1}/${maxRetries + 1})`)
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    // All retries failed
    toast.error('People search failed after multiple attempts')
    throw lastError || new Error('Search failed after multiple attempts')
  }
}

// Export singleton instance
export const unifiedDataService = new UnifiedDataService()

// Export service class for testing or custom instances
export { UnifiedDataService }
