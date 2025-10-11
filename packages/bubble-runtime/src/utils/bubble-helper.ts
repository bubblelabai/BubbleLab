import { BubbleClassWithMetadata, BubbleFactory } from '@bubblelab/bubble-core';
import { BubbleNodeType } from '@bubblelab/shared-schemas';

/**
 * Build a lookup map from className to bubble metadata
 */
export function buildClassNameLookup(
  factory: BubbleFactory
): Map<
  string,
  { bubbleName: string; className: string; nodeType: BubbleNodeType }
> {
  const lookup = new Map<
    string,
    { bubbleName: string; className: string; nodeType: BubbleNodeType }
  >();
  const all = factory.getAll() as BubbleClassWithMetadata[];

  for (const ctor of all) {
    const className = (ctor as unknown as { name: string }).name;
    const bubbleName =
      (ctor as unknown as { bubbleName?: string }).bubbleName ?? className;
    const nodeType =
      (ctor as unknown as { type?: BubbleNodeType }).type ?? 'unknown';
    lookup.set(className, { bubbleName, className, nodeType });
  }

  return lookup;
}
