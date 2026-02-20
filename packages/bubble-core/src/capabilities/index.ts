export {
  defineCapability,
  type CapabilityDefinition,
  type CapabilityRuntimeContext,
  type CapabilityToolFunc,
  type CapabilityToolFactory,
  type CapabilitySystemPromptFactory,
  type CapabilityDelegationHintFactory,
  type CapabilityResponseAppendFactory,
  type DefineCapabilityOptions,
} from './define-capability.js';

export {
  registerCapability,
  getCapability,
  getAllCapabilities,
  getAllCapabilityMetadata,
  getCapabilityMetadataById,
} from './registry.js';
