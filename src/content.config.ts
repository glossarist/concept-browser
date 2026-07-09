import { defineCollection, z } from 'astro:content';

const datasets = defineCollection({
  type: 'data',
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
  type: 'data',
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
  type: 'data',
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
  }),
});

const pages = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    type: z.string().optional(),
    html: z.string().optional(),
    route: z.string().optional(),
  }),
});

export const collections = { datasets, groups, concepts, pages };
