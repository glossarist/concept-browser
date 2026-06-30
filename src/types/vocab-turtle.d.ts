declare module '*/scripts/lib/vocab-turtle.mjs' {
  export interface VocabTerm {
    readonly iri: string;
    readonly label: string;
  }
  export interface VocabScheme {
    readonly schemeIri: string;
    readonly label: string;
    readonly terms: readonly VocabTerm[];
  }
  export function buildVocabularyTurtle(): string;
  export function listVocabSchemes(): readonly VocabScheme[];
}
