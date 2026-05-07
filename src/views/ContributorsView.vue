<script setup lang="ts">
import { useSiteConfig } from '../config/use-site-config';

interface Contributor {
  name: string;
  role?: string;
  organization?: string;
  url?: string;
  email?: string;
}

const { config } = useSiteConfig();
const contributors = config.value?.contributors as Contributor[] | undefined;
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">Home</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">Contributors</span>
    </nav>
    <h1 class="font-serif text-3xl text-ink-800 mb-2">Contributors</h1>
    <p class="text-ink-400 mb-8">
      People and organizations contributing to {{ config?.branding?.ownerName || config?.title || 'this glossary' }}.
    </p>

    <template v-if="contributors?.length">
      <div class="card overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-ink-100/60 bg-ink-50/50">
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Name</th>
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Role</th>
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Organization</th>
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Contact</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in contributors" :key="c.name" class="border-b border-ink-50 last:border-0">
              <td class="px-5 py-3 text-ink-800 font-medium">
                <a v-if="c.url" :href="c.url" target="_blank" class="concept-link">{{ c.name }}</a>
                <span v-else>{{ c.name }}</span>
              </td>
              <td class="px-5 py-3 text-ink-600">{{ c.role || '—' }}</td>
              <td class="px-5 py-3 text-ink-700">{{ c.organization || '—' }}</td>
              <td class="px-5 py-3">
                <a v-if="c.email" :href="`mailto:${c.email}`" class="concept-link text-xs">{{ c.email }}</a>
                <span v-else class="text-ink-300">—</span>
              </td>
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
