import { type CSSProperties, useState } from 'react';
import { createPortal } from 'react-dom';
import { CogIcon } from '@heroicons/react/24/outline';
import { BookOpen, Code, X, Info, Cpu } from 'lucide-react';
import type {
  CredentialResponse,
  ParsedBubbleWithInfo,
  CredentialType,
} from '@bubblelab/shared-schemas';
import {
  SYSTEM_CREDENTIALS,
  OPTIONAL_CREDENTIALS,
  AvailableModels,
} from '@bubblelab/shared-schemas';
import { CreateCredentialModal } from '@/pages/CredentialsPage';
import { useCreateCredential } from '@/hooks/useCredentials';
import { useOverlay } from '@/hooks/useOverlay';
import { useEditor } from '@/hooks/useEditor';
import { extractParamValue } from '@/utils/bubbleParamEditor';
import { SchemaParamsSection } from '@/components/flow_visualizer/param-editors/SchemaParamsSection';
import {
  getModelParamConfig,
  getExcludedParamNames,
} from '@/config/bubbleInlineParams';

interface BubbleDetailsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  flowId: number;
  bubble: ParsedBubbleWithInfo;
  logo: { name: string; file: string } | null;
  logoErrored: boolean;
  docsUrl: string | null;
  requiredCredentialTypes: string[];
  selectedBubbleCredentials: Record<string, number | null>;
  availableCredentials: CredentialResponse[];
  onCredentialChange: (credType: string, credId: number | null) => void;
  onParamEditInCode?: (paramName: string) => void;
  onViewCode?: () => void;
  showEditor: boolean;
}

const DEFAULT_MODAL_Z_INDEX = 1200;

export function BubbleDetailsOverlay({
  isOpen,
  onClose,
  flowId,
  bubble,
  logo,
  logoErrored,
  docsUrl,
  requiredCredentialTypes,
  selectedBubbleCredentials,
  availableCredentials,
  onCredentialChange,
  onParamEditInCode,
  onViewCode,
  showEditor,
}: BubbleDetailsOverlayProps) {
  // Internal state for credential creation modal
  const [createModalForType, setCreateModalForType] = useState<string | null>(
    null
  );
  const createCredentialMutation = useCreateCredential();
  const { updateBubbleParam } = useEditor(flowId);

  // Get model config for this bubble type (if any)
  const modelConfig = getModelParamConfig(bubble.bubbleName);
  const hasModelSection = modelConfig !== undefined;

  // Get model value if this bubble has a model param
  const modelParam =
    hasModelSection && modelConfig
      ? bubble.parameters.find((p) => p.name === modelConfig.paramName)
      : undefined;
  const modelExtracted =
    modelParam && modelConfig
      ? extractParamValue(modelParam, modelConfig.paramPath, bubble.bubbleName)
      : undefined;
  const currentModel = modelExtracted?.value as string | undefined;
  const isModelEditable = modelExtracted?.shouldBeEditable ?? false;

  // Get param names to exclude from Parameters section (model params shown in Model section)
  const excludedParamNames = getExcludedParamNames(bubble.bubbleName);

  // Handle overlay behavior (escape key, body scroll prevention)
  useOverlay({ isOpen, onClose });

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
    const isOptionalCredential = OPTIONAL_CREDENTIALS.has(
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
          {!isSystemCredential &&
            !isOptionalCredential &&
            availableForType.length > 0 && (
              <span className="text-xs font-medium text-red-300">Required</span>
            )}
        </div>
        <select
          title={`${bubble.bubbleName} ${credType}`}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-purple-500 focus:outline-none"
          value={
            selectedValue !== undefined && selectedValue !== null
              ? String(selectedValue)
              : ''
          }
          onChange={(event) => {
            const val = event.target.value;
            if (val === '__ADD_NEW__') {
              setCreateModalForType(credType);
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

  return createPortal(
    <div
      className="fixed left-0 top-0 bottom-0 z-[var(--bubble-overlay-z,1200)] w-full sm:w-[85%] md:w-[70%] lg:w-[55%] xl:w-[50%]"
      style={{ '--bubble-overlay-z': DEFAULT_MODAL_Z_INDEX } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-12 lg:px-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/95 shadow-2xl sm:ml-8">
            <header className="relative border-b border-neutral-900 p-6 sm:p-8">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
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
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                    {bubble.variableName}
                  </h2>
                  {bubble.description && (
                    <p className="mt-3 text-sm text-neutral-300 sm:text-base">
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

            {/* Model Section - Only for bubbles with model config */}
            {hasModelSection && modelConfig && (
              <section className="border-b border-neutral-900 bg-neutral-950/90 p-6 sm:p-8">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                    <Cpu className="h-4 w-4" />
                    Model
                  </div>
                  <div className="mt-4 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-100">
                          {modelConfig.label || 'AI Model'}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {isModelEditable
                            ? 'Select the model for this bubble'
                            : 'Model is set dynamically in code'}
                        </p>
                      </div>
                      {!isModelEditable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300 border border-blue-500/30">
                          Dynamic
                        </span>
                      )}
                    </div>
                    {isModelEditable ? (
                      <select
                        title="Select AI Model"
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-purple-500 focus:outline-none"
                        value={currentModel}
                        onChange={(e) =>
                          updateBubbleParam(
                            bubble.variableId,
                            modelConfig.paramPath,
                            e.target.value
                          )
                        }
                      >
                        {AvailableModels.options.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <pre className="w-full rounded-lg border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-sm text-neutral-400 font-mono">
                        {currentModel || 'Variable'}
                      </pre>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Parameters Section */}
            <section className="border-b border-neutral-900 bg-neutral-950/95 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-6">
                <Info className="h-4 w-4" />
                Parameters
              </div>
              <SchemaParamsSection
                bubble={bubble}
                updateBubbleParam={updateBubbleParam}
                onParamEditInCode={onParamEditInCode}
                excludedParamNames={excludedParamNames}
              />
            </section>

            {/* Credentials Section */}
            <section className="border-b border-neutral-900 bg-neutral-950/90 p-6 sm:p-8">
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
            </section>
          </div>
        </div>
      </div>

      {/* Create Credential Modal - rendered with higher z-index */}
      {createModalForType && (
        <div className="fixed inset-0 z-[1300]">
          <CreateCredentialModal
            isOpen={!!createModalForType}
            onClose={() => setCreateModalForType(null)}
            onSubmit={(data) => createCredentialMutation.mutateAsync(data)}
            isLoading={createCredentialMutation.isPending}
            lockedCredentialType={createModalForType as CredentialType}
            lockType
            onSuccess={(created) => {
              if (createModalForType) {
                onCredentialChange(createModalForType, created.id);
              }
              setCreateModalForType(null);
            }}
          />
        </div>
      )}
    </div>,
    document.body
  );
}

export default BubbleDetailsOverlay;
