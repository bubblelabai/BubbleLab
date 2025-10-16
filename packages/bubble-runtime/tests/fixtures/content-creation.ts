import {
  BubbleFlow,
  WebScrapeTool,
  ResearchAgentTool,
  RedditScrapeTool,
  AIAgentBubble,
  GoogleDriveBubble,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  trendsCount: number;
  ideasCount: number;
  fileId?: string;
  emailId?: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  productName: string;
  industry?: string;
  targetAudience?: string;
  subreddits?: string[];
}

interface TrendTopic {
  topic: string;
  description: string;
  relevanceScore: string;
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

export class ContentCreationTrendsFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const {
      email,
      productName,
      industry = 'general',
      targetAudience = 'general audience',
      subreddits = ['ContentCreator', 'InstagramMarketing', 'NewTubers'],
    } = payload;

    // STEP 1: Scrape Exploding Topics to discover trending topics related to the industry
    // Exploding Topics aggregates emerging trends across tech, marketing, health, finance, etc.
    // We'll use AI to extract topics relevant to the user's product/industry
    const explodingTopicsScraper = new WebScrapeTool({
      url: 'https://www.explodingtopics.com',
      format: 'markdown',
      onlyMainContent: true,
    });

    const scrapeResult = await explodingTopicsScraper.action();

    if (!scrapeResult.success || !scrapeResult.data?.content) {
      throw new Error(
        `Failed to scrape Exploding Topics: ${scrapeResult.error || 'No content'}`
      );
    }

    // STEP 2: Use AI to extract trending topics relevant to the product/industry
    const topicExtractionPrompt = `
  Analyze the following content from Exploding Topics and identify 3 trending topics
  that are most relevant to a product in the "${industry}" industry targeting "${targetAudience}".
  
  Product Name: ${productName}
  Industry: ${industry}
  Target Audience: ${targetAudience}
  
  Content from Exploding Topics:
  ${scrapeResult.data.content.substring(0, 8000)}
  
  Return a JSON object with:
  {
    "topics": [
      {
        "topic": "Trend name or keyword",
        "description": "Why this trend is relevant for content creation",
        "relevanceScore": "High/Medium - why it's relevant to this product"
      }
    ]
  }
  
  Focus on topics that can be adapted into content formats (videos, posts, campaigns).
      `;

