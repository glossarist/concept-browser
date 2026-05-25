export function createHash() {
  return { update: () => ({ digest: () => '' }) };
}
export function randomUUID() {
  return crypto.randomUUID();
}
