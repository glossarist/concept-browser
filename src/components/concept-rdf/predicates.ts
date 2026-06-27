export const GLOSS = {
  Concept: 'gloss:Concept',
  LocalizedConcept: 'gloss:LocalizedConcept',
  Designation: 'gloss:Designation',
  Expression: 'gloss:Expression',
  Abbreviation: 'gloss:Abbreviation',
  Symbol: 'gloss:Symbol',
  LetterSymbol: 'gloss:LetterSymbol',
  GraphicalSymbol: 'gloss:GraphicalSymbol',

  identifier: 'gloss:identifier',
  hasStatus: 'gloss:hasStatus',
  hasEntryStatus: 'gloss:hasEntryStatus',
  hasLocalization: 'gloss:hasLocalization',
  isLocalizationOf: 'gloss:isLocalizationOf',
  hasDomain: 'gloss:hasDomain',
  domain: 'gloss:domain',
  hasSource: 'gloss:hasSource',
  hasDate: 'gloss:hasDate',
  hasRelatedConcept: 'gloss:hasRelatedConcept',
  hasDefinition: 'gloss:hasDefinition',
  hasNote: 'gloss:hasNote',
  hasExample: 'gloss:hasExample',
  hasNonVerbalRep: 'gloss:hasNonVerbalRep',
  nonVerbalType: 'gloss:nonVerbalType',
  caption: 'gloss:caption',
  altText: 'gloss:altText',
  hasDesignation: 'gloss:hasDesignation',
  hasPronunciation: 'gloss:hasPronunciation',
  hasGrammarInfo: 'gloss:hasGrammarInfo',
  hasTermType: 'gloss:hasTermType',
  normativeStatus: 'gloss:normativeStatus',
  geographicalArea: 'gloss:geographicalArea',
  fieldOfApplication: 'gloss:fieldOfApplication',
  prefix: 'gloss:prefix',
  usageInfo: 'gloss:usageInfo',
  text: 'gloss:text',
  image: 'gloss:image',
  isInternational: 'gloss:isInternational',
  isAbsent: 'gloss:isAbsent',
  isAcronym: 'gloss:isAcronym',
  isInitialism: 'gloss:isInitialism',
  isTruncation: 'gloss:isTruncation',

  relationshipType: 'gloss:relationshipType',
  relationshipContent: 'gloss:relationshipContent',
  conceptSource: 'gloss:conceptSource',
  conceptId: 'gloss:conceptId',
} as const;

export const SKOS = {
  Concept: 'skos:Concept',
  Collection: 'skos:Collection',
  prefLabel: 'skos:prefLabel',
  altLabel: 'skos:altLabel',
  definition: 'skos:definition',
  scopeNote: 'skos:scopeNote',
  notation: 'skos:notation',
} as const;

export const SKOSXL = {
  Label: 'skosxl:Label',
  prefLabel: 'skosxl:prefLabel',
  altLabel: 'skosxl:altLabel',
  literalForm: 'skosxl:literalForm',
} as const;

export const DCTERMS = {
  language: 'dcterms:language',
  source: 'dcterms:source',
  title: 'dcterms:title',
  description: 'dcterms:description',
  created: 'dcterms:created',
} as const;

export const RDF = {
  value: 'rdf:value',
} as const;

export const OWL = {
  Thing: 'owl:Thing',
} as const;
