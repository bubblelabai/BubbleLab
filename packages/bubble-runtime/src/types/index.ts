import { ParsedBubble } from '@bubblelab/shared-schemas';

export interface ParseResult {
  success: boolean;
  bubbles: Record<string, ParsedBubble>;
  errors?: string[];
  warnings?: string[];
}
