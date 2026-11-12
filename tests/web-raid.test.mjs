import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOSSES, createBoss, createRaid, advanceStage, availableActions, bossIntent, effectiveStats, resolveRound, turnOrder } from '../src/lib/raid.mjs';
import { SKILLS } from '../src/lib/skills.mjs';
import { seededRandom } from '../src/lib/battle.mjs';
const catalog = JSON.parse(fs.readFileSync('data/web-catalog.json')).insects;
const squad = ['ZOEC0014', 'ZOBH0002', 'ZEAA0021'].map(id => catalog.find(i => i.id === id));
const fresh = () => createRaid(squad, catalog);
const plansFor = (s, actionId = 'basic') => Object.fromEntries(s.team.filter(a => a.hp > 0).map(a => [a.key, { actionId, targetKey: a.key }]));
const noMiss = () => .99;
function bossState(index) { const s = fresh(); s.stageIndex = index; s.boss = createBoss(index, catalog); return s; }

test('ten distinct high-HP catalog insects become progressively larger bosses without changing their source stats', () => {
  assert.equal(BOSSES.length, 10); assert.equal(new Set(BOSSES.map(b => b.id)).size, 10);
  let last = 0;
  BOSSES.forEach((spec, n) => {
    const original = catalog.find(i => i.id === spec.id), boss = createBoss(n, catalog);
    assert.ok(original.stats.hp >= 137); assert.ok(boss.stats.hp >= original.stats.hp * 3);
    assert.ok(boss.hint.length > 20); assert.equal(boss.image, original.image); assert.ok(boss.stats.hp > last); last = boss.stats.hp;
    assert.notEqual(boss.stats, original.stats);
  });
  assert.throws(() => createRaid(squad.slice(0, 2), catalog));
  assert.throws(() => createRaid([squad[0], squad[0], squad[1]], catalog));
  assert.throws(() => createBoss(10, catalog));
});

test('a round requires every living ally action, rejects illegal skills and never mutates its input', () => {
  const s = fresh(), before = structuredClone(s);
  assert.throws(() => resolveRound(s, {}));
  const invalid = plansFor(s); invalid['ally-0'].actionId = 'water';
  assert.throws(() => resolveRound(s, invalid));
  const result = resolveRound(s, plansFor(s), noMiss);
  assert.deepEqual(s, before); assert.equal(result.state.round, 2);
  assert.deepEqual(result.events.map(e => e.actorKey), result.order);
  assert.ok(result.events[0].snapshot.team.every(a => a.hp >= 0));
  s.team[1].hp = 0;
  assert.doesNotThrow(() => resolveRound(s, plansFor(s), noMiss));
});

test('all four actors use descending effective speed; ties favor allies; speed buffs affect the next round', () => {
  const s = fresh(); s.team.forEach(a => a.stats.agility = 43); s.boss.stats.agility = 43;
  assert.deepEqual(turnOrder(s), ['ally-0', 'ally-1', 'ally-2', 'boss']);
  s.team[0].stats.agility = 10; s.team[1].stats.agility = 20; s.team[2].stats.agility = 30; s.boss.stats.agility = 40;
  assert.deepEqual(turnOrder(s), ['boss', 'ally-2', 'ally-1', 'ally-0']);
  s.team[2].traits = [{ id: 'jump' }];
  const p = plansFor(s); p['ally-2'].actionId = 'jump';
  const result = resolveRound(s, p, noMiss);
  assert.equal(result.order[0], 'boss'); assert.equal(turnOrder(result.state)[0], 'ally-2');
});

test('an ally knocked out before its speed slot cannot attack; complete party defeat is game over', () => {
  const s = fresh(); s.boss.stats.agility = 999; s.boss.stats.attack = 999;
  s.team[0].hp = 1;
  const out = resolveRound(s, plansFor(s), noMiss);
  assert.equal(out.state.team[0].hp, 0);
  assert.equal(out.events.find(e => e.actorKey === 'ally-0').kind, 'skip');
  s.boss = createBoss(1, catalog); s.boss.stats.agility = 999; s.boss.stats.attack = 999; s.round = 3;
  const wipe = resolveRound(s, plansFor(s), noMiss);
  assert.equal(wipe.state.status, 'gameOver'); assert.ok(wipe.state.team.every(a => a.hp === 0));
  assert.equal(wipe.events.length, 1);
});

