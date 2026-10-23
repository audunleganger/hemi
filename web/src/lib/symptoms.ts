import type { SymptomDto } from '../api/types.gen'

/** A warning sign's symptom names, in the user's order (WS-2). */
export function symptomNames(ids: number[], symptoms: SymptomDto[] | undefined): string[] {
  return (symptoms ?? []).filter((s) => ids.includes(s.id)).map((s) => s.name)
}
