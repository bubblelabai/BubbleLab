// Template for Video Script Generator - Multi-Style Script Creation from YouTube Analysis
//
// INPUT: topic (required), targetAudience (optional), videoLength (optional), brandWebsite (optional), brandContext (optional), email (required), specificVideoUrls (optional)
//
// Workflow:
// PHASE 1: Input Processing & Brand Intelligence
//   - Parse and validate input parameters
//   - If brandWebsite provided, scrape and analyze brand context
//   - Auto-format URL (prepend https:// if missing)
//   - Determine video discovery method (search vs specific URLs)
//
// PHASE 2: Video Discovery & Transcript Extraction
//   - Search YouTube for top 5-8 videos OR use provided URLs
//   - Extract FULL transcripts from each video (parallel execution)
//   - Gather video metadata (titles, engagement, duration)
//
// PHASE 3: AI Pattern Analysis
//   - Analyze all transcripts to identify successful patterns:
//     * Opening hooks and attention techniques
//     * Content structure and pacing
//     * Storytelling and engagement tactics
//     * Visual cues and B-roll suggestions
//     * Transition techniques and CTAs
//
// PHASE 4: Multi-Style Script Generation
//   - Generate 4 complete script variations:
//     1. Educational/Tutorial style
//     2. Storytelling/Entertainment style
//     3. Professional/Corporate style
//     4. Casual/Conversational style
//   - Each with hooks, timing, talking points, visuals, CTAs
//
// PHASE 5: Email Delivery
//   - Send comprehensive HTML email with all scripts and insights