test('boss knockout ends the round immediately, advances only on clear, and tenth victory ends the expedition', () => {
  const s = fresh(); s.team[0].stats.agility = 999; s.team[0].stats.attack = 9999;
  const result = resolveRound(s, plansFor(s), noMiss);
  assert.equal(result.state.status, 'stageClear'); assert.equal(result.state.cleared, 1);
  assert.equal(result.state.boss.hp, 0); assert.equal(result.events.length, 1);
  assert.throws(() => advanceStage(s, catalog));
  assert.throws(() => resolveRound(result.state, plansFor(result.state)));
  const final = { ...s, stageIndex: 9, boss: createBoss(9, catalog) };
  const won = resolveRound(final, plansFor(final), noMiss).state;
  assert.equal(won.status, 'victory'); assert.equal(won.cleared, 10); assert.throws(() => advanceStage(won, catalog));
});

test('manual title skills respect ownership and cooldown while all 17 skills can execute', () => {
  for (const skill of SKILLS) {
    const s = fresh(); s.team[0].traits = [{ id: skill.id }]; s.team[0].stats.agility = 999;
    s.team.forEach(a => a.hp = Math.ceil(a.stats.hp * .5));
    s.boss.hp = s.boss.stats.hp = 10000;
    const p = plansFor(s); p['ally-0'] = { actionId: skill.id, targetKey: 'ally-1' };
    const out = resolveRound(s, p, noMiss);
    assert.ok(out.events.some(e => e.actionName === skill.name), skill.id);
    const a = out.state.team[0]; assert.equal(a.readyAt[skill.id], 2 + skill.cooldown);
    assert.ok(availableActions(a, out.state).find(x => x.id === skill.id).disabled);
    assert.throws(() => resolveRound(out.state, p, noMiss));
    out.state.round = a.readyAt[skill.id];
    assert.equal(availableActions(a, out.state).find(x => x.id === skill.id).disabled, false);
  }
});

test('support can heal and shield another ally, cleanses that ally, and retargets the caster if the recipient falls', () => {
  const s = fresh(); s.team[0].traits = [{ id: 'flower' }, { id: 'survivor' }, { id: 'armor' }]; s.team[0].stats.agility = 999;
  s.team[1].hp = 40;
  const p = plansFor(s); p['ally-0'] = { actionId: 'flower', targetKey: 'ally-1' };
  const out = resolveRound(s, p, noMiss), first = out.events[0].snapshot;
  assert.equal(first.team[0].shield, 0); assert.equal(first.team[1].hp, 40 + Math.round(s.team[1].stats.hp * .22));
  assert.equal(first.team[1].shield, Math.round(s.team[1].stats.hp * .1));
  s.team[1].hp = s.team[1].stats.hp - 1; s.team[1].effects.attackDown = { value: .2, until: 2 };
  p['ally-0'].actionId = 'survivor';
  const clean = resolveRound(s, p, noMiss).events[0].snapshot;
  assert.equal(clean.team[1].hp, clean.team[1].stats.hp); assert.deepEqual(clean.team[1].effects, {});
  s.team[1].hp = 1; s.boss.stats.agility = 2000; s.boss.stats.attack = 999;
  p['ally-0'].actionId = 'armor';
  const retarget = resolveRound(s, p, noMiss).state;
  assert.equal(retarget.team[1].hp, 0); assert.ok(retarget.team[0].shield > 0);
});

test('guard reduces damage and lasts until the guarded insect next acts, shields stay capped, effects expire', () => {
  const s = fresh(); s.team[0].stats.agility = 999; s.team[0].hp = 30;
  const p = plansFor(s); p['ally-0'].actionId = 'guard';
  const guarded = resolveRound(s, p, noMiss).state, normal = resolveRound(s, plansFor(s), noMiss).state;
  assert.ok(guarded.team[0].hp > normal.team[0].hp); assert.ok(guarded.team[0].guarding);
  guarded.boss.stats.agility = 2000;
  const next = resolveRound(guarded, plansFor(guarded), noMiss);
  assert.ok(next.events[0].snapshot.team[0].guarding); assert.equal(next.state.team[0].guarding, false);
  const shielded = fresh(); shielded.team[0].traits = [{ id: 'armor' }]; shielded.team[0].stats.agility = 999; shielded.team[1].shield = shielded.team[1].stats.hp * .39;
  const shieldPlans = plansFor(shielded); shieldPlans['ally-0'] = { actionId: 'armor', targetKey: 'ally-1' };
  const cap = resolveRound(shielded, shieldPlans, noMiss).events[0].snapshot.team[1];
  assert.ok(cap.shield <= Math.round(cap.stats.hp * .4));
  const effects = fresh(); effects.team[0].effects.attackUp = { value: .2, until: 1 };
  assert.equal(resolveRound(effects, plansFor(effects), noMiss).state.team[0].effects.attackUp, undefined);
});

