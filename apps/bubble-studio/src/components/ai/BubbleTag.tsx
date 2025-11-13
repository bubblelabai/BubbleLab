/**
 * BubbleTag - Inline bubble reference component
 * Displays bubble icon + variable name in chat messages
 */
import { CogIcon } from '@heroicons/react/24/outline';
import { findLogoForBubble } from '../../lib/integrations';
import { useBubbleDetail } from '../../hooks/useBubbleDetail';
import { useUIStore } from '../../stores/uiStore';

interface BubbleTagProps {
  variableId: number;
}

export function BubbleTag({ variableId }: BubbleTagProps) {
  const selectedFlow = useUIStore((state) => state.selectedFlowId);
  const bubbleDetail = useBubbleDetail(selectedFlow).getBubbleInfo(variableId);

  const logo = findLogoForBubble({ variableName: bubbleDetail?.bubbleName });

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
      <span className="font-medium">{bubbleDetail?.variableName}</span>
    </span>
  );
}
