import React, { useRef, useEffect } from 'react';
import {
  Brain,
  NotepadText,
  Pen,
  Check,
  Wrench,
  Trophy,
  Sparkles,
  Ban,
} from 'lucide-react';

// LoadingDots component using bouncing animation for code generation
const LoadingDots: React.FC = () => {
  return (
    <span className="inline-block animate-bounce text-blue-400 font-bold ml-1">
      ●●●
    </span>
  );
};

// Helper function to render icons with text
const renderIconWithText = (icon: React.ReactNode, text: string) => (
  <span className="flex items-center gap-1 text-muted-foreground">
    <span className="w-4 h-4">{icon}</span>
    <span>{text}</span>
  </span>
);

interface FlowGenerationProps {
  isStreaming: boolean;
  output: string;
  isRunning: boolean;
}

export const FlowGeneration: React.FC<FlowGenerationProps> = ({
  isStreaming,
  output,
  isRunning,
}) => {
  // Ref for auto-scrolling output
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll output when new content is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Live Generation Section UI
  if (isStreaming) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div
          ref={outputRef}
          className="flex-1 min-h-0 p-4 overflow-auto thin-scrollbar bg-card scroll-smooth"
        >
          <div className="relative">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {(() => {
                const lines = output.split('\n');
                const streamingActive = isStreaming;
                // Determine the last visible content line (skip trailing empty lines)
                let lastContentIndex = lines.length - 1;
                while (lastContentIndex > 0 && lines[lastContentIndex] === '') {
                  lastContentIndex--;
                }

                return lines.map((line, index) => {
                  const isLastLine = index === lastContentIndex;
                  const displayLine = isLastLine
                    ? line.replace(/\.\.\.$/, '')
                    : line;

                  // Render icons for specific text patterns
                  const renderLineWithIcons = (text: string) => {
                    if (text.includes('AI analyzing')) {
                      return renderIconWithText(
                        <Brain className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('AI analysis complete')) {
                      return renderIconWithText(
                        <Brain className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Discovering available bubbles')) {
                      return renderIconWithText(
                        <NotepadText className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Creating code template')) {
                      return renderIconWithText(
                        <Pen className="w-4 h-4" />,
                        text
                      );
                    }
                    if (
                      text.includes('Understanding') &&
                      text.includes('capabilities')
                    ) {
                      return renderIconWithText(
                        <NotepadText className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Validating generated code')) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Using')) {
                      return renderIconWithText(
                        <Wrench className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Discovered bubbles')) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Template created')) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Bubble details loaded')) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Code validation completed')) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Tool completed')) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Refining code')) {
                      return renderIconWithText(
                        <Sparkles className="w-4 h-4" />,
                        text
                      );
                    }
                    if (
                      text.includes('Refinement step') &&
                      text.includes('completed')
                    ) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Code generated successfully')) {
                      return renderIconWithText(
                        <Trophy className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Summary:')) {
                      return renderIconWithText(
                        <NotepadText className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Input Schema: Available')) {
                      return renderIconWithText(
                        <NotepadText className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Finalizing results')) {
                      return renderIconWithText(
                        <NotepadText className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Error:')) {
                      return renderIconWithText(
                        <Ban className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Generation Complete!')) {
                      return renderIconWithText(
                        <NotepadText className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Generation Error:')) {
                      return renderIconWithText(
                        <Ban className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Valid')) {
                      return renderIconWithText(
                        <Check className="w-4 h-4" />,
                        text
                      );
                    }
                    if (text.includes('Failed')) {
                      return renderIconWithText(
                        <Ban className="w-4 h-4" />,
                        text
                      );
                    }
                    return <span>{text}</span>;
                  };

                  return (
                    <div key={index}>
                      {renderLineWithIcons(displayLine)}
                      {streamingActive &&
                        isLastLine &&
                        /\.\.\.$/.test(line) && <LoadingDots />}
                    </div>
                  );
                });
              })()}
            </div>
            {isRunning && (
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
