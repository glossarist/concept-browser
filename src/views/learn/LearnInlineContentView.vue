<script setup lang="ts">
/**
 * LearnInlineContentView — unified inline content syntax reference.
 *
 * Documents every {{kind:target}} mention kind with examples,
 * explains the data/deployment boundary for citations, and shows
 * the resolution cascade.
 */
import { computed } from 'vue';
import { useI18n } from '../../i18n';
import LearnCard from '../../components/learn/LearnCard.vue';

const { t } = useI18n();

const introText = computed(() =>
  t('learn.inlineContent.intro') ||
  'Every inline reference in concept text uses the unified mustache-kind:target notation. The first word (before the colon) tells you what kind of reference it is.',
);

const mentionKinds = [
  { kind: 'cite', syntax: '{{cite:sourceId}}', example: '{{cite:iso7301}}', desc: 'Cite a ConceptSource from this concept\'s sources[] list. Walks the full resolution cascade (co-deployed → routed → bib).' },
  { kind: 'cite + label', syntax: '{{cite:sourceId, label}}', example: '{{cite:iso7301, rice}}', desc: 'Same as cite, with an explicit display label.' },
  { kind: 'urn', syntax: '{{urn:URN}}', example: '{{urn:iso:std:iso:704}}', desc: 'Reference a concept via URN routing. The deployment decides which dataset (if any) handles this URN.' },
  { kind: 'fig', syntax: '{{fig:id}}', example: '{{fig:diagram_3}}', desc: 'Reference a figure entity in the same dataset.' },
  { kind: 'table', syntax: '{{table:id}}', example: '{{table:unit_list}}', desc: 'Reference a table entity.' },
  { kind: 'formula', syntax: '{{formula:id}}', example: '{{formula:ohm_law}}', desc: 'Reference a formula entity.' },
  { kind: 'bib', syntax: '{{bib:id}}', example: '{{bib:ref_1}}', desc: 'Bibliography entry (case-3-only — no underlying concept). Renders as a flat reference.' },
  { kind: 'link', syntax: '{{link:URL}}', example: '{{link:https://example.com}}', desc: 'External URL. The URL is canonical; the deployment has no say.' },
  { kind: 'link + label', syntax: '{{link:URL, label}}', example: '{{link:https://example.com, click here}}', desc: 'External URL with display label.' },
  { kind: 'image', syntax: '{{image:src}}', example: '{{image:diagram.png}}', desc: 'Inline image embed. Local images get basePath-prefixed.' },
  { kind: 'image + alt', syntax: '{{image:src, alt}}', example: '{{image:diagram.png, The diagram}}', desc: 'Image with accessibility alt text.' },
  { kind: 'designation', syntax: '{{designation}}', example: '{{measurement unit}}', desc: 'Reference a concept by matching its designation text (same dataset).' },
  { kind: 'numeric', syntax: '{{numeric_id}}', example: '{{112-01-10}}', desc: 'Reference a concept by numeric ID (same dataset).' },
];

const cascade = [
  { step: 1, name: 'uriPatterns', desc: 'Is there a co-deployed dataset that matches this URI?', result: 'Internal link (case 1)' },
  { step: 2, name: 'routing[]', desc: 'Is there a routing entry for this URI in site-config.yml?', result: 'External link (case 2)' },
  { step: 3, name: 'citation.link', desc: 'Does the source have a canonical link?', result: 'Flat bib record (case 3)' },
  { step: 4, name: 'unresolved', desc: 'No match anywhere', result: 'Plain text' },
];
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    <h1 class="font-title text-3xl text-ink-800 dark:text-ink-50 mb-2">
      {{ t('learn.inlineContent.title') || 'Inline Content Syntax' }}
    </h1>
    <p class="text-ink-500 dark:text-ink-400">
      {{ introText }}
    </p>

    <LearnCard title="Mention Kinds">
      <template #body>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-ink-100 dark:border-ink-700 text-left">
                <th class="py-2 pr-4">Kind</th>
                <th class="py-2 pr-4">Syntax</th>
                <th class="py-2 pr-4">Example</th>
                <th class="py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in mentionKinds" :key="row.syntax" class="border-b border-ink-50 dark:border-ink-800">
                <td class="py-2 pr-4 font-mono text-xs text-ink-600 dark:text-ink-300">{{ row.kind }}</td>
                <td class="py-2 pr-4 font-mono text-xs text-ink-700 dark:text-ink-200">{{ row.syntax }}</td>
                <td class="py-2 pr-4 font-mono text-xs text-emerald-700 dark:text-emerald-300">{{ row.example }}</td>
                <td class="py-2 text-xs text-ink-500 dark:text-ink-400">{{ row.desc }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </LearnCard>

    <LearnCard title="Data / Deployment Boundary">
      <template #body>
        <div class="space-y-3 text-sm text-ink-600 dark:text-ink-300">
          <p>
            <strong>Dataset authors</strong> write citations in a deployment-agnostic way.
            They don't know where their dataset will be deployed or what other datasets will be co-deployed.
          </p>
          <p>
            <strong>Deployers</strong> write <code class="text-xs bg-ink-50 dark:bg-ink-800 px-1 rounded">site-config.yml</code>
            to register datasets and declare URI patterns. They never edit dataset content.
          </p>
          <p>
            <strong>Concept-browser</strong> resolves every citation at runtime. The same YAML works in any deployment.
          </p>
        </div>
      </template>
    </LearnCard>

    <LearnCard title="Resolution Cascade">
      <template #body>
        <div class="space-y-2">
          <div v-for="step in cascade" :key="step.step" class="flex items-start gap-3 py-2">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 text-xs font-mono flex items-center justify-center">{{ step.step }}</span>
            <div class="flex-1">
              <div class="font-mono text-xs text-ink-700 dark:text-ink-200">{{ step.name }}</div>
              <div class="text-xs text-ink-500 dark:text-ink-400">{{ step.desc }}</div>
              <div class="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">{{ step.result }}</div>
            </div>
          </div>
        </div>
      </template>
    </LearnCard>

    <LearnCard title="Deprecated: <<ref,title>>">
      <template #body>
        <div class="text-sm text-ink-600 dark:text-ink-300 space-y-2">
          <p>
            The AsciiDoc xref syntax <code class="text-xs bg-amber-50 dark:bg-amber-900/20 px-1 rounded">&lt;&lt;ref,title&gt;&gt;</code>
            is deprecated. It emits a console warning and renders as plain text.
          </p>
          <p>Migrate to the unified syntax:</p>
          <ul class="list-disc list-inside text-xs space-y-1">
            <li><code>&lt;&lt;fig_3,Figure 3&gt;&gt;</code> → <code class="text-emerald-700 dark:text-emerald-300" v-text="'{{fig:fig_3, Figure 3}}'"></code></li>
            <li><code>&lt;&lt;845-01-01, 845-01-01&gt;&gt;</code> → <code class="text-emerald-700 dark:text-emerald-300" v-text="'{{cite:iev_845-01-01}}'"></code></li>
            <li><code>&lt;&lt;ref_1, ISO 704&gt;&gt;</code> → <code class="text-emerald-700 dark:text-emerald-300" v-text="'{{bib:ref_1, ISO 704}}'"></code></li>
          </ul>
        </div>
      </template>
    </LearnCard>
  </div>
</template>
