import { useState } from 'react';
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { useUser } from '../hooks/useUser';

// Extend Window interface for Clerk
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>;
      };
    };
  }
}

// Persona options
const PERSONA_OPTIONS = [
  { id: 'founder', label: 'Founder / Startup', icon: '🚀' },
  { id: 'agency', label: 'Automation Agency', icon: '⚡' },
  { id: 'engineer', label: 'Software Engineer', icon: '💻' },
  { id: 'product', label: 'Product Manager', icon: '📋' },
  { id: 'operations', label: 'Operations / Ops', icon: '⚙️' },
  { id: 'marketer', label: 'Marketer', icon: '📈' },
  { id: 'student', label: 'Student / Learning', icon: '📚' },
  { id: 'other', label: 'Other', icon: '✨' },
];

// Discovery channel options
const DISCOVERY_OPTIONS = [
  { id: 'twitter', label: 'Twitter / X', icon: '𝕏' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'google', label: 'Google Search', icon: '🔍' },
  { id: 'producthunt', label: 'Product Hunt', icon: '🐱' },
  { id: 'github', label: 'GitHub', icon: '🐙' },
  { id: 'discord', label: 'Discord', icon: '💬' },
  { id: 'reddit', label: 'Reddit', icon: '🔴' },
  { id: 'referral', label: 'Friend / Referral', icon: '👋' },
  { id: 'other', label: 'Other', icon: '✨' },
];

interface OnboardingQuestionnaireProps {
  isVisible: boolean;
  onComplete: () => void;
}

export const OnboardingQuestionnaire: React.FC<
  OnboardingQuestionnaireProps
> = ({ isVisible, onComplete }) => {
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [persona, setPersona] = useState<string>('');
  const [discoveryChannel, setDiscoveryChannel] = useState<string>('');
  const [wantsInterview, setWantsInterview] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isVisible) {
    return null;
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return persona !== '';
      case 1:
        return discoveryChannel !== '';
      case 2:
        return wantsInterview !== null;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getAuthToken()}`,
          },
          body: JSON.stringify({
            persona,
            discoveryChannel,
            wantsInterview,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit questionnaire');
      }

      // Update local user state to reflect onboarding completion
      if (user) {
        // Clerk will handle the metadata update server-side
        // We just need to call onComplete to proceed
      }

      onComplete();
    } catch (err) {
      console.error('Failed to submit onboarding questionnaire:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get auth token
  const getAuthToken = async () => {
    // Access the Clerk session token
    const token = await window.Clerk?.session?.getToken();
    return token || '';
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                What describes you best?
              </h2>
              <p className="text-gray-400 text-sm">
                Help us personalize your experience
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PERSONA_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPersona(option.id)}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    persona === option.id
                      ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.icon}</span>
                    <span
                      className={`font-medium ${persona === option.id ? 'text-white' : 'text-gray-300'}`}
                    >
                      {option.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                How did you discover us?
              </h2>
              <p className="text-gray-400 text-sm">
                We'd love to know where you found Bubble Lab
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {DISCOVERY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDiscoveryChannel(option.id)}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    discoveryChannel === option.id
                      ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.icon}</span>
                    <span
                      className={`font-medium ${discoveryChannel === option.id ? 'text-white' : 'text-gray-300'}`}
                    >
                      {option.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Would you like 3 months of Pro for free?
              </h2>
              <p className="text-gray-400 text-sm">
                Join a quick 15-minute user interview and get 3 months of Pro
                for free
              </p>
              <p className="text-gray-500 text-xs mt-2">
                We'll reach out to {user?.emailAddresses?.[0]?.emailAddress} to
                schedule
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setWantsInterview(true)}
                className={`p-5 rounded-xl border text-left transition-all duration-200 ${
                  wantsInterview === true
                    ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <span
                      className={`font-medium text-lg ${wantsInterview === true ? 'text-white' : 'text-gray-300'}`}
                    >
                      Yes, I'd love to!
                    </span>
                    <p className="text-gray-500 text-sm mt-1">
                      Get 3 months Pro free + help shape the product
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setWantsInterview(false)}
                className={`p-5 rounded-xl border text-left transition-all duration-200 ${
                  wantsInterview === false
                    ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏭️</span>
                  <div>
                    <span
                      className={`font-medium text-lg ${wantsInterview === false ? 'text-white' : 'text-gray-300'}`}
                    >
                      Maybe later
                    </span>
                    <p className="text-gray-500 text-sm mt-1">
                      No worries, you can always reach out later
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 relative">
        {/* Progress indicator */}
        <div className="flex gap-2 mb-8 justify-center">
          {[0, 1, 2].map((step) => (
            <div
              key={step}
              className={`h-1.5 w-16 rounded-full transition-all duration-300 ${
                step <= currentStep ? 'bg-purple-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">{renderStep()}</div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between items-center mt-8">
          <button
            type="button"
            onClick={handleBack}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors ${
              currentStep === 0 ? 'invisible' : ''
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              canProceed() && !isSubmitting
                ? 'bg-white text-black hover:bg-gray-100 shadow-lg hover:shadow-xl hover:scale-105'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : currentStep === 2 ? (
              <>
                <Check className="w-4 h-4" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
