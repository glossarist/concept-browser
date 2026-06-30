declare module '*/scripts/lib/dataset-turtle.mjs' {
  export interface DatasetDistribution {
    readonly id: string;
    readonly title: string;
    readonly mediaType: string;
    readonly downloadUrl: string;
    readonly byteSize?: number;
  }

  export interface DatasetSection {
    readonly collectionIri: string;
    readonly title: string;
    readonly memberUris: readonly string[];
  }

  export interface DatasetTurtleInput {
    readonly datasetIri: string;
    readonly registerId: string;
    readonly title: string;
    readonly description?: string;
    readonly modified: string;
    readonly languages: readonly string[];
    readonly distributions: readonly DatasetDistribution[];
    readonly topConceptUris: readonly string[];
    readonly sections: readonly DatasetSection[];
    readonly sourceRepoUrl?: string;
    readonly publisherIri?: string;
    readonly contactIri?: string;
  }

  export function buildDatasetTurtle(input: DatasetTurtleInput): string;
}
