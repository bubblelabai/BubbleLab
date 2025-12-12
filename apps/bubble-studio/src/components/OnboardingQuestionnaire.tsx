import { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Rocket,
  Zap,
  Code,
  ClipboardList,
  Settings,
  TrendingUp,
  BookOpen,
  Sparkles,
  UserPlus,
  Gift,
  SkipForward,
} from 'lucide-react';
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
  { id: 'founder', label: 'Founder / Startup', icon: Rocket },
  { id: 'agency', label: 'Automation Agency', icon: Zap },
  { id: 'engineer', label: 'Software Engineer', icon: Code },
  { id: 'product', label: 'Product Manager', icon: ClipboardList },
  { id: 'operations', label: 'Operations / Ops', icon: Settings },
  { id: 'marketer', label: 'Marketer', icon: TrendingUp },
  { id: 'student', label: 'Student / Learning', icon: BookOpen },
  { id: 'other', label: 'Other', icon: Sparkles },
];

// Discovery channel options
// Using logos from public/integrations folder where available
const DISCOVERY_OPTIONS = [
  { id: 'twitter', label: 'Twitter / X', logo: '/integrations/x.svg' },
  { id: 'linkedin', label: 'LinkedIn', logo: '/integrations/linkedin.svg' },
  { id: 'youtube', label: 'YouTube', logo: '/integrations/youtube.svg' },
  { id: 'google', label: 'Google Search', logo: '/integrations/google.svg' }, // Logo not found
  { id: 'instagram', label: 'Instagram', logo: '/integrations/instagram.svg' },
  { id: 'github', label: 'GitHub', logo: '/integrations/github.svg' },
  { id: 'tiktok', label: 'TikTok', logo: '/integrations/tiktok.svg' }, // Logo not found
  { id: 'reddit', label: 'Reddit', logo: '/integrations/reddit.svg' },
  { id: 'referral', label: 'Friend / Referral', icon: UserPlus },
  { id: 'other', label: 'Other', icon: Sparkles },
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
  const [personaOtherText, setPersonaOtherText] = useState<string>('');
  const [discoveryChannel, setDiscoveryChannel] = useState<string>('');
  const [discoveryOtherText, setDiscoveryOtherText] = useState<string>('');
  const [wantsInterview, setWantsInterview] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isVisible) {
    return null;
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return (
          persona !== '' &&
          (persona !== 'other' || personaOtherText.trim() !== '')
        );
      case 1:
        return (
          discoveryChannel !== '' &&
          (discoveryChannel !== 'other' || discoveryOtherText.trim() !== '')
        );
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
            persona: persona === 'other' ? personaOtherText.trim() : persona,
            discoveryChannel:
              discoveryChannel === 'other'
                ? discoveryOtherText.trim()
                : discoveryChannel,
            wantsInterview,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit questionnaire');
      }

      // Store onboarding completion in localStorage (for self-hosted users)
      // This ensures self-hosted users don't see the questionnaire again
      localStorage.setItem('onboardingCompleted', 'true');

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
              {PERSONA_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                const isSelected = persona === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setPersona(option.id);
                      if (option.id !== 'other') {
                        setPersonaOtherText('');
                      }
                    }}
                    className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent
                        className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-400'}`}
                      />
                      <span
                        className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}
                      >
                        {option.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {persona === 'other' && (
              <div className="mt-4">
                <input
                  type="text"
                  value={personaOtherText}
                  onChange={(e) => setPersonaOtherText(e.target.value)}
                  placeholder="Please specify..."
                  className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                  autoFocus
                />
              </div>
            )}
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
              {DISCOVERY_OPTIONS.map((option) => {
                const isSelected = discoveryChannel === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setDiscoveryChannel(option.id);
                      if (option.id !== 'other') {
                        setDiscoveryOtherText('');
                      }
                    }}
                    className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {'logo' in option ? (
                        <img
                          src={option.logo}
                          alt={option.label}
                          className={`w-5 h-5 object-contain ${
                            isSelected ? 'opacity-100' : 'opacity-60'
                          }`}
                        />
                      ) : (
                        <option.icon
                          className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-400'}`}
                        />
                      )}
                      <span
                        className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}
                      >
                        {option.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {discoveryChannel === 'other' && (
              <div className="mt-4">
                <input
                  type="text"
                  value={discoveryOtherText}
                  onChange={(e) => setDiscoveryOtherText(e.target.value)}
                  placeholder="Please specify..."
                  className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                  autoFocus
                />
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Want a $20 Amazon gift card?
              </h2>
              <p className="text-gray-400 text-sm">
                Join a quick 15-minute user interview and get gift card on us!
                🎁
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
                  <Gift
                    className={`w-6 h-6 ${wantsInterview === true ? 'text-white' : 'text-gray-400'}`}
                  />
                  <div>
                    <span
                      className={`font-medium text-lg ${wantsInterview === true ? 'text-white' : 'text-gray-300'}`}
                    >
                      Yes, I'd love to!
                    </span>
                    <p className="text-gray-500 text-sm mt-1">
                      Get $20 Amazon gift card + help shape the product
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
                  <SkipForward
                    className={`w-6 h-6 ${wantsInterview === false ? 'text-white' : 'text-gray-400'}`}
                  />
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
                step <= currentStep ? 'bg-white' : 'bg-white/10'
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
