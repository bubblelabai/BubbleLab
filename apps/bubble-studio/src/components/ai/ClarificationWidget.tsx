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

export function ClarificationWidget({
  questions,
  onSubmit,
  isSubmitting,
}: ClarificationWidgetProps) {
  // Track selected answers for each question (questionId -> selectedChoiceIds)
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string[]>
  >({});

  const handleChoiceSelect = (questionId: string, choiceId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: [choiceId], // Single select - replace previous selection
    }));
  };

  const handleSubmit = () => {
    // Ensure all questions have been answered
    const allAnswered = questions.every(
      (q) => selectedAnswers[q.id] && selectedAnswers[q.id].length > 0
    );

    if (!allAnswered) {
      return; // Don't submit if not all questions are answered
    }

    onSubmit(selectedAnswers);
  };

  const allQuestionsAnswered = questions.every(
    (q) => selectedAnswers[q.id] && selectedAnswers[q.id].length > 0
  );

  return (
    <div className="border border-blue-500/30 rounded-lg overflow-hidden bg-gray-900/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
        <MessageCircleQuestion className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-blue-300">
          Help me understand your requirements
        </span>
      </div>

      {/* Questions */}
      <div className="p-4 space-y-5">
        {questions.map((question, index) => (
          <div key={question.id} className="space-y-2.5">
            {/* Question text */}
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                {index + 1}
              </span>
              <div>
                <p className="text-sm text-gray-200 font-medium">
                  {question.question}
                </p>
                {question.context && (
                  <p className="text-xs text-gray-500 mt-1">
                    {question.context}
                  </p>
                )}
              </div>
            </div>

            {/* Choices */}
            <div className="ml-7 space-y-2">
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
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                        : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                    } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-600'
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-2.5 h-2.5 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {choice.label}
                        </span>
                        {choice.description && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {choice.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer with submit button */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 bg-gray-800/30 border-t border-gray-700">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allQuestionsAnswered || isSubmitting}
          className={`px-5 py-2 text-sm rounded-lg font-medium transition-all flex items-center gap-2 ${
            allQuestionsAnswered && !isSubmitting
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
}
