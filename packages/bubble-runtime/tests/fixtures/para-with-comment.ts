/**
 * Weather Research Flow
 *
 * This is a simple BubbleFlow that uses an AI agent to research weather information
 * for a given city using web search capabilities.
 */

import {
  BubbleFlow,
  AIAgentBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

/**
 * Payload interface for the weather flow
 * Extends WebhookEvent to include city information
 */
interface WeatherPayload extends WebhookEvent {
  city: string;
}

/**
 * WeatherFlow - Researches weather for a specified city
 *
 * This flow demonstrates:
 * - Using AIAgentBubble for intelligent tasks
 * - Configuring AI models (Google Gemini)
 * - Using tools (research-agent-tool for web search)
 * - Handling async operations
 */
export class WeatherFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WeatherPayload) {
    const city = payload.city || 'San Francisco';

    // Create an AI agent bubble configured to research weather
    const weatherAgent: AIAgentBubble = new AIAgentBubble({
      message: `What is the current weather in ${city}? Find information from the web and provide a detailed report including temperature, conditions, and forecast.`,
      model: {
        model: 'google/gemini-2.5-flash',
      },
      tools: [
        { name: 'research-agent-tool' }, // Enables web search capability
      ],
    });

    // Execute the agent and get results
    const weatherResult = await weatherAgent.action();

    // Return the weather information
    return {
      city,
      weather: weatherResult.data?.response,
      status: 'success',
    };
  }
}
