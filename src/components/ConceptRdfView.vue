<script setup lang="ts">
import type { Concept, LocalizedConcept, Designation, Expression as ExpressionType, Abbreviation as AbbreviationType, GraphicalSymbol as GraphicalSymbolType } from 'glossarist';
import { computed, ref } from 'vue';
import { getClass } from '../adapters/ontology-schema';

const props = defineProps<{
  concept: Concept;
  registerId: string;
  conceptUriValue: string;
}>();

const rdfFormat = ref<'turtle' | 'jsonld'>('turtle');
const showSource = ref(false);
const uriCopied = ref(false);

function copyUri() {
  navigator.clipboard.writeText(props.conceptUriValue);
  uriCopied.value = true;
  setTimeout(() => { uriCopied.value = false; }, 2000);
}

function designationClassLabel(type: string): string {
  const map: Record<string, string> = {
    expression: 'gloss:Expression',
    abbreviation: 'gloss:Abbreviation',
    symbol: 'gloss:Symbol',
    letter_symbol: 'gloss:LetterSymbol',
    graphical_symbol: 'gloss:GraphicalSymbol',
  };
  return map[type] ?? 'gloss:Designation';
}

function desigSlug(designation: string, index: number): string {
  const slug = designation.replace(/[^a-zA-Z0-9]/g, '_');
  if (/^_+$/.test(slug)) return `d${index}`;
  return slug;
}

function formatCitation(c: any): string {
  if (!c) return '';
  if (c.source && c.id) return `${c.source} ${c.id}`;
  if (c.ref?.source) {
    const r = c.ref;
    return r.id ? `${r.source} ${r.id}` : r.source;
  }
  return '';
}

// ── Instance data extraction ─────────────────────────────────────────────

interface PropValue {
  predicate: string;
  values: string[];
  nested?: boolean;
}

interface ClassInstance {
  classId: string;
  classLabel: string;
  label: string;
  props: PropValue[];
}

function conceptInstance(): ClassInstance {
  const c = props.concept;
  const pv: PropValue[] = [];
  const add = (pred: string, ...vals: string[]) => {
    const filtered = vals.filter(Boolean);
    if (filtered.length) pv.push({ predicate: pred, values: filtered });
  };
  const addNested = (pred: string, ...vals: string[]) => {
    const filtered = vals.filter(Boolean);
    if (filtered.length) pv.push({ predicate: pred, values: filtered, nested: true });
  };

  add('gloss:identifier', c.id);
  if (c.status) add('gloss:hasStatus', `gloss:status/${c.status}`);
  for (const d of c.domains) addNested('gloss:hasDomain', d.conceptId || d.urn || '');
  for (const s of c.sources) addNested('gloss:hasSource', formatCitation(s.origin));
  for (const d of c.dates) addNested('gloss:hasDate', `${d.type}: ${d.date}`);
  for (const r of c.relatedConcepts) {
    const refLabel = r.content || (r.ref ? `${r.ref.source || ''} ${r.ref.id || ''}`.trim() : '');
    addNested('gloss:hasRelatedConcept', `${r.type}: ${refLabel}`);
  }
  for (const lang of c.languages) addNested('gloss:hasLocalization', `${lang}: ${c.localization(lang)?.primaryDesignation ?? ''}`);

  return { classId: 'gloss:Concept', classLabel: 'Concept', label: c.id, props: pv };
}

function localizedInstance(lc: LocalizedConcept): ClassInstance {
  const pv: PropValue[] = [];
  const add = (pred: string, ...vals: string[]) => {
    const filtered = vals.filter(Boolean);
    if (filtered.length) pv.push({ predicate: pred, values: filtered });
  };
  const addNested = (pred: string, ...vals: string[]) => {
    const filtered = vals.filter(Boolean);
    if (filtered.length) pv.push({ predicate: pred, values: filtered, nested: true });
  };

  add('dcterms:language', lc.languageCode ?? '');
  if (lc.entryStatus) add('gloss:hasEntryStatus', `gloss:entstatus/${lc.entryStatus}`);
  addNested('gloss:isLocalizationOf', props.conceptUriValue);
  for (const d of lc.terms) addNested(d.normativeStatus === 'preferred' ? 'skosxl:prefLabel' : 'skosxl:altLabel', d.designation);
  for (const d of lc.definitions) if (d.content) addNested('gloss:hasDefinition', d.content);
  for (const n of lc.notes) if (n.content) addNested('gloss:hasNote', n.content);
  for (const e of lc.examples) if (e.content) addNested('gloss:hasExample', e.content);
  for (const s of lc.sources) addNested('gloss:hasSource', formatCitation(s.origin));
  if (lc.domain) add('gloss:domain', lc.domain);

  return {
    classId: 'gloss:LocalizedConcept',
    classLabel: 'LocalizedConcept',
    label: `${lc.languageCode}: ${lc.primaryDesignation ?? ''}`,
    props: pv,
  };
}

