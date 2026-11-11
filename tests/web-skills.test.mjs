import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TITLES } from '../src/lib/profiles.mjs';
import { SKILLS, SKILL_MAP, skillsFor } from '../src/lib/skills.mjs';
import { simulateBattle, seededRandom, describeEvent } from '../src/lib/battle.mjs';
const fighter = (id, titles = [], stats = {}) => ({ id, name: id, traits: titles.map(id => ({ id })), stats: { hp: 1000, attack: 20, defense: 10, agility: 50, evasion: 5, ...stats } });
const run = (ids, target = fighter('target'), random = () => .5) => simulateBattle(fighter('actor', ids), target, random);
const firstUse = (result, id) => result.events.find(e => e.actor === 0 && e.skillId === id);

test('every title supplies one unique, documented ability; no duplicate or unowned abilities', () => {
  assert.deepEqual(SKILLS.map(s => s.id), TITLES.map(t => t.id));
  assert.equal(new Set(SKILLS.map(s => s.name)).size, TITLES.length);
  for (const s of SKILLS) { assert.ok(s.description.length > 15); assert.ok(s.cooldown >= 3); assert.ok(s.title); }
  assert.deepEqual(skillsFor(fighter('a', ['flight', 'flight', 'unknown', 'explorer'])).map(s => s.id), ['flight', 'explorer']);
  assert.deepEqual(skillsFor(null), []);
});

test('all 17 abilities can activate and their descriptions are emitted in the battle record', () => {
  const seen = new Set();
  for (const skill of SKILLS) {
    const result = run([skill.id], fighter('target', [], { attack: 50 }));
    const event = firstUse(result, skill.id);
    assert.ok(event, `ability never activates: ${skill.id}`);
    assert.match(describeEvent(event, [fighter('actor'), fighter('target')]), new RegExp(skill.name));
    seen.add(event.skillId);
  }
  assert.equal(seen.size, 17);
});

test('shield absorbs HP damage, persists until spent, and never exceeds 40% of maximum HP', () => {
  const result = run(['armor']);
  const cast = firstUse(result, 'armor');
  assert.equal(cast.shieldGained, 300);
  assert.equal(cast.damage, 0);
  const castIndex = result.events.indexOf(cast);
  const hitIndex = result.events.findIndex((e, n) => n > castIndex && e.target === 0 && e.rawDamage > 0);
  const hit = result.events[hitIndex];
  assert.ok(hit.absorbed > 0);
  assert.equal(hit.damage, 0);
  assert.equal(hit.hp[0], result.events[hitIndex - 1].hp[0]);
  for (const e of result.events) assert.ok(e.state[0].shield >= 0 && e.state[0].shield <= 400);
});

test('heals require low health, cap at maximum HP, and life drain uses actual HP damage', () => {
  for (const id of ['survivor', 'flower']) {
    const r = run([id], fighter('target', [], { attack: 100 }));
    const index = r.events.findIndex(e => e.actor === 0 && e.skillId === id);
    const e = r.events[index], previous = r.events[index - 1].hp[0];
    assert.ok(previous <= 1000 * SKILL_MAP[id].healthBelow);
    assert.ok(e.heal > 0);
    assert.equal(e.heal, Math.min(Math.round(1000 * SKILL_MAP[id].healing), 1000 - previous));
    assert.ok(e.hp[0] <= 1000);
  }
  const r = run(['recycler'], fighter('target', ['armor'], { hp: 100, attack: 50, agility: 100 }));
  assert.ok(r.events.some(e => e.skillId === 'recycler' && e.heal > 0));
  for (const e of r.events.filter(e => e.skillId === 'recycler')) {
    assert.ok(e.heal <= Math.round(e.damage * .65));
    if (e.damage === 0) assert.equal(e.heal, 0);
  }
});

test('sure-hit defeats evasion while normal attacks miss; piercing increases damage against armor', () => {
  const evasive = fighter('target', [], { evasion: 80 });
  const precision = run(['precision'], evasive);
  assert.ok(precision.events.filter(e => e.skillId === 'precision').every(e => !e.dodge && e.rawDamage > 0));
  assert.ok(precision.events.some(e => e.actor === 0 && e.kind === 'basic' && e.dodge));
  const tank = fighter('tank', [], { defense: 60 });
  const basic = run([], tank).events.find(e => e.actor === 0);
  const tiny = firstUse(run(['tiny'], tank), 'tiny');
  assert.ok(tiny.rawDamage > basic.rawDamage);
});

