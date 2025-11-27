import { type CSSProperties, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CogIcon } from '@heroicons/react/24/outline';
import { BookOpen, Code, Sparkles, X, Shield, Info } from 'lucide-react';
import type {
  CredentialResponse,
  ParsedBubbleWithInfo,
  CredentialType,
} from '@bubblelab/shared-schemas';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import BubbleExecutionBadge from './BubbleExecutionBadge';
import { BADGE_COLORS } from './BubbleColors';

interface BubbleDetailsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  bubble: ParsedBubbleWithInfo;
  logo: { name: string; file: string } | null;
  logoErrored: boolean;
  docsUrl: string | null;
  hasError: boolean;
  isExecuting: boolean;
  isCompleted: boolean;
  hasMissingRequirements: boolean;
  executionStats?: { totalTime: number; count: number };
  requiredCredentialTypes: string[];
  selectedBubbleCredentials: Record<string, number | null>;
  availableCredentials: CredentialResponse[];
  onCredentialChange: (credType: string, credId: number | null) => void;
  onRequestCreateCredential: (credType: string) => void;
  onParamEditInCode?: (paramName: string) => void;
  onViewCode?: () => void;
  showEditor: boolean;
  onFixWithPearl?: () => void;
  isPearlPending: boolean;
}

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const DEFAULT_MODAL_Z_INDEX = 1200;