function designationInstance(d: Designation): ClassInstance {
  const pv: PropValue[] = [];
  const add = (pred: string, ...vals: string[]) => {
    const filtered = vals.filter(Boolean);
    if (filtered.length) pv.push({ predicate: pred, values: filtered });
  };

  add('xl:literalForm', `${d.designation}${d.language ? '@' + d.language : ''}`);
  if (d.normativeStatus) add('gloss:normativeStatus', `gloss:norm/${d.normativeStatus}`);
  if (d.geographicalArea) add('gloss:geographicalArea', d.geographicalArea);
  if (d.international) add('gloss:isInternational', 'true');
  if (d.absent) add('gloss:isAbsent', 'true');
  if (d.termType) add('gloss:hasTermType', d.termType);
  for (const p of d.pronunciations ?? []) add('gloss:hasPronunciation', p.content || '');

  if (d.type === 'expression' || d.type === 'abbreviation') {
    const expr = d as ExpressionType;
    if (expr.prefix) add('gloss:prefix', expr.prefix);
    if (expr.usageInfo) add('gloss:usageInfo', expr.usageInfo);
    if (expr.fieldOfApplication) add('gloss:fieldOfApplication', expr.fieldOfApplication);
    for (const gi of expr.grammarInfo ?? []) {
      const parts: string[] = [];
      if (gi.gender) parts.push(`gender:${gi.gender}`);
      if (gi.number) parts.push(`number:${gi.number}`);
      if (gi.partOfSpeech) parts.push(`pos:${gi.partOfSpeech}`);
      if (parts.length) add('gloss:hasGrammarInfo', parts.join(', '));
    }
  }

  if (d.type === 'abbreviation') {
    const abbr = d as AbbreviationType;
    if (abbr.acronym) add('gloss:isAcronym', 'true');
    if (abbr.initialism) add('gloss:isInitialism', 'true');
    if (abbr.truncation) add('gloss:isTruncation', 'true');
  }

  if (d.type === 'graphical_symbol') {
    const gs = d as GraphicalSymbolType;
    if (gs.text) add('gloss:text', gs.text);
    if (gs.image) add('gloss:image', gs.image);
  }

  return {
    classId: designationClassLabel(d.type),
    classLabel: designationClassLabel(d.type).replace('gloss:', ''),
    label: d.designation,
    props: pv,
  };
}

// ── Build all sections ──────────────────────────────────────────────

const sections = computed<ClassInstance[]>(() => {
  const result: ClassInstance[] = [];
  result.push(conceptInstance());

  for (const lang of props.concept.languages) {
    const lc = props.concept.localization(lang);
    if (!lc) continue;
    result.push(localizedInstance(lc));
    for (const d of lc.terms) {
      result.push(designationInstance(d));
    }
  }

  return result;
});

// ── Type chain for hierarchy ─────────────────────────────────────────

const typeChain = computed(() => {
  const conceptCls = getClass('gloss:Concept');
  if (!conceptCls) return ['owl:Thing', 'skos:Concept', 'gloss:Concept'];
  return ['owl:Thing', ...conceptCls.ancestors, 'gloss:Concept'];
});

// ── Turtle source ────────────────────────────────────────────────────

