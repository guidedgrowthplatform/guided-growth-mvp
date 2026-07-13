export interface RenderProvenance {
  sourceCommit: string;
  branch: string;
  buildSha: string;
  artifactHash?: string;
}

export function resolveRenderProvenance(root?: string): RenderProvenance;
export function artifactHash(document: unknown): string;
export function withArtifactHash<T extends { provenance: RenderProvenance }>(document: T): T;
