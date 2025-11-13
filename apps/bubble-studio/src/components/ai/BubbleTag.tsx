/**
 * BubbleTag - Inline bubble reference component
 * Displays bubble icon + variable name in chat messages
 */
import { CogIcon } from '@heroicons/react/24/outline';
import { findLogoForBubble } from '../../lib/integrations';
import type { BubbleInfo } from '../../utils/bubbleUtils';

interface BubbleTagProps {
  variableId: number;
}

export function BubbleTag({ variableId }: BubbleTagProps) {
  const logo = findLogoForBubble({ variableName: variableId.toString() });

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-900/30 rounded text-xs text-blue-200 border border-blue-700/50">
      {logo ? (
        <img
          src={logo.file}
          alt={`${logo.name} logo`}
          className="h-3 w-3 object-contain"
          loading="lazy"
        />
      ) : (
        <CogIcon className="h-3 w-3" />
      )}
      <span className="font-medium">{variableId}</span>
    </span>
  );
}
