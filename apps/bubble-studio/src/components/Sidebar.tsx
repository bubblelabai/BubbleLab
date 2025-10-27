import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Link } from '@tanstack/react-router';
import {
  Plus,
  KeyRound,
  PanelLeft,
  Home,
  User,
  MessageCircle,
  Github,
  Star,
} from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { useGitHubStars } from '../hooks/useGitHubStars';
import { SignedIn } from './AuthComponents';
import { DISABLE_AUTH } from '../env';

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { user } = useUser();
  const { data: githubStars } = useGitHubStars();

  return (
    <div
      className={`fixed inset-y-0 left-0 z-40 bg-[#0f1115] border-r border-[#30363d] transition-all duration-200 ${
        isOpen ? 'w-56' : 'w-14'
      }`}
    >
      <div className="h-full flex flex-col pt-2 items-stretch gap-2">
        {/* Sidebar toggle (favicon) */}
        <button
          type="button"
          onClick={onToggle}
          className="relative group flex items-center h-12 rounded-lg hover:bg-[#21262d] focus:outline-none"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <span className="w-14 flex-none flex justify-center p-2">
            {isOpen ? (
              <img
                src="/favicon.ico"
                alt="Bubble Lab"
                className="w-8 h-8 rounded-lg"
              />
            ) : (
              <div className="relative w-8 h-8">
                <img
                  src="/favicon.ico"
                  alt="Bubble Lab"
                  className="w-8 h-8 rounded-lg transition-opacity group-hover:opacity-0"
                />
                <PanelLeft className="w-6 h-6 text-gray-200 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </span>
          {/* Bubble Lab text when expanded */}
          {isOpen && (
            <span className="text-lg font-semibold text-white">
              Bubble Studio
            </span>
          )}
          {/* Tooltip when collapsed */}
          {!isOpen && (
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
              Open Sidebar
            </span>
          )}
        </button>

        {/* Home button (icon only, shows label on hover) */}
        <div className="mt-2">
          <div className="relative group">
            <Link
              to="/home"
              activeProps={{
                className:
                  'w-full flex items-center rounded-lg bg-[#21262d] text-gray-200 transition-colors',
              }}
              inactiveProps={{
                className:
                  'w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors',
              }}
              aria-label="Home"
            >
              {/* Fixed icon column */}
              <span className="w-14 flex-none flex justify-center p-2">
                <Home className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                Home
              </span>
            </Link>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                Home
              </span>
            )}
          </div>
        </div>

        {/* New Flow button (icon only, shows label on hover) */}
        <div className="mt-2">
          <div className="relative group">
            <Link
              to="/new"
              activeProps={{
                className:
                  'w-full flex items-center rounded-lg bg-[#21262d] text-gray-200 transition-colors',
              }}
              inactiveProps={{
                className:
                  'w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors',
              }}
              aria-label="New Flow"
            >
              {/* Fixed icon column */}
              <span className="w-14 flex-none flex justify-center p-2">
                <Plus className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                New Flow
              </span>
            </Link>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                New Flow
              </span>
            )}
          </div>
        </div>

        {/* Credentials button (icon only, shows label on hover) */}
        <div className="mt-2">
          <div className="relative group">
            <Link
              to="/credentials"
              activeProps={{
                className:
                  'w-full flex items-center rounded-lg bg-[#21262d] text-gray-200 transition-colors',
              }}
              inactiveProps={{
                className:
                  'w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors',
              }}
              aria-label="Credentials"
            >
              {/* Fixed icon column */}
              <span className="w-14 flex-none flex justify-center p-2">
                <KeyRound className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                Credentials
              </span>
            </Link>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                Credentials
              </span>
            )}
          </div>
        </div>

        {/* Discord Community button */}
        <div className="mt-2">
          <div className="relative group">
            <a
              href="https://discord.com/invite/PkJvcU2myV"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Join Discord Community"
            >
              {/* Fixed icon column */}
              <span className="w-14 flex-none flex justify-center p-2">
                <MessageCircle className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                Discord
              </span>
            </a>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                Get instant help & feedback
              </span>
            )}
          </div>
        </div>

        {/* GitHub Star button */}
        <div className="mt-2">
          <div className="relative group">
            <a
              href="https://github.com/bubblelabai/BubbleLab"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Star us on GitHub"
            >
              {/* Fixed icon column */}
              <span className="w-14 flex-none flex justify-center p-2">
                <Github className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                {githubStars !== undefined ? (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Star className="w-3 h-3" fill="currentColor" />
                    {githubStars} Stars
                  </span>
                ) : (
                  'Star us on GitHub'
                )}
              </span>
            </a>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                Star us on GitHub
              </span>
            )}
          </div>
        </div>

        {/* Spacer to push bottom content down */}
        <div className="flex-1" />

        {/* Profile button at sidebar bottom */}
        <div className="mb-3">
          <SignedIn>
            <div className="w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors">
              {/* Fixed icon column with Clerk UserButton or mock avatar */}
              <span className="w-14 flex-none flex justify-center p-2">
                {DISABLE_AUTH ? (
                  // Mock avatar when auth is disabled
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-600/40 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-400" />
                  </div>
                ) : (
                  // Clerk UserButton when auth is enabled
                  user && (
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: 'w-8 h-8',
                        },
                      }}
                    />
                  )
                )}
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                {user?.emailAddresses?.[0]?.emailAddress || 'Profile'}
              </span>
            </div>
          </SignedIn>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
