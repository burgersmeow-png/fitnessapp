// Gym profiles: named sets of equipment ("Home", "Work gym") to switch between. Pure.
// Settings.equipment stays what the planner reads; switching a gym copies its equipment there.
import { ALL_EQUIPMENT, type Equipment } from './types';

export interface Gym {
  id: string;
  name: string;
  equipment: Equipment[];
}

export interface Gyms {
  active: string;
  list: Gym[];
}

export const MAX_GYMS = 4;
export const GYM_NAME_MAX = 20;

/** A starting point for a second place to train: what most homes and hotels have. */
export const HOME_EQUIPMENT: Equipment[] = ['dumbbell', 'bodyweight', 'bands'];

const cleanEquipment = (raw: unknown): Equipment[] =>
  Array.isArray(raw) ? ALL_EQUIPMENT.filter((e) => raw.includes(e)) : [];

export function cleanName(raw: unknown, fallback: string): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, GYM_NAME_MAX) : '';
  return name || fallback;
}

/**
 * Reads the stored record. With nothing stored there is one gym holding today's equipment,
 * and the active gym always matches `current`, since Settings is the source of truth.
 */
export function cleanGyms(raw: unknown, current: Equipment[]): Gyms {
  const r = (raw ?? {}) as { active?: unknown; list?: unknown };
  const seen = new Set<string>();
  const list: Gym[] = [];
  for (const g of Array.isArray(r.list) ? r.list : []) {
    const id = typeof g?.id === 'string' ? g.id : '';
    const equipment = cleanEquipment(g?.equipment);
    if (!id || seen.has(id) || equipment.length === 0 || list.length >= MAX_GYMS) continue;
    seen.add(id);
    list.push({ id, name: cleanName(g.name, `Gym ${list.length + 1}`), equipment });
  }
  if (list.length === 0) list.push({ id: 'gym-1', name: 'My gym', equipment: [...current] });
  const active = list.some((g) => g.id === r.active) ? (r.active as string) : list[0].id;
  return withEquipment({ active, list }, current);
}

export const activeGym = (g: Gyms): Gym => g.list.find((x) => x.id === g.active) ?? g.list[0];

/** Edits to equipment in Settings land on the gym you're at. */
export function withEquipment(g: Gyms, equipment: Equipment[]): Gyms {
  const clean = cleanEquipment(equipment);
  if (clean.length === 0) return g;
  return { ...g, list: g.list.map((x) => (x.id === g.active ? { ...x, equipment: clean } : x)) };
}

/** Adds a gym and makes it the active one. null when the list is full. */
export function addGym(g: Gyms, name?: string): Gyms | null {
  if (g.list.length >= MAX_GYMS) return null;
  let n = g.list.length + 1;
  while (g.list.some((x) => x.id === `gym-${n}`)) n++;
  const id = `gym-${n}`;
  const fallback = g.list.some((x) => x.name.toLowerCase() === 'home') ? `Gym ${g.list.length + 1}` : 'Home';
  return { active: id, list: [...g.list, { id, name: cleanName(name, fallback), equipment: [...HOME_EQUIPMENT] }] };
}

export function renameGym(g: Gyms, id: string, name: string): Gyms {
  return { ...g, list: g.list.map((x) => (x.id === id ? { ...x, name: cleanName(name, x.name) } : x)) };
}

/** The last gym can't go. Removing the active one moves you to the first left. */
export function removeGym(g: Gyms, id: string): Gyms {
  if (g.list.length <= 1) return g;
  const list = g.list.filter((x) => x.id !== id);
  return { active: list.some((x) => x.id === g.active) ? g.active : list[0].id, list };
}

export function switchGym(g: Gyms, id: string): Gyms {
  return g.list.some((x) => x.id === id) ? { ...g, active: id } : g;
}
