// The Symbolic Grammar Engine (its own repository, installed as a package) (her request 2026-11-13: one engine for every project).
import { formulaCode as engineCode } from 'symbolic-grammar-engine/src/writer/formulaMatch';
export * from 'symbolic-grammar-engine/src/writer/formulaMatch';

// Her master list (2026-11-17) codes a phrase naming a place, day or month as PRP like any prepositional phrase
// ("Luna lives in Texas." = S1.PN.PRP); the engine's earlier working code for it was R.
export function formulaCode(...args: Parameters<typeof engineCode>): string {
  return engineCode(...args).replace(/(^|[.([,;])R(?=$|[.)\],;'])/g, '$1PRP');
}
