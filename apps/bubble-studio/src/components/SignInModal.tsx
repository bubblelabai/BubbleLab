import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { SignedOut } from './AuthComponents';
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
        <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 relative">
          {/* Close button */}
          {onClose && (
            <button
              title="Close"
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors duration-200"
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
              <p className="text-foreground/80 text-2xl font-semibold">
                Welcome to Bubble Lab
              </p>
              <p className="text-muted-foreground text-sm">
                Sign in to start automating!
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <SignInButton mode="modal">
                <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors duration-200">
                  Sign In
                </button>
              </SignInButton>
              <div className="text-center">
                <span className="text-muted-foreground text-sm">
                  Don't have an account?{' '}
                </span>
                <SignUpButton mode="modal">
                  <button className="text-foreground hover:text-foreground/80 text-sm font-medium transition-colors duration-200 underline">
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
