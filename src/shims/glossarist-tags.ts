/**
 * Module augmentation for glossarist Concept.tags.
 * The JS runtime already supports tags (string[]) but the installed
 * type declarations have not been updated yet. This shim bridges the gap.
 */
declare module 'glossarist/models' {
  interface Concept {
    tags: string[];
  }
}
