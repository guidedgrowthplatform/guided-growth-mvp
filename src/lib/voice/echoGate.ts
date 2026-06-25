export interface EchoGateInput {
  echoGateOn: boolean;
  speaking: boolean;
  rms: number;
  minRms: number;
  isFinal: boolean;
  textLen: number;
  minChars: number;
  requireFinalForLowEnergy: boolean;
  sustainCount: number;
  sustainFrames: number;
}

export interface EchoGateResult {
  pass: boolean;
  sustainCount: number;
}

export function evaluateEchoGate(i: EchoGateInput): EchoGateResult {
  if (!i.echoGateOn || !i.speaking) return { pass: true, sustainCount: 0 };

  const loud = i.rms >= i.minRms;

  if (i.isFinal) {
    if (loud) return { pass: true, sustainCount: i.sustainCount };
    if (i.requireFinalForLowEnergy && i.textLen >= i.minChars) {
      return { pass: true, sustainCount: i.sustainCount };
    }
    return { pass: false, sustainCount: i.sustainCount };
  }

  if (!loud) return { pass: false, sustainCount: 0 };
  const next = i.sustainCount + 1;
  return { pass: next >= i.sustainFrames, sustainCount: next };
}
