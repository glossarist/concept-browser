// === Branding ===

export interface FontConfig {
  family: string;
  source: 'google' | 'url' | 'local';
  weights?: number[];
  url?: string;
}

export interface LogoConfig {
  path: string;
  alt: string;
  url?: string;
  remoteUrl?: string;
}

export interface SiteBranding {
  primaryColor?: string;
  darkColor?: string;
  fonts?: {
    header?: FontConfig;
    body?: FontConfig;
  };
  logo?: LogoConfig;
  footerLogo?: LogoConfig;
  favicon?: string;
  ownerName?: string;
  ownerUrl?: string;
}

// === Features ===

export interface PoweredByConfig {
  title: string;
  url: string;
}

export interface SiteFeatures {
  news?: boolean;
  stats?: boolean;
  graph?: boolean;
  about?: boolean;
  search?: boolean;
  poweredBy?: PoweredByConfig;
}

// === Analytics ===

export interface AnalyticsConfig {
  googleAnalyticsId?: string;
}

// === Navigation ===

export interface NavItem {
  label: string;
  route: string;
}

export interface SocialLinks {
  github?: string;
  twitter?: string;
  [key: string]: string | undefined;
}

// === Routing ===

export type RoutingType = 'site' | 'url';

export interface RoutingEntry {
  uri: string;
  type: RoutingType;
  targetDataset?: string;
  baseUrl?: string;
  url?: string;
  label: string;
}

// === Dataset ===

export interface DatasetConfig {
  id: string;
  uri: string;
  uriAliases?: string[];
  gcrPackage: string;
  sourceRepo?: string;
  title: string;
  description?: string;
  owner?: string;
  color?: string;
  tags?: string[];
  languageOrder?: string[];
  downloads?: string[];
}

// === Contributors ===

export interface Contributor {
  name: string;
  role?: string;
  organization?: string;
  url?: string;
  email?: string;
}

// === Downloads ===

export interface BulkFormatInfo {
  file: string;
  format: string;
  size: number;
}

export const FORMAT_LABELS: Record<string, string> = {
  turtle: 'Turtle (RDF)',
  jsonld: 'JSON-LD (SKOS)',
  tbx: 'TBX-XML',
  jsonl: 'JSONL',
  yaml: 'YAML',
};

// === Pages ===

export type PageType = 'page' | 'news' | 'contributors' | 'about' | 'stats' | 'custom';

export interface PageConfig {
  type: PageType;
  route: string;
  title: string;
  icon: string;
  source?: string;
  datasetScoped?: boolean;
}

// === Site Config ===

export interface SiteConfig {
  id: string;
  domain: string;
  title: string;
  subtitle?: string;
  description?: string;
  datasets: DatasetConfig[];
  routing: RoutingEntry[];
  branding: SiteBranding;
  analytics?: AnalyticsConfig;
  features?: SiteFeatures;
  social?: SocialLinks;
  nav?: NavItem[];
  footerNav?: NavItem[];
  defaults: {
    language?: string;
    languageOrder?: string[];
  };
  email?: string;
  pages?: PageConfig[];
  contributors?: Contributor[];
}
