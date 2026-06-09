/**
 * Source reference extraction for citation linking.
 *
 * Scans concept JSON-LD for source strings in gl:source fields.
 * Used by build-edges.js to generate source-refs.json.
 */

export function extractSourceRefs(concept, registerId) {
  const refs = new Set();

  // Managed concept-level sources
  for (const src of concept['gl:source'] || []) {
    const origin = src['gl:origin'];
    if (origin) {
      const ref = origin['gl:ref'];
      if (ref?.['gl:source']) refs.add(ref['gl:source']);
    }
  }

  // Localized concept-level sources
  for (const lc of Object.values(concept['gl:localizedConcept'] || {})) {
    for (const src of lc['gl:source'] || []) {
      const origin = src['gl:origin'];
      if (origin) {
        const ref = origin['gl:ref'];
        if (ref?.['gl:source']) refs.add(ref['gl:source']);
      }
    }
  }

  return [...refs].map(source => ({ source, registerId }));
}
