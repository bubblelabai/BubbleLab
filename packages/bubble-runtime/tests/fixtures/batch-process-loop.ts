import { z } from 'zod';
import {
  BubbleFlow,
  LinkedInTool,
  AIAgentBubble,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface LinkedInOutreachOutput {
  results: {
    name: string;
    username: string;
    headline: string;
    interested: boolean;
    reason: string;
    draftMessage: string | null;
  }[];
  emailSent: boolean;
}

export interface LinkedInOutreachPayload extends WebhookEvent {
  /**
   * Comma-separated list of LinkedIn usernames to analyze.
   * You can find the username in the profile URL: linkedin.com/in/[username]
   */
  usernames: string;

  /**
   * Email address where the report should be sent.
   */
  email: string;
}

export class LinkedInAIOutreachFlow extends BubbleFlow<'webhook/http'> {
  // Splits the comma-separated string of usernames into a clean array
  private transformUsernames(input: string): string[] {
    if (!input || input.trim().length === 0) return [];
    return input
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
  }

  // Analyzes a single LinkedIn profile for AI interest and generates a message
  // Condition: Runs for each username in the input list
  private async analyzeProfile(
    username: string
  ): Promise<LinkedInOutreachOutput['results'][0] | null> {
    // Scrapes LinkedIn posts and profile information for the given username.
    // We use 'scrapePosts' to get the user's recent activity and author details (headline, name).
    // This data is crucial to determine their current professional interests.
    const linkedInTool = new LinkedInTool({
      operation: 'scrapePosts',
      username: username,
      limit: 5, // We only need a few recent posts to gauge current interest
    });

    const liResult = await linkedInTool.action();

    if (
      !liResult.success ||
      !liResult.data.posts ||
      liResult.data.posts.length === 0
    ) {
      this.logger?.warn(`Could not fetch data for user: ${username}`);
      return null;
    }

    // Extract author info from the first post (assuming all posts have the same author info)
    const author = liResult.data.posts[0].author;
    if (!author) {
      this.logger?.warn(`No author info found for user: ${username}`);
      return null;
    }

    const name =
      `${author.firstName || ''} ${author.lastName || ''}`.trim() || username;
    const headline = author.headline || 'No headline';

    // Aggregate text from recent posts to give the AI context
    const postsText = liResult.data.posts
      .map((p) => p.text)
      .filter((t) => t)
      .join('\n---\n')
      .slice(0, 5000); // Limit context size

    // Analyzes the profile data to determine AI interest and draft a message.
    // Uses gemini-2.5-flash for fast and cost-effective text analysis and generation.
    // Returns a JSON object with interest status, reason, and a personalized draft message.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash', jsonMode: true },
      systemPrompt: `You are an expert networker and AI enthusiast. Your goal is to identify people interested in Artificial Intelligence and draft personalized outreach messages.`,
      message: `Analyze this LinkedIn profile for interest in AI.
      
      Name: ${name}
      Headline: ${headline}
      Recent Posts:
      ${postsText}
      
      Return a JSON object with these fields:
      - "interested": boolean (true if they show clear interest in AI, Machine Learning, LLMs, etc.)
      - "reason": string (brief explanation of why they seem interested or not)
      - "draftMessage": string (A personalized message from me asking to meet in person to discuss AI. Keep it professional, warm, and mention specific topics from their content. If not interested, set this to null.)`,
    });

    const aiResult = await agent.action();

    if (!aiResult.success) {
      this.logger?.error(
        `AI analysis failed for ${username}: ${aiResult.error}`
      );
      return null;
    }

    try {
      const analysis = JSON.parse(aiResult.data.response);
      return {
        name,
        username,
        headline,
        interested: analysis.interested,
        reason: analysis.reason,
        draftMessage: analysis.draftMessage,
      };
    } catch (e) {
      this.logger?.error(`Failed to parse AI response for ${username}`);
      return null;
    }
  }

  // Formats the results into a readable email body
  private formatEmailBody(results: LinkedInOutreachOutput['results']): string {
    const interested = results.filter((r) => r.interested);
    const notInterested = results.filter((r) => !r.interested);

    let body = `<h1>LinkedIn AI Interest Report</h1>`;

    if (interested.length > 0) {
      body += `<h2>🎯 People Interested in AI (${interested.length})</h2>`;
      interested.forEach((p) => {
        body += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h3><a href="https://www.linkedin.com/in/${p.username}">${p.name}</a></h3>
            <p><strong>Headline:</strong> ${p.headline}</p>
            <p><strong>Why:</strong> ${p.reason}</p>
            <div style="background-color: #f9f9f9; padding: 10px; margin-top: 10px; border-left: 3px solid #0077b5;">
              <strong>Draft Message:</strong><br/>
              ${p.draftMessage?.replace(/\n/g, '<br/>')}
            </div>
          </div>
        `;
      });
    } else {
      body += `<p>No one from the list appeared to be interested in AI based on their recent activity.</p>`;
    }

    if (notInterested.length > 0) {
      body += `<h3>Others Analyzed (${notInterested.length})</h3><ul>`;
      notInterested.forEach((p) => {
        body += `<li><strong>${p.name}</strong>: ${p.reason}</li>`;
      });
      body += `</ul>`;
    }

    return body;
  }

  // Sends the final report via email
  // Condition: Runs only if there are results to report
  private async sendReport(email: string, body: string): Promise<boolean> {
    // Sends the formatted HTML report to the user's email address.
    // The 'from' address is automatically handled by the system.
    const emailer = new ResendBubble({
      operation: 'send_email',
      to: email,
      subject: 'Your LinkedIn AI Networking List',
      html: body,
    });

    const result = await emailer.action();
    return result.success;
  }

  async handle(
    payload: LinkedInOutreachPayload
  ): Promise<LinkedInOutreachOutput> {
    const {
      usernames = 'satyanadella, billgates',
      email = 'user@example.com',
    } = payload;

    const userList = this.transformUsernames(usernames);
    const results: LinkedInOutreachOutput['results'] = [];

    // Process users in batches of 5 to respect rate limits and performance
    for (let i = 0; i < userList.length; i += 5) {
      const batch = userList.slice(i, i + 5);
      const batchPromises = batch.map((username) =>
        this.analyzeProfile(username)
      );

      const batchResults = await Promise.all(batchPromises);

      // Filter out nulls (failed scrapes) and add to main list
      batchResults.forEach((res) => {
        if (res) results.push(res);
      });
    }

    // Sort results: interested people first
    results.sort((a, b) =>
      a.interested === b.interested ? 0 : a.interested ? -1 : 1
    );

    // Log results to console as a fallback/record
    this.logger?.info(
      `Analyzed ${results.length} profiles. Found ${results.filter((r) => r.interested).length} interested in AI.`
    );

    // Send email report
    const emailBody = this.formatEmailBody(results);
    const emailSent = await this.sendReport(email, emailBody);

    return {
      results,
      emailSent,
    };
  }
}
