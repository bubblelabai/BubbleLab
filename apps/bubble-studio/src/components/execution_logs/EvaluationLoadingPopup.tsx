import { AnimatePresence, motion } from 'framer-motion';

interface EvaluationLoadingPopupProps {
  isEvaluating: boolean;
}

export function EvaluationLoadingPopup({
  isEvaluating,
}: EvaluationLoadingPopupProps) {
  return (
    <AnimatePresence>
      {isEvaluating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(15, 17, 21, 0.9)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Main Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 5 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center gap-6 p-8 rounded-2xl"
            style={{
              background:
                'linear-gradient(145deg, rgba(31, 41, 55, 0.6) 0%, rgba(17, 24, 39, 0.8) 100%)',
              border: '1px solid rgba(75, 85, 99, 0.3)',
              boxShadow:
                '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 80px rgba(168, 85, 247, 0.08)',
            }}
          >
            {/* Pearl Avatar with Glow Ring */}
            <div className="relative">
              {/* Outer glow */}
              <motion.div
                className="absolute -inset-4 rounded-full opacity-60"
                style={{
                  background:
                    'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.4, 0.6, 0.4],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Spinning ring around Pearl */}
              <motion.div
                className="absolute -inset-3"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <defs>
                    <linearGradient
                      id="pearlGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="rgba(168, 85, 247, 0.8)" />
                      <stop offset="50%" stopColor="rgba(139, 92, 246, 0.4)" />
                      <stop offset="100%" stopColor="rgba(168, 85, 247, 0.1)" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="url(#pearlGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="40 200"
                  />
                </svg>
              </motion.div>

              {/* Secondary ring - opposite direction */}
              <motion.div
                className="absolute -inset-3"
                animate={{ rotate: -360 }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="rgba(139, 92, 246, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="8 40"
                  />
                </svg>
              </motion.div>

              {/* Pearl Image */}
              <motion.div
                className="relative w-16 h-16 rounded-full overflow-hidden"
                style={{
                  boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)',
                }}
                animate={{
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <img
                  src="/pearl.png"
                  alt="Pearl"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </div>

            {/* Text Container */}
            <div className="flex flex-col items-center gap-2">
              {/* Main text */}
              <motion.div
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                <span className="text-sm font-medium text-gray-200 tracking-wide">
                  Checking your workflow
                </span>
                {/* Animated dots */}
                <span className="flex gap-0.5 ml-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="inline-block w-1 h-1 rounded-full bg-purple-400"
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1.2, 0.8],
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </span>
              </motion.div>

              {/* Subtext */}
              <motion.p
                className="text-xs text-gray-500 text-center max-w-[280px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                This one-time check helps ensure smooth execution
              </motion.p>
            </div>

            {/* Progress bar */}
            <motion.div
              className="w-48 h-1 rounded-full overflow-hidden bg-gray-800"
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(168, 85, 247, 0.8), rgba(139, 92, 246, 0.6), rgba(168, 85, 247, 0.8))',
                  backgroundSize: '200% 100%',
                }}
                animate={{
                  backgroundPosition: ['0% 0%', '200% 0%'],
                  width: ['0%', '100%'],
                }}
                transition={{
                  backgroundPosition: {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                  },
                  width: {
                    duration: 8,
                    ease: 'easeInOut',
                  },
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