const turtleSource = computed(() => {
  const lines: string[] = [];
  const ind = '  ';
  const c = props.concept;
  const uri = props.conceptUriValue;

  lines.push('@prefix gloss: <https://www.glossarist.org/ontologies/> .');
  lines.push('@prefix skos: <http://www.w3.org/2004/02/skos/core#> .');
  lines.push('@prefix xl: <http://www.w3.org/2008/05/skos-xl#> .');
  lines.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  lines.push('@prefix dcterms: <http://purl.org/dc/terms/> .');
  lines.push('');

  lines.push(`<${uri}> a gloss:Concept, skos:Concept ;`);
  lines.push(`${ind}gloss:identifier "${c.id}" ;`);
  if (c.status) lines.push(`${ind}gloss:hasStatus gloss:status/${c.status} ;`);
  for (const lang of c.languages) lines.push(`${ind}gloss:hasLocalization <${uri}/${lang}> ;`);
  for (const r of c.relatedConcepts) {
    lines.push(`${ind}gloss:hasRelatedConcept [`);
    lines.push(`${ind}${ind}gloss:relationshipType gloss:rel/${r.type} ;`);
    if (r.content) lines.push(`${ind}${ind}gloss:relationshipContent "${r.content}" ;`);
    if (r.ref) {
      if (r.ref.source) lines.push(`${ind}${ind}gloss:conceptSource "${r.ref.source}" ;`);
      if (r.ref.id) lines.push(`${ind}${ind}gloss:conceptId "${r.ref.id}" ;`);
    }
    lines.push(`${ind}] ;`);
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');

  for (const lang of c.languages) {
    const lc = c.localization(lang);
    if (!lc) continue;
    lines.push('');
    lines.push(`<${uri}/${lang}> a gloss:LocalizedConcept, skos:Concept ;`);
    lines.push(`${ind}dcterms:language "${lang}" ;`);
    lines.push(`${ind}gloss:isLocalizationOf <${uri}> ;`);
    if (lc.entryStatus) lines.push(`${ind}gloss:hasEntryStatus gloss:entstatus/${lc.entryStatus} ;`);
    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const normPrefix = d.normativeStatus === 'preferred' ? 'skosxl:prefLabel' : 'skosxl:altLabel';
      lines.push(`${ind}${normPrefix} <${uri}/${lang}/desig/${desigSlug(d.designation, di)}> ;`);
    }
    for (const def of lc.definitions) {
      if (def.content) lines.push(`${ind}gloss:hasDefinition [ rdf:value "${def.content}" ] ;`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');

    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const desigUri = `${uri}/${lang}/desig/${desigSlug(d.designation, di)}`;
      const dc = designationClassLabel(d.type);
      lines.push('');
      lines.push(`<${desigUri}> a ${dc}, xl:Label ;`);
      lines.push(`${ind}xl:literalForm "${d.designation}"@${lang} ;`);
      if (d.normativeStatus) lines.push(`${ind}gloss:normativeStatus gloss:norm/${d.normativeStatus} ;`);
      lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    }
  }

  return lines.join('\n');
});

// ── JSON-LD source ──────────────────────────────────────────────────

const jsonldSource = computed(() => {
  const c = props.concept;
  const uri = props.conceptUriValue;

  const doc: any = {
    '@context': {
      gloss: 'https://www.glossarist.org/ontologies/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      xl: 'http://www.w3.org/2008/05/skos-xl#',
      dcterms: 'http://purl.org/dc/terms/',
    },
    '@graph': [],
  };

  const conceptNode: any = {
    '@id': uri,
    '@type': ['gloss:Concept', 'skos:Concept'],
    'gloss:identifier': c.id,
  };
  if (c.status) conceptNode['gloss:hasStatus'] = { '@id': `gloss:status/${c.status}` };
  conceptNode['gloss:hasLocalization'] = c.languages.map(l => ({ '@id': `${uri}/${l}` }));
  doc['@graph'].push(conceptNode);

  for (const lang of c.languages) {
    const lc = c.localization(lang);
    if (!lc) continue;
    const lcNode: any = {
      '@id': `${uri}/${lang}`,
      '@type': ['gloss:LocalizedConcept', 'skos:Concept'],
      'dcterms:language': lang,
      'gloss:isLocalizationOf': { '@id': uri },
    };
    if (lc.entryStatus) lcNode['gloss:hasEntryStatus'] = { '@id': `gloss:entstatus/${lc.entryStatus}` };
    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const key = d.normativeStatus === 'preferred' ? 'skosxl:prefLabel' : 'skosxl:altLabel';
      lcNode[key] = lcNode[key] || [];
      lcNode[key].push({ '@id': `${uri}/${lang}/desig/${desigSlug(d.designation, di)}` });
    }
    doc['@graph'].push(lcNode);

    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const desigUri = `${uri}/${lang}/desig/${desigSlug(d.designation, di)}`;
      const desigNode: any = {
        '@id': desigUri,
        '@type': [designationClassLabel(d.type), 'xl:Label'],
        'xl:literalForm': { '@value': d.designation, '@language': lang },
      };
      if (d.normativeStatus) desigNode['gloss:normativeStatus'] = { '@id': `gloss:norm/${d.normativeStatus}` };
      doc['@graph'].push(desigNode);
    }
  }

  return JSON.stringify(doc, null, 2);
});

