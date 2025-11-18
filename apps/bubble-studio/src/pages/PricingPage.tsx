import React, { useEffect } from 'react';
import { PricingTable } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';
import { useUser } from '../hooks/useUser';
import { useAuth } from '../hooks/useAuth';

export const PricingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();

  // When component unmounts, invalidate subscription query and refresh Clerk data
  useEffect(() => {
    return () => {
      // Component is unmounting, refresh all user data

      // 1. Reload Clerk user object and session token (if not in mock mode)
      if (user && 'reload' in user && typeof user.reload === 'function') {
        void user.reload();
      }

      // 2. Force a new session token to be minted (skips cache)
      void getToken({ skipCache: true });

      // 3. Invalidate subscription query to refresh data
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    };
  }, [queryClient, user, getToken]);

  const handleBack = () => {
    router.history.back();
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-white mb-2">
          Upgrade Your Plan
        </h1>
        <p className="text-gray-400">
          Choose the plan that best fits your needs
        </p>
        <a
          href="https://www.bubblelab.ai/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mt-2"
        >
          View full pricing details
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Clerk Pricing Table */}
      <div className="mt-6">
        <PricingTable />
      </div>
    </div>
  );
};