export function BubbleDetailsOverlay({
  isOpen,
  onClose,
  bubble,
  logo,
  logoErrored,
  docsUrl,
  hasError,
  isExecuting,
  isCompleted,
  hasMissingRequirements,
  executionStats,
  requiredCredentialTypes,
  selectedBubbleCredentials,
  availableCredentials,
  onCredentialChange,
  onRequestCreateCredential,
  onParamEditInCode,
  onViewCode,
  showEditor,
  onFixWithPearl,
  isPearlPending,
}: BubbleDetailsOverlayProps) {
  const displayParams = useMemo(
    () =>
      bubble.parameters.filter(
        (param) => param.name !== 'credentials' && !param.name.includes('env')
      ),
    [bubble.parameters]
  );

  const sensitiveEnvParams = useMemo(
    () => bubble.parameters.filter((param) => param.name.includes('env')),
    [bubble.parameters]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const renderCredentialControl = (credType: string) => {
    const availableForType = availableCredentials.filter(
      (cred) => cred.credentialType === credType
    );
    const isSystemCredential = SYSTEM_CREDENTIALS.has(
      credType as CredentialType
    );
    const selectedValue = selectedBubbleCredentials[credType];

    return (
      <div
        key={credType}
        className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-100">{credType}</p>
            {isSystemCredential && (
              <p className="mt-0.5 text-xs text-neutral-400">
                System managed credential
              </p>
            )}
          </div>
          {!isSystemCredential && availableForType.length > 0 && (
            <span className="text-xs font-medium text-red-300">Required</span>
          )}
        </div>
        <select
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-purple-500 focus:outline-none"
          value={
            selectedValue !== undefined && selectedValue !== null
              ? String(selectedValue)
              : ''
          }
          onChange={(event) => {
            const val = event.target.value;
            if (val === '__ADD_NEW__') {
              onRequestCreateCredential(credType);
              return;
            }
            const parsed = val ? parseInt(val, 10) : null;
            onCredentialChange(credType, parsed);
          }}
        >
          <option value="">
            {isSystemCredential ? 'Use system default' : 'Select credential...'}
          </option>
          {availableForType.map((cred) => (
            <option key={cred.id} value={String(cred.id)}>
              {cred.name || `${cred.credentialType} (${cred.id})`}
            </option>
          ))}
          <option disabled>────────────</option>
          <option value="__ADD_NEW__">+ Add New Credential…</option>
        </select>
      </div>
    );
  };

  const averageRuntime =
    executionStats && executionStats.count > 0
      ? Math.round(executionStats.totalTime / executionStats.count)
      : null;

  const renderLogo = () => {
    if (logo && !logoErrored) {
      return (
        <img
          src={logo.file}
          alt={`${logo.name} logo`}
          className="h-16 w-16 rounded-2xl object-contain"
        />
      );
    }
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600">
        <CogIcon className="h-8 w-8 text-white" />
      </div>
    );
  };

  const headerBadge = hasError ? (
    <button
      type="button"
      onClick={onFixWithPearl}
      disabled={isPearlPending}
      className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-orange-600/50"
    >
      <Sparkles className="h-4 w-4" />
      {isPearlPending ? 'Analyzing...' : 'Fix with Pearl'}
    </button>
  ) : (
    <BubbleExecutionBadge
      hasError={false}
      isCompleted={isCompleted}
      isExecuting={isExecuting}
      executionStats={executionStats}
    />
  );

  return createPortal(
    <div
      className="fixed left-0 top-0 bottom-0 z-[var(--bubble-overlay-z,1200)] w-[65%]"
      style={{ '--bubble-overlay-z': DEFAULT_MODAL_Z_INDEX } as CSSProperties}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12">
          <div className="ml-8 max-w-4xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/95 shadow-2xl">
            <header className="relative border-b border-neutral-900 p-8">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-6 top-6 rounded-full border border-neutral-700 p-2 text-neutral-400 transition hover:text-white"
                aria-label="Close bubble details"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex flex-wrap items-start gap-6">
                {renderLogo()}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    {bubble.bubbleName && (
                      <span className="rounded-full border border-purple-500/40 px-3 py-1 text-xs uppercase tracking-wide text-purple-200">
                        {bubble.bubbleName}
                      </span>
                    )}
                    {bubble.className && (
                      <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400">
                        {bubble.className}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    {bubble.variableName}
                  </h2>
                  {bubble.description && (
                    <p className="mt-3 text-base text-neutral-300">
                      {bubble.description}
                    </p>
                  )}
                  {bubble.location && bubble.location.startLine > 0 && (
                    <p className="mt-2 text-sm text-neutral-500">
                      Lines {bubble.location.startLine}:
                      {bubble.location.startCol}
                      {bubble.location.endLine !== bubble.location.startLine &&
                        ` - ${bubble.location.endLine}:${bubble.location.endCol}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {headerBadge}
                {hasMissingRequirements && (
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${BADGE_COLORS.MISSING.background} ${BADGE_COLORS.MISSING.text} border ${BADGE_COLORS.MISSING.border}`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Missing credentials
                  </div>
                )}
                {docsUrl && (
                  <a
                    href={docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                  >
                    <BookOpen className="h-4 w-4" />
                    Docs
                  </a>
                )}
                {onViewCode && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewCode();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                  >
                    <Code className="h-4 w-4" />
                    {showEditor ? 'Focus Code' : 'View Code'}
                  </button>
                )}
              </div>
            </header>

            <section className="grid gap-6 border-b border-neutral-900 bg-neutral-950/90 p-8 lg:grid-cols-[1.5fr_1fr]">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  <Info className="h-4 w-4" />
                  Credentials
                </div>
                {requiredCredentialTypes.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-6 text-sm text-neutral-400">
                    This bubble does not require credentials.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {requiredCredentialTypes.map((credType) =>
                      renderCredentialControl(credType)
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-sm font-semibold text-neutral-200">
                    Execution
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-neutral-400">
                    <p>
                      Status:{' '}
                      <span className="font-medium text-white">
                        {hasError
                          ? 'Error'
                          : isExecuting
                            ? 'Running'
                            : isCompleted
                              ? 'Completed'
                              : 'Idle'}
                      </span>
                    </p>
                    {executionStats && (
                      <>
                        <p>
                          Runs:{' '}
                          <span className="font-medium text-white">
                            {executionStats.count}
                          </span>
                        </p>
                        {averageRuntime !== null && (
                          <p>
                            Avg runtime:{' '}
                            <span className="font-medium text-white">
                              {averageRuntime}ms
                            </span>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-sm font-semibold text-neutral-200">
                    Metadata
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-neutral-400">
                    <p>
                      Node type:{' '}
                      <span className="font-medium text-white">
                        {bubble.nodeType || 'tool'}
                      </span>
                    </p>
                    <p>
                      Variable ID:{' '}
                      <span className="font-medium text-white">
                        {bubble.variableId ?? '—'}
                      </span>
                    </p>
                    {bubble.hasAwait !== undefined && (
                      <p>
                        Awaited:{' '}
                        <span className="font-medium text-white">
                          {bubble.hasAwait ? 'Yes' : 'No'}
                        </span>
                      </p>
                    )}
                    {bubble.hasActionCall !== undefined && (
                      <p>
                        Action call:{' '}
                        <span className="font-medium text-white">
                          {bubble.hasActionCall ? 'Yes' : 'No'}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="border-b border-neutral-900 bg-neutral-950/95 p-8">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                <Info className="h-4 w-4" />
                Parameters
              </div>
              {displayParams.length === 0 && sensitiveEnvParams.length === 0 ? (
                <p className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-6 text-sm text-neutral-400">
                  This bubble does not define parameters.
                </p>
              ) : (
                <div className="mt-6 space-y-5">
                  {displayParams.map((param) => (
                    <div
                      key={param.name}
                      className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">
                            {param.name}
                            {param.type && (
                              <span className="ml-2 text-sm text-neutral-400">
                                ({param.type})
                              </span>
                            )}
                          </p>
                          {param.description && (
                            <p className="mt-1 text-sm text-neutral-400">
                              {param.description}
                            </p>
                          )}
                        </div>
                        {onParamEditInCode && (
                          <button
                            type="button"
                            onClick={() => onParamEditInCode(param.name)}
                            className="text-sm font-medium text-purple-300 transition hover:text-purple-200"
                          >
                            Jump to code
                          </button>
                        )}
                      </div>
                      <pre className="mt-3 max-h-60 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950/90 px-4 py-3 text-sm text-neutral-200">
                        {formatValue(param.value)}
                      </pre>
                    </div>
                  ))}
                  {sensitiveEnvParams.length > 0 && (
                    <div className="rounded-2xl border border-yellow-900 bg-yellow-950/40 p-5 text-yellow-200">
                      <p className="text-base font-semibold">
                        Hidden environment parameters
                      </p>
                      <p className="mt-2 text-sm opacity-80">
                        The following parameters contain environment secrets and
                        are hidden for security:
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {sensitiveEnvParams.map((param) => (
                          <li key={param.name}>{param.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BubbleDetailsOverlay;
