import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { vMath } from './directives/v-math';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.directive('math', vMath);
app.mount('#app');
