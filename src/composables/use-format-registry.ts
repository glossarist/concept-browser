export type FormatAvailability = 'per-concept' | 'aggregate' | 'both';
export type SerializeMode = 'build' | 'runtime';

export interface FormatDescriptor {
  id: string;
  extension: string;
  mediaType: string;
  label: string;
  available: FormatAvailability;
  serialize: SerializeMode;
}

const REGISTRY = new Map<string, FormatDescriptor>();

export function registerFormat(desc: FormatDescriptor): void {
  REGISTRY.set(desc.id, desc);
}

export function unregisterFormat(id: string): void {
  REGISTRY.delete(id);
}

export function getFormat(id: string): FormatDescriptor | undefined {
  return REGISTRY.get(id);
}

export function listFormats(opts: { availability?: FormatAvailability } = {}): FormatDescriptor[] {
  const filter = opts.availability;
  return [...REGISTRY.values()]
    .filter(f => !filter || f.available === filter || f.available === 'both')
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function clearFormats(): void {
  REGISTRY.clear();
}

registerFormat({ id: 'ttl',    extension: 'ttl',     mediaType: 'text/turtle',           label: 'Turtle',      available: 'both',         serialize: 'build' });
registerFormat({ id: 'jsonld', extension: 'jsonld',  mediaType: 'application/ld+json',   label: 'JSON-LD',     available: 'both',         serialize: 'build' });
registerFormat({ id: 'yaml',   extension: 'yaml',   mediaType: 'application/yaml',       label: 'YAML',        available: 'per-concept',  serialize: 'build' });
registerFormat({ id: 'tbx',    extension: 'tbx.xml', mediaType: 'application/x-tbx',     label: 'TBX',         available: 'aggregate',    serialize: 'build' });
registerFormat({ id: 'jsonl',  extension: 'jsonl',  mediaType: 'application/jsonl+json', label: 'JSON-Lines',  available: 'aggregate',    serialize: 'build' });
