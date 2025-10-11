import { SignedOut, SignInButton, SignUpButton } from '@clerk/clerk-react';
import { X } from 'lucide-react';

interface SignInModalProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isVisible = true,
  onClose,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <SignedOut>
      {/* Modal backdrop - full screen with dark overlay (no blur) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        {/* Modal container - centered with max width */}
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 relative">
          {/* Close button */}
          {onClose && (
            <button
              title="Close"
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/favicon.ico"
                  alt="Bubble Lab"
                  className="w-12 h-12 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-300 text-2xl font-semibold">
                Welcome to Bubble Lab
              </p>
              <p className="text-gray-400 text-sm">
                Sign in to start automating!
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <SignInButton mode="modal">
                <button className="w-full bg-white hover:bg-gray-100 text-black px-6 py-3 rounded-lg font-medium transition-colors duration-200">
                  Sign In
                </button>
              </SignInButton>
              <div className="text-center">
                <span className="text-gray-400 text-sm">
                  Don't have an account?{' '}
                </span>
                <SignUpButton mode="modal">
                  <button className="text-white hover:text-gray-200 text-sm font-medium transition-colors duration-200 underline">
                    Create Account now
                  </button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SignedOut>
  );
};
