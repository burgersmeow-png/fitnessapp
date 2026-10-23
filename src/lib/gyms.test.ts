import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeGym, addGym, cleanGyms, MAX_GYMS, removeGym, renameGym, switchGym, withEquipment } from './gyms';

test('nothing stored means one gym with your current equipment', () => {
  const g = cleanGyms(null, ['barbell', 'dumbbell']);
  assert.deepEqual(g, { active: 'gym-1', list: [{ id: 'gym-1', name: 'My gym', equipment: ['barbell', 'dumbbell'] }] });
});

test('stored gyms are cleaned and the active one follows Settings', () => {
  const g = cleanGyms(
    {
      active: 'b',
      list: [
        { id: 'a', name: '  Big   box  ', equipment: ['machine', 'laser'] },
        { id: 'a', name: 'dupe', equipment: ['barbell'] },
        { id: 'b', name: '', equipment: ['bands'] },
        { id: 'c', name: 'Empty', equipment: [] },
      ],
    },
    ['dumbbell', 'bodyweight'],
  );
  assert.deepEqual(g.list.map((x) => [x.id, x.name, x.equipment]), [
    ['a', 'Big box', ['machine']],
    ['b', 'Gym 2', ['dumbbell', 'bodyweight']],
  ]);
  assert.equal(cleanGyms({ active: 'zzz', list: g.list }, ['bands']).active, 'a');
});

test('adding names the first extra gym Home, makes it active, and stops at the limit', () => {
  let g = addGym(cleanGyms(null, ['barbell']))!;
  assert.equal(activeGym(g).name, 'Home');
  assert.deepEqual(activeGym(g).equipment, ['dumbbell', 'bodyweight', 'bands']);
  g = addGym(g, 'Hotel')!;
  assert.equal(activeGym(g).name, 'Hotel');
  g = addGym(g)!;
  assert.equal(g.list.length, MAX_GYMS);
  assert.equal(addGym(g), null);
});

test('switch, rename, edit equipment and remove', () => {
  let g = addGym(cleanGyms(null, ['barbell']))!;
  g = switchGym(g, 'gym-1');
  assert.equal(activeGym(g).name, 'My gym');
  g = withEquipment(g, ['cable']);
  assert.deepEqual(g.list[0].equipment, ['cable']);
  assert.deepEqual(withEquipment(g, []), g);
  g = renameGym(g, 'gym-2', '   ');
  assert.equal(g.list[1].name, 'Home');
  g = renameGym(g, 'gym-2', 'Garage');
  g = removeGym(g, 'gym-1');
  assert.deepEqual([g.active, g.list.length], ['gym-2', 1]);
  assert.equal(removeGym(g, 'gym-2').list.length, 1);
  assert.equal(addGym(g)!.list[1].id, 'gym-3');
});
