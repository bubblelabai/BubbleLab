import type { CapabilityMetadata } from '@bubblelab/shared-schemas';
import type { CapabilityDefinition } from './define-capability.js';

/** Global registry of capability definitions, keyed by capability ID. */
const capabilityRegistry = new Map<string, CapabilityDefinition>();

/** Registers a capability definition in the global registry. */
export function registerCapability(cap: CapabilityDefinition): void {
  if (capabilityRegistry.has(cap.metadata.id)) {
    console.warn(
      `[CapabilityRegistry] Overwriting existing capability: ${cap.metadata.id}`
    );
  }
  capabilityRegistry.set(cap.metadata.id, cap);
}

/** Returns a registered capability by ID, or undefined if not found. */
export function getCapability(id: string): CapabilityDefinition | undefined {
  return capabilityRegistry.get(id);
}

/** Returns all registered capability definitions. */
export function getAllCapabilities(): CapabilityDefinition[] {
  return Array.from(capabilityRegistry.values());
}

/** Returns serializable metadata for all registered capabilities. */
export function getAllCapabilityMetadata(): CapabilityMetadata[] {
  return Array.from(capabilityRegistry.values()).map((cap) => cap.metadata);
}

/** Returns metadata for a single capability by ID, or undefined if not found. */
export function getCapabilityMetadataById(
  id: string
): CapabilityMetadata | undefined {
  return capabilityRegistry.get(id)?.metadata;
}
