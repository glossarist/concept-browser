const LANG_NAMES: Record<string, string> = {
  eng: 'English',
  ara: 'Arabic',
  deu: 'German',
  fra: 'French',
  spa: 'Spanish',
  ita: 'Italian',
  jpn: 'Japanese',
  kor: 'Korean',
  pol: 'Polish',
  por: 'Portuguese',
  srp: 'Serbian',
  swe: 'Swedish',
  zho: 'Chinese',
  rus: 'Russian',
  fin: 'Finnish',
  dan: 'Danish',
  nld: 'Dutch',
  msa: 'Malay',
  nob: 'Norwegian Bokmål',
  nno: 'Norwegian Nynorsk',
};

export function langName(code: string): string {
  return LANG_NAMES[code] ?? code;
}

export function langLabel(code: string): string {
  return code.toUpperCase();
}

export const DEFAULT_LANG = 'eng';
