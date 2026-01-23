import FirecrawlApp from '@mendable/firecrawl-js';
import 'dotenv/config';

let app: FirecrawlApp | null = null;

function getFirecrawlApp(): FirecrawlApp {
  if (!app) {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }
    app = new FirecrawlApp({ 
      apiKey: process.env.FIRECRAWL_API_KEY 
    });
  }
  return app;
}

export interface ScrapedContent {
  content: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    publishedDate?: string;
  };
}

/**
 * Scrape content from a URL (changelog page)
 */
export async function scrapeChangelog(url: string): Promise<ScrapedContent> {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY environment variable is not set');
  }

  try {
    const firecrawlApp = getFirecrawlApp();
    const response = await firecrawlApp.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true, // Focus on main content, ignore nav/footer
    });

    // Firecrawl scrape returns a Document object
    const markdown = response.markdown || '';
    const metadata = response.metadata as {
      title?: string;
      description?: string;
      publishedDate?: string;
    } | undefined;

    return {
      content: markdown,
      markdown: markdown,
      metadata: {
        title: metadata?.title,
        description: metadata?.description,
        publishedDate: metadata?.publishedDate,
      },
    };
  } catch (error) {
    throw new Error(`Error scraping ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

