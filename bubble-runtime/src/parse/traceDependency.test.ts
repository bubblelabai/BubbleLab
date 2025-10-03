import { getFixture } from '../../tests/fixtures/index.js';
import { traceBubbleDependencies } from './traceDependencies.js';
import { BubbleFactory } from '@bubblelab/bubble-core';

describe('traceBubbleDependencies', () => {
  it('should trace bubble dependencies', async () => {
    const code = getFixture('reddit-lead-finder');
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
    const dependencies = traceBubbleDependencies(code, bubbleFactory);
    console.log(dependencies);
    expect(dependencies).toBeDefined();
  });
});
