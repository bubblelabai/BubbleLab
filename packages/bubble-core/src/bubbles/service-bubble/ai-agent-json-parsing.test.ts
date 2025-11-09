import { AIAgentBubble } from './ai-agent.js';
import {
  extractAndCleanJSON,
  postProcessJSON,
} from '../../utils/json-parsing.js';
import { formatFinalResponse } from '../../utils/agent-formatter.js';

// Type for accessing private methods in tests
interface AIAgentWithPrivateMethods {
  formatFinalResponse: (
    response: string | unknown,
    modelConfig: { model: string },
    jsonMode?: boolean
  ) => Promise<{ response: string; error?: string }>;
}

describe('AIAgent JSON Parsing', () => {
  // Helper to access private methods for testing
  const createAIAgent = (): AIAgentWithPrivateMethods => {
    const agent = new AIAgentBubble({
      message: 'test',
      model: { model: 'google/gemini-2.5-flash', maxTokens: 1000 },
      credentials: { GOOGLE_GEMINI_CRED: 'test-key' },
    });

    // Access private methods through type assertion
    return agent as unknown as AIAgentWithPrivateMethods;
  };

  describe('extractAndCleanJSON (from utility)', () => {
    test('should extract JSON from markdown code blocks', () => {
      const input = '```json\n{"result": "success"}\n```';
      const result = extractAndCleanJSON(input);
      expect(result).toBe('{"result": "success"}');
      expect(JSON.parse(result!)).toEqual({ result: 'success' });
    });

    test('should extract JSON from explanatory text', () => {
      const input =
        'I will help you with that. Here is the result: {"data": "test", "status": "ok"}';
      const result = extractAndCleanJSON(input);
      expect(result).toBe('{"data": "test", "status": "ok"}');
      expect(JSON.parse(result!)).toEqual({ data: 'test', status: 'ok' });
    });

    test('should handle mixed content with JSON at the end', () => {
      const input = `I understand your request. Let me process this data.

After analyzing the information, here's the structured result:

{
  "findings": ["item1", "item2"],
  "confidence": 0.95,
  "summary": "Analysis complete"
}

This should provide the information you need.`;

      const result = extractAndCleanJSON(input);
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!);
      expect(parsed.findings).toEqual(['item1', 'item2']);
      expect(parsed.confidence).toBe(0.95);
    });

    test('should extract array JSON', () => {
      const input =
        'Here are the results: [{"name": "test1"}, {"name": "test2"}]';
      const result = extractAndCleanJSON(input);
      expect(result).toBe('[{"name": "test1"}, {"name": "test2"}]');
      expect(JSON.parse(result!)).toEqual([
        { name: 'test1' },
        { name: 'test2' },
      ]);
    });

    test('should handle malformed JSON that can be fixed', () => {
      const input = `{
        "result": "success",
        "data": {
          "items": ["a", "b",]
        }
      }`;

      const result = extractAndCleanJSON(input);
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!);
      expect(parsed.result).toBe('success');
      expect(parsed.data.items).toEqual(['a', 'b']);
    });

    test('should return null for non-JSON content', () => {
      const input = 'This is just plain text with no JSON structure at all.';
      const result = extractAndCleanJSON(input);
      expect(result).toBeNull();
    });
  });

  describe('postProcessJSON (from utility)', () => {
    test('should fix trailing commas', () => {
      const input = '{"items": ["a", "b",], "count": 2,}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ items: ['a', 'b'], count: 2 });
    });

    test('should fix unquoted keys', () => {
      const input = '{name: "test", value: 42}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
    });

    test('should remove common AI prefixes', () => {
      const input = 'Here\'s the result: {"status": "complete"}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ status: 'complete' });
    });

    test('should balance missing braces', () => {
      const input = '{"items": [{"name": "test"}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ items: [{ name: 'test' }] });
    });

    test('should remove excess closing braces', () => {
      const input = '{"data": "test"}}}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ data: 'test' });
    });

    test('should handle newlines in strings', () => {
      const input = '{"message": "line1\\nline2", "status": "ok"}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({
        message: 'line1\nline2',
        status: 'ok',
      });
    });

    test('should remove trailing non-JSON content', () => {
      const input =
        '{"result": "success"} This is extra text that should be removed.';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ result: 'success' });
    });

    test('FIXED: should handle unescaped quotes in string values', () => {
      const input = `{
  "isFrustrated": true,
  "outreachMessage": "Hey [Author"s Reddit Username],\\n\\nYour post about building that Voice AI system..."
}`;
      const result = postProcessJSON(input);
      const parsed = JSON.parse(result);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain(
        'Hey [Author"s Reddit Username]'
      );
    });
  });

  describe('formatFinalResponse', () => {
    let agent: AIAgentWithPrivateMethods;

    beforeEach(() => {
      agent = createAIAgent();
    });

    test('should handle valid JSON in JSON mode', async () => {
      const input = '{"result": "success"}';
      const result = formatFinalResponse(input, 'google/gemini-2.5-flash');

      expect(result.error).toBeUndefined();
      expect(result.response).toEqual('{"result": "success"}');
    });
    test('should fix malformed JSON in JSON mode', () => {
      const input =
        'I will help you. {"result": "success", "items": ["a", "b",]}';
      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        true
      );

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.result).toBe('success');
      expect(parsed.items).toEqual(['a', 'b']);
    });

    test('should handle markdown code blocks', () => {
      const input = '```json\\n{"data": "test"}\\n```';
      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        true
      );

      expect(result.error).toBeUndefined();
      expect(JSON.parse(result.response)).toEqual({ data: 'test' });
    });

    test('should return error for completely invalid JSON', () => {
      const input = 'This is just plain text with no JSON at all.';
      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        true
      );

      expect(result.error).toBeDefined();
    });

    test('should not process JSON when not in JSON mode', () => {
      const input = 'This is regular text output';
      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        false
      );

      expect(result.error).toBeUndefined();
      expect(result.response).toBe('This is regular text output');
    });

    test('should handle key-value content wrapping', () => {
      const input = '"name": "test", "value": 42';
      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        true
      );

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.name).toBe('test');
      expect(parsed.value).toBe(42);
    });
  });

  describe('Common AI Response Patterns', () => {
    test('should handle "I will help you" responses', () => {
      const input =
        'I will help you with that request. {"result": {"status": "complete", "data": ["item1", "item2"]}}';
      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        true
      );

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.result.status).toBe('complete');
      expect(parsed.result.data).toEqual(['item1', 'item2']);
    });

    test('should handle responses with explanations after JSON', () => {
      const input = `{
        "analysis": "complete",
        "findings": ["result1", "result2"]
      }
      
      This analysis shows the key findings from the research.`;

      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        true
      );

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.analysis).toBe('complete');
      expect(parsed.findings).toEqual(['result1', 'result2']);
    });

    test('should handle complex nested structures with formatting issues', () => {
      const input = `Here's the analysis:
      
      {
        "research": {
          "sources": [
            {"url": "https://example.com", "title": "Test"},
            {"url": "https://test.com", "title": "Example",}
          ],
          "summary": "Research complete"
        },
        "confidence": 0.95,
      }`;

      const result = formatFinalResponse(
        input,
        'google/gemini-2.5-flash',
        true
      );

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.research.sources).toHaveLength(2);
      expect(parsed.confidence).toBe(0.95);
    });
  });
});
