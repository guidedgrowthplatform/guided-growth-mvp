/** Phase B adapter: Phase A contract -> renderer FlowDocument. */
import type {
  BeatNode,
  FlowComponentType,
  FlowDocument,
  VoiceConfig,
} from '../../src/onboarding-flow/types';
import type { ContractBeat, OnboardingContractV1 } from '../onboarding/lib/readContract';

/** Contract beat types accepted by the current renderer. Unknown types fail loudly. */
export const FLOW_BEAT_TYPES: Readonly<Record<string, FlowComponentType | null>> = {
  splash: 'primary-button',
  'get-started': 'primary-button',
  'splash-intro': 'coach-bubble',
  auth: 'auth',
  'mic-permission': 'mic-permission',
  'profile-input': 'profile-input',
  'path-selection': 'path-selection',
  'category-grid': 'category-grid',
  'goals-list': 'goals-list',
  'habit-picker': 'habit-picker',
  'habit-schedule': 'habit-schedule',
  'advanced-capture': 'advanced-capture',
  'advanced-frequency': 'advanced-frequency',
  'morning-checkin-setup': 'morning-checkin-setup',
  'reflection-card': 'reflection-card',
  'weekly-day-picker': 'weekly-day-picker',
  'into-app': 'into-app',
  'why-intro': 'why-intro',
  'weekly-projection': 'weekly-projection',
  'custom-entry': 'custom-entry',
  'state-check': 'state-check',
  'habit-review': 'habit-review',
  reflection: 'reflection',
  'coach-bubble': 'coach-bubble',
  'home-tour': 'home-tour',
  'weekly-habits-summary': 'weekly-habits-summary',
  // The legacy builder vocabulary remains accepted while the exporter lands.
  'auth-signup': 'auth',
  'profile-beat': 'profile-input',
};

const first = <T>(items: readonly T[]): T | undefined => items[0];

function screenIds(contract: OnboardingContractV1): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of contract.legacyCrosswalk.entries) {
    if (!result.has(entry.beatId)) result.set(entry.beatId, entry.legacyScreenId);
  }
  return result;
}

function opener(beat: ContractBeat): string | null {
  if (beat.openerSeq === null) return null;
  return beat.script.find((line) => line.seq === beat.openerSeq)?.words ?? null;
}

function voice(beat: ContractBeat): VoiceConfig {
  return {
    openerText: opener(beat),
    expectsInput: beat.expectedResponse !== null || beat.allowedTools.length > 0,
    directLlmAllowed: beat.voice.engine !== 'Vapi',
  };
}

function flowComponent(beat: ContractBeat): FlowComponentType {
  const component = FLOW_BEAT_TYPES[beat.type];
  if (!component)
    throw new Error(
      `[flow:sync] contract beat ${beat.id} has unsupported flow type "${beat.type}"`,
    );
  return component;
}

function contractNode(
  beat: ContractBeat,
  nextId: string | null,
  screenId: string,
  backId: string | null,
): BeatNode {
  const componentType = flowComponent(beat);
  const voiceConfig = voice(beat);
  const recorded = beat.script.filter((line) => line.clip !== null && line.clipPath !== null);
  const vapi = beat.voice.engine === 'Vapi';
  const hybrid =
    beat.voice.perLine.some((line) => line.resolution === 'recorded') &&
    beat.voice.perLine.some((line) => line.resolution === 'live');
  return {
    id: beat.id,
    type: 'beat',
    beatNumber: beat.order,
    name: beat.name,
    screenId,
    nextId,
    backId,
    context: { screenId, screenName: beat.name, contextBlock: beat.context },
    componentType,
    componentProps: beat.props,
    voice: voiceConfig,
    meta: {
      voiceOut: {
        engine:
          beat.voice.engine === 'MP3'
            ? 'mp3'
            : beat.voice.engine === 'Cartesia'
              ? 'cartesia'
              : vapi
                ? 'vapi'
                : 'none',
        mode: beat.voice.mode === 'Improvise' ? 'generative' : 'verbatim',
        ...(recorded.length > 0
          ? {
              mp3Assets: recorded.map((line) => ({
                id: line.clip as string,
                label: line.clip as string,
                file: line.clipPath as string,
                transcript: line.words,
                opener: line.seq === beat.openerSeq ? line.words : undefined,
                timing: line.seq === beat.openerSeq ? ('opener' as const) : ('element' as const),
              })),
            }
          : {}),
      },
      voiceIn: {
        engine: vapi ? 'vapi' : voiceConfig.expectsInput ? 'soniox' : 'none',
        enabled: voiceConfig.expectsInput,
        micRequired: voiceConfig.expectsInput,
        armOnBeatLoad: voiceConfig.expectsInput,
      },
      fill: {
        brain: vapi ? 'vapi' : voiceConfig.expectsInput ? 'direct-llm' : 'none',
        llmActive: voiceConfig.expectsInput,
        allowedTools: beat.allowedTools,
      },
      path: vapi ? 'path-1-vapi' : 'path-3-direct-llm',
      orb: {
        voiceOn: beat.voice.engine !== 'Silent',
        micOn: voiceConfig.expectsInput,
        bloomed: beat.voice.engine !== 'Silent',
      },
      toggles: {
        expectsInput: voiceConfig.expectsInput,
        directLlmAllowed: voiceConfig.directLlmAllowed,
        instantOpenerEligible: vapi,
        suppressVapiDuringMp3: hybrid,
        continueVapiAfterMp3: hybrid,
        autoplayRequiresUnlock: recorded.length > 0,
        qaForceEngineAllowed: true,
      },
      engine: {
        nodeId: beat.id,
        backId: backId ?? undefined,
        persistStep: beat.advance.mode === 'manual' ? null : beat.order,
        pathField: false,
        captureFields: beat.beatIO.dataIn.map((entry) => entry.key),
        toolName: first(beat.allowedTools),
        toolAdvancesStep: beat.advance.mode === 'self',
        toolPersistsFields: beat.beatIO.dataOut.map((entry) => entry.key),
      },
    },
    tool: first(beat.allowedTools)
      ? {
          toolName: first(beat.allowedTools) as string,
          persistsFields: beat.beatIO.dataOut.map((entry) => entry.key),
          advancesStep: beat.advance.mode === 'self',
        }
      : null,
    persist: beat.advance.mode === 'manual' ? null : { step: beat.order },
    hideOrb: beat.hideOrb,
  };
}

/**
 * The contract compile stage. It deliberately does not read designer source or
 * any legacy screen/audio membership tables. Variants remain separate nodes.
 */
export function contractToFlowDocument(contract: OnboardingContractV1): FlowDocument {
  const ordered = [...contract.beats].sort((a, b) => a.order - b.order);
  const legacyScreens = screenIds(contract);
  const beatIds = new Set(ordered.map((beat) => beat.id));
  const nodes = ordered.map((beat, index) =>
    contractNode(
      beat,
      ordered[index + 1]?.id ?? null,
      legacyScreens.get(beat.id) ?? beat.id,
      beat.parent === null || beatIds.has(beat.parent)
        ? beat.parent
        : (ordered[index - 1]?.id ?? null),
    ),
  );
  if (nodes.length === 0) throw new Error('[flow:sync] contract contains no flow beats');
  return {
    flowId: 'onboarding-contract-v1',
    name: 'Onboarding contract v1',
    version: contract.schemaVersion,
    publishedAt: '1970-01-01T00:00:00Z',
    entryNodeId: nodes[0].id,
    nodes,
  };
}
