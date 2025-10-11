import {
    BubbleFlow,
    HttpBubble,
    type WebhookEvent,
  } from '@bubblelab/bubble-core';
  
  export interface Output {
    message: string;
    newContactsAdded: number;
  }
  
  export interface CustomWebhookPayload extends WebhookEvent {
    url: string
  }
  
  export class HTTPFlow extends BubbleFlow<'webhook/http'> {
    async handle(payload: CustomWebhookPayload): Promise<Output> {
      const { url } = payload
      const httpRequest = new HttpBubble({
        url: url,
        method: "GET"
      });
      let resp = await httpRequest.action();
      return {
        message: `Successfully added ${JSON.stringify(resp)}`,
        newContactsAdded: 0
      };
    }
  }