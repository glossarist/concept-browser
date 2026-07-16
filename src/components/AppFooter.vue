<script setup lang="ts">
import { computed } from 'vue';
import { useSiteConfig } from '../config/use-site-config';
import { useI18n } from '../i18n';

const glossaristLogo = new URL('../assets/glossarist-logo.svg', import.meta.url).href;

const { config } = useSiteConfig();
const { t } = useI18n();

const poweredBy = computed(() => {
  const pb = config.value?.features?.poweredBy as { message?: string; url?: string } | undefined;
  return { message: pb?.message || t('footer.builtWith'), url: pb?.url || 'https://glossarist.org' };
});

const socialLinks = computed(() => {
  const s = config.value?.social;
  if (!s) return [];
  const links: { key: string; label: string; url: string }[] = [];
  if (s.github) links.push({ key: 'github', label: 'GitHub', url: s.github });
  if (s.twitter) links.push({ key: 'twitter', label: 'Twitter', url: s.twitter });
  return links;
});

const footerNav = computed(() => config.value?.footerNav ?? []);
const copyrightOwner = computed(() => config.value?.copyright || '');
const ownerName = computed(() => config.value?.branding?.ownerName || config.value?.title || '');
const ownerUrl = computed(() => config.value?.branding?.ownerUrl || '/');
</script>

<template>
  <footer class="border-t border-ink-100/60 bg-surface-raised mt-auto">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-400">
        <div class="flex items-center gap-3">
          <span v-if="copyrightOwner">
            &copy; {{ new Date().getFullYear() }} {{ copyrightOwner }}
          </span>
          <span v-else-if="ownerName">
            &copy; {{ new Date().getFullYear() }}
            <a v-if="ownerUrl" :href="ownerUrl" target="_blank" rel="noopener" class="concept-link">{{ ownerName }}</a>
            <span v-else>{{ ownerName }}</span>
          </span>
        </div>
        <div class="flex items-center gap-4">
          <router-link
            v-for="item in footerNav"
            :key="item.route"
            :to="item.route ? `/${item.route}` : '/'"
            class="hover:text-ink-700 transition-colors"
          >{{ item.label }}</router-link>
          <a
            v-for="link in socialLinks"
            :key="link.key"
            :href="link.url"
            target="_blank"
            rel="noopener"
            class="hover:text-ink-700 transition-colors"
          >{{ link.label }}</a>
          <span class="text-ink-200">|</span>
          <span class="text-xs inline-flex items-center gap-1.5">
            <img :src="glossaristLogo" alt="Glossarist" class="w-4 h-4 opacity-80" />
            <a :href="poweredBy.url" target="_blank" rel="noopener" class="concept-link">{{ poweredBy.message }}</a>
          </span>
        </div>
      </div>
    </div>
  </footer>
</template>
