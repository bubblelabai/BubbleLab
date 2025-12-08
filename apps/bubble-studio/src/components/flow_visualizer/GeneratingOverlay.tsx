import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createGenerateCodeQuery } from '@/queries/generateCodeQuery';

interface GeneratingOverlayProps {
  flowId: number;
  prompt?: string;
}

/**
 * Component to show generation progress while code is being generated
 * Displays streaming events from the code generation process
 */
export function GeneratingOverlay({ flowId, prompt }: GeneratingOverlayProps) {
  const [output, setOutput] = useState('');
  const outputEndRef = useRef<HTMLDivElement>(null);
  const processedEventCountRef = useRef(0);

  // Query to get generation events for this flow
  const { data: events = [] } = useQuery({
    ...createGenerateCodeQuery({
      prompt: prompt || '',
      flowId: flowId,
    }),
    enabled: !!prompt && !!flowId,
  });

  // Process events as they stream in
  useEffect(() => {
    if (events.length === 0) return;

    const newEvents = events.slice(processedEventCountRef.current);
    if (newEvents.length === 0) return;

    processedEventCountRef.current = events.length;

    for (const eventData of newEvents) {
      switch (eventData.type) {
        case 'llm_start':
          setOutput((prev) => prev + `Pearl is analyzing your prompt...\n`);
          break;

        case 'tool_start': {
          const tool = eventData.data.tool;
          let toolDesc = '';
          switch (tool) {
            case 'bubble-discovery':
              toolDesc = 'Pearl is discovering available bubbles';
              break;
            case 'template-generation':
              toolDesc = 'Pearl is creating code template';
              break;
            case 'bubbleflow-validation':
            case 'bubbleflow-validation-tool':
              toolDesc = 'Pearl is validating generated code';
              break;
            default:
              toolDesc = `Pearl is using ${tool}`;
          }
          setOutput((prev) => prev + `${toolDesc}...\n`);
          break;
        }

        case 'tool_complete': {
          const duration = eventData.data.duration
            ? ` (${eventData.data.duration}ms)`
            : '';
          setOutput((prev) => prev + `✅ Complete${duration}\n`);
          break;
        }

        case 'generation_complete':
          setOutput((prev) => prev + `\n✅ Code generation complete!\n`);
          break;

        case 'error':
          setOutput((prev) => prev + `\n❌ Error: ${eventData.data.error}\n`);
          break;
      }
    }
  }, [events]);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  return (
    <div className="h-full flex flex-col items-center justify-start p-8 overflow-hidden">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-purple-400 text-lg mb-2">Generating Code...</p>
        <p className="text-gray-500 text-sm">
          Pearl is creating your workflow. This may take a few minutes.
        </p>
      </div>

      {/* Show generation output/events */}
      {output && (
        <div className="flex-1 w-full max-w-2xl overflow-y-auto bg-gray-900/50 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
            {output}
          </div>
          <div ref={outputEndRef} />
        </div>
      )}
    </div>
  );
}
