declare module '*/scripts/normalize-yaml.mjs' {
  export interface NormalizeResult {
    checked: number;
    nonNfc: number;
    fixed: string[];
    check: boolean;
  }

  export interface NormalizeOptions {
    root?: string;
    check?: boolean;
    paths?: string[];
  }

  export function normalizeYaml(options?: NormalizeOptions): NormalizeResult;
}
