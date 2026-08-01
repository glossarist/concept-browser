import { BibliographyData, type BibliographyEntry } from 'glossarist';

export interface BibliographyAdapterOptions {
  basePath?: string;
  fetcher?: (url: string) => Promise<Response>;
}

export class BibliographyAdapter {
  private data: BibliographyData | null = null;
  private loaded = false;
  private readonly basePath: string;
  private readonly fetcher: (url: string) => Promise<Response>;

  constructor(
    private readonly datasetId: string,
    opts: BibliographyAdapterOptions = {},
  ) {
    this.basePath = opts.basePath ?? import.meta.env.BASE_URL ?? '/';
    this.fetcher = opts.fetcher ?? ((url: string) => fetch(url));
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const resp = await this.fetcher(`${this.basePath}data/${this.datasetId}/bibliography.json`);
      if (resp.ok) {
        const json = await resp.json();
        this.data = BibliographyData.fromJSON(json);
      }
    } catch {
      // Honest failure: loaded=true prevents retry storms; findById returns null.
    } finally {
      this.loaded = true;
    }
  }

  findById(id: string): BibliographyEntry | null {
    return this.data?.find(id) ?? null;
  }

  all(): readonly BibliographyEntry[] {
    return this.data?.entries ?? [];
  }

  clear(): void {
    this.data = null;
    this.loaded = false;
  }
}
