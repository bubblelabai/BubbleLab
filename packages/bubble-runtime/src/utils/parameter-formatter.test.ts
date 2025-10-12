import { BubbleFactory } from '@bubblelab/bubble-core';
import { getFixture } from '../../tests/fixtures';
import { BubbleScript } from '../parse/BubbleScript';
import {
  buildParametersObject,
  replaceBubbleInstantiation,
} from './parameter-formatter';

describe('parameter-formatter', () => {
  it('should format parameters correctly', async () => {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
    const parameter_with_string = getFixture('parameter-with-string');
    const originalScript = parameter_with_string.split('\n');
    const bubbleScript = new BubbleScript(parameter_with_string, bubbleFactory);
    const bubbles = bubbleScript.getParsedBubbles();

    const postgresBubble = Object.values(bubbles).find(
      (bubble) => bubble.bubbleName === 'postgresql'
    );

    if (!postgresBubble) {
      throw new Error('PostgreSQL bubble not found');
    }

    // Find the parameter with the name 'query' in original script
    const queryParameter = originalScript.find((line) =>
      line.includes('query:')
    );

    const result = buildParametersObject(
      postgresBubble.parameters,
      undefined,
      false
    );

    console.log(result);
  });

  it('should format parameters correctly for research weather', async () => {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
    const researchWeatherScript = getFixture('research-weather');
    const originalScript = researchWeatherScript.split('\n');
    const bubbleScript = new BubbleScript(researchWeatherScript, bubbleFactory);
    const bubbles = bubbleScript.getParsedBubbles();
    const weatherAgentBubble = Object.values(bubbles).find(
      (bubble) => bubble.bubbleName === 'ai-agent'
    );
    if (!weatherAgentBubble) {
      throw new Error('Weather agent bubble not found');
    }
    replaceBubbleInstantiation(originalScript, weatherAgentBubble);
    console.log(originalScript.join('\n'));
    // Check if logger is injected in any line
    const hasLogger = originalScript.some((line) => line.includes('logger'));
    expect(hasLogger).toBe(true);
  });

  it('should format parameters correctly with complex string literals', async () => {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
    const multiVariablesScript = getFixture('yfinance');
    const bubbleScript = new BubbleScript(multiVariablesScript, bubbleFactory);
    const bubbles = bubbleScript.getParsedBubbles();
    const yfinanceBubble = Object.values(bubbles).find(
      (bubble) => bubble.bubbleName === 'resend'
    );
    if (!yfinanceBubble) {
      throw new Error('Yfinance bubble not found');
    }
    // Check if subject of email contains string literal
    expect(yfinanceBubble.parameters[2].value).toBe("`Your Automated Financial Analysis for ${ticker.toUpperCase()}`");
    const result = buildParametersObject(yfinanceBubble.parameters, undefined, false);
    expect(result).toContain("subject: `Your Automated Financial Analysis for ${ticker.toUpperCase()}`");
  
  });

  it('should format parameters correctly for simple http', async () => {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
    const simpleHttpScript = getFixture('simple-http');
    const bubbleScript = new BubbleScript(simpleHttpScript, bubbleFactory);
    const bubbles = bubbleScript.getParsedBubbles();
    const httpBubble = Object.values(bubbles).find(
      (bubble) => bubble.bubbleName === 'http'
    );
    if (!httpBubble) {
      throw new Error('HTTP bubble not found');
    }
    expect(httpBubble.parameters.length > 0).toBe(true);
    expect(httpBubble.parameters[0].name).toBe('url');
    expect(httpBubble.parameters[0].value).toBe('url');
    expect(httpBubble.parameters[1].name).toBe('method');
    expect(httpBubble.parameters[1].value).toBe('GET');

    const result = buildParametersObject(httpBubble.parameters, undefined, false);
    expect(result).toContain("method: 'GET'");
  });

  describe('replaceBubbleInstantiation', () => {
    it('should replace bubble instantiation ending with semicolon });', () => {
      const lines = [
        '    const httpRequest = new HttpBubble({',
        '      url: "https://example.com",',
        '      method: "GET"',
        '    });',
        '    let resp = await httpRequest.action();'
      ];

      const bubble = {
        bubbleName: 'http',
        className: 'HttpBubble',
        variableName: 'httpRequest',
        variableId: 123,
        location: { startLine: 1, endLine: 4 },
        parameters: [
          { name: 'url', value: 'https://example.com', type: 'string' },
          { name: 'method', value: 'GET', type: 'string' }
        ],
        hasActionCall: false,
        dependencyGraph: { name: 'http', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      // Should have replaced the multi-line instantiation with single line
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('const httpRequest = new HttpBubble({');
      expect(lines[0]).toContain('logger: this.logger');
      expect(lines[0]).toContain('variableId: 123');
      expect(lines[1]).toContain('let resp = await httpRequest.action()');
    });

    it('should replace bubble instantiation ending without semicolon })', () => {
      const lines = [
        '    const httpRequest = new HttpBubble({',
        '      url: "https://example.com",',
        '      method: "GET"',
        '    })',
        '    let resp = await httpRequest.action();'
      ];

      const bubble = {
        bubbleName: 'http',
        className: 'HttpBubble',
        variableName: 'httpRequest',
        variableId: 456,
        location: { startLine: 1, endLine: 4 },
        parameters: [
          { name: 'url', value: 'https://example.com', type: 'string' },
          { name: 'method', value: 'GET', type: 'string' }
        ],
        hasActionCall: false,
        dependencyGraph: { name: 'http', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      // Should have replaced the multi-line instantiation with single line
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('const httpRequest = new HttpBubble({');
      expect(lines[0]).toContain('logger: this.logger');
      expect(lines[0]).toContain('variableId: 456');
      expect(lines[1]).toContain('let resp = await httpRequest.action()');
    });

    it('should replace bubble instantiation with action call }).action();', () => {
      const lines = [
        '    const result = await new HttpBubble({',
        '      url: "https://example.com",',
        '      method: "POST"',
        '    }).action();',
        '    console.log(result);'
      ];

      const bubble = {
        bubbleName: 'http',
        className: 'HttpBubble',
        variableName: 'result',
        variableId: 789,
        location: { startLine: 1, endLine: 4 },
        parameters: [
          { name: 'url', value: 'https://example.com', type: 'string' },
          { name: 'method', value: 'POST', type: 'string' }
        ],
        hasActionCall: true,
        dependencyGraph: { name: 'http', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      // Should have replaced and preserved await and action call
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('await new HttpBubble({');
      expect(lines[0]).toContain('logger: this.logger');
      expect(lines[0]).toContain('variableId: 789');
      expect(lines[0]).toContain('.action()');
      expect(lines[1]).toContain('console.log(result)');
    });

    it('should handle nested indentation correctly', () => {
      const lines = [
        '      if (condition) {',
        '        const bubble = new TestBubble({',
        '          param: "value"',
        '        });',
        '      }'
      ];

      const bubble = {
        bubbleName: 'test',
        className: 'TestBubble',
        variableName: 'bubble',
        variableId: 111,
        location: { startLine: 2, endLine: 4 },
        parameters: [
          { name: 'param', value: 'value', type: 'string' }
        ],
        hasActionCall: false,
        dependencyGraph: { name: 'test', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      // Should maintain proper indentation
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('if (condition)');
      expect(lines[1]).toContain('        const bubble = new TestBubble({');
      expect(lines[1]).toContain('logger: this.logger');
      expect(lines[2]).toContain('      }');
    });

    it('should replace anonymous bubble without variable name', () => {
      const lines = [
        '    await new HttpBubble({',
        '      url: "https://example.com"',
        '    }).action();',
        '    console.log("done");'
      ];

      const bubble = {
        bubbleName: 'http',
        className: 'HttpBubble',
        variableName: '_anonymous_http_1',
        variableId: 999,
        location: { startLine: 1, endLine: 3 },
        parameters: [
          { name: 'url', value: 'https://example.com', type: 'string' }
        ],
        hasActionCall: true,
        dependencyGraph: { name: 'http', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      // Should handle anonymous bubble
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('await new HttpBubble({');
      expect(lines[0]).toContain('logger: this.logger');
      expect(lines[0]).toContain('.action()');
      expect(lines[1]).toContain('console.log("done")');
    });

    it('should handle bubble with complex parameter types', () => {
      const lines = [
        '    const agent = new AIAgentBubble({',
        '      model: "gpt-4",',
        '      tools: [{ name: "web-search" }],',
        '      temperature: 0.7',
        '    });'
      ];

      const bubble = {
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        variableName: 'agent',
        variableId: 222,
        location: { startLine: 1, endLine: 5 },
        parameters: [
          { name: 'model', value: 'gpt-4', type: 'string' },
          { name: 'tools', value: [{ name: 'web-search' }], type: 'array' },
          { name: 'temperature', value: 0.7, type: 'number' }
        ],
        hasActionCall: false,
        dependencyGraph: { name: 'ai-agent', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('const agent = new AIAgentBubble({');
      expect(lines[0]).toContain('logger: this.logger');
      expect(lines[0]).toContain('variableId: 222');
    });

    it('should handle bubble with credentials object followed by logger config', () => {
      // This simulates the case where credentials have been injected
      // and then the bubble is being replaced again with logger config
      const lines = [
        '    const agent = new AIAgentBubble({',
        '      message: "Test message",',
        '      model: { model: "gpt-4" },',
        '      credentials: {',
        '        "OPENAI_CRED": "test-key"',
        '      }',
        '    }, {logger: this.logger, variableId: 333});',
        '    const result = await agent.action();'
      ];

      const bubble = {
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        variableName: 'agent',
        variableId: 333,
        location: { startLine: 1, endLine: 7 },
        parameters: [
          { name: 'message', value: 'Updated message', type: 'string' },
          { name: 'model', value: { model: 'gpt-4' }, type: 'object' },
          { name: 'credentials', value: { OPENAI_CRED: 'test-key' }, type: 'object' }
        ],
        hasActionCall: false,
        dependencyGraph: { name: 'ai-agent', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      // Should have replaced the multi-line instantiation with single line
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('const agent = new AIAgentBubble({');
      expect(lines[0]).toContain('logger: this.logger');
      expect(lines[0]).toContain('variableId: 333');
      expect(lines[1]).toContain('const result = await agent.action()');
    });

    it('should handle bubble with nested credentials object ending with }, {', () => {
      // This is the exact pattern from the bug report
      const lines = [
        '    const weatherAgent = new AIAgentBubble({',
        '      message: "Find weather",',
        '      credentials: {',
        '        "OPENAI_CRED": "key1",',
        '        "ANTHROPIC_CRED": "key2"',
        '      }',
        '    }, {logger: this.logger, variableId: 412, dependencyGraph: {...}});',
        '    const result = await weatherAgent.action();'
      ];

      const bubble = {
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        variableName: 'weatherAgent',
        variableId: 412,
        location: { startLine: 1, endLine: 7 },
        parameters: [
          { name: 'message', value: 'Updated weather query', type: 'string' },
          { name: 'credentials', value: { OPENAI_CRED: 'key1', ANTHROPIC_CRED: 'key2' }, type: 'object' }
        ],
        hasActionCall: false,
        dependencyGraph: { name: 'ai-agent', dependencies: [] }
      } as any;

      replaceBubbleInstantiation(lines, bubble);

      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('const weatherAgent = new AIAgentBubble({');
      expect(lines[0]).toContain('Updated weather query');
      expect(lines[0]).toContain('logger: this.logger');
      expect(lines[1]).toContain('const result = await weatherAgent.action()');
    });
  });
});
