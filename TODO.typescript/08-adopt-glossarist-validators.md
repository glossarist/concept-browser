# 08 — [BLOCKED] Adopt glossarist/validators

**Priority:** P2
**Status:** BLOCKED on TODO 04
**Estimated effort:** medium

## Context

glossarist-js ships a validator framework at `glossarist/validators` with rules for language codes, designation types, entry status, relationship types, ref shapes, locality completeness, etc. concept-browser currently relies on glossarist@0.4.34's `validateConcept`/`validateRegister` from the main entry, which may have fewer rules.

## Scope

- Audit current validation usage in concept-browser (if any beyond the CLI `doctor` command)
- Compare against `glossarist/validators` rule list
- Adopt upstream validators where they provide more coverage
- Wire into the `doctor` CLI command and any CI gates

## Acceptance criteria

- [ ] All upstream validator rules available to the `doctor` command
- [ ] CI gate uses upstream validators (if desired)
