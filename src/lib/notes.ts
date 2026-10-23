// Personal notes per lift, like "seat on 4" or "close grip". Pure.

export type LiftNotes = Record<string, string>;

export const NOTE_MAX = 140;

/** Sets or clears one lift's note; blank text removes it. */
export function setNote(notes: LiftNotes, exerciseId: string, text: string): LiftNotes {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
  const { [exerciseId]: _old, ...rest } = notes;
  return clean ? { ...rest, [exerciseId]: clean } : rest;
}
