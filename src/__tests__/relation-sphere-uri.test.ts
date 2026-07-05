import { describe, it, expect } from 'vitest';
import { UriRouter } from '../adapters/UriRouter';

describe('UriRouter.parseUri — deployment-agnostic concept URI parsing', () => {
  // The old parseNeighborUri in RelationSphere.vue hardcoded specific
  // hostnames. UriRouter.parseUri must work for ANY deployment.
  const cases: Array<[string, string, string]> = [
    // [input URI, expected registerId, expected conceptId]
    ['https://www.glossarist.org/iala-vocab/iala-2022/concept/1-1-000',     'iala-2022', '1-1-000'],
    ['https://glossarist.org/iala-2022/concept/1-1-000',                    'iala-2022', '1-1-000'],
    ['https://glossarist.org/iso/concept/3.1.1',                            'iso',       '3.1.1'],
    ['https://oimlsmart.github.io/vocab/viml-2022/concept/1.1',             'viml-2022', '1.1'],
    ['https://www.oimlsmart.org/vocab/viml-2022/concept/1.1',               'viml-2022', '1.1'],
    ['https://metanorma.github.io/iala-vocab/iala-2023/concept/2-1-245',    'iala-2023', '2-1-245'],
    ['https://isotc204.geolexica.org/isotc204-2022/concept/3.5.8.8',       'isotc204-2022', '3.5.8.8'],
    ['https://vocab.example.org/dataset-x/concept/foo',                      'dataset-x', 'foo'],
    ['https://custom.host/path/to/register/concept/abc-123',                'register',  'abc-123'],
  ];

  for (const [uri, expectedReg, expectedId] of cases) {
    it(`parses ${uri}`, () => {
      const parsed = UriRouter.parseUri(uri);
      expect(parsed).toEqual({ registerId: expectedReg, conceptId: expectedId });
    });
  }

  it('returns null for URIs without /concept/', () => {
    expect(UriRouter.parseUri('https://example.org/foo/bar')).toBeNull();
    expect(UriRouter.parseUri('urn:iso:std:iso:14812:2025:3.5.8.8')).toBeNull();
    expect(UriRouter.parseUri('')).toBeNull();
  });

  it('does NOT hardcode any specific hostname', () => {
    // Every deployment domain should work. If the regex hardcodes
    // a specific host, this test would fail for others.
    const diverse = [
      'https://a.io/r/concept/1',
      'https://b.com/x/y/z/concept/2',
      'https://1.2.3.4/reg/concept/3',
    ];
    for (const uri of diverse) {
      expect(UriRouter.parseUri(uri)).not.toBeNull();
    }
  });
});
