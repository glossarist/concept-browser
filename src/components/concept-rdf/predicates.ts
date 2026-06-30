export const GLOSS = {
  // Classes
  Concept: 'gloss:Concept',
  LocalizedConcept: 'gloss:LocalizedConcept',
  Designation: 'gloss:Designation',
  Expression: 'gloss:Expression',
  Abbreviation: 'gloss:Abbreviation',
  Symbol: 'gloss:Symbol',
  LetterSymbol: 'gloss:LetterSymbol',
  GraphicalSymbol: 'gloss:GraphicalSymbol',

  DetailedDefinition: 'gloss:DetailedDefinition',
  ConceptDate: 'gloss:ConceptDate',
  ConceptSource: 'gloss:ConceptSource',
  ConceptRef: 'gloss:ConceptRef',
  NonVerbalEntity: 'gloss:NonVerbalEntity',
  NonVerbalRep: 'gloss:NonVerbalRep',
  NonVerbalRepresentation: 'gloss:NonVerbalRepresentation',
  Figure: 'gloss:Figure',
  Table: 'gloss:Table',
  Formula: 'gloss:Formula',
  RelatedConcept: 'gloss:RelatedConcept',
  Citation: 'gloss:Citation',
  CitationRef: 'gloss:CitationRef',
  Locality: 'gloss:Locality',
  CustomLocality: 'gloss:CustomLocality',
  Reference: 'gloss:Reference',
  ConceptCollection: 'gloss:ConceptCollection',

  // Concept predicates
  identifier: 'gloss:identifier',
  uri: 'gloss:uri',
  hasStatus: 'gloss:hasStatus',
  hasEntryStatus: 'gloss:hasEntryStatus',
  hasLocalization: 'gloss:hasLocalization',
  isLocalizationOf: 'gloss:isLocalizationOf',
  hasDomain: 'gloss:hasDomain',
  domain: 'gloss:domain',
  hasSource: 'gloss:hasSource',
  hasDate: 'gloss:hasDate',
  hasRelatedConcept: 'gloss:hasRelatedConcept',
  hasDesignation: 'gloss:hasDesignation',
  hasDefinition: 'gloss:hasDefinition',
  hasNote: 'gloss:hasNote',
  hasExample: 'gloss:hasExample',
  hasAnnotation: 'gloss:hasAnnotation',
  hasNonVerbalRep: 'gloss:hasNonVerbalRep',
  hasReference: 'gloss:hasReference',
  hasPronunciation: 'gloss:hasPronunciation',
  hasGrammarInfo: 'gloss:hasGrammarInfo',
  hasTermType: 'gloss:hasTermType',
  tag: 'gloss:tag',
  register: 'gloss:register',

  // Lifecycle / review
  reviewDate: 'gloss:reviewDate',
  reviewDecisionDate: 'gloss:reviewDecisionDate',
  reviewDecisionEvent: 'gloss:reviewDecisionEvent',
  reviewStatus: 'gloss:reviewStatus',
  reviewDecision: 'gloss:reviewDecision',
  reviewDecisionNotes: 'gloss:reviewDecisionNotes',
  reviewType: 'gloss:reviewType',
  lineageSourceSimilarity: 'gloss:lineageSimilarity',
  lineageSimilarity: 'gloss:lineageSimilarity',
  release: 'gloss:release',
  classification: 'gloss:classification',
  script: 'gloss:script',
  system: 'gloss:conversionSystem',
  conversionSystem: 'gloss:conversionSystem',
  language: 'gloss:language',

  // Non-verbal
  nonVerbalType: 'gloss:representationType',
  representationType: 'gloss:representationType',
  representationRef: 'gloss:representationRef',
  hasNonVerbalRepresentation: 'gloss:hasNonVerbalRepresentation',
  expression: 'gloss:expression',
  latexForm: 'gloss:latexForm',
  content: 'gloss:content',
  hasHeader: 'gloss:hasHeader',
  hasRow: 'gloss:hasRow',
  image: 'gloss:image',
  caption: 'gloss:caption',
  altText: 'gloss:altText',

  // Designation
  normativeStatus: 'gloss:normativeStatus',
  geographicalArea: 'gloss:geographicalArea',
  fieldOfApplication: 'gloss:fieldOfApplication',
  prefix: 'gloss:prefix',
  usageInfo: 'gloss:usageInfo',
  text: 'gloss:text',
  isInternational: 'gloss:isInternational',
  isAbsent: 'gloss:isAbsent',
  isAcronym: 'gloss:isAcronym',
  isInitialism: 'gloss:isInitialism',
  isTruncation: 'gloss:isTruncation',

  // Related concept / ConceptRef
  relationshipType: 'gloss:relationshipType',
  relationshipContent: 'gloss:relationshipContent',
  relationshipRef: 'gloss:relationshipRef',
  conceptRefSource: 'gloss:conceptRefSource',
  conceptRefId: 'gloss:conceptRefId',

  // ConceptDate
  dateType: 'gloss:dateType',
  dateValue: 'gloss:dateValue',
  eventDescription: 'gloss:eventDescription',

  // ConceptSource
  sourceStatus: 'gloss:sourceStatus',
  sourceType: 'gloss:sourceType',
  sourceOrigin: 'gloss:sourceOrigin',
  modification: 'gloss:modification',

  // Citation
  hasCitationRef: 'gloss:hasCitationRef',
  hasCitationLocality: 'gloss:hasCitationLocality',
  citationLink: 'gloss:citationLink',
  citationOriginal: 'gloss:citationOriginal',
  hasCustomLocality: 'gloss:hasCustomLocality',
  bibliographicCitation: 'gloss:bibliographicCitation',

  // CitationRef
  citationRefSource: 'gloss:citationRefSource',
  citationRefId: 'gloss:citationRefId',
  citationRefVersion: 'gloss:citationRefVersion',

  // Reference
  refSource: 'gloss:source',
  refId: 'gloss:refId',
  refVersion: 'gloss:refVersion',
  refLink: 'gloss:refLink',
  refType: 'gloss:refType',
  urn: 'gloss:urn',
  term: 'gloss:term',
  hasLocality: 'gloss:hasLocality',

  // Locality
  localityType: 'gloss:localityType',
  referenceFrom: 'gloss:referenceFrom',
  referenceTo: 'gloss:referenceTo',
  customLocalityName: 'gloss:customLocalityName',
  customLocalityValue: 'gloss:customLocalityValue',
} as const;

