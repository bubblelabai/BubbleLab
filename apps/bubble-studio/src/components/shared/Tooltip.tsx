import { ReactNode, useState } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  show: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({
  children,
  content,
  show,
  position = 'bottom',
}: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } right-0 px-4 py-2.5 bg-amber-500/95 backdrop-blur-sm rounded-lg text-sm font-medium text-gray-900 leading-relaxed shadow-xl shadow-amber-500/25 z-50 pointer-events-none transition-all duration-200 ${
            isHovered ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
          style={{
            width: 'max-content',
            maxWidth: '280px',
          }}
        >
          {content}
          <div
            className={`absolute ${
              position === 'top'
                ? 'top-full -mt-1 border-[6px] border-transparent border-t-amber-500/95'
                : 'bottom-full -mb-1 border-[6px] border-transparent border-b-amber-500/95'
            } right-4`}
          />
        </div>
      )}
    </div>
  );
}
