/**
 * Figure layout derivation — derives a layout label from subfigure count.
 *
 * Per the architectural rule "derive layout, don't store it", this helper
 * inspects a Figure's subfigures and returns the layout kind:
 *
 *   - `single`  — no subfigures
 *   - `row`     — 2 subfigures side-by-side
 *   - `column`  — 3+ subfigures in a vertical stack (default for many)
 *   - `grid`    — 4+ subfigures in a 2-col grid
 *
 * Authors who want different behavior can split a composite figure into
 * multiple top-level figures. V1 does not expose a `layout` field.
 */
import type { Figure } from '../../adapters/non-verbal/types';

export type FigureLayout = 'single' | 'row' | 'column' | 'grid';

export function deriveLayout(fig: Figure): FigureLayout {
  const count = fig.subfigures?.length ?? 0;
  if (count === 0) return 'single';
  if (count === 1) return 'column';
  if (count === 2) return 'row';
  if (count === 3) return 'column';
  return 'grid';
}
