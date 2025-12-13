/**
 * ContextRequestWidget - Renders credential selection UI for Coffee context-gathering flows
 * Allows users to provide credentials before executing a mini-flow for context
 */
import { useState } from 'react';
import { Database, Loader2, X, Plus } from 'lucide-react';
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

  // Check if all required credentials are provided
  const allCredentialsProvided = request.requiredCredentials.every(
    (credType) => {
      const isSystem = SYSTEM_CREDENTIALS.has(credType);
      // System credentials don't need explicit selection
      if (isSystem) return true;
      return (
        credentials[credType] !== undefined && credentials[credType] !== null
      );
    }
  );

  const renderCredentialControl = (credType: CredentialType) => {
    const availableForType = availableCredentials.filter(
      (cred: CredentialResponse) => cred.credentialType === credType
    );
    const isSystemCredential = SYSTEM_CREDENTIALS.has(credType);
    const selectedValue = credentials[credType];

    return (
      <div
        key={credType}
        className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-200">{credType}</p>
            {isSystemCredential && (
              <p className="mt-0.5 text-xs text-gray-500">
                System managed credential
              </p>
            )}
          </div>
          {!isSystemCredential && (
            <span className="text-xs font-medium text-amber-400">Required</span>
          )}
        </div>
        <select
          title={`Select ${credType}`}
          className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none"
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
    <div className="border border-amber-500/30 rounded-lg overflow-hidden bg-gray-900/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
        <Database className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-amber-300">
          Pearl needs access to gather context
        </span>
      </div>

      {/* Description */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-300">{request.description}</p>

        {/* Credential Selection */}
        {request.requiredCredentials.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Required Credentials
            </p>
            {request.requiredCredentials.map((credType) =>
              renderCredentialControl(credType)
            )}
          </div>
        )}
      </div>

      {/* Footer with buttons */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-800/30 border-t border-gray-700">
        <button
          type="button"
          onClick={onReject}
          disabled={isLoading}
          className="px-4 py-2 text-sm rounded-lg font-medium transition-all flex items-center gap-2 border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
          Skip
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!allCredentialsProvided || isLoading}
          className={`px-5 py-2 text-sm rounded-lg font-medium transition-all flex items-center gap-2 ${
            allCredentialsProvided && !isLoading
              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Run Flow
            </>
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
