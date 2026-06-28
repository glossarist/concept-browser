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

declare module '@rdfjs/dataset' {
  export function dataset(): any;
  const _default: { dataset: typeof dataset };
  export default _default;
}

declare module 'rdf-validate-shacl' {
  export default class Validator {
    constructor(shapes: any, options?: { factory?: any });
    validate(data: any): { conforms: boolean; results: any[] };
  }
}
