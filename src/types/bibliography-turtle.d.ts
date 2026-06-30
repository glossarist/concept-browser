declare module '*/scripts/lib/bibliography-turtle.mjs' {
  export interface BibliographyEntryJson {
    readonly reference?: string;
    readonly title?: string;
    readonly link?: string;
  }
  export function buildBibliographyTurtle(
    register: string,
    bibliographyJson: Record<string, BibliographyEntryJson>,
    baseUri?: string,
  ): string;
}