declare module '*/scripts/lib/agents-turtle.mjs' {
  export function buildAgentsTurtle(
    contributors: readonly { name: string; role?: string; organization?: string; url?: string; email?: string }[],
    agentBase?: string,
  ): string;
}

declare module '*/scripts/lib/version-turtle.mjs' {
  export interface VersionInput {
    readonly registerId: string;
    readonly version: string;
    readonly versionIri: string;
    readonly datasetIri: string;
    readonly generatedAt: string;
    readonly previousVersionIri?: string;
    readonly changeSummary?: string;
    readonly associatedAgentIri?: string;
  }
  export interface VersionHistoryInput {
    readonly registerId: string;
    readonly datasetIri: string;
    readonly versions: readonly { version: string; generatedAt: string; changeSummary?: string }[];
    readonly associatedAgentIri?: string;
  }
  export function buildVersionTurtle(input: VersionInput): string;
  export function buildVersionHistoryTurtle(input: VersionHistoryInput): string;
}