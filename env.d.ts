/// <reference types="vite/client" />

declare const __CONCEPT_BROWSER_VERSION__: string;

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
