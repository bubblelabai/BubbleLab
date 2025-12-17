// Template for Gmail Labeling Assistant
// This template automatically classifies and labels emails using AI

export const templateCode = `import {
  BubbleFlow,
  GmailBubble,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

interface ClassifiedEmail {
  messageId: string;
  category: 'Newsletters' | 'Social' | 'Updates' | 'Receipts' | 'Support' | 'Personal' | 'unknown';
  summary: string;
}

export interface Output {
  summary: string;
  classifiedEmails: ClassifiedEmail[];
}

export interface CustomWebhookPayload extends WebhookEvent {
  /**
   * Maximum number of emails to classify and label (default: 25).
   * @canBeFile false
   */
  maxResults?: number;
}

export class GmailLabelingFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const maxResults = payload.maxResults || 25;

    // 1. List existing labels
    const listLabelsBubble = new GmailBubble({ operation: 'list_labels' });
    const labelsResult = await listLabelsBubble.action();

    if (!labelsResult.success || !labelsResult.data?.labels) {
      throw new Error('Failed to retrieve Gmail labels.');
    }

    const labelMap: Record<string, string> = {};
    const requiredLabels = ['newsletters', 'social', 'updates', 'receipts', 'support', 'personal'];
    const missingLabels: string[] = [];

    labelsResult.data.labels.forEach((label: any) => {
      if (requiredLabels.includes(label.name.toLowerCase())) {
        labelMap[label.name.toLowerCase()] = label.id;
      }
    });

    for (const label of requiredLabels) {
      if (!labelMap[label]) {
        missingLabels.push(label);
      }
    }

    // 2. Create missing labels
    for (const label of missingLabels) {
      const createLabelBubble = new GmailBubble({
        operation: 'create_label',
        name: label,
        label_list_visibility: 'labelShow',
        message_list_visibility: 'show',
      });
      const createResult = await createLabelBubble.action();
      if (createResult.success && createResult.data?.label) {
        labelMap[label] = createResult.data.label.id;
        this.logger?.info(\`Created label: \${label}\`);
      } else {
        this.logger?.info(\`Failed to create label "\${label}": \${createResult.error}\`);
      }
    }

    // 3. List emails to classify
    const listEmailsBubble = new GmailBubble({
      operation: 'list_emails',
      max_results: maxResults,
      include_details: true,
    });
    const emailsResult = await listEmailsBubble.action();

    if (!emailsResult.success || !emailsResult.data?.messages) {
      return {
        summary: 'No emails found to classify.',
        classifiedEmails: [],
      };
    }

    const requiredLabelIds = Object.values(labelMap);

    // 4. Filter emails to only include those not already labeled
    const unlabeledMessages = emailsResult.data.messages.filter((message: any) => {
      const hasRequiredLabel = message.labelIds?.some((labelId: string) => requiredLabelIds.includes(labelId)) || !message.textContent;
      return !hasRequiredLabel;
    });

    if (unlabeledMessages.length === 0) {
      return {
        summary: \`All \${emailsResult.data.messages.length} emails are already labeled.\`,
        classifiedEmails: [],
      };
    }

    // 5. Classify and label each email
    const classificationPromises = unlabeledMessages.map(async (message: any) => {
      if (!message.id || !message.textContent) {
        return null;
      }

      const emailContent = \`Subject: \${message.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'N/A'}\\nSnippet: \${message.snippet}\\nBody: \${message.textContent}\`;

      const agent = new AIAgentBubble({
        message: emailContent,
        systemPrompt: \`You are an email classification expert. Analyze the following email content and classify it into one of six categories: 'Newsletters' (educational/informational content you signed up for), 'Social' (notifications from LinkedIn, Twitter, Facebook, etc.), 'Updates' (product updates, account changes, service announcements), 'Receipts' (purchase confirmations, order summaries), 'Support' (customer service threads, help desk tickets), or 'Personal' (friends, family, non-work communication). If it doesn't fit, use 'unknown'. Provide a concise one-sentence summary. Respond in JSON format with "category" and "summary" keys.\`,
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
          temperature: 0,
        },
        tools: [],
      });

      const agentResult = await agent.action();

      if (agentResult.success && agentResult.data?.response) {
        try {
          const parsedResponse = JSON.parse(agentResult.data.response);
          const category = parsedResponse.category;
          const summary = parsedResponse.summary;

          if (requiredLabels.includes(category.toLowerCase()) && labelMap[category.toLowerCase()]) {
            const labelId = labelMap[category.toLowerCase()];
            const modifyLabelsBubble = new GmailBubble({
              operation: 'modify_message_labels',
              message_id: message.id,
              add_label_ids: [labelId],
            });
            await modifyLabelsBubble.action();
            return { messageId: message.id, category: category as ClassifiedEmail['category'], summary };
          } else {
            const validCategory = requiredLabels.includes(category.toLowerCase()) ? category : 'unknown';
            return { messageId: message.id, category: validCategory as ClassifiedEmail['category'], summary };
          }
        } catch (error) {
          console.error('Failed to parse AI response or apply label:', error);
        }
      }
      return { messageId: message.id, category: 'unknown' as const, summary: 'Failed to classify.' };
    });

    const classifiedEmails = (await Promise.all(classificationPromises)).filter((c): c is ClassifiedEmail => c !== null);

    // 6. Generate summary
    const categoryCounts = classifiedEmails.reduce((acc, email) => {
      acc[email.category] = (acc[email.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryMessageParts: string[] = [\`Processed \${unlabeledMessages.length} unlabeled emails out of \${emailsResult.data.messages.length} total.\`];
    const categories = ['Newsletters', 'Social', 'Updates', 'Receipts', 'Support', 'Personal'];
    categories.forEach(category => {
      const count = categoryCounts[category] || 0;
      summaryMessageParts.push(\`\${category}: \${count}\`);
    });
    summaryMessageParts.push(\`Unknown: \${categoryCounts.unknown || 0}\`);

    return {
      summary: summaryMessageParts.join(' '),
      classifiedEmails,
    };
  }
}`;
