import { useState } from 'react';
import { X, Send, Code, FileText, User } from 'lucide-react';
import { API_BASE_URL } from '../env';

interface SubmitTemplateModalProps {
  isVisible: boolean;
  onClose: () => void;
}

interface FormData {
  title: string;
  description: string;
  code: string;
  authorName: string;
  additionalNotes: string;
}

export const SubmitTemplateModal: React.FC<SubmitTemplateModalProps> = ({
  isVisible,
  onClose,
}) => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    code: '',
    authorName: '',
    additionalNotes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errorMessage) setErrorMessage(null);
  };

  const isFormValid = () => {
    return (
      formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.code.trim() !== ''
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/template-submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          code: formData.code,
          authorName: formData.authorName || undefined,
          additionalNotes: formData.additionalNotes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit template');
      }

      // Show success state
      setSubmitSuccess(true);

      // Reset form after delay
      setTimeout(() => {
        setSubmitSuccess(false);
        setFormData({
          title: '',
          description: '',
          code: '',
          authorName: '',
          additionalNotes: '',
        });
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit template:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to submit template. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#12141a] border border-[#2a2f3a] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2f3a]">
          <div>
            <h2 className="text-xl font-bold text-white">
              Submit Your Template
            </h2>
            <p className="text-sm text-gray-400">
              Share your Bubble Lab automation with the community
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <FileText className="w-4 h-4 text-gray-500" />
              Template Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., GitHub PR Auto-Commenter"
              className="w-full px-4 py-3 bg-[#1a1d24] border border-[#2a2f3a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all duration-200"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <FileText className="w-4 h-4 text-gray-500" />
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe what your template does and how it can help others..."
              rows={3}
              className="w-full px-4 py-3 bg-[#1a1d24] border border-[#2a2f3a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all duration-200 resize-none"
              required
            />
          </div>

          {/* Author Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <User className="w-4 h-4 text-gray-500" />
              Your Name
            </label>
            <input
              type="text"
              name="authorName"
              value={formData.authorName}
              onChange={handleInputChange}
              placeholder="How would you like to be credited?"
              className="w-full px-4 py-3 bg-[#1a1d24] border border-[#2a2f3a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all duration-200"
            />
          </div>

          {/* Code */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Code className="w-4 h-4 text-gray-500" />
              Flow Code <span className="text-red-400">*</span>
            </label>
            <textarea
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder={`Paste your BubbleFlow code here...

import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class MyTemplate extends BubbleFlow<'webhook/http'> {
  async handle(payload) {
    // Your implementation
  }
}`}
              rows={10}
              className="w-full px-4 py-3 bg-[#1a1d24] border border-[#2a2f3a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all duration-200 resize-none font-mono text-sm"
              required
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <FileText className="w-4 h-4 text-gray-500" />
              Additional Notes
            </label>
            <textarea
              name="additionalNotes"
              value={formData.additionalNotes}
              onChange={handleInputChange}
              placeholder="Any additional context, use cases, or setup instructions..."
              rows={2}
              className="w-full px-4 py-3 bg-[#1a1d24] border border-[#2a2f3a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all duration-200 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-[#2a2f3a] bg-[#0f1115]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Your template will be reviewed before publishing
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={!isFormValid() || isSubmitting}
                className={`px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
                  isFormValid() && !isSubmitting
                    ? 'bg-white hover:bg-gray-100 text-black'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {submitSuccess ? (
                  <>
                    <span className="text-green-600">✓</span>
                    Submitted!
                  </>
                ) : isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
