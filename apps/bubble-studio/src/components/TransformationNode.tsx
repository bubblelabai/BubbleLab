import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Code2 } from 'lucide-react';

export interface TransformationNodeData {
  flowId: number;
  transformationInfo: {
    functionName: string;
    description?: string;
    code: string;
    arguments: string;
    location: { startLine: number; endLine: number };
    isAsync: boolean;
    variableName?: string;
  };
  usedHandles?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
}

interface TransformationNodeProps {
  data: TransformationNodeData;
}

function TransformationNode({ data }: TransformationNodeProps) {
  const { transformationInfo, usedHandles = {} } = data;
  const {
    functionName,
    description,
    code,
    variableName,
    arguments: args,
  } = transformationInfo;

  // Calculate height based on code lines
  const codeLines = code.split('\n').length;
  const headerHeight = 80;
  const codeLineHeight = 18;
  const codeHeight = Math.max(codeLines * codeLineHeight + 20, 100);
  const padding = 40;
  const calculatedHeight = headerHeight + codeHeight + padding;

  return (
    <div
      className="relative bg-neutral-800/60 backdrop-blur-sm rounded-lg border border-neutral-600/60 shadow-xl"
      style={{
        width: '400px',
        height: `${calculatedHeight}px`,
        padding: '20px',
      }}
    >
      {/* Connection handles - only show if used */}
      {usedHandles.top && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}
      {usedHandles.bottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}
      {usedHandles.left && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}
      {usedHandles.right && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Code2 className="w-5 h-5 text-neutral-400" />
          <span className="text-lg font-semibold text-neutral-100">
            {variableName ? `${variableName} = ` : ''}
            {functionName}({args})
          </span>
        </div>
        {description && (
          <p className="text-sm text-neutral-300 line-clamp-2">{description}</p>
        )}
      </div>

      {/* Code Display */}
      <div className="mb-3 bg-neutral-900 rounded-md overflow-hidden">
        <pre className="text-xs text-neutral-100 p-3 overflow-x-auto overflow-y-auto max-h-64">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default memo(TransformationNode);
