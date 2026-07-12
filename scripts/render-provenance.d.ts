export interface RenderProvenance {
  sourceCommit: string;
  branch: string;
  buildSha: string;
}

export interface ArtifactProvenance extends RenderProvenance {
  artifactHash: string;
}

export function resolveRenderProvenance(root?: string): RenderProvenance;
export function artifactHash(document: Record<string, unknown>): string;
export function withArtifactHash<T extends Record<string, unknown>>(document: T): T;
