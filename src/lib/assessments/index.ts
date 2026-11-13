import type { AssessmentDef } from './types';
import { UNIT_1 } from './unit1';

// Every Symbolic Grammar assessment the scoring tool knows. Add the next unit here.
export const ASSESSMENTS: AssessmentDef[] = [UNIT_1];

export function getAssessment(id: string): AssessmentDef {
  return ASSESSMENTS.find((a) => a.id === id) ?? ASSESSMENTS[0];
}

export * from './types';
export * from './scoring';