const rdfSource = computed(() => rdfFormat.value === 'turtle' ? turtleSource.value : jsonldSource.value);
</script>

<template>
  <div class="space-y-6">
    <!-- Instance header -->
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-widest text-ink-300 font-medium mb-2">RDF Instance</div>
          <div class="flex items-center gap-2 flex-wrap">
            <code class="text-sm font-mono text-ink-700 break-all">{{ conceptUriValue }}</code>
            <button @click="copyUri" class="p-1.5 rounded text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors flex-shrink-0" :title="uriCopied ? 'Copied!' : 'Copy URI'">
              <svg v-if="!uriCopied" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 01-2-2v-1m6 4v-3a2 2 0 00-2-2H8"/></svg>
              <svg v-else class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </button>
          </div>
          <div class="flex gap-1.5 mt-2.5">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">gloss:Concept</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">skos:Concept</span>
          </div>
        </div>
      </div>

      <!-- Mini hierarchy -->
      <div class="mt-4 pt-3 border-t border-ink-100/60">
        <div class="flex items-center gap-1.5 flex-wrap text-xs text-ink-400">
          <template v-for="(t, i) in typeChain" :key="i">
            <span v-if="i > 0" class="text-ink-200 mx-0.5">→</span>
            <code class="text-[11px] text-ink-400">{{ t }}</code>
          </template>
          <span class="text-ink-200 mx-0.5">→</span>
          <code class="text-[11px] text-ink-700 font-semibold bg-ink-50 px-1.5 py-0.5 rounded">{{ concept.id }}</code>
        </div>
      </div>
    </div>

    <!-- Property-value panels per class -->
    <div v-for="(section, si) in sections" :key="si" class="card p-5">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-1 h-4 rounded-full" :class="section.classId === 'gloss:Concept' ? 'bg-blue-500' : section.classId === 'gloss:LocalizedConcept' ? 'bg-emerald-500' : 'bg-amber-500'"></div>
        <code class="text-xs font-semibold text-ink-700">{{ section.classId }}</code>
        <span class="text-xs text-ink-400">·</span>
        <span class="text-xs text-ink-500">{{ section.label }}</span>
      </div>

      <div class="space-y-1.5">
        <div v-for="prop in section.props" :key="prop.predicate" class="grid grid-cols-[160px_1fr] gap-x-3 gap-y-0.5 py-1.5 border-b border-ink-100/30 last:border-0">
          <code class="text-xs text-blue-600 font-medium leading-relaxed self-start pt-0.5">{{ prop.predicate }}</code>
          <div class="flex flex-col gap-0.5">
            <template v-for="(val, vi) in prop.values" :key="vi">
              <span v-if="prop.nested" class="text-xs text-ink-600 bg-ink-50/60 px-2 py-1 rounded border-l-2 border-ink-200 leading-relaxed break-words">{{ val }}</span>
              <span v-else class="text-xs text-ink-600 leading-relaxed break-words">{{ val }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- RDF Source panel -->
    <div class="card overflow-hidden">
      <button @click="showSource = !showSource" class="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-ink-50/30 transition-colors">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-ink-400 transition-transform" :class="showSource ? 'rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          <span class="text-sm font-medium text-ink-700">RDF Source</span>
        </div>
        <div class="flex items-center gap-2">
          <select v-model="rdfFormat" @click.stop class="text-xs border border-ink-200 rounded px-2 py-1 bg-surface text-ink-600 focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="turtle">Turtle</option>
            <option value="jsonld">JSON-LD</option>
          </select>
          <span class="text-[10px] text-ink-300">{{ sections.length }} resources</span>
        </div>
      </button>
      <div v-if="showSource" class="border-t border-ink-100/60">
        <pre class="p-4 text-xs font-mono text-ink-700 bg-ink-50/30 overflow-x-auto leading-relaxed max-h-[600px] overflow-y-auto">{{ rdfSource }}</pre>
      </div>
    </div>
  </div>
</template>
