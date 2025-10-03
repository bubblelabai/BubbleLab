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
});
