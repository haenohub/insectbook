import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProfile, STAT_META, TITLE_MAP } from '../src/lib/profiles.mjs';
import { filterInsects, sortInsects } from '../src/lib/search.mjs';
import { randomPair, seededRandom, simulateBattle } from '../src/lib/battle.mjs';
const source = JSON.parse(fs.readFileSync('data/insects.json')).insects;
const data = JSON.parse(fs.readFileSync('data/web-catalog.json'));
const insects = data.insects;
const byId = Object.fromEntries(insects.map(i => [i.id, i]));

test('catalog contains every available drawing, excludes pending and blocked records, preserves files', () => {
  const actual = source.filter(r => ['generated', 'approved'].includes(r.illustration.status) && r.illustration.reference_review_status !== 'blocked');
  assert.deepEqual(insects.map(i => i.id), actual.map(i => i.id));
  assert.equal(new Set(insects.map(i => i.id)).size, insects.length);
  for (const i of insects) {
    assert.ok(fs.existsSync('.' + i.image), i.id);
    assert.ok(i.traits.length >= 2, `${i.name} needs multiple titles`);
    assert.equal(new Set(i.traits.map(t => t.id)).size, i.traits.length);
    for (const t of i.traits) { assert.ok(TITLE_MAP[t.id]); assert.ok(t.reason.length > 8); }
    for (const s of STAT_META) assert.ok(Number.isFinite(i.stats[s.key]) && i.stats[s.key] > 0 && i.stats[s.key] <= s.max, `${i.id} ${s.key}`);
  }
});

test('titles use source context, not misleading name substrings', () => {
  assert.ok(byId.ZDAN0003.traits.some(t => t.id === 'survivor' && t.basis === 'source'));
  assert.ok(byId.ZDAN0003.traits.some(t => t.id === 'camouflage'));
  const moth = insects.find(i => i.name === '꿀벌부채명나방');
  assert.ok(moth);
  assert.ok(!moth.traits.some(t => t.id === 'flower'));
  const fake = { ...source[0], family_ko: '시험과', taxonomy: { order: { name_ko: '기타' }, genus: {} }, information: { general_description: '날개에 꽃무늬가 있다.', ecology: '낮에 활동한다.' } };
  const p = createProfile(fake);
  assert.ok(!p.traits.some(t => ['flower', 'night', 'survivor'].includes(t.id)));
});

test('size extraction converts centimeters and does not confuse wingspan with body length', () => {
  const fixture = structuredClone(source[0]);
  fixture.information.general_description = '날개편 길이는 99mm이다. 몸길이는 1.2~1.8 cm이다.';
  assert.equal(createProfile(fixture).size, 15);
  fixture.information.general_description = '날개편 길이는 99mm이다.';
  assert.equal(createProfile(fixture).size, null);
});

test('search supports Korean and Latin name, family, genus, titles and combined words', () => {
  assert.ok(filterInsects(insects, { query: '넓적사슴벌레', scope: 'name' }).some(i => i.id === 'ZOEC0014'));
  assert.ok(filterInsects(insects, { query: '흰나비과', scope: 'family' }).some(i => i.id === 'ZRED0008'));
  assert.ok(filterInsects(insects, { query: '  INDolestes  ', scope: 'genus' }).some(i => i.id === 'ZDAN0003'));
  assert.ok(filterInsects(insects, { query: '가는실잠자리속', scope: 'genus' }).some(i => i.id === 'ZDAN0003'));
  const flight = filterInsects(insects, { query: '비행의 대가' });
  assert.equal(flight.length, data.titleCounts.flight);
  assert.equal(filterInsects(insects, { query: '비행의대가' }).length, flight.length);
  assert.ok(filterInsects(insects, { query: '사슴벌레과 갑옷 전사' }).length > 0);
  assert.equal(filterInsects(insects, { query: 'zzzz없는곤충999' }).length, 0);
});

