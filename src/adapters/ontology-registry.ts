/**
 * Ontology Registry — taxonomy-driven labels, definitions, and colors for the browser.
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
  category?: string;
  inverseOf?: string;
}

export interface TaxonomyCategory {
  label: string;
  color: string;
}

export interface Taxonomy {
  scheme: string;
  schemeLabel: string | null;
  schemeDefinition: string | null;
  categories?: Record<string, TaxonomyCategory>;
  concepts: Record<string, TaxonomyConcept>;
  colors?: Record<string, string>;
}

export interface TaxonomyDisplay {
  label: string;
  color: string;
  definition?: string;
}

type TaxonomyKey = keyof typeof taxonomyData;

const DEFAULT_COLOR = 'badge-gray';

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

  getBroader(taxonomy: TaxonomyKey, id: string): string | null {
    return this.getConcept(taxonomy, id)?.broader ?? null;
  }

  getNarrower(taxonomy: TaxonomyKey, id: string): TaxonomyConcept[] {
    return this.getAll(taxonomy).filter(c => c.broader === id);
  }

  getCategory(taxonomy: TaxonomyKey, id: string): string | null {
    return this.getConcept(taxonomy, id)?.category ?? null;
  }

  getInverse(taxonomy: TaxonomyKey, id: string): string | null {
    return this.getConcept(taxonomy, id)?.inverseOf ?? null;
  }

  getCategoryConfig(taxonomy: TaxonomyKey, categoryId: string): TaxonomyCategory | null {
    return this.data[taxonomy]?.categories?.[categoryId] ?? null;
  }

  getCategories(taxonomy: TaxonomyKey): Record<string, TaxonomyCategory> {
    return this.data[taxonomy]?.categories ?? {};
  }

  getColor(taxonomy: TaxonomyKey, id: string): string | null {
    return this.data[taxonomy]?.colors?.[id] ?? null;
  }

  getDisplay(taxonomy: TaxonomyKey, id: string | null | undefined, colorFallback?: string): TaxonomyDisplay {
    if (!id) return { label: '', color: colorFallback ?? DEFAULT_COLOR };
    const concept = this.getConcept(taxonomy, id);
    return {
      label: concept?.prefLabel ?? id,
      color: this.data[taxonomy]?.colors?.[id] ?? colorFallback ?? DEFAULT_COLOR,
      definition: concept?.definition ?? undefined,
    };
  }
}

export const ontology = new OntologyRegistry();
