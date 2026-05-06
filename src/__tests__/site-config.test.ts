import { describe, it, expect } from 'vitest';
import type { RuntimeSiteConfig } from '../config/use-site-config';

describe('RuntimeSiteConfig', () => {
  it('accepts valid config structure', () => {
    const config: RuntimeSiteConfig = {
      id: 'geolexica',
      domain: 'www.geolexica.org',
      title: 'Geolexica',
      datasets: ['iev', 'isotc211', 'isotc204', 'osgeo'],
      branding: { primaryColor: '#2563eb' },
      defaults: { language: 'eng' },
    };
    expect(config.datasets).toEqual(['iev', 'isotc211', 'isotc204', 'osgeo']);
    expect(config.branding?.primaryColor).toBe('#2563eb');
  });

  it('supports single-dataset config', () => {
    const config: RuntimeSiteConfig = {
      id: 'isotc204',
      domain: 'isotc204.geolexica.org',
      title: 'ISO/TC 204 ITS Vocabulary',
      datasets: ['isotc204'],
      defaultDataset: 'isotc204',
      branding: { primaryColor: '#d97706', ownerName: 'ISO/TC 204' },
      defaults: { language: 'eng' },
    };
    expect(config.datasets).toEqual(['isotc204']);
    expect(config.defaultDataset).toBe('isotc204');
  });

  it('supports optional fields', () => {
    const config: RuntimeSiteConfig = {
      id: 'osgeo',
      domain: 'osgeo.geolexica.org',
      title: 'OSGeo Lexicon',
      subtitle: 'Open Source Geospatial Glossary',
      datasets: ['osgeo'],
      branding: {
        primaryColor: '#059669',
        ownerName: 'OSGeo',
        ownerUrl: 'https://www.osgeo.org',
      },
      analytics: { googleAnalyticsId: 'UA-168998071-3' },
      features: { graph: true, search: true },
      social: { github: 'https://github.com/geolexica/osgeo-glossary' },
      defaults: { language: 'eng' },
    };
    expect(config.subtitle).toBe('Open Source Geospatial Glossary');
    expect(config.analytics?.googleAnalyticsId).toBe('UA-168998071-3');
  });
});
