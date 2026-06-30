/**
 * Stryker mutation testing config — scoped to high-value emitter files.
 *
 * Run via: npm run mutation:test
 * CI cost: ~3-5 minutes per PR on this scope.
 *
 * Mutation testing systematically mutates source code (e.g., `if (x)`
 * becomes `if (!x)`, `+` becomes `-`, conditionals are removed) and
 * re-runs the test suite per mutant. A "killed" mutant means tests
 * caught the bug; a "survived" mutant means test gap.
 *
 * Thresholds: high=80, low=60, break=50. Build fails if mutation
 * score drops below 50%.
 */
export default {
  $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [
    'src/components/concept-rdf/concept-emitter.ts',
    'src/components/concept-rdf/dataset-emitter.ts',
    'src/components/concept-rdf/bibliography-emitter.ts',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  vitest: {
    configFile: 'vite.config.ts',
  },
  ignorePatterns: [
    'src/__tests__/**/__fixtures__/**',
  ],
  timeoutMS: 60000,
  concurrency: 2,
};
