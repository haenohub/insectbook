export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function randomPair(insects, random = Math.random) {
  if (insects.length < 2) throw new Error('서로 다른 곤충 두 마리가 필요합니다.');
  const first = Math.min(insects.length - 1, Math.floor(random() * insects.length));
  const offset = Math.min(insects.length - 2, Math.floor(random() * (insects.length - 1)));
  const second = offset >= first ? offset + 1 : offset;
  return [insects[first], insects[second]];
}
export function simulateBattle(left, right, random = Math.random) {
  if (!left || !right || left.id === right.id) throw new Error('서로 다른 곤충을 선택해 주세요.');
  const fighters = [left, right], hp = fighters.map(i => i.stats.hp), events = [];
  let rounds = 0;
  for (let round = 1; round <= 40 && hp.every(n => n > 0); round++) {
    rounds = round;
    const first = random() < left.stats.agility / (left.stats.agility + right.stats.agility) ? 0 : 1;
    for (const actor of [first, 1 - first]) {
      const target = 1 - actor;
      if (hp[actor] <= 0 || hp[target] <= 0) break;
      const dodge = random() < fighters[target].stats.evasion / 100;
      const critical = !dodge && random() < 0.1;
      const raw = dodge ? 0 : Math.max(5, Math.round((fighters[actor].stats.attack * (0.9 + random() * 0.25) - fighters[target].stats.defense * 0.42) * (critical ? 1.5 : 1)));
      const damage = Math.min(raw, hp[target]);
      hp[target] = Math.max(0, hp[target] - damage);
      events.push({ round, actor, target, dodge, critical, damage, hp: [...hp] });
    }
  }
  const ratios = hp.map((n, k) => n / fighters[k].stats.hp);
  const winner = hp[0] <= 0 ? 1 : hp[1] <= 0 ? 0 : Math.abs(ratios[0] - ratios[1]) < 0.000001 ? null : ratios[0] > ratios[1] ? 0 : 1;
  return { events, winner, rounds, hp: [...hp], limitReached: hp.every(n => n > 0) };
}
