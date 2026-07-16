import type { App } from 'vue';
import { createPinia } from 'pinia';
import router from '../router';

export default function (app: App) {
  app.use(createPinia());
  app.use(router);
}
