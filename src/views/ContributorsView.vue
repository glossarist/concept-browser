<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSiteConfig } from '../config/use-site-config';

interface Contributor {
  language: string;
  registerName: string;
  organization: string;
  contact: string;
  email: string;
  uri: string;
  country: string;
}

interface ContributorsData {
  register: string;
  owner: string;
  manager: string;
  contributors: Contributor[];
}

const { config } = useSiteConfig();
const data = ref<ContributorsData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const resp = await fetch('/contributors.json');
    if (resp.ok) data.value = await resp.json();
  } catch (e: any) {
    error.value = e.message;
  }
  loading.value = false;
});
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="font-serif text-3xl text-ink-800 mb-2">Contributors</h1>
    <p class="text-ink-400 mb-8">
      Organizations and individuals contributing to {{ config?.branding?.ownerName || config?.title || 'this glossary' }}.
    </p>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div class="card p-6 space-y-3">
          <div class="h-4 bg-ink-100 rounded w-40"></div>
          <div class="h-6 bg-ink-100 rounded w-3/4"></div>
          <div class="h-4 bg-ink-100 rounded w-1/2"></div>
        </div>
      </div>
    </template>

    <template v-else-if="error">
      <div class="card p-8 text-center">
        <p class="text-ink-500">Failed to load contributors.</p>
      </div>
    </template>

    <template v-else-if="data">
      <!-- Register metadata -->
      <div v-if="data.owner" class="card p-6 mb-6">
        <h2 class="section-label">Register Information</h2>
        <dl class="space-y-3 mt-3">
          <div v-if="data.owner" class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-40 flex-shrink-0 pt-0.5">Owner</dt>
            <dd class="text-ink-800 font-medium">{{ data.owner }}</dd>
          </div>
          <div v-if="data.manager" class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-40 flex-shrink-0 pt-0.5">Manager</dt>
            <dd class="text-ink-800">{{ data.manager }}</dd>
          </div>
        </dl>
      </div>

      <!-- Per-language contributors -->
      <div v-if="data.contributors.length" class="card overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-ink-100/60 bg-ink-50/50">
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Language</th>
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Organization</th>
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Contact</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in data.contributors" :key="c.language" class="border-b border-ink-50 last:border-0">
              <td class="px-5 py-3">
                <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ c.language.toUpperCase() }}</span>
                <span v-if="c.registerName" class="ml-2 text-ink-600 text-xs">{{ c.registerName }}</span>
              </td>
              <td class="px-5 py-3 text-ink-700">
                <span v-if="c.uri"><a :href="c.uri" target="_blank" class="concept-link">{{ c.organization }}</a></span>
                <span v-else>{{ c.organization }}</span>
              </td>
              <td class="px-5 py-3 text-ink-500 text-xs">{{ c.contact }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <div class="card p-8 text-center">
        <p class="text-ink-500">No contributor information available.</p>
      </div>
    </template>
  </div>
</template>
