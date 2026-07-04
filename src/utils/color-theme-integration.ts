/**
 * Color-theme integration bridge for the relationship-categories module.
 * Re-exports the color pair accessors with a stable interface so consumers
 * don't need to import from two places.
 */
export {
  colorPairForType,
  colorPairForCategory,
  colorThemeForOverrides,
} from './relationship-categories';
export type { ColorPair } from './color-theme';
