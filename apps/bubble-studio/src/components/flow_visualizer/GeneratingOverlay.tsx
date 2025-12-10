/**
 * Overlay shown when Pearl is generating workflow code
 */

export function GeneratingOverlay() {
  return (
    <div className="h-full relative">
      {/* Background with dots - same as ReactFlow */}
      <div className="absolute inset-0" style={{ backgroundColor: '#1e1e1e' }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="dots"
              x="0"
              y="0"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="#525252" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Message overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
          <p className="text-gray-400 text-base mb-2">
            Pearl is generating your workflow
          </p>
          <p className="text-gray-500 text-sm">
            Check the Pearl panel on the right to see progress
          </p>
        </div>
      </div>
    </div>
  );
}
