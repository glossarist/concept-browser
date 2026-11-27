// scripts/extract-source-refs.ts
function extractSourceRefs(concept, registerId) {
  const refs = /* @__PURE__ */ new Set();
  for (const src of concept["gl:source"] || []) {
    const origin = src["gl:origin"];
    if (origin) {
      const ref = origin["gl:ref"];
      if (ref?.["gl:source"]) refs.add(ref["gl:source"]);
    }
  }
  for (const lc of Object.values(concept["gl:localizedConcept"] || {})) {
    for (const src of lc["gl:source"] || []) {
      const origin = src["gl:origin"];
      if (origin) {
        const ref = origin["gl:ref"];
        if (ref?.["gl:source"]) refs.add(ref["gl:source"]);
      }
    }
  }
  return [...refs].map((source) => ({ source, registerId }));
}
export {
  extractSourceRefs
};
