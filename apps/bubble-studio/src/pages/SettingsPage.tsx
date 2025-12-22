import React from 'react';
import { RedeemCouponSection } from '../components/RedeemCouponSection';

export const SettingsPage: React.FC = () => {
  return (
    <div className="h-full bg-[#0a0a0a] overflow-auto">
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white font-sans">Settings</h1>
          <p className="text-gray-400 mt-2 text-sm font-sans">
            Manage your account settings
          </p>
        </div>

        {/* Content */}
        <div className="pb-12">
          {/* Promotions Section */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 font-sans">
              Promotions
            </h2>
            <div className="max-w-xl">
              <RedeemCouponSection />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
