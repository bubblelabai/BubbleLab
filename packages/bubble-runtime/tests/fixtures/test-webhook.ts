import {
    BubbleFlow,
    GoogleSheetsBubble,
    RedditScrapeTool,
    AIAgentBubble,
    HttpBubble,
    type WebhookEvent,
  } from '@bubblelab/bubble-core';
  
  export interface Output {
    message: string;
    newContactsAdded: number;
  }
  
  export interface CustomWebhookPayload extends WebhookEvent {
    name: string
    age: number
  }
  
  export class RedditFlow extends BubbleFlow<'webhook/http'> {
    async handle(payload: CustomWebhookPayload): Promise<Output> {
      const { name, age} = payload;
     const agent = new AIAgentBubble({
        message:`User has name of ${name} and age of ${age}`,
        systemPrompt: "Say greeting to user"
     });
      const resp = await agent.action();
      return {
        message: `Successfully added ${JSON.stringify(resp)}`,
        newContactsAdded: 0
      };
    }
  }