export const SKOS = {
  Concept: 'skos:Concept',
  Collection: 'skos:Collection',
  ConceptScheme: 'skos:ConceptScheme',
  prefLabel: 'skos:prefLabel',
  altLabel: 'skos:altLabel',
  definition: 'skos:definition',
  scopeNote: 'skos:scopeNote',
  notation: 'skos:notation',
  member: 'skos:member',
  hasTopConcept: 'skos:hasTopConcept',
  inScheme: 'skos:inScheme',
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
  isPartOf: 'dcterms:isPartOf',
  replaces: 'dcterms:replaces',
  isReplacedBy: 'dcterms:isReplacedBy',
  bibliographicCitation: 'dcterms:bibliographicCitation',
  format: 'dcterms:format',
  publisher: 'dcterms:publisher',
  contactPoint: 'dcterms:contactPoint',
  BibliographicResource: 'dcterms:BibliographicResource',
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
  comment: 'rdfs:comment',
} as const;

export const PROV = {
  wasGeneratedBy: 'prov:wasGeneratedBy',
  generatedAtTime: 'prov:generatedAtTime',
  wasDerivedFrom: 'prov:wasDerivedFrom',
  wasAttributedTo: 'prov:wasAttributedTo',
  invalidatedAtTime: 'prov:invalidatedAtTime',
  wasInvalidatedBy: 'prov:wasInvalidatedBy',
  wasAssociatedWith: 'prov:wasAssociatedWith',
  wasRevisionOf: 'prov:wasRevisionOf',
  used: 'prov:used',
  actedOnBehalfOf: 'prov:actedOnBehalfOf',
  Activity: 'prov:Activity',
  Entity: 'prov:Entity',
  Agent: 'prov:Agent',
  Organization: 'prov:Organization',
  Person: 'prov:Person',
} as const;

export const DCAT = {
  Dataset: 'dcat:Dataset',
  Distribution: 'dcat:Distribution',
  distribution: 'dcat:distribution',
  downloadURL: 'dcat:downloadURL',
  mediaType: 'dcat:mediaType',
  byteSize: 'dcat:byteSize',
  contactPoint: 'dcat:contactPoint',
} as const;

export const FOAF = {
  Person: 'foaf:Person',
  Organization: 'foaf:Organization',
  name: 'foaf:name',
  mbox: 'foaf:mbox',
  page: 'foaf:page',
  Image: 'foaf:Image',
} as const;

export const XSD = {
  dateTime: 'xsd:dateTime',
  date: 'xsd:date',
  boolean: 'xsd:boolean',
  integer: 'xsd:integer',
  string: 'xsd:string',
  anyURI: 'xsd:anyURI',
} as const;
