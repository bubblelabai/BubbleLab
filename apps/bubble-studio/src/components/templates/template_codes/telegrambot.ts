// Template for Telegram AI Responder Bot
// This template creates a Telegram bot that automatically responds to messages
// with AI-generated responses and contextual images

export const templateCode = `import { z } from 'zod';

import {
  BubbleFlow,
  TelegramBubble,
  AIAgentBubble,
  StorageBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';
import type { CronEvent } from '@bubblelab/bubble-core';

export interface Output {
  success: boolean;
  messageId?: number;
  aiResponse?: string;
  originalMessage?: string;
  chatId?: number;
}

// Input payload for the Telegram AI responder bot
export interface TelegramMessagePayload extends CronEvent {
  /** The numeric chat ID where the bot should respond. Find it by messaging @userinfobot (for users), adding @userinfobot to a group, or for channels use the channel username (@yourchannel) or numeric ID (-1001234567890). Leave empty to auto-detect from recent messages. */
  chatId?: number;
}

export class TelegramBotFlow extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '*/5 * * * *';
  
  // Fetches recent updates from Telegram to find the most recent message and chat ID
  private async getRecentMessages(): Promise<Array<{ chatId: number; messageText: string; messageId: number; date: number }>> {
    // Retrieves the most recent updates (messages, channel posts, etc.) from Telegram API.
    // Setting offset to -1 gets the last few updates. The limit parameter controls how many
    // updates to fetch (1-100). Filters to only return messages from the last 5 minutes (300 seconds).
    const telegram = new TelegramBubble({
      operation: 'get_updates',
      limit: 100,
    });
    const result = await telegram.action();

    if (!result.success) {
      throw new Error(\`Telegram get_updates failed: \${result.error}\`);
    }

    const messages: Array<{ chatId: number; messageText: string; messageId: number; date: number }> = [];
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300; // 5 minutes in seconds

    // Extract messages from the last 5 minutes
    if (result.data && Array.isArray(result.data.updates) && result.data.updates.length > 0) {
      const updates = result.data.updates;
      
      for (const update of updates) {
        // Check regular messages
        if (update.message?.text && update.message?.chat?.id && update.message?.message_id && update.message?.date) {
          if (update.message.date >= fiveMinutesAgo) {
            messages.push({
              chatId: update.message.chat.id,
              messageText: update.message.text,
              messageId: update.message.message_id,
              date: update.message.date
            });
          }
        }
        
        // Check channel posts
        if (update.channel_post?.text && update.channel_post?.chat?.id && update.channel_post?.message_id && update.channel_post?.date) {
          if (update.channel_post.date >= fiveMinutesAgo) {
            messages.push({
              chatId: update.channel_post.chat.id,
              messageText: update.channel_post.text,
              messageId: update.channel_post.message_id,
              date: update.channel_post.date
            });
          }
        }
      }
    }

    return messages;
  }

  // Sends a typing action to show the bot is processing
  private async sendTypingAction(chatId: number): Promise<void> {
    // Displays a "typing..." indicator in the chat to let the user know the bot is working
    // on a response. The action parameter can be changed to other values like "upload_photo",
    // "record_video", etc., depending on what the bot is doing.
    const telegram = new TelegramBubble({
      operation: 'send_chat_action',
      chat_id: chatId,
      action: 'find_location',
    });
    const result = await telegram.action();

    if (!result.success) {
      throw new Error(\`Telegram send_chat_action failed: \${result.error}\`);
    }
  }

  // Generates an AI response based on the user's message
  private async generateAIResponse(messageText: string): Promise<string> {
    // Uses Google's Gemini Pro model to generate a conversational response to the user's
    // message. The systemPrompt instructs the bot to proactively search the web for real-time
    // information without asking for confirmation. The bot will automatically use the web-search-tool
    // when it needs current data like weather, news, or other real-time information.
    // Change the model to google/gemini-3-pro-preview for more sophisticated responses,
    // or adjust the systemPrompt to customize the bot's behavior and tone.
    const aiAgent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt: 'You are Pearl, a helpful and proactive Telegram bot assistant. When users ask for real-time information like weather, news, or current events, you MUST automatically search the web using your available tools WITHOUT asking for confirmation or permission. Never say you "cannot access" information - instead, immediately use the web-search-tool to find the answer. Provide direct, helpful responses based on the search results. Be conversational and friendly.',
      message: messageText,
      tools: [
        {
          name: 'web-search-tool'
        }
      ]
    });
    const result = await aiAgent.action();

    if (!result.success) {
      throw new Error(\`AI Agent failed: \${result.error}\`);
    }

    return result.data.response;
  }

  // Generates an appropriate image based on the AI's response content using the gemini image model
  private async generateResponseImage(aiResponse: string): Promise<string> {
    // Uses Google's Gemini Flash Image Preview model to generate expressive, chat-appropriate
    // emoticon/meme-style images (表情包) that visually represent the emotion or content of
    // the AI's response. These images are designed to be fun, expressive, and suitable for
    // messaging apps - think reaction images, cartoonish expressions, or playful illustrations
    // rather than realistic photos.
    const imageAgent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash-image-preview' },
      systemPrompt: 'You are an AI that generates fun, expressive, chat-appropriate emoticon/meme-style images (表情包). Create cartoon-like, playful, and expressive images that capture the emotion or sentiment of the conversation. These should be colorful, simple, and visually engaging - perfect for messaging apps. Think reaction images, cute characters, or funny illustrations rather than realistic photos.',
      message: \`Generate a chat-appropriate emoticon/meme image that represents the emotion and content of this message: \${aiResponse}\`,
      tools: []
    });
    const result = await imageAgent.action();

    if (!result.success) {
      throw new Error(\`Image Generation failed: \${result.error}\`);
    }

    // Extract base64 image data from the response
    // The response is a JSON string containing an array with text and inlineData
    try {
      const parsed = JSON.parse(result.data.response);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.type === 'inlineData' && item.inlineData?.data) {
            return item.inlineData.data; // Return just the base64 data without data URI prefix
          }
        }
      }
    } catch (e) {
      throw new Error(\`Failed to parse image response: \${e}\`);
    }

    throw new Error('No image data found in AI response');
  }

  // Uploads the base64 image to R2 storage and returns a public URL
  private async uploadImageToStorage(base64Data: string): Promise<string> {
    // Uploads the generated image to Bubble Lab's R2 storage bucket and returns a public
    // URL that can be used to send the image via Telegram. This approach avoids hitting
    // Telegram's size limits for direct base64 uploads. The image is stored as a PNG file
    // with a timestamp-based filename for uniqueness.
    const fileName = \`telegram-weather-\${Date.now()}.png\`;
    
    const storage = new StorageBubble({
      operation: 'updateFile',
      bucketName: 'bubble-lab-bucket',
      fileName: fileName,
      contentType: 'image/png',
      fileContent: base64Data,
    });
    const result = await storage.action();

    if (!result.success) {
      throw new Error(\`Storage upload failed: \${result.error}\`);
    }

    // Get the public URL for the uploaded file
    const getFileStorage = new StorageBubble({
      operation: 'getFile',
      bucketName: 'bubble-lab-bucket',
      fileName: result.data.fileName || fileName,
    });
    const getResult = await getFileStorage.action();

    if (!getResult.success || !getResult.data.fileUrl) {
      throw new Error(\`Failed to get file URL: \${getResult.error}\`);
    }

    return getResult.data.fileUrl;
  }

  // Sends a photo to the specified Telegram chat
  private async sendTelegramPhoto(chatId: number, photoUrl: string, caption?: string, replyToMessageId?: number): Promise<number> {
    // Sends the AI-generated image to the chat using a URL instead of base64 data.
    // The photo parameter accepts either a file_id, HTTP URL, or base64 data, but URLs
    // are more reliable for larger images. The caption parameter adds text context to the image.
    // Change parse_mode to 'Markdown' if you prefer different formatting.
    const telegram = new TelegramBubble({
      operation: 'send_photo',
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML',
      reply_to_message_id: replyToMessageId,
    });
    const result = await telegram.action();

    if (!result.success) {
      throw new Error(\`Telegram send_photo failed: \${result.error}\`);
    }

    // Safely access the message_id from the result structure
    if (result.data && result.data.message && typeof result.data.message === 'object' && 'message_id' in result.data.message) {
        return result.data.message.message_id;
    }
    
    return 0;
  }

  // Sends a text message to the specified Telegram chat
  private async sendTelegramMessage(chatId: number, text: string, replyToMessageId?: number): Promise<number> {
    // Sends the AI-generated response back to the chat using HTML formatting for any
    // text markup the AI might include (like bold, italic, links). Change parse_mode
    // to 'Markdown' or 'MarkdownV2' if you prefer Markdown formatting instead.
    const telegram = new TelegramBubble({
      operation: 'send_message',
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_to_message_id: replyToMessageId,
    });
    const result = await telegram.action();

    if (!result.success) {
      throw new Error(\`Telegram send failed: \${result.error}\`);
    }

    // Safely access the message_id from the result structure
    if (result.data && result.data.message && typeof result.data.message === 'object' && 'message_id' in result.data.message) {
        return result.data.message.message_id
    }
    
    return 0;
  }

  // Adds an emoji reaction to acknowledge the user's message before processing
  private async reactToMessage(chatId: number, messageId: number): Promise<void> {
    // Reacts to the user's message with a thumbs up emoji to acknowledge receipt.
    // The reaction parameter can be changed to other emojis like "❤️", "🔥", "👀", etc.
    // Set is_big to true for a bigger animation effect, or false for a subtle reaction.
    const telegram = new TelegramBubble({
      operation: 'set_message_reaction',
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji: '👍' }],
      is_big: false,
    });
    const result = await telegram.action();

    if (!result.success) {
      throw new Error(\`Telegram set_message_reaction failed: \${result.error}\`);
    }
  }

  async handle(payload: TelegramMessagePayload): Promise<Output> {
    const { chatId: providedChatId } = payload;

    // Get all messages from the last 5 minutes
    const recentMessages = await this.getRecentMessages();
    
    if (recentMessages.length === 0) {
      return {
        success: true,
        aiResponse: 'No new messages in the last 5 minutes',
      };
    }

    // Filter messages by chatId if provided
    const messagesToProcess = providedChatId 
      ? recentMessages.filter(msg => msg.chatId === providedChatId)
      : recentMessages;

    if (messagesToProcess.length === 0) {
      return {
        success: true,
        aiResponse: \`No new messages in the last 5 minutes for chat \${providedChatId}\`,
      };
    }

    // Process each message
    let lastProcessedMessageId = 0;
    let lastAiResponse = '';
    let lastOriginalMessage = '';
    let lastChatId = 0;

    for (const message of messagesToProcess) {
      const { chatId, messageText, messageId } = message;

      // React to the user's message with a thumbs up
      await this.reactToMessage(chatId, messageId);

      // Send typing action to show bot is working
      await this.sendTypingAction(chatId);

      // Generate AI response first
      const aiResponse = await this.generateAIResponse(messageText);
      
      // Generate an image based on the AI's response
      const responseImageBase64 = await this.generateResponseImage(aiResponse);
      
      // Upload the image to storage and get public URL
      const imageUrl = await this.uploadImageToStorage(responseImageBase64);
      
      // Send the contextual image using the URL, replying to the user's message
      await this.sendTelegramPhoto(chatId, imageUrl, '', messageId);

      // Send the AI response to Telegram, replying to the user's message
      const sentMessageId = await this.sendTelegramMessage(chatId, aiResponse, messageId);

      // Track last processed message for output
      lastProcessedMessageId = sentMessageId;
      lastAiResponse = aiResponse;
      lastOriginalMessage = messageText;
      lastChatId = chatId;
    }

    return {
      success: true,
      messageId: lastProcessedMessageId,
      aiResponse: \`Processed \${messagesToProcess.length} message(s). Last: \${lastAiResponse}\`,
      originalMessage: lastOriginalMessage,
      chatId: lastChatId,
    };
  }
}`;
