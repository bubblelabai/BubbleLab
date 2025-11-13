/**
 * Utility for parsing bubble tags in text
 * Format: <bubble>variableId</bubble>
 */

export interface BubbleTagSegment {
  type: 'text' | 'bubble';
  content: string;
  variableId?: number;
}

/**
 * Parse text containing bubble tags into segments
 * Example: "Check the <bubble>123</bubble> output" ->
 * [
 *   { type: 'text', content: 'Check the ' },
 *   { type: 'bubble', content: '123', variableId: 123 },
 *   { type: 'text', content: ' output' }
 * ]
 */
export function parseBubbleTags(text: string): BubbleTagSegment[] {
  const segments: BubbleTagSegment[] = [];
  const bubbleTagRegex = /<bubble>(\d+)<\/bubble>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = bubbleTagRegex.exec(text)) !== null) {
    // Add text before the bubble tag
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the bubble tag
    const variableId = parseInt(match[1], 10);
    segments.push({
      type: 'bubble',
      content: match[1],
      variableId,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last bubble tag
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Check if text contains any bubble tags
 */
export function hasBubbleTags(text: string): boolean {
  return /<bubble>\d+<\/bubble>/.test(text);
}

/**
 * Extract all variable IDs from bubble tags in text
 */
export function extractBubbleVariableIds(text: string): number[] {
  const matches = text.matchAll(/<bubble>(\d+)<\/bubble>/g);
  return Array.from(matches, (m) => parseInt(m[1], 10));
}
