// Minimal site config loader for Astro SSG.
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';

let cached: any = null;

export async function getSiteConfig() {
  if (cached) return cached;
  const path = resolve(process.cwd(), 'site-config.yml');
  if (existsSync(path)) {
    try {
      cached = yaml.load(readFileSync(path, 'utf-8'));
    } catch {
      cached = { title: 'Glossarist', description: '' };
    }
  } else {
    const jsonPath = resolve(process.cwd(), 'public', 'site-config.json');
    if (existsSync(jsonPath)) {
      cached = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    } else {
      cached = { title: 'Glossarist', description: '' };
    }
  }
  return cached;
}
