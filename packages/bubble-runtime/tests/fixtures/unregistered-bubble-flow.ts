// Invalid example that should fail validation
// Unregistered bubble class - uses a custom bubble that isn't registered

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
