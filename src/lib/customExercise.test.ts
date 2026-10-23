import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customId, draftProblem, makeCustomExercise } from './customExercise';

test('drafts explain what is missing', () => {
  const d = { name: '', equipment: null, primary: [], secondary: [] };
  assert.equal(draftProblem(d, []), 'Give it a name.');
  assert.equal(draftProblem({ ...d, name: 'Landmine Press' }, ['landmine press']), 'You already have an exercise with that name.');
  assert.equal(draftProblem({ ...d, name: 'Landmine Press' }, []), 'Pick the equipment it uses.');
  assert.equal(draftProblem({ ...d, name: 'Landmine Press', equipment: 'barbell' }, []), 'Pick at least one main muscle.');
  assert.equal(draftProblem({ ...d, name: 'Landmine Press', equipment: 'barbell', primary: ['shoulders'] }, []), null);
});

test('custom exercises get unique ids and sensible flags', () => {
  assert.equal(customId('Landmine Press!', []), 'custom-landmine-press');
  assert.equal(customId('Landmine Press', ['custom-landmine-press']), 'custom-landmine-press-2');
  const e = makeCustomExercise({ name: '  Landmine   Press ', equipment: 'barbell', primary: ['shoulders'], secondary: ['triceps', 'shoulders'] }, []);
  assert.deepEqual(e, {
    id: 'custom-landmine-press', name: 'Landmine Press', equipment: 'barbell',
    primary: ['shoulders'], secondary: ['triceps'], compound: true, custom: true,
  });
  assert.equal(makeCustomExercise({ name: 'Wrist Curl', equipment: 'dumbbell', primary: ['biceps'], secondary: [] }, []).compound, false);
});
