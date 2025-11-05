import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { sharedMarkdownComponents } from './shared/MarkdownComponents';

interface TypewriterMarkdownProps {
  text: string;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
}

/**
 * TypewriterMarkdown Component
 *
 * Displays markdown text character-by-character with a typing animation effect.
 * Shows a blinking cursor while typing, which disappears when complete.
 * Properly renders markdown formatting including bold, lists, code blocks, etc.
 * Uses shared markdown styles for consistency across the app.
 *
 * @param text - The full markdown text to display
 * @param speed - Typing speed in milliseconds per character (default: 10)
 * @param onComplete - Callback fired when typing animation completes
 */
export function TypewriterMarkdown({
  text,
  speed = 10,
  onComplete,
}: TypewriterMarkdownProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setIsComplete(true);
      return;
    }

    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown components={sharedMarkdownComponents}>
        {displayedText}
      </ReactMarkdown>
      {!isComplete && (
        <span className="ml-0.5 animate-pulse text-purple-300 text-lg">|</span>
      )}
    </div>
  );
}
