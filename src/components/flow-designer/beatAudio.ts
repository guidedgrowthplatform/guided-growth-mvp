// Resolves each beat's pre-rendered clips by its Voice Scripts stage.
// The clip map is generated from the Master Sheet "Voice Scripts" tab (mp3_en + text_en)
// by scripts/voice-sync/gen_voice_scripts_audio.py -> voiceScriptsAudio.ts.
import { VOICE_SCRIPTS_AUDIO, type VoiceClip } from './voiceScriptsAudio';

export type { VoiceClip };

/** The rotation of pre-rendered clips for a beat's Voice Scripts stage (empty if none). */
export function clipsForStage(stage?: string): readonly VoiceClip[] {
  if (!stage) return [];
  return VOICE_SCRIPTS_AUDIO[stage] ?? [];
}

/** Which stages currently have audio (for builder UI / diagnostics). */
export function stagesWithAudio(): string[] {
  return Object.keys(VOICE_SCRIPTS_AUDIO);
}
