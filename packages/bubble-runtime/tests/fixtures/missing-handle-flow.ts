// Invalid example that should fail validation
// Missing handle method - implements wrong method name

import { BubbleFlow } from '@bubblelab/bubble-core';

// @ts-expect-error Missing handle method
export class MissingHandleFlow extends BubbleFlow<'webhook/http'> {
  async execute(payload: any) {
    // Wrong method name - should be 'handle' not 'execute'
    return { status: 'should fail' };
  }
}
