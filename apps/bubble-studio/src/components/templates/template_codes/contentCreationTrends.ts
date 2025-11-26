// Template for Content Creation Trends - EVENT-DRIVEN Fresh Content Flow
//
// INPUT: industry (required), brandWebsite (optional), targetAudience (optional), email (required)
//
// PHILOSOPHY: Generate FRESH, TIMELY ideas based on RECENT events/news, NOT stale evergreen trends
//
// Workflow:
// PHASE 1: Brand Intelligence
//   - Auto-format brandWebsite URL (prepend https:// if missing)
//   - Scrape brand website → extract brand context (products, voice, audience, values)
//
// PHASE 2: AI Research Planning - FRESH NEWS SOURCES
//   - AI brainstorms BEST sources for RECENT news/events (not evergreen sites)
//   - Generates: Fresh news sites, YouTube queries, subreddits, trend keywords
//   - Priority: Sites publishing NEW content daily with DATES
//
// PHASE 3: NEWS-FIRST Research
//   - PARALLEL scraping: Google Trends + Exploding Topics + AI-suggested NEWS sources
//   - Extract 4-6 EMERGING PHENOMENA from recent news (specific events with dates)
//   - PARALLEL execution:
//     * YouTube: Full transcripts from 3-5 videos (NO truncation)
//     * Research: How creators are responding to EACH specific event/phenomenon
//   - Reddit: Full post content from AI-suggested communities
//
// PHASE 4: EVENT-DRIVEN Ideation
//   - Pass: Brand context + Emerging phenomena + Research + Transcripts + Reddit
//   - Generate 8-12 FRESH, TIMELY ideas tied to SPECIFIC recent events
//   - Each idea references a specific event/date (not generic trends)
//
// PHASE 5: Delivery
//   - Send comprehensive professional email with ALL information
//   - Focus on FRESHNESS and timeliness of opportunities

