// Invalid examples that should fail validation

// Example 1: Missing BubbleFlow class
export class InvalidFlow {
  async handle(payload: any) {
    return { error: "Should fail - doesn't extend BubbleFlow" };
  }
}

// Example 2: Unregistered bubble class
import { BubbleFlow } from '@bubblelab/bubble-core';

class CustomUnregisteredBubble {
  constructor(params: any) {}
  async action() {
    return {};
  }
}

export class UnregisteredBubbleFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const invalid = new CustomUnregisteredBubble({
      param: 'should fail',
    });

    return await invalid.action();
  }
}

// Example 3: Missing handle method
// @ts-expect-error Missing handle method
export class MissingHandleFlow extends BubbleFlow<'webhook/http'> {
  async execute(payload: any) {
    // Wrong method name
    return { status: 'should fail' };
  }
}
