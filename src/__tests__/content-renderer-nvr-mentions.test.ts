import { describe, it, expect } from 'vitest';
import { renderContent } from '../utils/content-renderer';
import type { RenderOptions } from '../utils/content-renderer';
import type { NonVerbalKind } from '../adapters/non-verbal/types';

type NvResolver = (kind: NonVerbalKind, id: string, display?: string) => string;

function makeOpts(nonVerbalRefResolver?: NvResolver): RenderOptions {
  return { nonVerbalRefResolver };
}

describe('content-renderer — non-verbal mentions', () => {
  it('dispatches {{fig:id}} to nonVerbalRefResolver as figure', () => {
    const calls: Array<[NonVerbalKind, string, string | undefined]> = [];
    const resolver: NvResolver = (kind, id, display) => {
      calls.push([kind, id, display]);
      return `<a href="#figure-ds-${id}">${id}</a>`;
    };
    const out = renderContent('See {{fig:mixed-reflection}} in the diagram.', makeOpts(resolver));
    expect(calls).toEqual([['figure', 'mixed-reflection', undefined]]);
    expect(out).toContain('href="#figure-ds-mixed-reflection"');
  });

  it('dispatches {{table:id}} to nonVerbalRefResolver as table', () => {
    const resolver: NvResolver = (kind) => `<a href="#${kind}-ds-x">x</a>`;
    const out = renderContent('See {{table:wavelengths}}.', makeOpts(resolver));
    expect(out).toContain('href="#table-ds-x"');
  });

  it('dispatches {{formula:id}} to nonVerbalRefResolver as formula', () => {
    const resolver: NvResolver = (kind) => `<a href="#${kind}-ds-x">x</a>`;
    const out = renderContent('Use {{formula:e-mc2}}.', makeOpts(resolver));
    expect(out).toContain('href="#formula-ds-x"');
  });

  it('passes the display override as the third resolver arg', () => {
    const calls: Array<[NonVerbalKind, string, string | undefined]> = [];
    const resolver: NvResolver = (kind, id, display) => {
      calls.push([kind, id, display]);
      return '<span/>';
    };
    renderContent('{{fig:foo, Figure 3}}', makeOpts(resolver));
    expect(calls[0]).toEqual(['figure', 'foo', 'Figure 3']);
  });

  it('falls back to a typed span when no resolver is configured', () => {
    const out = renderContent('{{fig:foo}}', makeOpts(undefined));
    expect(out).toContain('nv-ref nv-ref--figure');
    expect(out).toContain('foo');
  });

  it('falls back to entityId as label when display override is absent and no resolver', () => {
    const out = renderContent('{{table:wavelengths}}', makeOpts(undefined));
    expect(out).toContain('wavelengths');
    expect(out).toContain('nv-ref--table');
  });
});