test('hit effects change attack, accuracy and incoming damage; missed skills do not apply debuffs', () => {
  const weakened = run(['night']);
  const attack = weakened.events.find(e => e.actor === 1 && e.round === 2);
  const baseline = run([]).events.find(e => e.actor === 1 && e.round === 2);
  assert.ok(attack.rawDamage < baseline.rawDamage);
  const exposed = run(['sense']);
  assert.ok(exposed.events.find(e => e.actor === 0 && e.round === 2).rawDamage > run([]).events.find(e => e.actor === 0 && e.round === 2).rawDamage);
  const debuffMiss = run(['pattern'], fighter('target', [], { evasion: 80 }));
  const miss = firstUse(debuffMiss, 'pattern');
  assert.equal(miss.dodge, true);
  assert.deepEqual(miss.applied, []);
  const pattern = run(['pattern'], fighter('target'), () => .2);
  assert.ok(pattern.events.some(e => e.actor === 1 && e.dodge));
});

test('agility skills change next-round initiative, effects expire, and evasion buff works', () => {
  const jump = run(['jump'], fighter('target'), () => .55);
  assert.equal(jump.events.find(e => e.round === 1).actor, 1);
  assert.equal(jump.events.find(e => e.round === 2).actor, 0);
  assert.equal(jump.events.find(e => e.round === 3).actor, 1);
  const wing = run(['wing'], fighter('target'), () => .55);
  assert.equal(wing.events.find(e => e.round === 2).actor, 0);
  const flight = run(['flight'], fighter('target'), () => .2);
  assert.ok(flight.events.some(e => e.actor === 1 && e.dodge));
  const first = firstUse(flight, 'flight');
  assert.equal(first.state[0].effects.find(e => e.id === 'evasionUp').rounds, 2);
  assert.ok(!flight.events.find(e => e.round === 3).state[0].effects.some(e => e.id === 'evasionUp'));
});

test('survival skill cleanses negative status effects', () => {
  const a = fighter('actor', ['survivor']);
  const b = fighter('target', ['pattern', 'night'], { attack: 100 });
  const r = simulateBattle(a, b, () => .5);
  const cleansed = r.events.find(e => e.skillId === 'survivor' && e.cleansed.length);
  assert.ok(cleansed);
  assert.ok(cleansed.cleansed.includes('accuracyDown') || cleansed.cleansed.includes('attackDown'));
  assert.ok(cleansed.state[0].effects.every(e => !['accuracyDown', 'attackDown'].includes(e.id)));
});

test('cooldowns, mandatory basic attacks and per-match state resets hold over real catalog matches', () => {
  const catalog = JSON.parse(readFileSync('data/web-catalog.json')).insects;
  for (let seed = 0; seed < 200; seed++) {
    const pair = [catalog[seed % catalog.length], catalog[(seed + 200) % catalog.length]];
    const before = JSON.stringify(pair);
    const result = simulateBattle(...pair, seededRandom(seed));
    for (const actor of [0, 1]) {
      const actions = result.events.filter(e => e.actor === actor), last = {};
      for (let n = 0; n < actions.length; n++) {
        const e = actions[n];
        if (!e.skillId) continue;
        assert.ok(pair[actor].traits.some(t => t.id === e.skillId), 'cannot cast another title');
        if (n) assert.equal(actions[n - 1].kind, 'basic', 'skills cannot be used on consecutive own turns');
        if (last[e.skillId] !== undefined) assert.ok(n - last[e.skillId] >= SKILL_MAP[e.skillId].cooldown + 1);
        last[e.skillId] = n;
      }
    }
    assert.equal(JSON.stringify(pair), before, 'the source profile must not mutate');
    assert.deepEqual(simulateBattle(...pair, seededRandom(seed)), result, 'a rematch starts with clean skill state');
  }
});
