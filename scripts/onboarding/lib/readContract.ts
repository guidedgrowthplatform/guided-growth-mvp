import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ParseError, parse, visit } from 'jsonc-parser';

type ContractTool = string | { name: string };

type ContractBeat = {
  id: string;
  order: number;
  type: string;
  context?: string | null;
  openerSeq?: number | null;
  allowedTools?: ContractTool[] | null;
  expectedResponse?: unknown;
  script?: Array<{ seq: number; words: string }>;
  elements?: unknown[];
  beatIO?: unknown;
  conversation?: unknown;
  voice?: { engine?: string; mode?: string | null };
  inheritsContextFrom?: string | null;
};

export type OnboardingContract = {
  contractRevision: string;
  globalContext: string;
  beats: ContractBeat[];
};

export type ReadContractResult = {
  contract: OnboardingContract;
  contractSha256: string;
};

export function readContract(contractPath: string): ReadContractResult {
  const bytes = readFileSync(contractPath);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const parseErrors: ParseError[] = [];
  const keysByObject = new Map<number, Set<string>>();
  let objectDepth = 0;

  visit(text, {
    onObjectBegin: () => {
      objectDepth += 1;
      keysByObject.set(objectDepth, new Set());
    },
    onObjectProperty: (name) => {
      const keys = keysByObject.get(objectDepth)!;
      if (keys.has(name)) throw new Error(`Contract contains duplicate key: ${name}`);
      keys.add(name);
    },
    onObjectEnd: () => {
      keysByObject.delete(objectDepth);
      objectDepth -= 1;
    },
  }, { allowTrailingComma: false, disallowComments: true });

  const contract = parse(text, parseErrors, {
    allowTrailingComma: false,
    disallowComments: true,
  }) as OnboardingContract | undefined;
  if (parseErrors.length > 0 || !contract) throw new Error('Contract is not valid strict JSON.');
  validateContract(contract);

  return {
    contract,
    contractSha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function validateContract(contract: OnboardingContract): void {
  if (!contract.contractRevision || typeof contract.contractRevision !== 'string') {
    throw new Error('Contract must include a string contractRevision.');
  }
  if (typeof contract.globalContext !== 'string') {
    throw new Error('Contract must include a string globalContext.');
  }
  if (!Array.isArray(contract.beats)) throw new Error('Contract must include a beats array.');
  for (const beat of contract.beats) {
    if (!beat || typeof beat.id !== 'string' || !beat.id) throw new Error('Every beat requires an ID.');
    if (!Number.isSafeInteger(beat.order)) throw new Error(`Beat ${beat.id} requires an integer order.`);
    if (typeof beat.type !== 'string') throw new Error(`Beat ${beat.id} requires a type.`);
    if (beat.context !== undefined && beat.context !== null && typeof beat.context !== 'string') {
      throw new Error(`Beat ${beat.id} context must be a string or null.`);
    }
    if (!Array.isArray(beat.allowedTools ?? [])) throw new Error(`Beat ${beat.id} allowedTools must be an array.`);
  }
}
