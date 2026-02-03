import axios, { AxiosInstance } from 'axios';

/**
 * CMS Service for Commerce Cloud
 * 
 * Fetches CMS pages, components, and content from SAP Commerce Cloud OCC API
 */

interface CMSPageResponse {
  uid: string;
  name: string;
  typeCode: string;
  template: string;
  contentSlots?: any[];
  [key: string]: any;
}

interface CMSComponentResponse {
  component: Array<{
    uid: string;
    typeCode: string;
    name?: string;
    [key: string]: any;
  }>;
}

interface CMSLanguage {
  isocode: string;
  name: string;
  nativeName: string;
  active: boolean;
}

export class CMSService {
  private client: AxiosInstance;
  private baseUrl: string;
  private baseSiteId: string;

  constructor() {
    this.baseUrl = process.env.COMMERCE_CLOUD_API_URL || 
      'https://api.cqgm99dz6h-lenzingag1-p1-public.model-t.cc.commerce.ondemand.com';
    this.baseSiteId = process.env.COMMERCE_CLOUD_BASE_SITE || 'portal';

    this.client = axios.create({
      baseURL: `${this.baseUrl}/occ/v2/${this.baseSiteId}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get CMS Page by label/ID or code
   * Supports ContentPage, CategoryPage, and ProductPage
   */
  async getPage(
    options: {
      pageLabelOrId?: string;
      pageType?: 'ContentPage' | 'CategoryPage' | 'ProductPage';
      code?: string;
      lang?: string;
      curr?: string;
    }
  ): Promise<CMSPageResponse> {
    const {
      pageLabelOrId,
      pageType = 'ContentPage',
      code,
      lang = 'en',
      curr = 'EUR'
    } = options;

    const params: any = {
      pageType,
      lang,
      curr,
    };

    // ContentPage uses pageLabelOrId
    if (pageLabelOrId) {
      params.pageLabelOrId = pageLabelOrId;
    }

    // CategoryPage/ProductPage uses code
    if (code) {
      params.code = code;
    }

    const response = await this.client.get('/cms/pages', {
      params,
    });

    return response.data;
  }

  /**
   * Get multiple CMS Components by IDs
   */
  async getComponents(
    componentIds: string[],
    lang: string = 'en',
    curr: string = 'EUR'
  ): Promise<CMSComponentResponse> {
    const response = await this.client.get('/cms/components', {
      params: {
        fields: 'DEFAULT',
        currentPage: 0,
        pageSize: componentIds.length,
        componentIds: componentIds.join(','),
        lang,
        curr,
      },
    });

    return response.data;
  }

  /**
   * Get available languages
   */
  async getLanguages(
    lang: string = 'en',
    curr: string = 'EUR'
  ): Promise<{ languages: CMSLanguage[] }> {
    const response = await this.client.get('/languages', {
      params: { lang, curr },
    });

    return response.data;
  }

  /**
   * Get translation file
   */
  async getTranslation(
    lang: string = 'en',
    namespace: string = 'common'
  ): Promise<Record<string, string>> {
    const response = await this.client.get(`/translation/${lang}/${namespace}.json`);
    return response.data;
  }

  /**
   * Get CDC (Gigya) configuration
   */
  async getCDCConfig(): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/occ/v2/configuration/cdc`);
    return response.data;
  }

  /**
   * Get Analytics configuration
   */
  async getAnalyticsConfig(
    lang: string = 'en',
    curr: string = 'USD'
  ): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/occ/v2/configuration/analytics`, {
      params: { lang, curr },
    });
    return response.data;
  }

  /**
   * Get base sites
   */
  async getBaseSites(
    lang: string = 'en',
    curr: string = 'USD'
  ): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/occ/v2/basesites`, {
      params: {
        fields: 'FULL,baseSites(urlEncodingAttributes)',
        lang,
        curr,
      },
    });
    return response.data;
  }

  /**
   * Get media file (proxy)
   */
  async getMedia(filename: string, context?: string): Promise<any> {
    const url = context 
      ? `${this.baseUrl}/medias/${filename}?context=${context}`
      : `${this.baseUrl}/medias/${filename}`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    
    return {
      data: response.data,
      contentType: response.headers['content-type'],
    };
  }

  /**
   * Get media URL
   */
  getMediaUrl(mediaPath: string): string {
    return `${this.baseUrl}${mediaPath}`;
  }
}

export const cmsService = new CMSService();
