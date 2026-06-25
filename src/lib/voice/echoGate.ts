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
    if (loud) return { pass: true, sustainCount: 0 };
    if (i.requireFinalForLowEnergy && i.textLen >= i.minChars) {
      return { pass: true, sustainCount: 0 };
    }
    return { pass: false, sustainCount: i.sustainCount };
  }

  if (!loud) return { pass: false, sustainCount: 0 };
  const next = i.sustainCount + 1;
  return next >= i.sustainFrames
    ? { pass: true, sustainCount: 0 }
    : { pass: false, sustainCount: next };
}
