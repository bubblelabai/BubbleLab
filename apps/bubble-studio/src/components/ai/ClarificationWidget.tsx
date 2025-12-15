/**
 * ClarificationWidget - Renders inline multiple-choice questions from Coffee agent
 * Allows users to select answers before proceeding with plan generation
 */
import { useState } from 'react';
import { Check, MessageCircleQuestion, Loader2 } from 'lucide-react';
import type { ClarificationQuestion } from '@bubblelab/shared-schemas';

interface ClarificationWidgetProps {
  questions: ClarificationQuestion[];
  onSubmit: (answers: Record<string, string[]>) => void;
  isSubmitting: boolean;
}

const OTHER_CHOICE_ID = 'other';

export function ClarificationWidget({
  questions,
  onSubmit,
  isSubmitting,
}: ClarificationWidgetProps) {
  // Track selected answers for each question (questionId -> selectedChoiceIds)
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string[]>
  >({});

  // Track custom text for "Other" option (questionId -> customText)
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

  const handleChoiceSelect = (questionId: string, choiceId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: [choiceId], // Single select - replace previous selection
    }));

    // Clear custom text if "Other" is not selected
    if (choiceId !== OTHER_CHOICE_ID) {
      setCustomTexts((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleCustomTextChange = (questionId: string, text: string) => {
    setCustomTexts((prev) => ({
      ...prev,
      [questionId]: text,
    }));
  };

  const handleSubmit = () => {
    // Ensure all questions have been answered
    const allAnswered = questions.every((q) => {
      const hasAnswer =
        selectedAnswers[q.id] && selectedAnswers[q.id].length > 0;
      if (!hasAnswer) return false;

      // If "Other" is selected, ensure custom text is provided
      if (selectedAnswers[q.id]?.[0] === OTHER_CHOICE_ID) {
        return customTexts[q.id] && customTexts[q.id].trim().length > 0;
      }

      return true;
    });

    if (!allAnswered) {
      return; // Don't submit if not all questions are answered
    }

    // Merge custom texts with selected answers
    const answersWithCustomText: Record<string, string[]> = {};
    for (const question of questions) {
      const selectedChoiceId = selectedAnswers[question.id]?.[0];
      if (selectedChoiceId === OTHER_CHOICE_ID) {
        // For "Other" option, use the custom text as the answer
        answersWithCustomText[question.id] = [customTexts[question.id] || ''];
      } else {
        answersWithCustomText[question.id] = selectedAnswers[question.id] || [];
      }
    }

    onSubmit(answersWithCustomText);
  };

  const allQuestionsAnswered = questions.every((q) => {
    const hasAnswer = selectedAnswers[q.id] && selectedAnswers[q.id].length > 0;
    if (!hasAnswer) return false;

    // If "Other" is selected, ensure custom text is provided
    if (selectedAnswers[q.id]?.[0] === OTHER_CHOICE_ID) {
      return customTexts[q.id] && customTexts[q.id].trim().length > 0;
    }

    return true;
  });

  return (
    <div className="border border-neutral-600/80 rounded-lg overflow-hidden bg-neutral-800/70">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-neutral-600/80 bg-neutral-700/20">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-medium text-neutral-200">
            Help me understand your requirements
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="px-4 py-3 space-y-4">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className={`space-y-3 ${index !== questions.length - 1 ? 'pb-4 border-b border-neutral-700/50' : ''}`}
          >
            {/* Question text */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200">
                  {question.question}
                </p>
                {question.context && (
                  <p className="text-xs text-neutral-300 mt-0.5">
                    {question.context}
                  </p>
                )}
              </div>
            </div>

            {/* Choices */}
            <div className="ml-8 space-y-1.5">
              {question.choices.map((choice) => {
                const isSelected = selectedAnswers[question.id]?.includes(
                  choice.id
                );

                return (
                  <button
                    type="button"
                    key={choice.id}
                    onClick={() => handleChoiceSelect(question.id, choice.id)}
                    disabled={isSubmitting}
                    className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                      isSelected
                        ? 'border-blue-500/50 bg-blue-500/15 text-neutral-100'
                        : 'border-neutral-600 bg-neutral-900/60 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-900/80'
                    } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-neutral-600'
                        }`}
                      >
                        {isSelected && <Check className="w-2 h-2 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{choice.label}</span>
                        {choice.description && (
                          <p
                            className={`text-xs mt-0.5 ${isSelected ? 'text-blue-200/70' : 'text-neutral-400'}`}
                          >
                            {choice.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* "Other" option with custom text field */}
              <button
                type="button"
                onClick={() => handleChoiceSelect(question.id, OTHER_CHOICE_ID)}
                disabled={isSubmitting}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  selectedAnswers[question.id]?.includes(OTHER_CHOICE_ID)
                    ? 'border-blue-500/50 bg-blue-500/15 text-neutral-100'
                    : 'border-neutral-600 bg-neutral-900/60 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-900/80'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedAnswers[question.id]?.includes(OTHER_CHOICE_ID)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-neutral-600'
                    }`}
                  >
                    {selectedAnswers[question.id]?.includes(
                      OTHER_CHOICE_ID
                    ) && <Check className="w-2 h-2 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">Other</span>
                    <p
                      className={`text-xs mt-0.5 ${selectedAnswers[question.id]?.includes(OTHER_CHOICE_ID) ? 'text-blue-200/70' : 'text-neutral-400'}`}
                    >
                      Specify your own answer
                    </p>
                  </div>
                </div>
              </button>

              {/* Custom text input - shown when "Other" is selected */}
              {selectedAnswers[question.id]?.includes(OTHER_CHOICE_ID) && (
                <input
                  type="text"
                  value={customTexts[question.id] || ''}
                  onChange={(e) =>
                    handleCustomTextChange(question.id, e.target.value)
                  }
                  disabled={isSubmitting}
                  placeholder="Enter your answer..."
                  className="w-full px-3 py-2 text-sm rounded border border-neutral-600 bg-neutral-900/60 text-neutral-200 placeholder-neutral-500 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex justify-end border-t border-neutral-700/50">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allQuestionsAnswered || isSubmitting}
          className={`px-4 py-2 text-sm rounded font-medium transition-colors flex items-center gap-2 ${
            allQuestionsAnswered && !isSubmitting
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Continue
            </>
          )}
        </button>
      </div>
    </div>
  );
}
