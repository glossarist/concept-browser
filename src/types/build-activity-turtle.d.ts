declare module '*/scripts/lib/build-activity-turtle.mjs' {
  export interface BuildActivityTurtleInput {
    readonly runId: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly gitSha?: string | null;
    readonly gitBranch?: string | null;
    readonly toolId: string;
    readonly toolVersion: string;
    readonly datasetRegisters: readonly string[];
    readonly conceptCount: number;
    readonly associatedAgentIri?: string | null;
  }

  export function buildActivityTurtle(input: BuildActivityTurtleInput): string;
}