export const templateCode = `import {
  BubbleFlow,
  YouTubeTool,
  AIAgentBubble,
  ResendBubble,
  WebScrapeTool,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  videosAnalyzed: number;
  transcriptsExtracted: number;
  scriptsGenerated: number;
  emailId?: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  topic: string;
  targetAudience?: string;
  videoLength?: 'short' | 'medium' | 'long';
  brandWebsite?: string;
  brandContext?: string;
  specificVideoUrls?: string[];
}

interface BrandIntelligence {
  name: string;
  description: string;
  voice: string;
  audience: string;
  valueProps: string[];
}

interface VideoWithTranscript {
  title: string;
  url: string;
  duration: string | null;
  viewCount: number | null;
  channelName: string | null;
  transcript: string;
  transcriptWithTimestamps: Array<{ start: string | null; duration: string | null; text: string | null }>;
}

interface PatternAnalysis {
  openingHooks: Array<{
    technique: string;
    example: string;
    whyItWorks: string;
  }>;
  contentStructure: {
    commonSections: string[];
    pacing: string;
    averageLength: string;
  };
  engagementTactics: Array<{
    tactic: string;
    description: string;
    frequency: string;
  }>;
  visualSuggestions: string[];
  transitionTechniques: string[];
  ctaPatterns: Array<{
    type: string;
    example: string;
  }>;
  keyInsights: string[];
}

interface ScriptSection {
  timing: string;
  section: string;
  content: string;
  talkingPoints: string[];
  visualSuggestions: string[];
}

interface VideoScript {
  style: string;
  hook: string;
  introduction: string;
  mainSections: ScriptSection[];
  callToAction: string;
  estimatedDuration: string;
  productionNotes: string[];
}

interface ScriptVariations {
  scripts: VideoScript[];
  selectionGuide: string;
}

export class VideoScriptGeneratorFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const {
      email,
      topic,
      targetAudience,
      videoLength = 'medium',
      brandWebsite,
      brandContext,
      specificVideoUrls,
    } = payload;

    // ========================================================================
    // PHASE 1: INPUT PROCESSING & BRAND INTELLIGENCE
    // ========================================================================
    const lengthGuide = {
      short: '1-3 minutes',
      medium: '5-10 minutes',
      long: '15-30 minutes',
    };
    const targetLength = lengthGuide[videoLength];

    // Brand Intelligence: Scrape and analyze brand website if provided
    let brandIntel: BrandIntelligence | null = null;

    if (brandWebsite) {
      // Auto-prepend https:// if no protocol specified
      const formattedUrl = brandWebsite.startsWith('http://') || brandWebsite.startsWith('https://')
        ? brandWebsite
        : \`https://\${brandWebsite}\`;

      try {
        const brandScraper = new WebScrapeTool({
          url: formattedUrl,
          format: 'markdown',
          onlyMainContent: true,
        });

        const brandResult = await brandScraper.action();

        if (brandResult.success && brandResult.data?.content) {
          // Use AI to extract structured brand intelligence
          const brandAnalysisPrompt = \`
Analyze this brand's website and extract key information for video script creation:

Website Content:
\${brandResult.data.content.substring(0, 8000)}

Extract and return JSON:
{
  "name": "Brand/company name",
  "description": "2-3 sentence description",
  "voice": "Brand voice and tone (e.g., professional, casual, humorous, inspirational)",
  "audience": "Target audience description",
  "valueProps": ["Key value propositions or unique selling points"]
}
          \`;

          const brandAnalyzer = new AIAgentBubble({
            message: brandAnalysisPrompt,
            systemPrompt: 'You are a brand strategist. Analyze websites and extract structured brand intelligence for content creation. Return only valid JSON.',
            model: {
              model: 'google/gemini-2.5-flash',
              jsonMode: true,
            },
          });

          const brandAnalysisResult = await brandAnalyzer.action();

          if (brandAnalysisResult.success && brandAnalysisResult.data?.response) {
            try {
              brandIntel = JSON.parse(brandAnalysisResult.data.response);
            } catch (error) {
              console.error('Failed to parse brand analysis JSON');
            }
          }
        }
      } catch (error) {
        console.error('Failed to scrape brand website:', error);
      }
    }

    // Combine brand context from website and manual input
    const finalBrandContext = brandIntel
      ? \`\${brandIntel.name}: \${brandIntel.description}. Brand Voice: \${brandIntel.voice}. \${brandContext ? 'Additional context: ' + brandContext : ''}\`
      : brandContext || 'Generic content creator';

    const finalTargetAudience = brandIntel?.audience || targetAudience || 'General audience';

    // ========================================================================
    // PHASE 2: VIDEO DISCOVERY & TRANSCRIPT EXTRACTION
    // ========================================================================
    let videoUrls: string[] = [];
    let videoMetadata: Array<{
      title: string | null;
      url: string | null;
      duration: string | null;
      viewCount: number | null;
      channelName: string | null;
    }> = [];

    if (specificVideoUrls && specificVideoUrls.length > 0) {
      // Use provided URLs
      videoUrls = specificVideoUrls.slice(0, 8); // Max 8 videos

      // Get metadata for these videos
      const metadataSearch = new YouTubeTool({
        operation: 'searchVideos',
        videoUrls: videoUrls,
      });

      const metadataResult = await metadataSearch.action();

      if (metadataResult.success && metadataResult.data?.videos) {
        videoMetadata = metadataResult.data.videos.filter(v => v.url).slice(0, 8);
        videoUrls = videoMetadata.map(v => v.url!).filter(Boolean);
      }
    } else {
      // Search for videos on the topic
      const youtubeSearch = new YouTubeTool({
        operation: 'searchVideos',
        searchQueries: [topic],
        maxResults: 8,
      });

      const searchResult = await youtubeSearch.action();

      if (!searchResult.success || !searchResult.data?.videos || searchResult.data.videos.length === 0) {
        throw new Error(\`Failed to find videos for topic: \${topic}\`);
      }

      videoMetadata = searchResult.data.videos.filter(v => v.url).slice(0, 8);
      videoUrls = videoMetadata.map(v => v.url!).filter(Boolean);
    }

    if (videoUrls.length === 0) {
      throw new Error('No valid video URLs found for analysis');
    }

    // Extract transcripts from all videos in PARALLEL
    const transcriptPromises = videoUrls.map(async (url) => {
      try {
        const transcriptTool = new YouTubeTool({
          operation: 'getTranscript',
          videoUrl: url,
        });

        const result = await transcriptTool.action();

        if (result.success && result.data?.fullTranscriptText) {
          // Find matching metadata
          const metadata = videoMetadata.find(v => v.url === url);

          return {
            title: metadata?.title || 'Unknown Title',
            url: url,
            duration: metadata?.duration || null,
            viewCount: metadata?.viewCount || null,
            channelName: metadata?.channelName || null,
            transcript: result.data.fullTranscriptText,
            transcriptWithTimestamps: result.data.transcript || [],
          };
        }
        return null;
      } catch (error) {
        console.error(\`Failed to get transcript for \${url}:\`, error);
        return null;
      }
    });

    const transcriptResults = await Promise.all(transcriptPromises);
    const videosWithTranscripts: VideoWithTranscript[] = transcriptResults.filter(
      (result): result is VideoWithTranscript => result !== null
    );

    if (videosWithTranscripts.length === 0) {
      throw new Error('Failed to extract transcripts from any videos. Try different videos or topics.');
    }

    // ========================================================================
    // PHASE 3: AI PATTERN ANALYSIS
    // ========================================================================
    const patternAnalysisPrompt = \`
You are an expert video content analyst specializing in identifying successful patterns in YouTube videos.

TOPIC: \${topic}
TARGET AUDIENCE: \${finalTargetAudience}
DESIRED VIDEO LENGTH: \${targetLength}
BRAND CONTEXT: \${finalBrandContext}

VIDEOS ANALYZED (\${videosWithTranscripts.length} videos):
\${videosWithTranscripts.map((v, i) => \`
Video \${i + 1}: \${v.title}
Channel: \${v.channelName || 'Unknown'}
Duration: \${v.duration || 'Unknown'}
Views: \${v.viewCount ? v.viewCount.toLocaleString() : 'Unknown'}
URL: \${v.url}

FULL TRANSCRIPT:
\${v.transcript}

---
\`).join('\\n')}

TASK: Analyze ALL transcripts above and identify successful patterns that make these videos engaging and effective.

Extract and return JSON with the following structure:
{
  "openingHooks": [
    {
      "technique": "Name of the hook technique (e.g., 'Pattern Interrupt', 'Bold Statement', 'Question Hook')",
      "example": "Exact quote from a transcript showing this technique",
      "whyItWorks": "Brief explanation of why this is effective"
    }
  ],
  "contentStructure": {
    "commonSections": ["List of common content sections across videos (e.g., 'Introduction', 'Problem Setup', 'Solution', 'Examples')"],
    "pacing": "Description of how content flows (e.g., 'Fast-paced with quick cuts', 'Methodical and detailed')",
    "averageLength": "Typical section lengths and video duration"
  },
  "engagementTactics": [
    {
      "tactic": "Name of engagement tactic (e.g., 'Rhetorical Questions', 'Personal Stories', 'Humor')",
      "description": "How it's used in these videos",
      "frequency": "How often this appears (e.g., 'Every 30-60 seconds', 'Throughout video')"
    }
  ],
  "visualSuggestions": ["List of visual elements mentioned or implied in transcripts (B-roll, demonstrations, graphics, etc.)"],
  "transitionTechniques": ["Common phrases or methods used to transition between sections"],
  "ctaPatterns": [
    {
      "type": "Type of CTA (e.g., 'Subscribe', 'Comment', 'Visit Website', 'Download')",
      "example": "Exact quote showing how it's delivered"
    }
  ],
  "keyInsights": ["3-5 key insights about what makes these videos successful for this topic"]
}

Focus on actionable patterns that can be adapted to create a new video on this topic.
    \`;

    const patternAnalyzer = new AIAgentBubble({
      message: patternAnalysisPrompt,
      systemPrompt: 'You are an expert video content analyst. Analyze video transcripts and extract actionable patterns for content creation. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
    });

    const analysisResult = await patternAnalyzer.action();

    if (!analysisResult.success || !analysisResult.data?.response) {
      throw new Error(\`Failed to analyze patterns: \${analysisResult.error || 'No response'}\`);
    }

    let patternAnalysis: PatternAnalysis;
    try {
      patternAnalysis = JSON.parse(analysisResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse pattern analysis JSON');
    }

    // ========================================================================
    // PHASE 4: MULTI-STYLE SCRIPT GENERATION
    // ========================================================================
    const scriptGenerationPrompt = \`
You are an expert video script writer. Create 4 complete video script variations in different styles.

CONTEXT:
- Topic: \${topic}
- Target Audience: \${finalTargetAudience}
- Desired Length: \${targetLength}
- Brand Context: \${finalBrandContext}

PATTERN ANALYSIS FROM SUCCESSFUL VIDEOS:
\${JSON.stringify(patternAnalysis, null, 2)}

VIDEOS ANALYZED:
\${videosWithTranscripts.map((v, i) => \`\${i + 1}. "\${v.title}" by \${v.channelName} (\${v.viewCount?.toLocaleString() || 'N/A'} views)\`).join('\\n')}

TASK: Generate 4 COMPLETE video scripts on the topic "\${topic}", each in a different style:

1. **Educational/Tutorial** - Clear, step-by-step, teaching-focused, informative
2. **Storytelling/Entertainment** - Narrative-driven, engaging, emotional, entertaining
3. **Professional/Corporate** - Polished, authoritative, business-appropriate, credible
4. **Casual/Conversational** - Relatable, friendly, authentic, approachable

Each script must include:
- **Hook** (0-10 sec): Exact opening words to grab attention
- **Introduction** (10-30 sec): Context and value promise
- **Main Sections**: 3-5 sections with timing markers (e.g., "1:00-3:30")
- **Talking Points**: Bullet points for each section
- **Visual Suggestions**: What to show on screen for each section
- **Call-to-Action**: Ending and next steps
- **Estimated Duration**: Total video length
- **Production Notes**: Tone, pacing, delivery tips

Return ONLY valid JSON:
{
  "scripts": [
    {
      "style": "Educational/Tutorial",
      "hook": "Exact opening words (10-15 seconds of content)",
      "introduction": "Introduction text after the hook",
      "mainSections": [
        {
          "timing": "1:00-3:30",
          "section": "Section name",
          "content": "Full script content for this section",
          "talkingPoints": ["Key point 1", "Key point 2"],
          "visualSuggestions": ["What to show on screen", "B-roll ideas"]
        }
      ],
      "callToAction": "Exact closing words and CTA",
      "estimatedDuration": "8-10 minutes",
      "productionNotes": ["Tone: Warm and instructive", "Pace: Moderate with pauses for clarity", "Energy: Medium"]
    }
  ],
  "selectionGuide": "2-3 sentences helping creators choose which style fits their channel/goals best"
}

Make scripts COMPLETE and ACTIONABLE - ready to use for recording.
    \`;

    const scriptGenerator = new AIAgentBubble({
      message: scriptGenerationPrompt,
      systemPrompt: 'You are an expert video script writer. Create complete, actionable video scripts in multiple styles. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
    });

    const scriptResult = await scriptGenerator.action();

    if (!scriptResult.success || !scriptResult.data?.response) {
      throw new Error(\`Failed to generate scripts: \${scriptResult.error || 'No response'}\`);
    }

    let scriptVariations: ScriptVariations;
    try {
      scriptVariations = JSON.parse(scriptResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse script variations JSON');
    }

    if (!scriptVariations.scripts || scriptVariations.scripts.length === 0) {
      throw new Error('No scripts generated');
    }

    // ========================================================================
    // PHASE 5: EMAIL DELIVERY
    // ========================================================================
    const htmlEmail = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Script Variations</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa; color: #212529;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; border-bottom: 2px solid #495057;">
              <h1 style="margin: 0 0 8px 0; color: #212529; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">Video Script Variations</h1>
              <p style="margin: 0; color: #6c757d; font-size: 15px;">Topic: \${topic} • \${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>

          <!-- Analysis Overview -->
          <tr>
            <td style="padding: 35px 40px; background-color: #f8f9fa; border-bottom: 1px solid #dee2e6;">
              <h2 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Analysis Overview</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="32%" style="vertical-align: top; padding: 15px; background-color: #ffffff; border-radius: 3px;">
                    <div style="font-size: 11px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Videos Analyzed</div>
                    <div style="font-size: 24px; font-weight: 600; color: #495057; margin-bottom: 4px;">\${videosWithTranscripts.length}</div>
                    <div style="font-size: 13px; color: #6c757d;">Full transcripts extracted</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="vertical-align: top; padding: 15px; background-color: #ffffff; border-radius: 3px;">
                    <div style="font-size: 11px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Scripts Generated</div>
                    <div style="font-size: 24px; font-weight: 600; color: #495057; margin-bottom: 4px;">\${scriptVariations.scripts.length}</div>
                    <div style="font-size: 13px; color: #6c757d;">Different styles</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="vertical-align: top; padding: 15px; background-color: #ffffff; border-radius: 3px;">
                    <div style="font-size: 11px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Target Length</div>
                    <div style="font-size: 24px; font-weight: 600; color: #495057; margin-bottom: 4px;">\${targetLength.split('-')[0]}</div>
                    <div style="font-size: 13px; color: #6c757d;">\${targetLength}</div>
                  </td>
                </tr>
              </table>
              \${brandIntel ? \`
              <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-left: 3px solid #1976d2; border-radius: 3px;">
                <div style="font-size: 12px; font-weight: 600; color: #1565c0; margin-bottom: 8px; text-transform: uppercase;">Brand Context</div>
                <div style="font-size: 14px; color: #1976d2; margin-bottom: 5px; font-weight: 600;">\${brandIntel.name}</div>
                <div style="font-size: 12px; color: #1976d2; line-height: 1.6; margin-bottom: 8px;">\${brandIntel.description}</div>
                <div style="font-size: 11px; color: #1976d2;">
                  <strong>Voice:</strong> \${brandIntel.voice} •
                  <strong>Audience:</strong> \${brandIntel.audience}
                  \${brandIntel.valueProps.length > 0 ? \` • <strong>Key Values:</strong> \${brandIntel.valueProps.join(', ')}\` : ''}
                </div>
              </div>
              \` : ''}
            </td>
          </tr>

          <!-- Videos Analyzed -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6;">
              <h2 style="margin: 0 0 20px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Videos Analyzed with Full Transcripts</h2>
              \${videosWithTranscripts.map((video, i) => \`
                <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-left: 3px solid #495057; border-radius: 3px;">
                  <div style="font-size: 14px; font-weight: 600; color: #212529; margin-bottom: 8px;">\${i + 1}. \${video.title}</div>
                  <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">Channel: \${video.channelName || 'Unknown'} • Duration: \${video.duration || 'N/A'} • Views: \${video.viewCount ? video.viewCount.toLocaleString() : 'N/A'}</div>
                  <a href="\${video.url}" style="font-size: 11px; color: #495057; text-decoration: none; border-bottom: 1px solid #495057; margin-bottom: 12px; display: inline-block;">Watch Video</a>

                  <!-- Collapsible Transcript Section -->
                  <details style="margin-top: 12px;">
                    <summary style="cursor: pointer; font-size: 12px; color: #495057; font-weight: 600; padding: 8px 12px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 3px; user-select: none;">
                      📄 View Full Transcript (\${video.transcript.split(' ').length} words)
                    </summary>
                    <div style="margin-top: 12px; padding: 15px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 3px; max-height: 400px; overflow-y: auto;">
                      <div style="font-size: 11px; color: #6c757d; margin-bottom: 10px; font-weight: 600;">FULL TRANSCRIPT:</div>
                      <div style="font-size: 12px; color: #495057; line-height: 1.8; white-space: pre-wrap; font-family: 'Courier New', monospace;">
\${video.transcript}
                      </div>
                    </div>
                  </details>
                </div>
              \`).join('')}
            </td>
          </tr>

          <!-- Pattern Insights -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6; background-color: #f8f9fa;">
              <h2 style="margin: 0 0 20px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Pattern Analysis & Insights</h2>

              <!-- Key Insights -->
              <div style="margin-bottom: 25px;">
                <h3 style="margin: 0 0 12px 0; color: #212529; font-size: 15px; font-weight: 600;">Key Insights</h3>
                <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 13px; line-height: 1.8;">
                  \${patternAnalysis.keyInsights.map(insight => \`<li>\${insight}</li>\`).join('')}
                </ul>
              </div>

              <!-- Opening Hooks -->
              <div style="margin-bottom: 25px;">
                <h3 style="margin: 0 0 12px 0; color: #212529; font-size: 15px; font-weight: 600;">Successful Opening Hooks</h3>
                \${patternAnalysis.openingHooks.slice(0, 3).map(hook => \`
                  <div style="margin-bottom: 12px; padding: 12px; background-color: #ffffff; border-radius: 3px;">
                    <div style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 5px;">\${hook.technique}</div>
                    <div style="font-size: 12px; color: #6c757d; font-style: italic; margin-bottom: 5px;">"\${hook.example}"</div>
                    <div style="font-size: 11px; color: #6c757d;">\${hook.whyItWorks}</div>
                  </div>
                \`).join('')}
              </div>

              <!-- Engagement Tactics -->
              <div style="margin-bottom: 25px;">
                <h3 style="margin: 0 0 12px 0; color: #212529; font-size: 15px; font-weight: 600;">Engagement Tactics</h3>
                \${patternAnalysis.engagementTactics.slice(0, 4).map(tactic => \`
                  <div style="margin-bottom: 10px; padding: 10px; background-color: #ffffff; border-radius: 3px;">
                    <div style="font-size: 12px; font-weight: 600; color: #495057;">\${tactic.tactic}</div>
                    <div style="font-size: 11px; color: #6c757d;">\${tactic.description} • Used: \${tactic.frequency}</div>
                  </div>
                \`).join('')}
              </div>

              <!-- Visual Suggestions -->
              \${patternAnalysis.visualSuggestions.length > 0 ? \`
              <div>
                <h3 style="margin: 0 0 12px 0; color: #212529; font-size: 15px; font-weight: 600;">Visual Elements to Consider</h3>
                <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 12px; line-height: 1.7;">
                  \${patternAnalysis.visualSuggestions.slice(0, 5).map(visual => \`<li>\${visual}</li>\`).join('')}
                </ul>
              </div>
              \` : ''}
            </td>
          </tr>

          <!-- Script Selection Guide -->
          <tr>
            <td style="padding: 35px 40px; border-bottom: 1px solid #dee2e6; background-color: #e3f2fd;">
              <h2 style="margin: 0 0 12px 0; color: #1565c0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Which Script Style Should You Choose?</h2>
              <p style="margin: 0; color: #1976d2; font-size: 14px; line-height: 1.6;">\${scriptVariations.selectionGuide}</p>
            </td>
          </tr>

          <!-- Scripts -->
          \${scriptVariations.scripts.map((script, i) => \`
          <tr>
            <td style="padding: 35px 40px; border-bottom: 2px solid #dee2e6;">
              <div style="margin-bottom: 20px;">
                <span style="display: inline-block; padding: 6px 12px; background-color: #212529; color: #ffffff; border-radius: 3px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-right: 10px;">SCRIPT #\${i + 1}</span>
                <span style="font-size: 18px; font-weight: 600; color: #212529;">\${script.style}</span>
              </div>
              <div style="margin-bottom: 10px; padding: 10px; background-color: #e9ecef; border-radius: 3px;">
                <div style="font-size: 11px; color: #6c757d; font-weight: 600; margin-bottom: 5px;">ESTIMATED DURATION</div>
                <div style="font-size: 14px; color: #495057; font-weight: 500;">\${script.estimatedDuration}</div>
              </div>

              <!-- Hook -->
              <div style="margin-bottom: 20px;">
                <div style="font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #dee2e6; padding-bottom: 5px;">HOOK (0-10 SEC)</div>
                <p style="margin: 0; color: #212529; font-size: 14px; line-height: 1.6; background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 3px;">\${script.hook}</p>
              </div>

              <!-- Introduction -->
              <div style="margin-bottom: 20px;">
                <div style="font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #dee2e6; padding-bottom: 5px;">INTRODUCTION (10-30 SEC)</div>
                <p style="margin: 0; color: #495057; font-size: 13px; line-height: 1.6;">\${script.introduction}</p>
              </div>

              <!-- Main Sections -->
              <div style="margin-bottom: 20px;">
                <div style="font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid #dee2e6; padding-bottom: 5px;">MAIN CONTENT SECTIONS</div>
                \${script.mainSections.map((section, j) => \`
                  <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-left: 3px solid #495057; border-radius: 3px;">
                    <div style="margin-bottom: 10px;">
                      <span style="display: inline-block; padding: 3px 8px; background-color: #495057; color: #ffffff; border-radius: 2px; font-size: 10px; font-weight: 600; margin-right: 8px;">\${section.timing}</span>
                      <span style="font-size: 14px; font-weight: 600; color: #212529;">\${section.section}</span>
                    </div>
                    <p style="margin: 0 0 12px 0; color: #495057; font-size: 13px; line-height: 1.6;">\${section.content}</p>

                    \${section.talkingPoints.length > 0 ? \`
                    <div style="margin-bottom: 12px;">
                      <div style="font-size: 11px; color: #6c757d; font-weight: 600; margin-bottom: 5px;">KEY TALKING POINTS:</div>
                      <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 12px; line-height: 1.6;">
                        \${section.talkingPoints.map(point => \`<li>\${point}</li>\`).join('')}
                      </ul>
                    </div>
                    \` : ''}

                    \${section.visualSuggestions.length > 0 ? \`
                    <div>
                      <div style="font-size: 11px; color: #6c757d; font-weight: 600; margin-bottom: 5px;">VISUAL SUGGESTIONS:</div>
                      <div style="font-size: 12px; color: #6c757d;">• \${section.visualSuggestions.join(' • ')}</div>
                    </div>
                    \` : ''}
                  </div>
                \`).join('')}
              </div>

              <!-- Call to Action -->
              <div style="margin-bottom: 20px;">
                <div style="font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #dee2e6; padding-bottom: 5px;">CALL-TO-ACTION & CLOSING</div>
                <p style="margin: 0; color: #212529; font-size: 14px; line-height: 1.6; background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; border-radius: 3px;">\${script.callToAction}</p>
              </div>

              <!-- Production Notes -->
              \${script.productionNotes.length > 0 ? \`
              <div>
                <div style="font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #dee2e6; padding-bottom: 5px;">PRODUCTION NOTES</div>
                <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 12px; line-height: 1.7;">
                  \${script.productionNotes.map(note => \`<li>\${note}</li>\`).join('')}
                </ul>
              </div>
              \` : ''}
            </td>
          </tr>
          \`).join('')}

          <!-- Footer -->
          <tr>
            <td style="padding: 25px 40px; background-color: #212529; text-align: center; border-top: 1px solid #495057;">
              <p style="margin: 0; color: #adb5bd; font-size: 12px;">Generated by BubbleLab Video Script Generator • <a href="https://bubblelab.ai" style="color: #dee2e6; text-decoration: none;">bubblelab.ai</a></p>
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
      subject: \`Video Script Variations: \${topic} - \${scriptVariations.scripts.length} Styles - \${new Date().toLocaleDateString()}\`,
      html: htmlEmail,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success) {
      throw new Error(\`Failed to send email: \${emailResult.error || 'Unknown error'}\`);
    }

    return {
      message: \`Successfully generated \${scriptVariations.scripts.length} video script variations from \${videosWithTranscripts.length} video transcripts\`,
      videosAnalyzed: videoUrls.length,
      transcriptsExtracted: videosWithTranscripts.length,
      scriptsGenerated: scriptVariations.scripts.length,
      emailId: emailResult.data?.email_id as string,
    };
  }
}`;