    const topicExtractor = new AIAgentBubble({
      message: topicExtractionPrompt,
      systemPrompt:
        'You are a trend analyst specializing in content marketing. Extract the most relevant trending topics for content creation. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });

    const topicResult = await topicExtractor.action();

    if (!topicResult.success || !topicResult.data?.response) {
      throw new Error(
        `Failed to extract topics: ${topicResult.error || 'No response'}`
      );
    }

    let extractedTopics: { topics: TrendTopic[] };
    try {
      extractedTopics = JSON.parse(topicResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse extracted topics JSON');
    }

    // STEP 3: For each topic, do deep research sequentially (to avoid rate limits)
    // This approach:
    // - Avoids overwhelming the research agent with parallel requests
    // - Provides better visibility in live output (you see each topic being researched)
    // - Prevents rate limiting from search APIs
    const allTrends: TrendData['trends'] = [];

    for (const topic of extractedTopics.topics) {
      const researchTask = `
  Research how the trend "${topic.topic}" is being used in content creation across social media platforms.
  
  Context: This trend is relevant because: ${topic.description}
  
  Find specific examples of:
  - How creators are using this trend in TikTok, Instagram Reels, YouTube Shorts
  - Viral content formats related to this trend
  - Popular hashtags, sounds, or challenges associated with it
  - Creative ways brands/creators are adapting this trend
  - Engagement patterns (what makes content around this trend perform well)
  
  Provide 2-3 specific content format examples with sources.
        `;

      const researchSchema = JSON.stringify({
        trends: [
          {
            topic: 'string (the trending topic being researched)',
            format: 'string (specific content format name)',
            description: 'string (how this format works and why its effective)',
            platforms: ['array of platforms where this format is trending'],
            sourceUrl: 'string (URL source where you found this information)',
            viralExamples: [
              'array of specific examples, hashtags, or creator names - optional',
            ],
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
        const topicTrends =
          (researchResult.data.result as TrendData).trends || [];
        allTrends.push(...topicTrends);
      }
      // Continue even if one topic fails - we want partial results
    }

    if (allTrends.length === 0) {
      throw new Error('Failed to research any trends - no data gathered');
    }

    const trendData: TrendData = {
      trends: allTrends,
    };

    // STEP 4: Gather real-world creator insights from Reddit (in parallel)
    // Reddit communities provide:
    // - ContentCreator: General creator tips, what's working now, tool recommendations
    // - tiktokcreators: TikTok-specific trends, algorithm insights, viral strategies
    // - InstagramMarketing: IG Reels trends, hashtag strategies, posting best practices
    // - NewTubers: YouTube Shorts trends, thumbnail strategies, what's getting views
    // Running in parallel since Reddit API is separate and has its own rate limits
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
          return `r/${subreddit}: ${topPosts.map((p: any) => p.title).join('; ')}`;
        }
        return null;
      } catch (error) {
        console.error(`Failed to scrape r/${subreddit}:`, error);
        return null;
      }
    });

    const redditResults = await Promise.all(redditPromises);
    const redditInsights = redditResults.filter((r): r is string => r !== null);

    // STEP 5: Use AI to synthesize all research into actionable content ideas
    // This combines:
    // - Trending topics from Exploding Topics
    // - Deep research on how each trend is being used in content
    // - Real creator insights from Reddit communities
    // The AI will adapt these trends specifically for the user's product/audience
    const adaptationPrompt = `
  You are a creative content strategist. Analyze the following trending content formats and generate actionable content ideas adapted for a specific product.
  
  TRENDING FORMATS DISCOVERED:
  ${JSON.stringify(trendData.trends, null, 2)}
  
  ADDITIONAL REDDIT INSIGHTS:
  ${redditInsights.join('\n')}
  
  PRODUCT INFORMATION:
  - Product Name: ${productName}
  - Industry: ${industry}
  - Target Audience: ${targetAudience}
  
  TASK:
  Generate 8-12 specific, actionable content ideas that adapt these trending formats for this product. Each idea should:
  1. Leverage a specific trending format
  2. Be tailored to the product and target audience
  3. Include specific content hooks and engagement strategies
  4. Explain how to adapt the trend authentically (not just copy it)
  5. Estimate engagement potential (High/Medium/Low)
  
  Return a JSON object with:
  {
    "executiveSummary": "2-3 sentence overview of the trend landscape and key opportunities",
    "ideas": [
      {
        "title": "Catchy idea title",
        "format": "Which trending format this uses",
        "description": "Detailed description of the content piece",
        "adaptationStrategy": "How to authentically adapt the trend for this product",
        "contentHooks": ["Hook 1", "Hook 2", "Hook 3"],
        "estimatedEngagement": "High/Medium/Low with brief reasoning"
      }
    ]
  }
      `;

    const ideationAgent = new AIAgentBubble({
      message: adaptationPrompt,
      systemPrompt:
        'You are an expert content strategist specializing in viral social media content. Generate creative, actionable ideas that authentically adapt trends. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });

    const ideationResult = await ideationAgent.action();

    if (!ideationResult.success || !ideationResult.data?.response) {
      throw new Error(
        `Failed to generate ideas: ${ideationResult.error || 'No response'}`
      );
    }

    let contentIdeas: ContentIdeas;
    try {
      contentIdeas = JSON.parse(ideationResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse content ideas JSON');
    }

    // 4. Create a beautifully formatted document for Google Drive
    const documentContent = `
  # 📈 Content Creation Trends Report
  **Generated for: ${productName}**
  **Date: ${new Date().toLocaleDateString()}**
  
  ## 📊 Executive Summary
  ${contentIdeas.executiveSummary}
  
  ---
  
  ## 🔥 Trending Formats Discovered
  ${trendData.trends
    .map(
      (trend, i) => `
  ### ${i + 1}. ${trend.format}
  **Description:** ${trend.description}
  **Platforms:** ${trend.platforms.join(', ')}
  **Source:** [${new URL(trend.sourceUrl).hostname}](${trend.sourceUrl})
  ${trend.viralExamples && trend.viralExamples.length > 0 ? `**Examples:** ${trend.viralExamples.join(', ')}` : ''}
  `
    )
    .join('\n')}
  
  ---
  
  ## 💡 Actionable Content Ideas for ${productName}
  
  ${contentIdeas.ideas
    .map(
      (idea, i) => `
  ### Idea ${i + 1}: ${idea.title}
  **Format:** ${idea.format}
  **Engagement Potential:** ${idea.estimatedEngagement}
  
  **Description:**
  ${idea.description}
  
  **Adaptation Strategy:**
  ${idea.adaptationStrategy}
  
  **Content Hooks:**
  ${idea.contentHooks && idea.contentHooks.length > 0 ? idea.contentHooks.map((hook) => `- ${hook}`).join('\n') : '- N/A'}
  
  ---
  `
    )
    .join('\n')}
  
  ## 📚 Research Sources
  **Primary Trend Source:**
  - [Exploding Topics](https://www.explodingtopics.com) - Emerging trend aggregator
  
  **Deep Research Sources:**
  ${trendData.trends.map((trend) => `- [${new URL(trend.sourceUrl).hostname}](${trend.sourceUrl}) - ${trend.topic}`).join('\n')}
  
  **Creator Community Insights:**
  ${subreddits.map((sub) => `- r/${sub} - Real-world creator discussions`).join('\n')}
  
  ---
  *Generated by BubbleLab Content Trends Workflow*
      `.trim();

    // 5. Upload to Google Drive
    const driveUpload = new GoogleDriveBubble({
      operation: 'upload_file',
      name: `Content_Trends_${productName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`,
      content: documentContent,
      mimeType: 'text/plain',
    });

    const driveResult = await driveUpload.action();

    if (!driveResult.success) {
      throw new Error(
        `Failed to upload to Drive: ${driveResult.error || 'Unknown error'}`
      );
    }

    // 6. Send email summary with HTML formatting
    const htmlEmail = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Content Trends Report</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 40px 30px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">📈 Content Trends Report</h1>
                <p style="margin: 10px 0 0 0; color: #ffe0e0; font-size: 16px;">For ${productName}</p>
              </td>
            </tr>
  
            <!-- Executive Summary -->
            <tr>
              <td style="padding: 30px; background-color: #fff5f5; border-bottom: 3px solid #fee;">
                <h2 style="margin: 0 0 15px 0; color: #c92a2a; font-size: 18px;">📊 Executive Summary</h2>
                <p style="margin: 0; color: #495057; font-size: 15px; line-height: 1.6;">${contentIdeas.executiveSummary}</p>
              </td>
            </tr>
  
            <!-- Key Metrics -->
            <tr>
              <td style="padding: 30px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="33%" style="text-align: center; padding: 20px; background-color: #fff5f5; border-radius: 8px;">
                      <div style="font-size: 32px; font-weight: 700; color: #ff6b6b; margin-bottom: 5px;">${trendData.trends.length}</div>
                      <div style="font-size: 14px; color: #868e96;">Trends Found</div>
                    </td>
                    <td width="10"></td>
                    <td width="33%" style="text-align: center; padding: 20px; background-color: #fff5f5; border-radius: 8px;">
                      <div style="font-size: 32px; font-weight: 700; color: #ff6b6b; margin-bottom: 5px;">${contentIdeas.ideas.length}</div>
                      <div style="font-size: 14px; color: #868e96;">Ideas Generated</div>
                    </td>
                    <td width="10"></td>
                    <td width="33%" style="text-align: center; padding: 20px; background-color: #fff5f5; border-radius: 8px;">
                      <div style="font-size: 32px; font-weight: 700; color: #ff6b6b; margin-bottom: 5px;">${new Set(trendData.trends.map((t) => t.sourceUrl)).size}</div>
                      <div style="font-size: 14px; color: #868e96;">Sources Analyzed</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
  
            <!-- Trending Topics & Formats -->
            <tr>
              <td style="padding: 30px; background-color: #fff5f5;">
                <h2 style="margin: 0 0 20px 0; color: #c92a2a; font-size: 20px;">🔥 Trending Topics & Content Formats</h2>
                <p style="margin: 0 0 20px 0; color: #495057; font-size: 14px;">Discovered from Exploding Topics and researched across social platforms</p>
                ${trendData.trends
                  .slice(0, 5)
                  .map(
                    (trend) => `
                  <div style="margin-bottom: 15px; padding: 15px; background-color: #ffffff; border-radius: 6px; border-left: 4px solid #ff6b6b;">
                    <div style="display: inline-block; padding: 4px 8px; background-color: #ffe3e3; color: #c92a2a; border-radius: 4px; font-size: 11px; font-weight: 600; margin-bottom: 8px;">
                      ${trend.topic}
                    </div>
                    <h3 style="margin: 0 0 8px 0; color: #c92a2a; font-size: 16px;">${trend.format}</h3>
                    <p style="margin: 0 0 8px 0; color: #495057; font-size: 14px; line-height: 1.5;">${trend.description}</p>
                    <a href="${trend.sourceUrl}" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background-color: #ff6b6b; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 600;">
                      📖 Read Source (${new URL(trend.sourceUrl).hostname})
                    </a>
                  </div>
                `
                  )
                  .join('')}
              </td>
            </tr>
  
            <!-- Top Ideas Preview -->
            <tr>
              <td style="padding: 30px;">
                <h2 style="margin: 0 0 20px 0; color: #c92a2a; font-size: 20px;">💡 Top Adapted Ideas</h2>
                ${contentIdeas.ideas
                  .slice(0, 3)
                  .map(
                    (idea) => `
                  <div style="margin-bottom: 20px; padding: 20px; background-color: #fff5f5; border-radius: 8px; border-left: 4px solid #ff6b6b;">
                    <h3 style="margin: 0 0 10px 0; color: #c92a2a; font-size: 18px;">${idea.title}</h3>
                    <p style="margin: 0 0 10px 0; color: #495057; font-size: 14px; line-height: 1.5;">${idea.description}</p>
                    <div style="display: inline-block; padding: 4px 12px; background-color: ${idea.estimatedEngagement.toLowerCase().includes('high') ? '#51cf66' : idea.estimatedEngagement.toLowerCase().includes('medium') ? '#ffd43b' : '#adb5bd'}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">
                      ${idea.estimatedEngagement}
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </td>
            </tr>
  
            <!-- Google Drive Link -->
            <tr>
              <td style="padding: 30px; background-color: #f8f9fa; text-align: center;">
                <p style="margin: 0 0 15px 0; color: #495057; font-size: 15px;">Full report with all ${contentIdeas.ideas.length} ideas saved to Google Drive</p>
                <a href="https://drive.google.com/file/d/${driveResult.data?.file?.id}/view" style="display: inline-block; padding: 12px 30px; background-color: #ff6b6b; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Full Report</a>
              </td>
            </tr>
  
            <!-- Footer -->
            <tr>
              <td style="padding: 30px; background-color: #212529; text-align: center;">
                <p style="margin: 0; color: #adb5bd; font-size: 14px;">Powered by <a href="https://bubblelab.ai" style="color: #ff6b6b; text-decoration: none; font-weight: 600;">bubble lab</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
      `;

    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: `📈 Content Trends Report for ${productName} - ${new Date().toLocaleDateString()}`,
      html: htmlEmail,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success) {
      throw new Error(
        `Failed to send email: ${emailResult.error || 'Unknown error'}`
      );
    }

    return {
      message: `Successfully generated ${contentIdeas.ideas.length} content ideas from ${trendData.trends.length} trending formats`,
      trendsCount: trendData.trends.length,
      ideasCount: contentIdeas.ideas.length,
      fileId: driveResult.data?.file?.id as string,
      emailId: emailResult.data?.email_id as string,
    };
  }
}
