declare module '*/scripts/lib/turtle-escape.mjs' {
  export function ttlLit(s: unknown): string;
  export function ttlPrefixed(qname: string): string;
  export function ttlIri(iri: string): string;
  export function assertValidIri(iri: unknown, context?: string): string;
}