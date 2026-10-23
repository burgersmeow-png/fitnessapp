// Workouts people keep from shared links, to do again later. Pure.
import { encodeWorkoutLink, type WorkoutLink } from './workoutLink';

export interface SavedWorkout {
  /** The encoded link, which doubles as the id: the same workout saved twice is one entry. */
  id: string;
  title: string;
  lifts: number;
  sets: number;
  savedAt: string;
}

export const MAX_SAVED = 30;

export function saveWorkout(list: SavedWorkout[], link: WorkoutLink, now = new Date()): SavedWorkout[] {
  const id = encodeWorkoutLink(link);
  const entry: SavedWorkout = { id, title: link.title, lifts: link.lifts.length, sets: link.lifts.reduce((n, l) => n + l.sets, 0), savedAt: now.toISOString() };
  return [entry, ...list.filter((s) => s.id !== id)].slice(0, MAX_SAVED);
}

export const removeSaved = (list: SavedWorkout[], id: string) => list.filter((s) => s.id !== id);

export const isSaved = (list: SavedWorkout[], link: WorkoutLink) => list.some((s) => s.id === encodeWorkoutLink(link));