export const templateCode = `
import {
  BubbleFlow,
  WebScrapeTool,
  ResearchAgentTool,
  RedditScrapeTool,
  AIAgentBubble,
  ResendBubble,
  YouTubeTool,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  trendsCount: number;
  ideasCount: number;
  youtubeVideosAnalyzed: number;
  emailId?: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  industry: string;
  brandWebsite?: string;
  targetAudience?: string;
}

interface BrandIntelligence {
  productName: string;
  description: string;
  products: string[];
  brandVoice: string;
  targetAudience: string;
  industry: string;
  valuePropositions: string[];
}

interface ResearchPlan {
  newsSourceUrls: Array<{ url: string; reason: string }>;
  trendKeywords: string[];
  youtubeSearchQueries: string[];
  subreddits: string[];
  reasoning: string;
}

interface EmergingPhenomena {
  phenomena: Array<{
    title: string;
    description: string;
    dateContext: string;
    relevanceToIndustry: string;
    contentOpportunity: string;
  }>;
}

interface TrendData {
  trends: Array<{
    topic: string;
    format: string;
    description: string;
    platforms: string[];
    viralExamples: string[];
    sourceUrl: string;
  }>;
}

interface ContentIdeas {
  ideas: Array<{
    title: string;
    format: string;
    description: string;
    adaptationStrategy: string;
    contentHooks: string[];
    estimatedEngagement: string;
  }>;
  executiveSummary: string;
}

interface YouTubeAnalysis {
  fullTranscripts: string;
  videoTitles: string[];
}

interface ScrapeResult {
  success: boolean;
  data?: { content: string };
  error?: string;
}

interface EmailReportData {
  phenomena: EmergingPhenomena;
  trends: TrendData;
  ideas: ContentIdeas;
  youtube: YouTubeAnalysis;
  plan: ResearchPlan;
}

export class ContentCreationTrendsFlow extends BubbleFlow<'webhook/http'> {
  // ============================================================================
  // PHASE 1: Brand Intelligence
  // ============================================================================

  // Orchestrates brand intelligence gathering - either scrapes and analyzes website
  // or creates default context based on industry
  private async gatherBrandIntelligence(
    payload: CustomWebhookPayload
  ): Promise<BrandIntelligence> {
    const { industry, brandWebsite, targetAudience } = payload;

    let brandContext: BrandIntelligence;

    if (brandWebsite) {
      // Format brand website URL by prepending https:// if no protocol is specified
      let formattedUrl: string;
      if (brandWebsite.startsWith('http://') || brandWebsite.startsWith('https://')) {
        formattedUrl = brandWebsite;
      } else {
        formattedUrl = \`https://\${brandWebsite}\`;
      }

      // Scrape the brand website in markdown format, focusing on main content
      const scraper = new WebScrapeTool({
        url: formattedUrl,
        format: 'markdown',
        onlyMainContent: true,
      });

      const scrapeResult = await scraper.action();

      if (!scrapeResult.success || !scrapeResult.data?.content) {
        throw new Error(\`Failed to scrape brand website: \${scrapeResult.error || 'No content'}\`);
      }

      const content = scrapeResult.data.content;

      // Analyze scraped website content using AI to extract structured brand intelligence
      const prompt = \`
Analyze this brand's website and extract key information:

Website Content:
\${content.substring(0, 10000)}

Extract and return JSON:
{
  "productName": "Main product/company name",
  "description": "2-3 sentence company description",
  "products": ["list of main products/services"],
  "brandVoice": "Description of tone/style (professional, casual, technical, etc.)",
  "targetAudience": "Who is the primary audience",
  "industry": "Specific industry/niche",
  "valuePropositions": ["key benefits they emphasize"]
}
      \`;

      const analyzer = new AIAgentBubble({
        message: prompt,
        systemPrompt: 'You are a brand strategist. Analyze websites and extract structured brand intelligence. Return only valid JSON.',
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
        },
      });

      const analyzeResult = await analyzer.action();

      if (!analyzeResult.success || !analyzeResult.data?.response) {
        throw new Error('Failed to analyze brand');
      }

      try {
        brandContext = JSON.parse(analyzeResult.data.response) as BrandIntelligence;
      } catch (error) {
        throw new Error('Failed to parse brand analysis JSON');
      }
    } else {
      // Create default brand context when no website is provided
      brandContext = {
        productName: \`\${industry} Business\`,
        description: \`A business in the \${industry} industry\`,
        products: [],
        brandVoice: 'professional',
        targetAudience: targetAudience || 'general audience',
        industry: industry,
        valuePropositions: [],
      };
    }

    // Override target audience if provided explicitly
    if (targetAudience) {
      brandContext.targetAudience = targetAudience;
    }

    return brandContext;
  }

  // ============================================================================
  // PHASE 2: Research Strategy Planning
  // ============================================================================

  // Plans comprehensive research strategy using AI to identify the best sources
  // for discovering fresh, recent content opportunities
  private async planResearchStrategy(context: BrandIntelligence): Promise<ResearchPlan> {
    const prompt = \`
You are a research strategist specializing in finding FRESH, RECENT content opportunities.

BRAND CONTEXT:
- Company: \${context.productName}
- Industry: \${context.industry}
- Target Audience: \${context.targetAudience}
- Description: \${context.description}

CRITICAL: We need FRESH ideas based on RECENT events, news, and emerging phenomena.
Focus on sources that publish NEW content daily/weekly, NOT evergreen trend aggregators.

TASK: Identify the BEST sources for discovering RECENT events and emerging phenomena:

1. **NEWS SOURCES (3-5 REQUIRED)** - TOP PRIORITY:
   - What are the BEST news sites/blogs that cover RECENT developments in this industry?
   - MUST BE: Sites that publish NEW articles daily/weekly with DATES
   - MUST HAVE: Coverage of events, launches, phenomena, cultural moments, breaking news
   - AVOID: Evergreen content sites, old blogs, generic news
   - Examples:
     * Tech: TechCrunch, The Verge, Ars Technica
     * Marketing: AdAge, MarketingBrew, Adweek
     * Finance: Bloomberg, Financial Times, WSJ
     * Culture: Vulture, The Ringer, Polygon
   - Provide FULL URLs (e.g., "https://techcrunch.com")

2. Trend Keywords (3-5 keywords):
   - Industry-specific terms for Google Trends and Exploding Topics
   - Focus on emerging topics, not established ones

3. YouTube Search Queries (MAX 3 searches):
   - Queries to find videos about RECENT events/trends in this niche
   - Include time-sensitive terms like "2024", "latest", "new"

4. Reddit Communities (3-5 subreddits):
   - Subreddits discussing CURRENT events in this industry
   - Active communities with recent posts

Return JSON:
{
  "newsSourceUrls": [
    { "url": "https://example.com", "reason": "Why this news source publishes fresh, relevant content for this industry" }
  ],
  "trendKeywords": ["keyword1", "keyword2", "keyword3"],
  "youtubeSearchQueries": ["query 1", "query 2", "query 3"],
  "subreddits": ["subreddit1", "subreddit2", "subreddit3"],
  "reasoning": "Brief explanation focusing on how these sources will surface RECENT events and phenomena"
}
    \`;

    const planner = new AIAgentBubble({
      message: prompt,
      systemPrompt: 'You are an expert research strategist. Plan comprehensive research strategies for content trend discovery. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });

    const result = await planner.action();

    if (!result.success || !result.data?.response) {
      throw new Error('Failed to create research plan');
    }

    try {
      return JSON.parse(result.data.response) as ResearchPlan;
    } catch (error) {
      throw new Error('Failed to parse research plan JSON');
    }
  }

  // ============================================================================
  // PHASE 3: News and Trend Data Collection
  // ============================================================================

  // Scrapes fresh news sources including Google Trends, Exploding Topics, and
  // AI-suggested news sites to gather recent content
  private async scrapeNewsSources(plan: ResearchPlan): Promise<string> {
    const scrapeResults: ScrapeResult[] = [];

    // Scrape Google Trends
    try {
      const googleTrendsResult = await new WebScrapeTool({
        url: 'https://trends.google.com/trends/trendingsearches/daily',
        format: 'markdown',
        onlyMainContent: true,
      }).action();
      scrapeResults.push(googleTrendsResult);
    } catch (error) {
      scrapeResults.push({ success: false, error: 'Failed to scrape Google Trends' });
    }

    // Scrape Exploding Topics
    try {
      const explodingTopicsResult = await new WebScrapeTool({
        url: 'https://www.explodingtopics.com',
        format: 'markdown',
        onlyMainContent: true,
      }).action();
      scrapeResults.push(explodingTopicsResult);
    } catch (error) {
      scrapeResults.push({ success: false, error: 'Failed to scrape Exploding Topics' });
    }

    // Scrape AI-suggested news sources
    for (const site of plan.newsSourceUrls) {
      try {
        const newsResult = await new WebScrapeTool({
          url: site.url,
          format: 'markdown',
          onlyMainContent: true,
        }).action();
        scrapeResults.push(newsResult);
      } catch (error) {
        scrapeResults.push({ success: false, error: \`Failed to scrape \${site.url}\` });
      }
    }

    // Combine all scraped news content
    const allNewsContent = scrapeResults
      .filter((result) => result.success && result.data?.content)
      .map((result, index) => {
        if (index === 0) return \`=== GOOGLE TRENDS (LIVE) ===\\n\${result.data!.content}\`;
        if (index === 1) return \`=== EXPLODING TOPICS ===\\n\${result.data!.content}\`;
        const siteIndex = index - 2;
        return \`=== \${plan.newsSourceUrls[siteIndex]?.url || 'NEWS SOURCE'} ===\\n\${result.data!.content}\`;
      })
      .join('\\n\\n---\\n\\n');

    return allNewsContent;
  }

  // Extracts 4-6 emerging phenomena from recent news using AI, identifying specific
  // events or cultural moments happening right now that create content opportunities
  private async extractEmergingPhenomena(
    newsContent: string,
    context: BrandIntelligence,
    plan: ResearchPlan
  ): Promise<EmergingPhenomena> {
    const prompt = \`
Analyze RECENT news content and identify 4-6 emerging phenomena, events, or cultural moments that are happening RIGHT NOW.

BRAND CONTEXT:
- Company: \${context.productName}
- Industry: \${context.industry}
- Target Audience: \${context.targetAudience}

CRITICAL INSTRUCTIONS:
- Focus on RECENT events (last 2-4 weeks ideally)
- Look for: product launches, cultural moments, viral phenomena, breaking news, industry events
- Extract the DATE/TIME CONTEXT (when did this happen?)
- Explain why THIS SPECIFIC EVENT creates a content opportunity

RECENT NEWS CONTENT:
\${newsContent.substring(0, 20000)}

NEWS SOURCES ANALYZED:
- Google Trends (live trending searches)
- Exploding Topics
\${plan.newsSourceUrls.map(s => \`- \${s.url} (\${s.reason})\`).join('\\n')}

Return JSON with RECENT, SPECIFIC phenomena:
{
  "phenomena": [
    {
      "title": "Specific event/phenomenon name (e.g., 'ChatGPT Vision Launch', 'Apple Glowtime Event')",
      "description": "What happened? Be specific about the event/news",
      "dateContext": "When did this happen? (e.g., 'September 2024', 'Last week', 'This month')",
      "relevanceToIndustry": "Why this matters for \${context.industry} industry",
      "contentOpportunity": "Specific content angle this event creates for \${context.productName}"
    }
  ]
}

FOCUS ON: Recent events that create TIMELY content opportunities, not evergreen trends.
    \`;

    const extractor = new AIAgentBubble({
      message: prompt,
      systemPrompt: 'You are a news analyst specializing in identifying emerging phenomena and timely content opportunities. Focus on RECENT events with specific dates. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });

    const result = await extractor.action();

    if (!result.success || !result.data?.response) {
      throw new Error(\`Failed to extract phenomena: \${result.error || 'No response'}\`);
    }

    let emergingPhenomena: EmergingPhenomena;
    try {
      emergingPhenomena = JSON.parse(result.data.response) as EmergingPhenomena;
    } catch (error) {
      throw new Error('Failed to parse emerging phenomena JSON');
    }

    if (!emergingPhenomena.phenomena || emergingPhenomena.phenomena.length === 0) {
      throw new Error('No emerging phenomena found in recent news');
    }

    return emergingPhenomena;
  }

  // ============================================================================
  // PHASE 4: Deep Content Analysis (Parallel Execution)
  // ============================================================================

  // Searches YouTube for relevant videos and extracts full transcripts with timestamps
  private async analyzeYouTubeContent(queries: string[]): Promise<YouTubeAnalysis> {
    const limitedQueries = queries.slice(0, 3);

    // Search YouTube for videos
    const youtubeSearch = new YouTubeTool({
      operation: 'searchVideos',
      searchQueries: limitedQueries,
      maxResults: 5,
    });

    const youtubeSearchResult = await youtubeSearch.action();

    let fullYoutubeTranscripts = '';
    let youtubeVideoTitles: string[] = [];

    if (youtubeSearchResult.success && youtubeSearchResult.data?.videos && youtubeSearchResult.data.videos.length > 0) {
      const topVideos = youtubeSearchResult.data.videos.slice(0, 5).filter(v => v.url);
      youtubeVideoTitles = topVideos.map(v => v.title || '').filter(Boolean);

      // Extract full transcripts from all videos
      const transcriptPromises = topVideos.map(async (video) => {
        try {
          const transcriptTool = new YouTubeTool({
            operation: 'getTranscript',
            videoUrl: video.url!,
          });

          const result = await transcriptTool.action();

          if (result.success && result.data?.fullTranscriptText) {
            return \`
=== VIDEO: \${video.title || 'Untitled'} ===
URL: \${video.url}
FULL TRANSCRIPT:
\${result.data.fullTranscriptText}

\`;
          }
          return '';
        } catch (error) {
          console.error(\`Failed to get transcript for \${video.url}:\`, error);
          return '';
        }
      });

      const transcripts = await Promise.all(transcriptPromises);
      fullYoutubeTranscripts = transcripts.filter(Boolean).join('\\n--- NEXT VIDEO ---\\n');
    }

    return {
      fullTranscripts: fullYoutubeTranscripts,
      videoTitles: youtubeVideoTitles,
    };
  }

  // Researches how creators and brands are responding to each emerging phenomenon
  // using the research agent to find viral content formats and engagement tactics
  private async researchPhenomenaResponses(
    phenomena: EmergingPhenomena,
    context: BrandIntelligence
  ): Promise<TrendData> {
    const allTrends: TrendData['trends'] = [];

    for (const phenomenon of phenomena.phenomena) {
      const researchTask = \`
Research how creators and brands are responding to this RECENT event/phenomenon on social media.

EMERGING PHENOMENON:
- Event: \${phenomenon.title}
- What Happened: \${phenomenon.description}
- When: \${phenomenon.dateContext}
- Why It Matters: \${phenomenon.relevanceToIndustry}

BRAND CONTEXT:
- Company: \${context.productName}
- Industry: \${context.industry}
- Target Audience: \${context.targetAudience}

RESEARCH TASK:
Find how creators are ALREADY creating content around this event/phenomenon:
- TikTok, Instagram Reels, YouTube Shorts responses to this event
- Viral content formats that have emerged in response
- Hashtags, sounds, or memes related to this specific event
- How brands/creators are jumping on this timely moment
- What makes the most engaging responses to this event

Provide 2-3 specific content format examples showing how creators are responding to THIS event.
      \`;

      const researchSchema = JSON.stringify({
        trends: [
          {
            topic: 'string (the trending topic being researched)',
            format: 'string (specific content format name)',
            description: 'string (how this format works and why its effective)',
            platforms: ['array of platforms where this format is trending'],
            sourceUrl: 'string (URL source where you found this information)',
            viralExamples: ['array of specific examples, hashtags, or creator names - optional'],
          },
        ],
      });

      const topicResearch = new ResearchAgentTool({
        task: researchTask,
        expectedResultSchema: researchSchema,
        maxIterations: 25,
      });

      const researchResult = await topicResearch.action();

      if (researchResult.success && researchResult.data?.result) {
        const topicTrends = (researchResult.data.result as TrendData).trends || [];
        allTrends.push(...topicTrends);
      }
      // Continue even if one topic fails - we want partial results
    }

    if (allTrends.length === 0) {
      throw new Error('Failed to research any trends - no data gathered');
    }

    return { trends: allTrends };
  }

  // Scrapes Reddit posts from AI-suggested subreddits to gather creator discussions
  // and community insights about recent trends
  private async scrapeRedditDiscussions(subreddits: string[]): Promise<string> {
    const redditPromises = subreddits.map(async (subreddit) => {
      const redditScraper = new RedditScrapeTool({
        subreddit,
        limit: 10,
        sort: 'hot',
        timeFilter: 'week',
      });

      try {
        const redditResult = await redditScraper.action();

        if (redditResult.success && redditResult.data?.posts) {
          const topPosts = redditResult.data.posts.slice(0, 5);

          const formattedPosts = topPosts.map((p: any) => {
            const title = p.title || 'No title';
            const content = p.selftext || p.body || 'No content';
            const score = p.score || 0;
            const comments = p.num_comments || 0;

            return \`
[r/\${subreddit}] \${title}
Score: \${score} | Comments: \${comments}
Content: \${content.substring(0, 500)}\${content.length > 500 ? '...' : ''}
---\`;
          }).join('\\n');

          return \`
=== SUBREDDIT: r/\${subreddit} ===
\${formattedPosts}
\`;
        }
        return null;
      } catch (error) {
        console.error(\`Failed to scrape r/\${subreddit}:\`, error);
        return null;
      }
    });

    const redditResults = await Promise.all(redditPromises);
    return redditResults.filter((r): r is string => r !== null).join('\\n');
  }

  // ============================================================================
  // PHASE 5: Content Idea Generation
  // ============================================================================

  // Generates 8-12 fresh, event-driven content ideas by synthesizing brand context,
  // emerging phenomena, research data, YouTube transcripts, and Reddit discussions
  private async generateContentIdeas(
    context: BrandIntelligence,
    phenomena: EmergingPhenomena,
    trends: TrendData,
    youtube: YouTubeAnalysis,
    reddit: string
  ): Promise<ContentIdeas> {
    const prompt = \`
You are an expert content strategist specializing in TIMELY, EVENT-DRIVEN content.

========================================
BRAND INTELLIGENCE
========================================
Company: \${context.productName}
Industry: \${context.industry}
Target Audience: \${context.targetAudience}
Description: \${context.description}
Brand Voice: \${context.brandVoice}
Products/Services: \${context.products.join(', ')}
Value Propositions: \${context.valuePropositions.join(', ')}

========================================
EMERGING PHENOMENA (RECENT EVENTS)
========================================
These are FRESH, RECENT events happening RIGHT NOW:

\${phenomena.phenomena.map((p, i) => \`
\${i + 1}. \${p.title} (\${p.dateContext})
   What happened: \${p.description}
   Why it matters: \${p.relevanceToIndustry}
   Content opportunity: \${p.contentOpportunity}
\`).join('\\n')}

========================================
HOW CREATORS ARE RESPONDING (RESEARCH)
========================================
\${JSON.stringify(trends.trends, null, 2)}

========================================
YOUTUBE VIDEO ANALYSIS (\${youtube.videoTitles.length} videos)
========================================
Videos analyzed:
\${youtube.videoTitles.map((title, i) => \`\${i + 1}. \${title}\`).join('\\n')}

Full transcripts:
\${youtube.fullTranscripts || 'No transcripts available'}

========================================
REDDIT CREATOR DISCUSSIONS
========================================
\${reddit || 'No Reddit data available'}

========================================
CRITICAL TASK
========================================
Generate 8-12 FRESH, TIMELY content ideas that:
1. Are tied to SPECIFIC RECENT EVENTS from the emerging phenomena above
2. Feel FRESH and TIMELY (not evergreen or generic)
3. Reference the event/date context (e.g., "Responding to Apple's latest launch...")
4. Are tailored to \${context.productName}'s brand and products
5. Can be executed NOW while the moment is still relevant

Each idea should:
- Reference a SPECIFIC recent event/phenomenon
- Explain WHY this moment matters NOW
- Show how \${context.productName} can authentically participate

Return ONLY valid JSON:
{
  "executiveSummary": "2-3 sentences about the FRESH opportunities from recent events/phenomena",
  "ideas": [
    {
      "title": "Timely, event-driven idea title (reference the event)",
      "format": "Content format being used",
      "description": "Description that references the SPECIFIC event and timing",
      "adaptationStrategy": "How \${context.productName} can authentically join this conversation NOW",
      "contentHooks": ["Hook 1 (event-specific)", "Hook 2", "Hook 3"],
      "estimatedEngagement": "High/Medium/Low with reasoning (mention timeliness)"
    }
  ]
}
    \`;

    const ideationAgent = new AIAgentBubble({
      message: prompt,
      systemPrompt:
        'You are an expert content strategist specializing in TIMELY, EVENT-DRIVEN viral content. Generate FRESH ideas tied to recent events with specific dates. Avoid evergreen or generic ideas. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });

    const result = await ideationAgent.action();

    if (!result.success || !result.data?.response) {
      throw new Error(\`Failed to generate ideas: \${result.error || 'No response'}\`);
    }

    try {
      return JSON.parse(result.data.response) as ContentIdeas;
    } catch (error) {
      throw new Error('Failed to parse content ideas JSON');
    }
  }

  // ============================================================================
  // PHASE 6: Email Report Generation and Delivery
  // ============================================================================

  // Sends the comprehensive HTML email report to the user
  private async sendEmailReport(
    email: string,
    context: BrandIntelligence,
    data: EmailReportData
  ): Promise<{ emailId?: string }> {
    // Format the comprehensive HTML email containing all generated insights, ideas, and research data
    const htmlEmail = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Content Trends Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa; color: #212529;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; border-bottom: 2px solid #495057;">
              <h1 style="margin: 0 0 8px 0; color: #212529; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">Content Trends Analysis Report</h1>
              <p style="margin: 0; color: #6c757d; font-size: 15px;">\${context.productName} • \${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>

          <!-- Executive Summary -->
          <tr>
            <td style="padding: 35px 40px; background-color: #f8f9fa; border-bottom: 1px solid #dee2e6;">
              <h2 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Executive Summary</h2>
              <p style="margin: 0; color: #212529; font-size: 15px; line-height: 1.7;">\${data.ideas.executiveSummary}</p>
            </td>
          </tr>

          <!-- Research Overview -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6;">
              <h2 style="margin: 0 0 20px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Research Methodology & Sources</h2>
              <div style="padding: 15px; background-color: #f8f9fa; border-left: 3px solid #495057; border-radius: 3px;">
                <div style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 8px;">RESEARCH COMPONENTS:</div>
                <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 13px; line-height: 1.8;">
                  <li><strong>Google Trends:</strong> Real-time trending search data analysis</li>
                  <li><strong>Fresh News Sources:</strong> \${data.plan.newsSourceUrls.length} AI-selected news sites (recent articles with dates)</li>
                  <li><strong>Exploding Topics:</strong> Emerging topic identification</li>
                  <li><strong>Event-Driven Research:</strong> Analysis of how creators respond to specific phenomena</li>
                  <li><strong>Reddit Insights:</strong> Real creator discussions from r/\${data.plan.subreddits.join(', r/')}</li>
                  \${data.youtube.fullTranscripts ? '<li><strong>YouTube Analysis:</strong> Full video transcript analysis from multiple trending videos</li>' : ''}
                </ul>
              </div>
            </td>
          </tr>

          <!-- Emerging Phenomena -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6; background-color: #f8f9fa;">
              <h2 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Emerging Phenomena & Recent Events</h2>
              <p style="margin: 0 0 20px 0; color: #495057; font-size: 13px; line-height: 1.6;">Fresh, timely events identified from recent news that create content opportunities:</p>
              \${data.phenomena.phenomena.map((phenomenon, i) => \`
              <div style="margin-bottom: 20px; padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-left: 3px solid #495057; border-radius: 3px;">
                <h3 style="margin: 0 0 10px 0; color: #212529; font-size: 16px; font-weight: 600;">\${i + 1}. \${phenomenon.title}</h3>
                <p style="margin: 0 0 10px 0; color: #495057; font-size: 13px; line-height: 1.6;"><strong>What happened:</strong> \${phenomenon.description}</p>
                <p style="margin: 0 0 10px 0; color: #495057; font-size: 13px; line-height: 1.6;"><strong>Why it matters:</strong> \${phenomenon.relevanceToIndustry}</p>
                <p style="margin: 0; color: #495057; font-size: 13px; line-height: 1.6; background-color: #f8f9fa; padding: 10px; border-radius: 3px;"><strong>Opportunity:</strong> \${phenomenon.contentOpportunity}</p>
              </div>
              \`).join('')}
            </td>
          </tr>

          \${data.youtube.videoTitles.length > 0 ? \`
          <!-- YouTube Insights -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6; background-color: #f8f9fa;">
              <h2 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">YouTube Video Analysis</h2>
              <p style="margin: 0 0 15px 0; color: #495057; font-size: 13px; line-height: 1.6;">Analyzed top YouTube content in this niche to understand creator presentation styles and audience engagement patterns. Full transcripts were analyzed to extract deep insights.</p>
              <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 3px; padding: 15px;">
                <div style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 10px;">TOP VIDEOS ANALYZED (\${data.youtube.videoTitles.length}):</div>
                <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 13px; line-height: 1.8;">
                  \${data.youtube.videoTitles.map((title) => \`<li>\${title}</li>\`).join('')}
                </ul>
              </div>
              \${data.youtube.fullTranscripts ? \`
              <div style="margin-top: 15px; padding: 15px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 3px;">
                <div style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 8px;">TRANSCRIPT INSIGHTS:</div>
                <p style="margin: 0; color: #6c757d; font-size: 12px; line-height: 1.6;">Complete transcripts analyzed for content patterns, presentation styles, and engagement hooks. All insights incorporated into the content ideas below.</p>
              </div>
              \` : ''}
            </td>
          </tr>
          \` : ''}

          <!-- Trending Formats -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6;">
              <h2 style="margin: 0 0 20px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Discovered Trending Formats</h2>
              \${data.trends.trends
                .map(
                  (trend, i) => \`
                <div style="margin-bottom: 20px; padding: 20px; background-color: #f8f9fa; border-left: 3px solid #495057; border-radius: 3px;">
                  <h3 style="margin: 0 0 10px 0; color: #212529; font-size: 16px; font-weight: 600;">\${i + 1}. \${trend.format}</h3>
                  <p style="margin: 0 0 12px 0; color: #495057; font-size: 14px; line-height: 1.6;">\${trend.description}</p>
                  \${trend.viralExamples && trend.viralExamples.length > 0 ? \`
                  <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; color: #6c757d; font-weight: 600; margin-bottom: 5px;">VIRAL EXAMPLES:</div>
                    <div style="color: #495057; font-size: 12px;">\${trend.viralExamples.join(' • ')}</div>
                  </div>
                  \` : ''}
                  <a href="\${trend.sourceUrl}" style="color: #495057; font-size: 12px; text-decoration: none; border-bottom: 1px solid #495057;">Source: \${new URL(trend.sourceUrl).hostname}</a>
                </div>
              \`
                )
                .join('')}
            </td>
          </tr>

          <!-- Content Ideas -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6; background-color: #f8f9fa;">
              <h2 style="margin: 0 0 20px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Actionable Content Ideas for \${context.productName}</h2>
              <p style="margin: 0 0 25px 0; color: #495057; font-size: 13px; line-height: 1.6;">The following ideas adapt the trending formats discovered above specifically for your brand, products, target audience, and industry context. Each idea incorporates insights from YouTube transcripts and Reddit community discussions.</p>
              \${data.ideas.ideas
                .map(
                  (idea, i) => \`
                <div style="margin-bottom: 25px; padding: 25px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 3px;">
                  <div style="margin-bottom: 12px;">
                    <span style="display: inline-block; padding: 4px 10px; background-color: #212529; color: #ffffff; border-radius: 2px; font-size: 11px; font-weight: 600; margin-right: 8px;">IDEA #\${i + 1}</span>
                    <span style="display: inline-block; padding: 4px 10px; background-color: #e9ecef; color: #495057; border-radius: 2px; font-size: 11px;">\${idea.estimatedEngagement}</span>
                  </div>
                  <h3 style="margin: 0 0 12px 0; color: #212529; font-size: 17px; font-weight: 600;">\${idea.title}</h3>
                  <div style="margin-bottom: 8px;">
                    <span style="font-size: 11px; color: #6c757d; font-weight: 600;">FORMAT:</span>
                    <span style="font-size: 13px; color: #495057; margin-left: 8px;">\${idea.format}</span>
                  </div>
                  <p style="margin: 0 0 15px 0; color: #495057; font-size: 14px; line-height: 1.6;">\${idea.description}</p>
                  <div style="padding: 15px; background-color: #f8f9fa; border-radius: 3px; margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #6c757d; font-weight: 600; margin-bottom: 8px;">ADAPTATION STRATEGY:</div>
                    <p style="margin: 0; color: #495057; font-size: 13px; line-height: 1.6;">\${idea.adaptationStrategy}</p>
                  </div>
                  \${idea.contentHooks && idea.contentHooks.length > 0 ? \`
                  <div>
                    <div style="font-size: 11px; color: #6c757d; font-weight: 600; margin-bottom: 8px;">CONTENT HOOKS:</div>
                    <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 13px; line-height: 1.7;">
                      \${idea.contentHooks.map((hook) => \`<li>\${hook}</li>\`).join('')}
                    </ul>
                  </div>
                  \` : ''}
                </div>
              \`
                )
                .join('')}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 25px 40px; background-color: #212529; text-align: center; border-top: 1px solid #495057;">
              <p style="margin: 0; color: #adb5bd; font-size: 12px;">Generated by BubbleLab Trends Workflow • <a href="https://bubblelab.ai" style="color: #dee2e6; text-decoration: none;">bubblelab.ai</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    \`;

    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: \`Content Trends Analysis for \${context.productName} - \${context.industry} - \${new Date().toLocaleDateString()}\`,
      html: htmlEmail,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success) {
      throw new Error(\`Failed to send email: \${emailResult.error || 'Unknown error'}\`);
    }

    return {
      emailId: emailResult.data?.email_id as string,
    };
  }

  // Builds the final output summary with all metrics
  private buildOutput(
    ideas: ContentIdeas,
    trends: TrendData,
    youtube: YouTubeAnalysis,
    plan: ResearchPlan,
    emailResult: { emailId?: string }
  ): Output {
    return {
      message: \`Successfully generated \${ideas.ideas.length} brand-tailored content ideas from \${trends.trends.length} trending formats, \${youtube.videoTitles.length} YouTube videos analyzed, and \${plan.subreddits.length} Reddit communities researched\`,
      trendsCount: trends.trends.length,
      ideasCount: ideas.ideas.length,
      youtubeVideosAnalyzed: youtube.videoTitles.length,
      emailId: emailResult.emailId,
    };
  }

  // ============================================================================
  // MAIN WORKFLOW ORCHESTRATION
  // ============================================================================

  async handle(payload: CustomWebhookPayload): Promise<Output> {
    // Phase 1: Gather brand intelligence from website or create default context
    const brandContext = await this.gatherBrandIntelligence(payload);

    // Phase 2: Plan research strategy with AI to identify best sources
    const researchPlan = await this.planResearchStrategy(brandContext);

    // Phase 3: Scrape news sources to gather recent content
    const newsContent = await this.scrapeNewsSources(researchPlan);

    // Phase 4: Extract emerging phenomena from news content
    const emergingPhenomena = await this.extractEmergingPhenomena(
      newsContent,
      brandContext,
      researchPlan
    );

    // Phase 5: Run deep analysis in parallel (YouTube + Research)
    const [youtubeAnalysis, trendData] = await Promise.all([
      this.analyzeYouTubeContent(researchPlan.youtubeSearchQueries),
      this.researchPhenomenaResponses(emergingPhenomena, brandContext),
    ]);

    // Phase 6: Scrape Reddit discussions for creator insights
    const redditContent = await this.scrapeRedditDiscussions(researchPlan.subreddits);

    // Phase 7: Generate fresh, event-driven content ideas
    const contentIdeas = await this.generateContentIdeas(
      brandContext,
      emergingPhenomena,
      trendData,
      youtubeAnalysis,
      redditContent
    );

    // Phase 8: Send comprehensive email report
    const emailResult = await this.sendEmailReport(payload.email, brandContext, {
      phenomena: emergingPhenomena,
      trends: trendData,
      ideas: contentIdeas,
      youtube: youtubeAnalysis,
      plan: researchPlan,
    });

    // Phase 9: Return execution summary
    return this.buildOutput(
      contentIdeas,
      trendData,
      youtubeAnalysis,
      researchPlan,
      emailResult
    );
  }
}

`;

// Metadata export is now optional - this template demonstrates removal of metadata export
// The templateLoader will use {} as default metadata when not present
