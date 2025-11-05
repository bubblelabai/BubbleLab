import type { Components } from 'react-markdown';

/**
 * Shared markdown component styles for consistent rendering across the app
 * Used by TypewriterMarkdown (Generation Overlay) and PearlChat
 */
export const sharedMarkdownComponents: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-xl md:text-2xl font-bold text-gray-100 mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg md:text-xl font-bold text-gray-100 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base md:text-lg font-semibold text-gray-200 mb-2">
      {children}
    </h3>
  ),
  // Paragraphs
  p: ({ children }) => (
    <p className="text-base text-gray-300 leading-relaxed mb-4">{children}</p>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-2 mb-4 text-base text-gray-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-2 mb-4 text-base text-gray-300">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-300 leading-relaxed">{children}</li>
  ),
  // Code blocks
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-gray-800/50 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-gray-900/50 text-gray-300 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4">
        {children}
      </code>
    );
  },
  // Pre blocks (wraps code blocks)
  pre: ({ children }) => (
    <pre className="bg-gray-900/50 rounded-lg overflow-x-auto mb-4">
      {children}
    </pre>
  ),
  // Bold text
  strong: ({ children }) => (
    <strong className="font-bold text-gray-100">{children}</strong>
  ),
  // Links
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-blue-400 hover:text-blue-300 underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-purple-500 pl-4 py-2 my-4 text-gray-400 italic">
      {children}
    </blockquote>
  ),
};
