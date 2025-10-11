import { ReactNode, useEffect, useRef, useState } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  show: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

type Position = 'top' | 'bottom' | 'left' | 'right';

export function Tooltip({
  children,
  content,
  show,
  position = 'bottom',
}: TooltipProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [actualPosition, setActualPosition] = useState<Position>(position);
  const [horizontalAlign, setHorizontalAlign] = useState<
    'left' | 'center' | 'right'
  >('center');

  useEffect(() => {
    if (!show || !tooltipRef.current || !containerRef.current) return;

    const checkPosition = () => {
      if (!tooltipRef.current || !containerRef.current) return;

      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 16; // Increased padding for better edge detection

      let finalPosition = position;
      let finalHorizontalAlign: 'left' | 'center' | 'right' = 'center';

      // Check vertical positions (top/bottom)
      if (position === 'bottom' || position === 'top') {
        // Check if tooltip would overflow horizontally
        const wouldOverflowLeft = tooltipRect.left < padding;
        const wouldOverflowRight = tooltipRect.right > viewportWidth - padding;

        if (wouldOverflowLeft) {
          finalHorizontalAlign = 'left';
        } else if (wouldOverflowRight) {
          finalHorizontalAlign = 'right';
        }

        // Check if we should flip vertically
        if (position === 'bottom') {
          const spaceBelow = viewportHeight - containerRect.bottom;
          if (
            spaceBelow < tooltipRect.height + padding &&
            containerRect.top > spaceBelow
          ) {
            finalPosition = 'top';
          }
        } else if (position === 'top') {
          const spaceAbove = containerRect.top;
          if (
            spaceAbove < tooltipRect.height + padding &&
            containerRect.bottom < spaceAbove
          ) {
            finalPosition = 'bottom';
          }
        }
      }

      // Check horizontal positions (left/right)
      if (position === 'left' || position === 'right') {
        if (position === 'right') {
          const spaceRight = viewportWidth - containerRect.right;
          if (
            spaceRight < tooltipRect.width + padding &&
            containerRect.left > spaceRight
          ) {
            finalPosition = 'left';
          }
        } else if (position === 'left') {
          const spaceLeft = containerRect.left;
          if (
            spaceLeft < tooltipRect.width + padding &&
            containerRect.right < spaceLeft
          ) {
            finalPosition = 'right';
          }
        }

        // Check vertical overflow for horizontal tooltips
        const wouldOverflowTop = tooltipRect.top < padding;
        const wouldOverflowBottom =
          tooltipRect.bottom > viewportHeight - padding;

        if (wouldOverflowTop) {
          finalHorizontalAlign = 'left'; // Align to top
        } else if (wouldOverflowBottom) {
          finalHorizontalAlign = 'right'; // Align to bottom
        }
      }

      setActualPosition(finalPosition);
      setHorizontalAlign(finalHorizontalAlign);
    };

    // Check position after a small delay to ensure DOM is updated
    const timeoutId = setTimeout(checkPosition, 0);

    return () => clearTimeout(timeoutId);
  }, [show, position]);

  const getPositionClasses = () => {
    const vertical = actualPosition === 'top' || actualPosition === 'bottom';

    if (vertical) {
      const verticalClass =
        actualPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
      let horizontalClass = '';

      switch (horizontalAlign) {
        case 'left':
          horizontalClass = 'left-0';
          break;
        case 'right':
          horizontalClass = 'right-0';
          break;
        case 'center':
        default:
          horizontalClass = 'left-1/2 -translate-x-1/2';
          break;
      }

      return `${verticalClass} ${horizontalClass}`;
    } else {
      const horizontalClass =
        actualPosition === 'left' ? 'right-full mr-2' : 'left-full ml-2';
      return `${horizontalClass} top-1/2 -translate-y-1/2`;
    }
  };

  const getArrowClasses = () => {
    const vertical = actualPosition === 'top' || actualPosition === 'bottom';

    if (vertical) {
      const verticalClass =
        actualPosition === 'top'
          ? 'top-full -mt-1 border-4 border-transparent border-t-gray-900'
          : 'bottom-full -mb-1 border-4 border-transparent border-b-gray-900';

      let horizontalClass = '';
      switch (horizontalAlign) {
        case 'left':
          horizontalClass = 'left-4';
          break;
        case 'right':
          horizontalClass = 'right-4';
          break;
        case 'center':
        default:
          horizontalClass = 'left-1/2 -translate-x-1/2';
          break;
      }

      return `${verticalClass} ${horizontalClass}`;
    } else {
      const horizontalClass =
        actualPosition === 'left'
          ? 'left-full -ml-1 border-4 border-transparent border-l-gray-900'
          : 'right-full -mr-1 border-4 border-transparent border-r-gray-900';
      return `${horizontalClass} top-1/2 -translate-y-1/2`;
    }
  };

  return (
    <div className="relative group" ref={containerRef}>
      {children}
      {show && (
        <div
          ref={tooltipRef}
          className={`absolute ${getPositionClasses()} px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 max-w-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none shadow-lg z-50`}
        >
          {content}
          <div className={`absolute ${getArrowClasses()}`}></div>
        </div>
      )}
    </div>
  );
}
