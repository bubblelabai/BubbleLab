/**
 * Overlay shown when Pearl is generating workflow code
 */

export function GeneratingOverlay() {
  return (
    <div className="h-full relative">
      {/* Background with dots - same as ReactFlow */}
      <div className="absolute inset-0 bg-sidebar">
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
              <circle
                cx="1"
                cy="1"
                r="1"
                className="fill-slate-400 dark:fill-[#525252]"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Message overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          {/* Holographic Glass Bubble */}
          <div className="flex items-center justify-center mb-6 relative">
            {/* Main bubble container */}
            <div className="relative w-24 h-24 animate-float">
              {/* Outer glow/aura */}
              <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl" />

              {/* Main glass sphere */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-300 via-purple-500 to-purple-700 shadow-2xl shadow-purple-500/40">
                {/* Glass overlay for depth */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-black/20" />

                {/* Secondary highlight (bottom-right) */}
                <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-purple-200/40 blur-sm" />

                {/* Inner reflection spots */}
                <div className="absolute top-5 right-7 w-4 h-4 rounded-full bg-white/20" />
                <div className="absolute bottom-10 left-5 w-3 h-3 rounded-full bg-purple-100/25" />

                {/* Holographic shimmer effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent animate-shimmer" />

                {/* Bottom shadow/depth */}
                <div className="absolute bottom-0 left-1/4 right-1/4 h-1/3 bg-gradient-to-t from-purple-900/40 to-transparent rounded-full blur-sm" />
              </div>
            </div>
          </div>

          <p className="text-muted-foreground text-base font-medium">
            Please be patient, Pearl is generating your workflow...
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-12px) scale(1.03);
          }
        }

        @keyframes shimmer {
          0% {
            transform: rotate(0deg);
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            transform: rotate(360deg);
            opacity: 0.3;
          }
        }

        .animate-float {
          animation: float 4s ease-in-out infinite;
        }

        .animate-shimmer {
          animation: shimmer 8s linear infinite;
        }

        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-pulse-slower {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
