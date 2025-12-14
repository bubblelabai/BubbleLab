import { describe, it, expect } from 'vitest';
import {
  formatFinalResponse,
  formatGeminiImageResponse,
  generationsToMessageContent,
} from './agent-formatter';

describe('formatFinalResponse', () => {
  describe('array response handling', () => {
    it('should handle array with text chunks and inlineData', () => {
      const response = [
        {
          type: 'text',
          text: "Here's an image of a dog for you! ",
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: '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',
          },
        },
      ];

      const result = formatFinalResponse(response, 'test-model');

      expect(result.response).toBe("Here's an image of a dog for you! ");
      expect(result.error).toBeUndefined();
    });

    it('should handle array with text and function calls', () => {
      const response = [
        {
          type: 'text',
          text: "**My Initial Workflow Plan**\n\nOkay, so I need to create a workflow to get new user sign-ups from a PostgreSQL database and put them into a Google Sheet. Sounds straightforward enough, but I have some critical unknowns that I need to address before I can even start building.\n\nFirst, I need to know the database structure. Specifically, what's the table name, and what are the column names for the sign-up date and user details? I can't query the database without that. Same goes for the Google Sheet; I need to know the spreadsheet ID and the specific sheet (tab) where the data should go.\n\nSecond, I need to figure out what triggers this workflow. Is this a one-time thing, a daily routine, or is it triggered by some other event? The mention of \"today\" makes a daily schedule the obvious choice, but I shouldn't assume. I need to confirm that with the user.\n\nMy plan to gather this information is to use the `get-bubble-details-tool` to inspect the available `postgresql` and `google-sheets` bubbles. That should give me a good understanding of what tools I have to work with. Then I'll run a flow with `runBubbleFlow` to grab the database schema and list any available spreadsheets. I'll need to use some clarification questions, I think. I'll need to ask the user some questions about the specific table and columns to use, and also clarify which spreadsheet they would like me to use. Once I have all that info, I should be able to make a concrete plan. So, first step: Get bubble details!\n\n\n",
        },
        {
          type: 'functionCall',
          functionCall: {
            name: 'get-bubble-details-tool',
            args: { bubbleId: 'postgresql' },
          },
        },
        {
          type: 'functionCall',
          functionCall: {
            name: 'get-bubble-details-tool',
            args: { bubbleId: 'google-sheets' },
          },
        },
      ];

      const result = formatFinalResponse(
        response,
        'google/gemini-3.0-pro-preview'
      );
      expect(result.response).toBe(
        "**My Initial Workflow Plan**\n\nOkay, so I need to create a workflow to get new user sign-ups from a PostgreSQL database and put them into a Google Sheet. Sounds straightforward enough, but I have some critical unknowns that I need to address before I can even start building.\n\nFirst, I need to know the database structure. Specifically, what's the table name, and what are the column names for the sign-up date and user details? I can't query the database without that. Same goes for the Google Sheet; I need to know the spreadsheet ID and the specific sheet (tab) where the data should go.\n\nSecond, I need to figure out what triggers this workflow. Is this a one-time thing, a daily routine, or is it triggered by some other event? The mention of \"today\" makes a daily schedule the obvious choice, but I shouldn't assume. I need to confirm that with the user.\n\nMy plan to gather this information is to use the `get-bubble-details-tool` to inspect the available `postgresql` and `google-sheets` bubbles. That should give me a good understanding of what tools I have to work with. Then I'll run a flow with `runBubbleFlow` to grab the database schema and list any available spreadsheets. I'll need to use some clarification questions, I think. I'll need to ask the user some questions about the specific table and columns to use, and also clarify which spreadsheet they would like me to use. Once I have all that info, I should be able to make a concrete plan. So, first step: Get bubble details!\n\n\n"
      );
      expect(result.error).toBeUndefined();
    });

    it('should handle multiple text chunks in array', () => {
      const response = [
        {
          type: 'text',
          text: 'First chunk of text. ',
        },
        {
          type: 'text',
          text: 'Second chunk of text. ',
        },
        {
          type: 'text',
          text: 'Third chunk of text.',
        },
      ];

      const result = formatFinalResponse(response, 'test-model');

      expect(result.response).toBe(
        'First chunk of text. Second chunk of text. Third chunk of text.'
      );
      expect(result.error).toBeUndefined();
    });

    it('should handle json in json mode', () => {
      const response = '{"name": "John", "age": 30}';
      const result = formatFinalResponse(response, 'test-model', true);
      expect(result.response).toBe('{"name": "John", "age": 30}');
      expect(result.error).toBeUndefined();
    });

    it('should handle json in json mode', () => {
      const response = `\`\`\`json
{
  "isQualified": false,
  "outreachMessage": ""
}
\`\`\``;
      const result = formatFinalResponse(response, 'test-model', true);
      expect(result.response).toBe(`{
  "isQualified": false,
  "outreachMessage": ""
}`);
      expect(result.error).toBeUndefined();
    });

    it('should handle json in json mode', () => {
      const response =
        "The top news headline is: Trump's shutdown win lands GOP with a huge headache";
      const result = formatFinalResponse(response, 'test-model', false);
      expect(result.response).toBe(
        "The top news headline is: Trump's shutdown win lands GOP with a huge headache"
      );
      console.log(result.response);
      expect(result.error).toBeUndefined();
    });
  });
});

describe('generationsToMessageContent', () => {
  it('should handle LLMResult.generations with message.kwargs.content text chunks', () => {
    // Real structure from handleLLMEnd: output.generations is Generation[][]
    // After .flat() we get Generation[] where each has message.kwargs.content
    const generations = [
      {
        text: '',
        message: {
          lc: 1,
          type: 'constructor',
          id: ['langchain_core', 'messages', 'AIMessageChunk'],
          kwargs: {
            content: [
              {
                type: 'text',
                text: '**My Thought Process: Prioritizing Context Gathering**\n\nOkay, so I need to gather context.',
              },
              {
                type: 'text',
                text: '**My Next Step: Getting Google Drive Details**\n\nI need the GoogleDriveBubble.',
              },
            ],
            additional_kwargs: {},
            response_metadata: {
              finishReason: 'STOP',
              index: 0,
              finishMessage: 'Model generated function call(s).',
            },
            id: 'run-c7f8017c-9fb3-4e86-9dbf-073812312d6d',
          },
        },
        generationInfo: {
          finishReason: 'STOP',
          index: 0,
          finishMessage: 'Model generated function call(s).',
        },
      },
    ];

    const messageContent = generationsToMessageContent(generations);
    const result = formatFinalResponse(
      messageContent,
      'google/gemini-2.5-flash'
    );

    console.log(result.response);

    expect(result.response).toContain('**My Thought Process');
    expect(result.response).toContain('**My Next Step');
    expect(result.error).toBeUndefined();
  });
});
