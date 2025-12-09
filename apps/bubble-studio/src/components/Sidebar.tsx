import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Link } from '@tanstack/react-router';
import {
  KeyRound,
  PanelLeft,
  PanelLeftClose,
  Home,
  Workflow,
  User,
  MessageCircle,
  Github,
  Star,
  Video,
  BookOpen,
} from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { useGitHubStars } from '../hooks/useGitHubStars';
import { SignedIn } from './AuthComponents';
import { DISABLE_AUTH } from '../env';
import { AnimatedThemeToggle } from './animated-theme-toggle';

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  ref: React.RefObject<HTMLDivElement | null>;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, ref }) => {
  const { user } = useUser();
  const { data: githubStars } = useGitHubStars();

  return (
    <div
      ref={ref}
      className={`fixed inset-y-0 left-0 z-40 bg-sidebar border-r border-sidebar-border transition-all duration-200 ${
        isOpen ? 'w-56' : 'w-16'
      }`}
    >
      <div className="h-full flex flex-col pt-2 px-2 items-stretch gap-2">
        {/* Sidebar toggle (favicon) */}
        <button
          type="button"
          onClick={onToggle}
          className="relative group flex items-center h-12 rounded-lg hover:bg-sidebar-hover focus:outline-none"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <span className="w-12 flex-none flex justify-center p-2">
            {isOpen ? (
              <div className="relative w-8 h-8">
                <img
                  src="/favicon.ico"
                  alt="Bubble Lab"
                  className="w-8 h-8 rounded-lg transition-opacity group-hover:opacity-0"
                />
                <PanelLeftClose className="w-6 h-6 text-sidebar-foreground absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ) : (
              <div className="relative w-8 h-8">
                <img
                  src="/favicon.ico"
                  alt="Bubble Lab"
                  className="w-8 h-8 rounded-lg transition-opacity group-hover:opacity-0"
                />
                <PanelLeft className="w-6 h-6 text-sidebar-foreground absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </span>
          {/* Bubble Lab text when expanded */}
          {isOpen && (
            <span className="text-lg font-semibold text-foreground group-hover:text-muted-foreground transition-colors">
              Bubble Studio
            </span>
          )}
          {/* Tooltip when expanded */}
          {isOpen && (
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50">
              Close Sidebar
            </span>
          )}
          {/* Tooltip when collapsed */}
          {!isOpen && (
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
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
                  'w-full flex items-center rounded-lg bg-sidebar-active text-sidebar-foreground transition-colors',
              }}
              inactiveProps={{
                className:
                  'w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors',
              }}
              aria-label="Home"
            >
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
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
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Home
              </span>
            )}
          </div>
        </div>

        {/* My Flows button (icon only, shows label on hover) */}
        <div className="mt-2">
          <div className="relative group">
            <Link
              to="/flows"
              activeProps={{
                className:
                  'w-full flex items-center rounded-lg bg-sidebar-active text-sidebar-foreground transition-colors',
              }}
              inactiveProps={{
                className:
                  'w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors',
              }}
              aria-label="My Flows"
            >
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
                <Workflow className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                My Flows
              </span>
            </Link>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                My Flows
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
                  'w-full flex items-center rounded-lg bg-sidebar-active text-sidebar-foreground transition-colors',
              }}
              inactiveProps={{
                className:
                  'w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors',
              }}
              aria-label="Credentials"
            >
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
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
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Credentials
              </span>
            )}
          </div>
        </div>

        {/* Spacer to push bottom content down */}
        <div className="flex-1" />

        {/* Divider */}
        <div className="px-3 py-2">
          <div className="border-t border-sidebar-border" />
        </div>

        {/* Theme Toggle */}
        <div className="mt-2">
          <div className="relative group">
            <div className="w-full flex items-center rounded-lg">
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
                <AnimatedThemeToggle className="h-8 w-8" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap text-muted-foreground transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                Theme
              </span>
            </div>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Toggle Theme
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
              className="w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors"
              aria-label="Join Discord Community"
            >
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
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
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Get instant help, report bugs, join community!
              </span>
            )}
          </div>
        </div>

        {/* Documentation button */}
        <div className="mt-2">
          <div className="relative group">
            <a
              href="https://docs.bubblelab.ai/intro"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors"
              aria-label="Read Documentation"
            >
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
                <BookOpen className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                Documentation
              </span>
            </a>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Read Documentation
              </span>
            )}
          </div>
        </div>

        {/* Demos button */}
        <div className="mt-2">
          <div className="relative group">
            <a
              href="https://www.youtube.com/@bubblelab_ai"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors"
              aria-label="Watch Demos"
            >
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
                <Video className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                Demos
              </span>
            </a>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Watch Demos
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
              className="w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors"
              aria-label="Star us on GitHub"
            >
              {/* Fixed icon column */}
              <span className="w-12 flex-none flex justify-center p-2">
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
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-sidebar-tooltip px-2 py-1 text-xs text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Star us on GitHub
              </span>
            )}
          </div>
        </div>

        {/* Profile button at sidebar bottom */}
        <div className="mb-3">
          <SignedIn>
            <div className="w-full flex items-center rounded-lg hover:bg-sidebar-hover text-muted-foreground hover:text-sidebar-foreground transition-colors">
              {/* Fixed icon column with Clerk UserButton or mock avatar */}
              <span className="w-12 flex-none flex justify-center p-2">
                {DISABLE_AUTH ? (
                  // Mock avatar when auth is disabled
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
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
