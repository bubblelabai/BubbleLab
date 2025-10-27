export const templateCode = `import {
  BubbleFlow,
  AIAgentBubble,
  ResendBubble,
  LinkedInTool,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

interface Lead {
  name: string;
  headline: string | null;
  profileUrl: string | null;
  username: string | null;
  reason: string;
  postText: string;
  postUrl: string | null;
  additionalPosts: string[];
  storyAnalysis: string;
}

interface CheckedProfile {
  name: string;
  headline: string | null;
  profileUrl: string | null;
  username: string | null;
  reason: string;
  postText: string;
  postUrl: string | null;
}

export interface Output {
  leads: Lead[];
  emailSent: boolean;
}

export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  leadPersona: string;
}

export class LinkedinLeadGen extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { email = "emailtoreceivereport@gmail.com", leadPersona = "Devs who run automation agencies, or build extensively with n8n" } = payload;

    // Step 1: Generate keywords using AI agent based on the lead persona
    const keywordGenerator = new AIAgentBubble({
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 5000,
      },
      systemPrompt: "You are a lead generation expert. Given a lead persona, generate 10 relevant keywords for searching LinkedIn posts. Return only a comma-separated list of keywords, nothing else.",
      message: \`Generate relevant LinkedIn search keywords for the following lead persona: "\${leadPersona}"\`,
    });
    
    const keywordResult = await keywordGenerator.action();
    
    if (!keywordResult.success || !keywordResult.data?.response) {
      throw new Error(\`Failed to generate keywords: \${keywordResult.error}\`);
    }
    
    // Extract keywords from AI response
    const generatedKeywords = keywordResult.data.response.trim();
    const keywords = generatedKeywords.split(',').map(k => k.trim()).filter(k => k);
    const primaryKeyword = keywords[0] || leadPersona.split(' ').slice(0, 2).join(' ') || 'business';

    this.logger?.info(\`Generated keywords: \${generatedKeywords}\`);
    this.logger?.info(\`Using primary keyword: \${primaryKeyword}\`);

    // Step 2: Search LinkedIn posts using the generated keywords
    const searchResult = await new LinkedInTool({
      operation: 'searchPosts',
      keyword: primaryKeyword,
      limit: 5,
      sortBy: 'relevance'
    }).action();

    if (!searchResult.success || !searchResult.data?.posts) {
      throw new Error(\`Failed to search LinkedIn posts: \${searchResult.error}\`);
    }

    const posts = searchResult.data.posts;
    
    // Step 3: Analyze each post to determine if it's a lead and extract username using AI heuristics
    const analysisPromises = posts.map(async (post: any) => {
      // Use AI heuristics to extract username from profileUrl
      let username: string | null = null;
      
      if (post.author?.profileUrl) {
        try {
          const usernameExtractor = new AIAgentBubble({
            model: {
              model: 'google/gemini-2.5-flash',
              temperature: 0.1,
              maxTokens: 1000,
            },
            systemPrompt: "You are a URL parser specialist. Extract the LinkedIn username from the given LinkedIn profile URL using advanced heuristics. Return only the username, nothing else. The username is typically the part after 'linkedin.com/in/' and before any '?' or '/' characters. Handle edge cases like URLs with hyphens, special characters, or complex paths.",
            message: \`Extract username using heuristics from this LinkedIn profile URL: \${post.author.profileUrl}\`,
          });
          
          const extractResult = await usernameExtractor.action();
          if (extractResult.success && extractResult.data?.response) {
            username = extractResult.data.response.trim();
            this.logger?.info(\`AI extracted username: \${username} from URL: \${post.author.profileUrl}\`);
          }
        } catch (aiExtractError) {
          this.logger?.error(\`AI extraction failed for \${post.author.profileUrl}: \${aiExtractError}\`);
          
          // Fallback to regex-based extraction if AI fails
          try {
            const urlMatch = post.author.profileUrl.match(/linkedin\\.com\\/in\\/([^?\\/]+)/);
            if (urlMatch && urlMatch[1]) {
              username = urlMatch[1];
              this.logger?.info(\`Fallback regex extracted username: \${username} from URL: \${post.author.profileUrl}\`);
            }
          } catch (regexError) {
            this.logger?.error(\`Regex fallback failed for \${post.author.profileUrl}: \${regexError}\`);
          }
        }
      }
      
      // Initial lead analysis
      const leadGenAnalysisAgent = new AIAgentBubble({
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
          temperature: 0.2,
          maxTokens: 10000,
        },
        systemPrompt: \`You are an expert lead generation analyst. Your task is to analyze a LinkedIn post and its author to determine if they are a potential lead based on the following persona: "\${leadPersona}". Respond in JSON format with two keys: "isLead" (boolean) and "reason" (a brief explanation).\`,
        message: \`Analyze the following LinkedIn post and author:\\n\\nAuthor: \${post.author?.firstName} \${post.author?.lastName}\\nHeadline: \${post.author?.headline}\\nPost Text: "\${post.text}"\`,
      });
      
      const agentResult = await leadGenAnalysisAgent.action();

      if (agentResult.success && agentResult.data?.response) {
        try {
          const analysis = JSON.parse(agentResult.data.response);
          
          // Create checked profile object for both leads and non-leads
          const checkedProfile: CheckedProfile = {
            name: \`\${post.author?.firstName} \${post.author?.lastName}\`,
            headline: post.author?.headline,
            profileUrl: post.author?.profileUrl,
            username: username,
            reason: analysis.reason,
            postText: post.text,
            postUrl: post.url,
          };

          if (analysis.isLead && username) {
            // Scrape additional posts from this lead's profile
            let additionalPosts: string[] = [];
            let storyAnalysis = "";
            
            try {
              const profilePostsResult = await new LinkedInTool({
                operation: 'scrapePosts',
                username: username,
                limit: 10,
                pageNumber: 1
              }).action();

              if (profilePostsResult.success && profilePostsResult.data?.posts) {
                additionalPosts = profilePostsResult.data.posts
                  .filter((p: any, index: number) => index < 5 && p.text && p.text !== post.text)
                  .map((p: any) => p.text!);

                // Analyze the complete story of all posts
                if (additionalPosts.length > 0) {
                  const storyAgent = new AIAgentBubble({
                    model: {
                      model: 'google/gemini-2.5-flash',
                      temperature: 0.3,
                      maxTokens: 2000,
                    },
                    systemPrompt: "You are a strategic analyst with web research capabilities. Based on a collection of LinkedIn posts from the same author, analyze their professional story, expertise, and why they might be interested in automation tools or services. Focus on their pain points, current tools they use, and opportunities for engagement. Provide a concise analysis with markdown formatting for better readability (use **bold**, *italic*, bullet points with *, etc.).",
                    message: \`Analyze the professional story and interests of this person based on their recent LinkedIn posts. Use web search and scraping tools to research any companies, tools, or technologies they mention to provide deeper insights:\\n\\nOriginal post: "\${post.text}"\\n\\nAdditional posts:\\n\${additionalPosts.map((p: string, i: number) => \`\${i + 1}. "\${p}"\`).join('\\n\\n')}\\n\\nPersona we're looking for: "\${leadPersona}"\`
                  });
                  
                  const storyResult = await storyAgent.action();
                  if (storyResult.success && storyResult.data?.response) {
                    storyAnalysis = storyResult.data.response;
                  }
                }
              }
            } catch (scrapeError) {
              this.logger?.error(\`Failed to scrape additional posts for \${username}: \${scrapeError}\`);
            }

            return {
              ...checkedProfile,
              additionalPosts,
              storyAnalysis: this.markdownToHtml(storyAnalysis),
              isLead: true
            } as Lead;
          } else {
            // Return non-lead profile for tracking
            return { ...checkedProfile, isLead: false };
          }
        } catch (e) {
          console.error('Failed to parse AI response:', e);
        }
      }
      return null;
    });

    const results = await Promise.all(analysisPromises);
    const leads = results.filter((result: any): result is Lead => result && result.isLead === true) as Lead[];
    const checkedProfiles = results.filter((result: any): result is CheckedProfile => result && (!result.isLead || result.isLead === false)) as CheckedProfile[];

    // Step 4: Send email with enhanced leads or checked profiles
    let emailSent = false;

    try {
      const htmlContent = leads.length > 0
        ? this.generateLeadsEmail(leads, checkedProfiles, leadPersona, primaryKeyword)
        : this.generateNoLeadsEmail(checkedProfiles, leadPersona, primaryKeyword);

      const textContent = leads.length > 0
        ? this.generateLeadsText(leads, checkedProfiles, leadPersona, primaryKeyword)
        : this.generateNoLeadsText(checkedProfiles, leadPersona, primaryKeyword);

      const emailResult = await new ResendBubble({
        operation: 'send_email',
        from: 'Bubble Lab Team <welcome@hello.bubblelab.ai>',
        to: [email],
        subject: leads.length > 0 
          ? \`🚀 Found \${leads.length} Enhanced LinkedIn Leads: \${primaryKeyword}\`
          : \`🔍 LinkedIn Search Report: No Leads Found (\${primaryKeyword})\`,
        text: textContent,
        html: htmlContent,
      }).action();

      if (emailResult.success) {
        emailSent = true;
        this.logger?.info(\`Email sent successfully to \${email}\`);
      } else {
        this.logger?.error(\`Failed to send email: \${emailResult.error}\`);
      }
    } catch (emailError) {
      this.logger?.error(\`Email sending error: \${emailError}\`);
    }

    return { leads, emailSent };
  }

  private markdownToHtml(markdown: string): string {
    if (!markdown) return '';
    
    return markdown
      // Bold text **text** -> <strong>text</strong>
      .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
      // Italic text *text* -> <em>text</em>
      .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
      // Bullet points * item -> <li>item</li>
      .replace(/^\\* (.+)$/gm, '<li>$1</li>')
      // Wrap bullet lists in <ul> tags
      .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
      // Line breaks
      .replace(/\\n\\n/g, '</p><p>')
      .replace(/\\n/g, '<br>')
      // Wrap in paragraphs
      .replace(/^(.+)$/gm, '<p>$1</p>')
      // Clean up extra paragraphs around lists
      .replace(/<p><ul>/g, '<ul>')
      .replace(/<\\/ul><\\/p>/g, '</ul>')
      .replace(/<p><\\/p>/g, '');
  }

  private generateLeadsEmail(leads: Lead[], checkedProfiles: CheckedProfile[], leadPersona: string, keyword: string): string {
    const leadsHtml = leads.map(lead => \`
      <div style="background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #0073b1;">
        <h3 style="margin: 0 0 10px 0; color: #0073b1;">
          \${lead.profileUrl ? \`<a href="\${lead.profileUrl}" target="_blank" style="text-decoration: none; color: #0073b1;">\${lead.name}</a>\` : lead.name}
        </h3>
        <p style="margin: 5px 0; color: #666; font-style: italic;">\${lead.headline || 'No headline available'}</p>
        \${lead.username ? \`<p style="margin: 5px 0; color: #555; font-size: 12px;">Username: @\${lead.username}</p>\` : ''}
        <div style="margin: 15px 0;">
          <strong>Why they're a lead:</strong>
          <p style="margin: 5px 0; color: #333;">\${lead.reason}</p>
        </div>

        \${lead.storyAnalysis ? \`
        <div style="margin: 15px 0; background: #e8f4fd; padding: 15px; border-radius: 4px;">
          <strong>💡 Story Analysis:</strong>
          <div style="margin: 10px 0; color: #2c5282; font-size: 14px; line-height: 1.6;">\${lead.storyAnalysis}</div>
        </div>
        \` : ''}

        <div style="background: white; padding: 15px; border-radius: 4px; margin: 10px 0;">
          <strong>Key Post:</strong>
          <p style="margin: 8px 0; line-height: 1.4;">"\${lead.postText.length > 300 ? lead.postText.substring(0, 300) + '...' : lead.postText}"</p>
          \${lead.postUrl ? \`<a href="\${lead.postUrl}" target="_blank" style="color: #0073b1; text-decoration: none;">Read full post →</a>\` : ''}
        </div>

        \${lead.additionalPosts.length > 0 ? \`
        <div style="margin: 10px 0;">
          <strong>Additional Posts (\${lead.additionalPosts.length}):</strong>
          <ul style="margin: 5px 0; padding-left: 20px;">
            \${lead.additionalPosts.map(post => \`<li style="margin: 3px 0; font-size: 13px; color: #555;">"\${post.substring(0, 150)}..."</li>\`).join('')}
          </ul>
        </div>
        \` : ''}
      </div>
    \`).join('');

    const nonLeadsHtml = checkedProfiles.length > 0 ? \`
      <div style="margin: 30px 0;">
        <h2 style="color: #495057; margin: 20px 0 15px 0; padding-top: 20px; border-top: 2px solid #dee2e6;">📋 Profiles Checked (Not Qualified)</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">These profiles were analyzed but did not match the target persona:</p>
        \${checkedProfiles.map((profile, index) => \`
          <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #6c757d;">
            <h4 style="margin: 0 0 8px 0; color: #495057; font-size: 16px;">
              \${index + 1}. \${profile.profileUrl ? \`<a href="\${profile.profileUrl}" target="_blank" style="text-decoration: none; color: #0073b1;">\${profile.name}</a>\` : profile.name}
            </h4>
            <p style="margin: 3px 0; color: #666; font-style: italic; font-size: 14px;">\${profile.headline || 'No headline available'}</p>
            \${profile.username ? \`<p style="margin: 3px 0; color: #555; font-size: 12px;">Username: @\${profile.username}</p>\` : ''}
            <div style="margin: 10px 0;">
              <strong>Why not a lead:</strong>
              <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">\${profile.reason}</p>
            </div>
            <div style="background: white; padding: 12px; border-radius: 4px; margin: 8px 0;">
              <strong>Sample Post:</strong>
              <p style="margin: 5px 0; line-height: 1.4; font-size: 14px;">"\${profile.postText.length > 200 ? profile.postText.substring(0, 200) + '...' : profile.postText}"</p>
              \${profile.postUrl ? \`<a href="\${profile.postUrl}" target="_blank" style="color: #0073b1; text-decoration: none; font-size: 12px;">Read full post →</a>\` : ''}
            </div>
          </div>
        \`).join('')}
      </div>
    \` : '';

    return \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0073b1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🚀 Enhanced LinkedIn Lead Generation Results</h1>
          <p style="margin: 5px 0; opacity: 0.9;">Complete profile analysis with story insights</p>
        </div>

        <div style="padding: 20px; background: white; border-radius: 0 0 8px 8px; border: 1px solid #e1e4e8;">
          <div style="margin-bottom: 20px; padding: 15px; background: #f0f7ff; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Lead Persona:</strong> \${leadPersona}</p>
            <p style="margin: 5px 0;"><strong>Search Keyword:</strong> \${keyword}</p>
            <p style="margin: 5px 0;"><strong>Leads Found:</strong> <span style="color: #28a745; font-weight: bold;">\${leads.length}</span></p>
            <p style="margin: 5px 0;"><strong>Profiles Checked:</strong> <span style="color: #6c757d; font-weight: bold;">\${checkedProfiles.length}</span></p>
          </div>

          \${leadsHtml}

          \${nonLeadsHtml}

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px; text-align: center;">Generated by Bubble Lab Enhanced Lead Generation Workflow</p>
        </div>
      </div>
    \`;
  }

  private generateNoLeadsEmail(checkedProfiles: CheckedProfile[], leadPersona: string, keyword: string): string {
    const profilesHtml = checkedProfiles.map((profile, index) => \`
      <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #dc3545;">
        <h4 style="margin: 0 0 8px 0; color: #495057; font-size: 16px;">
          \${index + 1}. \${profile.profileUrl ? \`<a href="\${profile.profileUrl}" target="_blank" style="text-decoration: none; color: #0073b1;">\${profile.name}</a>\` : profile.name}
        </h4>
        <p style="margin: 3px 0; color: #666; font-style: italic; font-size: 14px;">\${profile.headline || 'No headline available'}</p>
        \${profile.username ? \`<p style="margin: 3px 0; color: #555; font-size: 12px;">Username: @\${profile.username}</p>\` : ''}
        <div style="margin: 10px 0;">
          <strong>Why not a lead:</strong>
          <p style="margin: 5px 0; color: #dc3545; font-size: 14px;">\${profile.reason}</p>
        </div>
        <div style="background: white; padding: 12px; border-radius: 4px; margin: 8px 0;">
          <strong>Sample Post:</strong>
          <p style="margin: 5px 0; line-height: 1.4; font-size: 14px;">"\${profile.postText.length > 200 ? profile.postText.substring(0, 200) + '...' : profile.postText}"</p>
          \${profile.postUrl ? \`<a href="\${profile.postUrl}" target="_blank" style="color: #0073b1; text-decoration: none; font-size: 12px;">Read full post →</a>\` : ''}
        </div>
      </div>
    \`).join('');

    return \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🔍 LinkedIn Search Report: No Leads Found</h1>
          <p style="margin: 5px 0; opacity: 0.9;">Here are the profiles we checked and why they didn't qualify</p>
        </div>
        
        <div style="padding: 20px; background: white; border-radius: 0 0 8px 8px; border: 1px solid #e1e4e8;">
          <div style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 4px; border-left: 4px solid #ffc107;">
            <p style="margin: 5px 0;"><strong>Lead Persona:</strong> \${leadPersona}</p>
            <p style="margin: 5px 0;"><strong>Search Keyword:</strong> \${keyword}</p>
            <p style="margin: 5px 0;"><strong>Profiles Checked:</strong> <span style="color: #dc3545; font-weight: bold;">\${checkedProfiles.length}</span></p>
            <p style="margin: 5px 0;"><strong>Qualified Leads:</strong> <span style="color: #dc3545; font-weight: bold;">0</span></p>
          </div>
          
          <h3 style="color: #495057; margin: 20px 0 15px 0;">📋 Profiles Analyzed:</h3>
          \${profilesHtml}
          
          <div style="margin-top: 20px; padding: 15px; background: #d1ecf1; border-radius: 4px; border-left: 4px solid #17a2b8;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>💡 Suggestion:</strong> Consider adjusting your lead persona or search keywords to cast a wider net for potential leads.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px; text-align: center;">Generated by Bubble Lab Enhanced Lead Generation Workflow</p>
        </div>
      </div>
    \`;
  }

  private generateLeadsText(leads: Lead[], checkedProfiles: CheckedProfile[], leadPersona: string, keyword: string): string {
    let text = \`🚀 Enhanced LinkedIn Lead Generation Results\\n\\nLead Persona: \${leadPersona}\\nSearch Keyword: \${keyword}\\nLeads Found: \${leads.length}\\nProfiles Checked: \${checkedProfiles.length}\\n\\n\`;

    leads.forEach((lead: Lead, index: number) => {
      text += \`\${index + 1}. \${lead.name}\\n   Headline: \${lead.headline || 'No headline available'}\\n   Profile: \${lead.profileUrl || 'No profile URL'}\\n   Username: \${lead.username ? '@' + lead.username : 'No username'}\\n   Why they're a lead: \${lead.reason}\\n   \\n   Key Post: "\${lead.postText.length > 200 ? lead.postText.substring(0, 200) + '...' : lead.postText}"\\n   Post Link: \${lead.postUrl || 'No post URL'}\\n   \\n   \${lead.storyAnalysis ? \`Story Analysis: \${lead.storyAnalysis}\\n\` : ''}\\n   \${lead.additionalPosts.length > 0 ? \`Additional Posts: \${lead.additionalPosts.length}\\n\${lead.additionalPosts.map((post: string, i: number) => \`   \${i + 1}. "\${post.substring(0, 100)}..."\`).join('\\n')}\\n\` : ''}\\n\\n----------------------------------------\\n\`;
    });

    if (checkedProfiles.length > 0) {
      text += \`\\n📋 Profiles Checked (Not Qualified)\\n\\nThese profiles were analyzed but did not match the target persona:\\n\\n\`;

      checkedProfiles.forEach((profile: CheckedProfile, index: number) => {
        text += \`\${index + 1}. \${profile.name}\\n   Headline: \${profile.headline || 'No headline available'}\\n   Profile: \${profile.profileUrl || 'No profile URL'}\\n   Username: \${profile.username ? '@' + profile.username : 'No username'}\\n   Why not a lead: \${profile.reason}\\n   Sample Post: "\${profile.postText.length > 150 ? profile.postText.substring(0, 150) + '...' : profile.postText}"\\n   Post Link: \${profile.postUrl || 'No post URL'}\\n\\n----------------------------------------\\n\`;
      });
    }

    text += \`\\nGenerated by Bubble Lab Enhanced Lead Generation Workflow\\n\`;
    return text;
  }

  private generateNoLeadsText(checkedProfiles: CheckedProfile[], leadPersona: string, keyword: string): string {
    let text = \`🔍 LinkedIn Search Report: No Leads Found\\n\\nLead Persona: \${leadPersona}\\nSearch Keyword: \${keyword}\\nProfiles Checked: \${checkedProfiles.length}\\nQualified Leads: 0\\n\\n📋 Profiles Analyzed:\\n\\n\`;

    checkedProfiles.forEach((profile: CheckedProfile, index: number) => {
      text += \`\${index + 1}. \${profile.name}\\n   Headline: \${profile.headline || 'No headline available'}\\n   Profile: \${profile.profileUrl || 'No profile URL'}\\n   Username: \${profile.username ? '@' + profile.username : 'No username'}\\n   Why not a lead: \${profile.reason}\\n   Sample Post: "\${profile.postText.length > 150 ? profile.postText.substring(0, 150) + '...' : profile.postText}"\\n   Post Link: \${profile.postUrl || 'No post URL'}\\n\\n----------------------------------------\\n\`;
    });

    text += \`\\n💡 Suggestion: Consider adjusting your lead persona or search keywords to cast a wider net for potential leads.\\n\\nGenerated by Bubble Lab Enhanced Lead Generation Workflow\\n\`;
    return text;
  }
}`;
