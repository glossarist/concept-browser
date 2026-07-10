/**
 * App entry for Astro Vue islands.
 *
 * Astro calls this function when creating each island's Vue app.
 * We install Pinia + a router stub so ALL SPA components work
 * without modification — they call useVocabularyStore(), useRouter(),
 * getFactory() etc. and everything resolves.
 */
import type { App } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

export default function (app: App) {
  // Pinia — required by useVocabularyStore, useUiStore
  app.use(createPinia());

  // Vue Router stub — SPA components call router.push(). In Astro,
  // we use memory history so router.push() does client-side nav
  // without changing the URL scheme.
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:pathMatch(.*)*', component: { render: () => null } },
    ],
  });
  app.use(router);
}
