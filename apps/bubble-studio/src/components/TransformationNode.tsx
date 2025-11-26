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
}

interface TransformationNodeProps {
  data: TransformationNodeData;
}

function TransformationNode({ data }: TransformationNodeProps) {
  const { transformationInfo } = data;
  const {
    functionName,
    description,
    code,
    isAsync,
    variableName,
    arguments: args,
  } = transformationInfo;

  // Calculate height based on code lines
  const codeLines = code.split('\n').length;
  const headerHeight = 80;
  const codeLineHeight = 18;
  const codeHeight = Math.max(codeLines * codeLineHeight + 20, 100);
  const footerHeight = 30;
  const padding = 40;
  const calculatedHeight = headerHeight + codeHeight + footerHeight + padding;

  return (
    <div
      className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg shadow-lg border-2 border-amber-400 dark:border-amber-600"
      style={{
        width: '400px',
        height: `${calculatedHeight}px`,
        padding: '20px',
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: '#f59e0b' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#f59e0b' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: '#f59e0b' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#f59e0b' }}
      />

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Code2 className="w-5 h-5 text-amber-700 dark:text-amber-300" />
          <span className="text-lg font-bold text-amber-900 dark:text-amber-100">
            {isAsync && '⚡️ '}
            {variableName ? `${variableName} = ` : ''}
            {functionName}({args})
          </span>
        </div>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {/* Code Display */}
      <div className="mb-3 bg-gray-900 rounded-md overflow-hidden">
        <pre className="text-xs text-gray-100 p-3 overflow-x-auto overflow-y-auto max-h-64">
          <code>{code}</code>
        </pre>
      </div>

      {/* Footer - shows transformation label */}
      <div className="mt-2 pt-2 border-t border-amber-300 dark:border-amber-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Transformation
        </span>
      </div>
    </div>
  );
}

export default memo(TransformationNode);
