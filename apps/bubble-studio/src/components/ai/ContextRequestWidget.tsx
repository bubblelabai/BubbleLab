/**
 * ContextRequestWidget - Renders credential selection UI for Coffee context-gathering flows
 * Allows users to provide credentials before executing a mini-flow for context
 */
import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import type {
  CoffeeRequestExternalContextEvent,
  CredentialType,
  CredentialResponse,
} from '@bubblelab/shared-schemas';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import { useCredentials, useCreateCredential } from '@/hooks/useCredentials';
import { CreateCredentialModal } from '@/pages/CredentialsPage';

interface ContextRequestWidgetProps {
  request: CoffeeRequestExternalContextEvent;
  credentials: Partial<Record<CredentialType, number>>;
  onCredentialChange: (credType: CredentialType, credId: number | null) => void;
  onSubmit: () => void;
  onReject: () => void;
  isLoading: boolean;
  apiBaseUrl: string;
}

export function ContextRequestWidget({
  request,
  credentials,
  onCredentialChange,
  onSubmit,
  onReject,
  isLoading,
  apiBaseUrl,
}: ContextRequestWidgetProps) {
  const [createModalForType, setCreateModalForType] = useState<string | null>(
    null
  );

  // Fetch available credentials
  const { data: availableCredentials = [] } = useCredentials(apiBaseUrl);
  const createCredentialMutation = useCreateCredential();

  const { required: requiredCreds = [] } = request.credentialRequirements;

  // Check if all required credentials are provided
  const allCredentialsProvided = requiredCreds.every((credType) => {
    const isSystem = SYSTEM_CREDENTIALS.has(credType);
    // System credentials don't need explicit selection
    if (isSystem) return true;
    return (
      credentials[credType] !== undefined && credentials[credType] !== null
    );
  });

  const renderCredentialControl = (credType: CredentialType) => {
    const availableForType = availableCredentials.filter(
      (cred: CredentialResponse) => cred.credentialType === credType
    );
    const isSystemCredential = SYSTEM_CREDENTIALS.has(credType);
    const selectedValue = credentials[credType];

    return (
      <div
        key={credType}
        className="space-y-2 rounded border border-neutral-600 bg-neutral-900/60 p-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-200">{credType}</p>
            {isSystemCredential && (
              <p className="mt-0.5 text-xs text-neutral-500">
                System managed credential
              </p>
            )}
          </div>
          {!isSystemCredential && (
            <span className="text-xs font-medium text-blue-400">Required</span>
          )}
        </div>
        <select
          title={`Select ${credType}`}
          className="w-full rounded border border-neutral-600 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500/50 focus:outline-none"
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
          disabled={isLoading}
        >
          <option value="">
            {isSystemCredential ? 'Use system default' : 'Select credential...'}
          </option>
          {availableForType.map((cred: CredentialResponse) => (
            <option key={cred.id} value={String(cred.id)}>
              {cred.name || `${cred.credentialType} (${cred.id})`}
            </option>
          ))}
          <option disabled>────────────</option>
          <option value="__ADD_NEW__">+ Add New Credential</option>
        </select>
      </div>
    );
  };

  return (
    <div className="border border-neutral-600/80 rounded-lg overflow-hidden bg-neutral-800/70">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-neutral-600/80 bg-neutral-700/20">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-300">
            Pearl needs access to gather context
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3 space-y-4">
        <p className="text-sm text-neutral-300 leading-relaxed">
          {request.description}
        </p>

        {/* Credential Selection */}
        {requiredCreds.length > 0 && (
          <div className="space-y-3">
            {requiredCreds.map((credType) => renderCredentialControl(credType))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex justify-end gap-2 border-t border-neutral-700/50">
        <button
          type="button"
          onClick={onReject}
          disabled={isLoading}
          className="px-3 py-2 text-sm rounded font-medium transition-colors text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!allCredentialsProvided || isLoading}
          className={`px-4 py-2 text-sm rounded font-medium transition-colors flex items-center gap-2 ${
            allCredentialsProvided && !isLoading
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            'Gather Context'
          )}
        </button>
      </div>

      {/* Create Credential Modal */}
      {createModalForType && (
        <CreateCredentialModal
          isOpen={!!createModalForType}
          onClose={() => setCreateModalForType(null)}
          onSubmit={(data) => createCredentialMutation.mutateAsync(data)}
          isLoading={createCredentialMutation.isPending}
          lockedCredentialType={createModalForType as CredentialType}
          lockType
          onSuccess={(created) => {
            if (createModalForType) {
              onCredentialChange(
                createModalForType as CredentialType,
                created.id
              );
            }
            setCreateModalForType(null);
          }}
        />
      )}
    </div>
  );
}