test('armor, camouflage, counter, regeneration and tracking bosses activate their distinct mechanics', () => {
  const armored = bossState(0); armored.boss.stats.agility = 1;
  const unarmored = structuredClone(armored); unarmored.round = 2;
  const firstDamage = s => s.boss.hp - resolveRound(s, plansFor(s), noMiss).events[0].snapshot.boss.hp;
  assert.ok(firstDamage(armored) < firstDamage(unarmored));
  const hidden = bossState(2); assert.equal(effectiveStats(hidden.boss, hidden).evasion, 35); hidden.round = 2; assert.equal(effectiveStats(hidden.boss, hidden).evasion, 5);
  const counter = bossState(3); counter.round = 3; counter.team[0].stats.agility = 999;
  const reflected = resolveRound(counter, plansFor(counter), noMiss).events[0].snapshot;
  assert.equal(reflected.team[0].hp, counter.team[0].hp - 7);
  const regen = bossState(4); regen.round = 3; regen.boss.hp -= 100; regen.boss.stats.agility = 999;
  assert.equal(bossIntent(regen).heal, true); const regenerated = resolveRound(regen, plansFor(regen), noMiss).events[0].snapshot;
  assert.equal(regenerated.boss.hp, regen.boss.hp + Math.round(regen.boss.stats.hp * .08));
  const tracker = bossState(5); tracker.round = 3; tracker.team[2].hp = 1;
  assert.equal(bossIntent(tracker).targetKey, 'ally-2'); assert.ok(bossIntent(tracker).sureHit);
});

test('jump and shield bosses hit all allies, haste changes order, and low-health rage changes stats', () => {
  for (const index of [1, 6]) {
    const s = bossState(index); s.round = 3; s.boss.stats.agility = 999;
    assert.equal(bossIntent(s).all, true);
    const event = resolveRound(s, plansFor(s), noMiss).events[0];
    assert.ok(event.snapshot.team.every((a, n) => a.hp < s.team[n].hp));
    if (index === 6) assert.ok(event.snapshot.boss.shield > 0);
  }
  const speed = bossState(7), normal = effectiveStats(speed.boss, speed).agility;
  speed.round = 2; assert.ok(effectiveStats(speed.boss, speed).agility > normal);
  for (const n of [8, 9]) { const s = bossState(n), attack = effectiveStats(s.boss, s).attack; s.boss.hp = Math.floor(s.boss.stats.hp / 2); assert.ok(effectiveStats(s.boss, s).attack > attack); }
});

test('next stage restores survivors, revives KO allies and clears effects, guards, shields and cooldowns', () => {
  const s = fresh(); s.status = 'stageClear'; s.cleared = 1; s.boss.hp = 0;
  s.team[0].hp = 0; s.team[1].hp = 1; s.team[2].hp = s.team[2].stats.hp;
  s.team.forEach(a => { a.shield = 10; a.guarding = true; a.readyAt.hunter = 9; a.effects.attackDown = { value: .2, until: 9 }; });
  const next = advanceStage(s, catalog);
  assert.equal(next.stageIndex, 1); assert.equal(next.round, 1); assert.equal(next.status, 'planning');
  assert.equal(next.team[0].hp, Math.ceil(s.team[0].stats.hp * .5));
  assert.equal(next.team[1].hp, 1 + Math.ceil(s.team[1].stats.hp * .4));
  assert.equal(next.team[2].hp, next.team[2].stats.hp);
  for (const a of next.team) { assert.equal(a.shield, 0); assert.equal(a.guarding, false); assert.deepEqual(a.effects, {}); assert.deepEqual(a.readyAt, {}); }
  assert.equal(s.team[0].hp, 0);
});

test('a real three-insect team can clear all ten bosses with manually chosen support and attacks across seeded runs', () => {
  for (let seed = 0; seed < 10; seed++) {
    let s = fresh(); const rng = seededRandom(seed);
    for (let n = 0; n < 250 && !['victory', 'gameOver'].includes(s.status); n++) {
      if (s.status === 'stageClear') s = advanceStage(s, catalog);
      const plans = {};
      for (const a of s.team.filter(a => a.hp > 0)) {
        const actions = availableActions(a, s).filter(x => !x.disabled), low = [...s.team].filter(a => a.hp > 0).sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp)[0];
        const action = actions.find(x => x.healing && low.hp / low.stats.hp < .6) || actions.find(x => x.barrier && !low.shield && low.hp / low.stats.hp < .7) || actions.find(x => x.power >= 1.25) || actions.find(x => x.id === 'explorer') || actions[0];
        plans[a.key] = { actionId: action.id, targetKey: action.target === 'ally' ? low.key : 'boss' };
      }
      s = resolveRound(s, plans, rng).state;
      s.team.forEach(a => { assert.ok(a.hp >= 0 && a.hp <= a.stats.hp); assert.ok(a.shield >= 0 && a.shield <= Math.round(a.stats.hp * .4)); });
    }
    assert.equal(s.status, 'victory', `seed ${seed}`); assert.equal(s.cleared, 10);
  }
});
