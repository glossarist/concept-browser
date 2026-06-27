import { InvalidLangTagError } from '../errors';

export interface LangTag {
  readonly primary: string;
  readonly script?: string;
  readonly region?: string;
  readonly variants?: string[];
  readonly privateUse?: string[];
  readonly raw: string;
}

const ISO_639_3_TO_1: Readonly<Record<string, string>> = {
  eng: 'en', fra: 'fr', deu: 'de', zho: 'zh', ara: 'ar', jpn: 'ja', rus: 'ru',
  kor: 'ko', spa: 'es', ita: 'it', por: 'pt', nld: 'nl', swe: 'sv', fin: 'fi',
  dan: 'da', nob: 'nb', nno: 'nn', nor: 'no', pol: 'pl', tur: 'tr', ces: 'cs', ell: 'el',
  heb: 'he', hin: 'hi', ind: 'id', fas: 'fa', ukr: 'uk', hun: 'hu', ron: 'ro',
  slk: 'sk', slv: 'sl', hrv: 'hr', srp: 'sr', bul: 'bg', msa: 'ms', tha: 'th',
  vie: 'vi', urd: 'ur', ben: 'bn', tam: 'ta', tel: 'te', mar: 'mr', guj: 'gu',
  pan: 'pa', mal: 'ml', kan: 'kn', ori: 'or', asm: 'as', sin: 'si', nep: 'ne',
  lit: 'lt', lav: 'lv', est: 'et', gle: 'ga', cym: 'cy', eus: 'eu', cat: 'ca',
  glg: 'gl', afr: 'af', sqi: 'sq', mkd: 'mk', bel: 'be', kaz: 'kk', uzb: 'uz',
  aze: 'az', hye: 'hy', kat: 'ka', mon: 'mn', tuk: 'tk', uig: 'ug', tgl: 'tl',
};

const ISO_639_1_TO_3: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ISO_639_3_TO_1)) out[v] = k;
  return Object.freeze(out);
})();

const DEFAULT_SCRIPTS: Readonly<Record<string, string>> = {
  zh: 'Hans',
  sr: 'Cyrl',
  uz: 'Latn',
};

const SCRIPT_RE = /^[A-Z][a-z]{3}$/;
const ISO_ALPHA2_REGION_RE = /^[A-Z]{2}$/;
const UN_M49_REGION_RE = /^\d{3}$/;

export function mapIso6393To6391(code: string): string | null {
  return ISO_639_3_TO_1[code] ?? null;
}

export function mapIso6391To6393(code: string): string | null {
  return ISO_639_1_TO_3[code] ?? null;
}

export function parseLangTag(input: string): LangTag {
  if (!input || typeof input !== 'string') {
    throw new InvalidLangTagError(`Invalid language tag: ${String(input)}`, { input });
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new InvalidLangTagError(`Empty language tag`, { input });
  }

  const segments = trimmed.split('-');
  const first = segments[0]!;
  if (!/^[a-zA-Z]{2,3}$/.test(first)) {
    throw new InvalidLangTagError(
      `Invalid primary subtag: ${first}`,
      { input, subtag: first },
    );
  }

  const primary = (ISO_639_3_TO_1[first.toLowerCase()] ?? first.toLowerCase());
  const tag: LangTag = { primary, raw: input };

  let i = 1;
  let privateUse: string[] | undefined;
  if (segments[i] === 'x') {
    privateUse = segments.slice(i + 1);
    i = segments.length;
  }

  let script: string | undefined;
  let region: string | undefined;
  let variants: string[] | undefined;

  for (; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg === 'x') {
      privateUse = segments.slice(i + 1);
      break;
    }
    if (SCRIPT_RE.test(seg) && !script) {
      script = seg;
    } else if ((ISO_ALPHA2_REGION_RE.test(seg) || UN_M49_REGION_RE.test(seg)) && !region) {
      region = seg;
    } else if (/^[a-z0-9]{4,8}$/i.test(seg)) {
      variants = variants ?? [];
      variants.push(seg);
    } else {
      throw new InvalidLangTagError(
        `Unrecognized language subtag: ${seg}`,
        { input, subtag: seg },
      );
    }
  }

  const finalTag: LangTag = {
    primary,
    script: script ?? DEFAULT_SCRIPTS[primary],
    region,
    variants,
    privateUse,
    raw: input,
  };
  return finalTag;
}

export function formatLangTag(tag: LangTag): string {
  const parts: string[] = [tag.primary];
  if (tag.script) parts.push(tag.script);
  if (tag.region) parts.push(tag.region);
  if (tag.variants?.length) parts.push(...tag.variants);
  if (tag.privateUse?.length) parts.push('x', ...tag.privateUse);
  return parts.join('-');
}

export function canonicalLangTag(input: string): string {
  return formatLangTag(parseLangTag(input));
}

export function isValidLangTag(input: string): boolean {
  try {
    parseLangTag(input);
    return true;
  } catch {
    return false;
  }
}

export function isNfc(text: string): boolean {
  return text.normalize('NFC') === text;
}

export function toNfc(text: string): string {
  return text.normalize('NFC');
}
