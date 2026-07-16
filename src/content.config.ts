import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const datasets = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/datasets' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    uri: z.string().optional(),
    uriBase: z.string().optional().default(''),
    year: z.number().optional(),
    status: z.string().optional(),
    ref: z.string().optional(),
    refAliases: z.array(z.string()).optional(),
    owner: z.string().optional(),
    languages: z.array(z.string()).default(['eng']),
    conceptCount: z.number().default(0),
    color: z.union([z.string(), z.object({ light: z.string(), dark: z.string() })]).optional(),
    tags: z.array(z.string()).default([]),
    sections: z.array(z.any()).optional(),
    sourceRepo: z.string().optional(),
    lastUpdated: z.string().optional(),
  }),
});

const groups = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/groups' }),
  schema: z.object({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['lineage', 'topic', 'family', 'collection', 'default']).default('default'),
    description: z.string().optional(),
    current: z.string().optional(),
    datasets: z.array(z.string()).default([]),
    color: z.union([z.string(), z.object({ light: z.string(), dark: z.string() })]).optional(),
  }),
});

const concepts = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/concepts' }),
  schema: z.object({
    registerId: z.string(),
    conceptId: z.string(),
    uri: z.string(),
    status: z.string().default('valid'),
    designations: z.record(z.string(), z.string()).default({}),
    eng: z.string().optional(),
    definition: z.record(z.string(), z.string()).optional(),
    groups: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    languages: z.array(z.string()).optional(),
    localizations: z.record(z.string(), z.object({
      languageCode: z.string().optional(),
      terms: z.array(z.union([
        z.string(),
        z.object({ designation: z.string(), normativeStatus: z.string().optional() }),
      ])).default([]),
      definitions: z.array(z.union([
        z.string(),
        z.object({ content: z.string() }),
      ])).default([]),
      notes: z.array(z.union([
        z.string(),
        z.object({ content: z.string() }),
      ])).default([]),
      examples: z.array(z.union([
        z.string(),
        z.object({ content: z.string() }),
      ])).default([]),
    })).optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,json}', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    type: z.string().optional(),
    html: z.string().optional(),
    route: z.string().optional(),
  }),
});

export const collections = { datasets, groups, concepts, pages };
