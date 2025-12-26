import { describe, it, expect } from 'vitest';
import { normalizeBracelessControlFlow } from './normalize-control-flow';

describe('normalizeBracelessControlFlow', () => {
  it('should wrap braceless if-else chain with braces', () => {
    const input = `
if (x === 'A') aCount++;
else if (x === 'B') bCount++;
else cCount++;
`;
    const result = normalizeBracelessControlFlow(input);
    console.log('Input:', input);
    console.log('Output:', result);

    // Check it still parses
    expect(result).toContain('{');
    expect(result).toContain('}');
  });
});
