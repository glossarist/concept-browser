/**
 * Ontology Registry — taxonomy-driven labels and definitions for the browser.
 *
 * All enumeration labels, definitions, and colors come from the SKOS taxonomy
 * data extracted at build time from concept-model/ontologies/taxonomies/*.ttl.
 * The browser never hardcodes taxonomy values — it looks them up here.
 */
import taxonomyData from '../data/taxonomies.json';

export interface TaxonomyConcept {
  id: string;
  iri: string;
  prefLabel: string;
  altLabel?: string;
  definition?: string;
  broader?: string;
}

export interface Taxonomy {
  scheme: string;
  schemeLabel: string | null;
  schemeDefinition: string | null;
  concepts: Record<string, TaxonomyConcept>;
}

type TaxonomyKey = keyof typeof taxonomyData;

export class OntologyRegistry {
  private data: Record<string, Taxonomy>;

  constructor() {
    this.data = taxonomyData as unknown as Record<string, Taxonomy>;
  }

  getConcept(taxonomy: TaxonomyKey, id: string): TaxonomyConcept | null {
    return this.data[taxonomy]?.concepts[id] ?? null;
  }

  getLabel(taxonomy: TaxonomyKey, id: string | null | undefined): string {
    if (!id) return '';
    return this.getConcept(taxonomy, id)?.prefLabel ?? id;
  }

  getAltLabel(taxonomy: TaxonomyKey, id: string): string | null {
    return this.getConcept(taxonomy, id)?.altLabel ?? null;
  }

  getDefinition(taxonomy: TaxonomyKey, id: string): string | null {
    return this.getConcept(taxonomy, id)?.definition ?? null;
  }

  getAll(taxonomy: TaxonomyKey): TaxonomyConcept[] {
    return Object.values(this.data[taxonomy]?.concepts ?? {});
  }

  getScheme(taxonomy: TaxonomyKey): string {
    return this.data[taxonomy]?.scheme ?? '';
  }

  has(taxonomy: TaxonomyKey, id: string): boolean {
    return id in (this.data[taxonomy]?.concepts ?? {});
  }

  /** Get broader concept ID, if any (for hierarchical taxonomies like designation-type). */
  getBroader(taxonomy: TaxonomyKey, id: string): string | null {
    return this.getConcept(taxonomy, id)?.broader ?? null;
  }

  /** Get all child concept IDs of a given concept. */
  getNarrower(taxonomy: TaxonomyKey, id: string): TaxonomyConcept[] {
    return this.getAll(taxonomy).filter(c => c.broader === id);
  }
}

export const ontology = new OntologyRegistry();
