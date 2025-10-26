import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
}

/**
 * TypewriterText Component
 *
 * Displays text character-by-character with a typing animation effect.
 * Shows a blinking cursor while typing, which disappears when complete.
 *
 * @param text - The full text to display
 * @param speed - Typing speed in milliseconds per character (default: 30)
 * @param onComplete - Callback fired when typing animation completes
 */
export function TypewriterText({
  text,
  speed = 30,
  onComplete,
}: TypewriterTextProps) {
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
    <p className="text-base text-purple-100 leading-relaxed">
      {displayedText}
      {!isComplete && (
        <span className="ml-0.5 animate-pulse text-purple-300">|</span>
      )}
    </p>
  );
}