test('title filters intersect, taxonomy and favorites compose, sorting does not mutate source', () => {
  const filtered = filterInsects(insects, { titles: ['flight', 'survivor'], family: byId.ZDAN0003.family, genus: 'Indolestes', favorites: ['ZDAN0003'] });
  assert.deepEqual(filtered.map(i => i.id), ['ZDAN0003']);
  assert.equal(filterInsects(insects, { favorites: [] }).length, 0);
  for (const key of ['hp', 'attack', 'agility']) {
    const sorted = sortInsects(insects, key);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1].stats[key] >= sorted[i].stats[key]);
  }
  assert.equal(insects[0].id, 'ZMAJ0111');
});

test('random matching never produces duplicate or missing fighters', () => {
  for (let seed = 0; seed < 500; seed++) {
    const pair = randomPair(insects, seededRandom(seed));
    assert.equal(pair.length, 2); assert.notEqual(pair[0].id, pair[1].id);
  }
  assert.throws(() => randomPair([insects[0]]));
  assert.throws(() => simulateBattle(insects[0], insects[0]));
});

test('battles are reproducible, terminate, respect HP and never attack after a KO', () => {
  const a = byId.ZOEC0014, b = byId.ZDAP0009;
  assert.deepEqual(simulateBattle(a, b, seededRandom(42)), simulateBattle(a, b, seededRandom(42)));
  for (let seed = 0; seed < 300; seed++) {
    const pair = randomPair(insects, seededRandom(seed));
    const result = simulateBattle(...pair, seededRandom(seed + 918));
    assert.ok(result.events.length > 0 && result.events.length <= 80);
    let hp = pair.map(i => i.stats.hp);
    for (const e of result.events) {
      assert.ok(hp.every(n => n > 0), 'no turn after a KO');
      assert.equal(e.hp[e.actor], hp[e.actor]);
      assert.equal(e.hp[e.target], hp[e.target] - e.damage);
      assert.ok(e.hp.every(n => n >= 0));
      assert.equal(e.dodge, e.damage === 0);
      hp = e.hp;
    }
    assert.deepEqual(result.hp, hp);
    if (!result.limitReached) assert.equal(hp[1 - result.winner], 0);
  }
});

test('agility changes first-move probability; higher evasion actually avoids hits', () => {
  const slow = { ...byId.ZRED0008, id: 'slow', stats: { hp: 160, attack: 20, defense: 12, agility: 25, evasion: 5 } };
  const fast = { ...byId.ZRED0008, id: 'fast', stats: { hp: 160, attack: 20, defense: 12, agility: 96, evasion: 32 } };
  let fastFirst = 0, fastDodge = 0, slowDodge = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const r = simulateBattle(slow, fast, seededRandom(seed));
    if (r.events[0].actor === 1) fastFirst++;
    for (const e of r.events) if (e.dodge) { if (e.target === 1) fastDodge++; else slowDodge++; }
  }
  assert.ok(fastFirst > 650 && fastFirst < 900, fastFirst);
  assert.ok(fastDodge > slowDodge * 2);
});

test('forty-round cap produces a draw when every attack is avoided', () => {
  const r = simulateBattle(byId.ZOEC0014, byId.ZRED0008, () => 0);
  assert.equal(r.rounds, 40); assert.equal(r.events.length, 80); assert.equal(r.winner, null);
  assert.equal(r.limitReached, true);
  assert.deepEqual(r.hp, [byId.ZOEC0014.stats.hp, byId.ZRED0008.stats.hp]);
});

test('project-site asset paths preserve the deployment prefix and external URLs', async () => {
  const { assetUrl } = await import('../src/lib/asset-url.mjs');
  assert.equal(assetUrl('/assets/web-illustrations/ZRED0008.webp', '/insectbook/'), '/insectbook/assets/web-illustrations/ZRED0008.webp');
  assert.equal(assetUrl('data/insects/ZRED0008.json', '/insectbook/'), '/insectbook/data/insects/ZRED0008.json');
  assert.equal(assetUrl('/favicon.svg', '/'), '/favicon.svg');
  assert.equal(assetUrl('assets/a.webp', '/insectbook'), '/insectbook/assets/a.webp');
  assert.equal(assetUrl('https://www.nature.go.kr/photo.jpg', '/insectbook/'), 'https://www.nature.go.kr/photo.jpg');
});
