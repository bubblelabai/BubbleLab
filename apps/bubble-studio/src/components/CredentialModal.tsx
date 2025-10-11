import { useState, useEffect } from 'react';
import { CredentialType, CredentialResponse } from '@bubblelab/shared-schemas';

interface CredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (credentials: Record<string, Record<string, number>>) => void;
  requiredCredentials: Record<string, string[]>;
  availableCredentials: CredentialResponse[];
  flowId: string;
  bubbleFlowHistory: Array<{
    id: string;
    name: string;
    selectedCredentials?: Record<string, Record<string, number>>;
  }>;
  bubbleFlowName: string;
}

import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
// Helper function to check if a credential type is system-managed
function isSystemCredential(credType: CredentialType): boolean {
  return SYSTEM_CREDENTIALS.has(credType);
}

export function CredentialModal({
  isOpen,
  onClose,
  onConfirm,
  requiredCredentials,
  availableCredentials,
  flowId,
  bubbleFlowHistory,
  bubbleFlowName,
}: CredentialModalProps) {
  const [selectedCredentials, setSelectedCredentials] = useState<
    Record<string, Record<string, number>>
  >({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Get current selected credentials from source of truth (bubbleFlowHistory)
      const currentFlow = bubbleFlowHistory.find((flow) => flow.id === flowId);
      const currentlySelected = currentFlow?.selectedCredentials || {};

      console.log(
        '[CredentialModal] Loading current selected credentials from flow history:',
        currentlySelected
      );

      // Start with currently selected credentials, then fill in defaults for missing ones
      const credentials: Record<string, Record<string, number>> = {
        ...currentlySelected,
      };

      Object.entries(requiredCredentials).forEach(([bubbleName, credTypes]) => {
        credTypes.forEach((credType) => {
          const availableForType = availableCredentials.filter(
            (cred) => cred.credentialType === credType
          );
          const isSystemCred = isSystemCredential(credType as CredentialType);

          // Only auto-fill if not already selected and not a system credential
          if (
            availableForType.length > 0 &&
            !isSystemCred &&
            !credentials[bubbleName]?.[credType]
          ) {
            if (!credentials[bubbleName]) {
              credentials[bubbleName] = {};
            }
            // Default to first available credential only if none is currently selected
            credentials[bubbleName][credType] = availableForType[0].id;
          }
        });
      });

      setSelectedCredentials(credentials);
      setErrors([]);
    }
  }, [
    isOpen,
    requiredCredentials,
    availableCredentials,
    flowId,
    bubbleFlowHistory,
  ]);

  if (!isOpen) return null;

  const updateCredentialSelection = (
    bubbleName: string,
    credType: string,
    credId: number | null
  ) => {
    setSelectedCredentials((prev) => {
      const updated = { ...prev };

      // Apply the selection change to all bubbles that require this credType
      Object.entries(requiredCredentials).forEach(([bName, types]) => {
        if (Array.isArray(types) && (types as string[]).includes(credType)) {
          if (!updated[bName]) updated[bName] = {};
          if (credId === null) {
            delete updated[bName][credType];
          } else {
            updated[bName][credType] = credId;
          }
        }
      });

      return updated;
    });
    setErrors([]); // Clear errors when user makes a selection
  };

  const getCredentialsForType = (credType: string) => {
    return availableCredentials.filter(
      (cred) => cred.credentialType === credType
    );
  };

  const handleConfirm = () => {
    const validationErrors: string[] = [];

    // Check if any required non-system credentials are missing
    Object.entries(requiredCredentials).forEach(([bubbleName, credTypes]) => {
      credTypes.forEach((credType) => {
        const availableForType = getCredentialsForType(credType);
        const isSystemCred = isSystemCredential(credType as CredentialType);

        // Only require selection if there are available credentials and it's not a system credential
        if (availableForType.length > 0 && !isSystemCred) {
          if (!selectedCredentials[bubbleName]?.[credType]) {
            validationErrors.push(
              `Please select a ${credType} credential for ${bubbleName}`
            );
          }
        }
      });
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    onConfirm(selectedCredentials);
  };

  const hasRequiredCredentials = Object.keys(requiredCredentials).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">
            🔑 Configure Credentials for {bubbleFlowName}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {hasRequiredCredentials
              ? 'Select the credentials you want to use for this BubbleFlow'
              : 'No credentials required - using system defaults'}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {hasRequiredCredentials ? (
            <div className="space-y-4">
              {Object.entries(requiredCredentials).map(
                ([bubbleName, credTypes]) => (
                  <div key={bubbleName} className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-200 mb-3">
                      {bubbleName}
                    </h3>
                    <div className="space-y-2">
                      {credTypes.map((credType) => {
                        const availableCreds = getCredentialsForType(credType);
                        const isSystemCred = isSystemCredential(
                          credType as CredentialType
                        );

                        return (
                          <div
                            key={credType}
                            className="flex items-center gap-3"
                          >
                            <label className="text-sm text-gray-300 w-40">
                              {credType}:
                            </label>
                            <select
                              title={credType}
                              value={
                                selectedCredentials[bubbleName]?.[credType] ||
                                ''
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                updateCredentialSelection(
                                  bubbleName,
                                  credType,
                                  value ? parseInt(value) : null
                                );
                              }}
                              className="flex-1 bg-gray-600 text-gray-100 px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">
                                {isSystemCred
                                  ? '✓ System Default'
                                  : '-- Select Credential --'}
                              </option>
                              {availableCreds.map((cred) => (
                                <option key={cred.id} value={cred.id}>
                                  {cred.name}
                                </option>
                              ))}
                            </select>
                            {availableCreds.length === 0 && !isSystemCred && (
                              <span className="text-xs text-yellow-400">
                                No credentials available
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-300 text-center">
                This BubbleFlow doesn't require any user credentials.
                <br />
                System credentials will be used automatically.
              </p>
            </div>
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mt-4 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-3">
              <p className="text-sm font-medium text-red-200 mb-1">
                Please fix the following:
              </p>
              <ul className="list-disc list-inside text-xs text-red-300 space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-900 px-6 py-4 border-t border-gray-700 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {availableCredentials.length} credential
            {availableCredentials.length !== 1 ? 's' : ''} available
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {hasRequiredCredentials
                ? 'Continue with Selected Credentials'
                : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
