/**
 * The derived step maps for the LIVE published flow, computed once at module
 * load (L1-3). Consumers (useOnboarding, onboardingStepBeats, the orchestrator)
 * read these instead of hand-maintained tables, so a builder reorder +
 * flow:sync updates them with no hand edit. The api-side twin is generated to
 * api/_lib/llm/onboarding/stepMaps.generated.ts by the same flow:sync run.
 */
import { deriveStepMaps } from './transform/deriveStepMaps';
import { loadPublishedFlow } from './useFlow';

export const DERIVED_STEP_MAPS = deriveStepMaps(loadPublishedFlow());
