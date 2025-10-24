// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

import { APIFY_ACTOR_SCHEMAS } from './apify-scraper.schema.js';
import { z } from 'zod';

export type ActorId = keyof typeof APIFY_ACTOR_SCHEMAS;
export type ActorInput<T extends ActorId> = z.input<
  (typeof APIFY_ACTOR_SCHEMAS)[T]['input']
>;
export type ActorOutput<T extends ActorId> = z.output<
  (typeof APIFY_ACTOR_SCHEMAS)[T]['output']
>;
export type ActorSchema<T extends ActorId> = (typeof APIFY_ACTOR_SCHEMAS)[T];
