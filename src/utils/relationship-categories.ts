import { ontology } from '../adapters/ontology-registry';

export interface RelationshipCategory {
  id: string;
  label: string;
  types: string[];
  color: string;
}

export const RELATIONSHIP_CATEGORIES: RelationshipCategory[] = [
  {
    id: 'hierarchical',
    label: 'Hierarchy',
    types: ['broader', 'narrower', 'broader_generic', 'narrower_generic',
            'broader_partitive', 'narrower_partitive', 'broader_instantial', 'narrower_instantial',
            'has_concept', 'is_concept_of', 'instance_of', 'has_instance',
            'has_part', 'is_part_of', 'inherits', 'inherited_by'],
    color: 'text-blue-600 bg-blue-50',
  },
  {
    id: 'mapping',
    label: 'Equivalence',
    types: ['equivalent', 'close_match', 'broad_match', 'narrow_match', 'related_match'],
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    id: 'associative',
    label: 'Associative',
    types: ['see', 'related_concept', 'related_concept_broader', 'related_concept_narrower', 'references'],
    color: 'text-violet-600 bg-violet-50',
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    types: ['deprecates', 'deprecated_by', 'supersedes', 'superseded_by',
            'replaces', 'replaced_by', 'invalidates', 'invalidated_by',
            'retires', 'retired_by'],
    color: 'text-red-600 bg-red-50',
  },
  {
    id: 'comparative',
    label: 'Comparison',
    types: ['compare', 'contrast'],
    color: 'text-amber-600 bg-amber-50',
  },
  {
    id: 'definitional',
    label: 'Definitional',
    types: ['has_definition', 'definition_of', 'has_version', 'version_of',
            'current_version', 'current_version_of'],
    color: 'text-cyan-600 bg-cyan-50',
  },
  {
    id: 'spatiotemporal',
    label: 'Spatiotemporal',
    types: ['sequentially_related', 'spatially_related', 'temporally_related'],
    color: 'text-teal-600 bg-teal-50',
  },
  {
    id: 'lexical',
    label: 'Lexical',
    types: ['homograph', 'false_friend'],
    color: 'text-pink-600 bg-pink-50',
  },
  {
    id: 'designation',
    label: 'Designation',
    types: ['abbreviated_form_for', 'short_form_for'],
    color: 'text-gray-600 bg-gray-50',
  },
];



export const INVERSE_RELATIONSHIPS: Record<string, string> = {
  // Lifecycle
  supersedes: 'superseded_by',
  superseded_by: 'supersedes',
  deprecates: 'deprecated_by',
  deprecated_by: 'deprecates',
  replaces: 'replaced_by',
  replaced_by: 'replaces',
  invalidates: 'invalidated_by',
  retires: 'retired_by',

  // Hierarchical (generic)
  broader: 'narrower',
  narrower: 'broader',
  broader_generic: 'narrower_generic',
  narrower_generic: 'broader_generic',

  // Hierarchical (partitive)
  broader_partitive: 'narrower_partitive',
  narrower_partitive: 'broader_partitive',
  has_part: 'is_part_of',
  is_part_of: 'has_part',

  // Hierarchical (instantial)
  broader_instantial: 'narrower_instantial',
  narrower_instantial: 'broader_instantial',
  instance_of: 'has_instance',
  has_instance: 'instance_of',

  // ISO 19135 register relations
  has_concept: 'is_concept_of',
  is_concept_of: 'has_concept',
  inherits: 'inherited_by',
  inherited_by: 'inherits',
  has_definition: 'definition_of',
  has_version: 'version_of',
  current_version: 'current_version_of',

  // Symmetric (self-inverse)
  equivalent: 'equivalent',
  compare: 'compare',
  contrast: 'contrast',
  close_match: 'close_match',
  related_match: 'related_match',
};
const CATEGORY_MAP = new Map<string, RelationshipCategory>();
for (const cat of RELATIONSHIP_CATEGORIES) {
  for (const t of cat.types) {
    CATEGORY_MAP.set(t, cat);
  }
}

export function categorizeRelationship(type: string): RelationshipCategory {
  return CATEGORY_MAP.get(type) ?? { id: 'other', label: 'Other', types: [type], color: 'text-gray-600 bg-gray-50' };
}

export function relationshipLabel(type: string): string {
  // Check the ontology taxonomy first (for glossarist-specific types)
  const concept = ontology.getConcept('relationshipType', type);
  if (concept?.prefLabel) return concept.prefLabel;

  // Fallback: humanize the type string
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function relationshipDefinition(type: string): string | null {
  return ontology.getDefinition('relationshipType', type);
}
