import { defineCollection, z } from 'astro:content';

const datasets = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    uri: z.string().optional(),
    uriBase: z.string(),
    year: z.number().optional(),
    status: z.string().optional(),
    ref: z.string().optional(),
    owner: z.string().optional(),
    languages: z.array(z.string()),
    conceptCount: z.number(),
    color: z.union([
      z.string(),
      z.object({ light: z.string(), dark: z.string() }),
    ]).optional(),
    tags: z.array(z.string()),
    sections: z.array(z.any()).optional(),
    sourceRepo: z.string().optional(),
  }),
});

const groups = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['lineage', 'topic', 'family', 'collection', 'default']),
    description: z.string().optional(),
    current: z.string().optional(),
    datasets: z.array(z.string()),
    color: z.union([
      z.string(),
      z.object({ light: z.string(), dark: z.string() }),
    ]).optional(),
  }),
});

const concepts = defineCollection({
  type: 'data',
  schema: z.object({
    registerId: z.string(),
    conceptId: z.string(),
    uri: z.string(),
    status: z.string().optional(),
    designations: z.record(z.string(), z.string()),
    eng: z.string().optional(),
    definition: z.record(z.string(), z.string()).optional(),
    groups: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    type: z.enum(['page', 'news', 'contributors', 'about', 'stats', 'custom']).optional(),
    route: z.string().optional(),
    icon: z.string().optional(),
  }),
});

export const collections = { datasets, groups, concepts, pages };
