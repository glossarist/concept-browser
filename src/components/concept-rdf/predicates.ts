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
  reviewDate: 'gloss:reviewDate',
  reviewDecisionDate: 'gloss:reviewDecisionDate',
  reviewDecisionEvent: 'gloss:reviewDecisionEvent',
  reviewStatus: 'gloss:reviewStatus',
  reviewDecision: 'gloss:reviewDecision',
  reviewDecisionNotes: 'gloss:reviewDecisionNotes',
  lineageSourceSimilarity: 'gloss:lineageSourceSimilarity',
  release: 'gloss:release',
  classification: 'gloss:classification',
  hasDefinition: 'gloss:hasDefinition',
  hasNote: 'gloss:hasNote',
  hasExample: 'gloss:hasExample',
  hasAnnotation: 'gloss:hasAnnotation',
  hasNonVerbalRep: 'gloss:hasNonVerbalRep',
  nonVerbalType: 'gloss:nonVerbalType',
  caption: 'gloss:caption',
  altText: 'gloss:altText',
  script: 'gloss:script',
  system: 'gloss:system',
  reviewType: 'gloss:reviewType',
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

  Citation: 'gloss:Citation',
  CitationRef: 'gloss:CitationRef',
  Locality: 'gloss:Locality',
  source: 'gloss:source',
  refn: 'gloss:refn',
  sourceStatus: 'gloss:sourceStatus',
  sourceType: 'gloss:sourceType',
  modificationNote: 'gloss:modificationNote',
  localityType: 'gloss:localityType',
  referenceFrom: 'gloss:referenceFrom',
  referenceTo: 'gloss:referenceTo',
  original: 'gloss:original',
  citationLocality: 'gloss:citationLocality',
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
  modified: 'dcterms:modified',
  identifier: 'dcterms:identifier',
  date: 'dcterms:date',
  type: 'dcterms:type',
  isVersionOf: 'dcterms:isVersionOf',
  bibliographicCitation: 'dcterms:bibliographicCitation',
  format: 'dcterms:format',
} as const;

export const RDF = {
  type: 'rdf:type',
  value: 'rdf:value',
} as const;

export const OWL = {
  Thing: 'owl:Thing',
  sameAs: 'owl:sameAs',
  deprecated: 'owl:deprecated',
} as const;

export const RDFS = {
  seeAlso: 'rdfs:seeAlso',
  label: 'rdfs:label',
} as const;

export const PROV = {
  wasGeneratedBy: 'prov:wasGeneratedBy',
  generatedAtTime: 'prov:generatedAtTime',
  wasDerivedFrom: 'prov:wasDerivedFrom',
  wasAttributedTo: 'prov:wasAttributedTo',
  invalidatedAtTime: 'prov:invalidatedAtTime',
  Activity: 'prov:Activity',
  Entity: 'prov:Entity',
} as const;

export const XSD = {
  dateTime: 'xsd:dateTime',
  boolean: 'xsd:boolean',
  integer: 'xsd:integer',
  string: 'xsd:string',
} as const;
