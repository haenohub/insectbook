import { skillsFor, SKILL_MAP, EFFECT_LABELS, NEGATIVE_EFFECTS } from './skills.mjs';

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
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function simulateBattle(left, right, random = Math.random) {
  if (!left || !right || left.id === right.id) throw new Error('서로 다른 곤충을 선택해 주세요.');
  const fighters = [left, right], hp = fighters.map(i => i.stats.hp), events = [];
  const state = fighters.map(i => ({ skills: skillsFor(i), effects: {}, shield: 0, turns: 0, readyAt: {}, used: {}, nextSkillTurn: 1 }));
  let rounds = 0;
  const value = (index, key) => state[index].effects[key]?.value || 0;
  const agility = index => fighters[index].stats.agility * (1 + value(index, 'agilityUp')) * (1 - value(index, 'agilityDown'));
  const snapshot = round => state.map(s => ({
    shield: s.shield,
    effects: Object.entries(s.effects).map(([id, e]) => ({ id, label: EFFECT_LABELS[id], value: e.value, rounds: e.until - round + 1 })),
    cooldowns: Object.fromEntries(s.skills.map(skill => [skill.id, Math.max(0, (s.readyAt[skill.id] || 0) - s.turns - 1)])),
    skillReady: s.turns + 1 >= s.nextSkillTurn,
  }));
  function chooseSkill(index) {
    const s = state[index];
    if (s.turns < s.nextSkillTurn) return null;
    const available = s.skills.filter(skill => {
      if (s.turns < (s.readyAt[skill.id] || 0)) return false;
      if (skill.healthBelow && hp[index] / fighters[index].stats.hp > skill.healthBelow) return false;
      if (skill.id === 'armor' && s.shield >= Math.round(fighters[index].stats.hp * .15)) return false;
      return true;
    });
    // Prefer healing when hurt, rotate the title's own skills, then use the shared fallback.
    const unique = available.filter(skill => skill.id !== 'explorer');
    const pool = unique.length ? unique : available;
    const ranked = [...pool].sort((a, b) => {
      const score = skill => (hp[index] / fighters[index].stats.hp < .55 && (skill.healing || skill.drain) ? 100 : 0) - (s.used[skill.id] || 0) * 10;
      return score(b) - score(a);
    });
    return ranked[0] || null;
  }
  for (let round = 1; round <= 40 && hp.every(n => n > 0); round++) {
    rounds = round;
    for (const s of state) for (const [id, effect] of Object.entries(s.effects)) if (effect.until < round) delete s.effects[id];
    const first = random() < agility(0) / (agility(0) + agility(1)) ? 0 : 1;
    for (const actor of [first, 1 - first]) {
      const target = 1 - actor;
      if (hp[actor] <= 0 || hp[target] <= 0) break;
      const own = state[actor], other = state[target];
      own.turns++;
      const skill = chooseSkill(actor);
      const action = skill || { power: 1 };
      const event = { round, actor, target, kind: skill ? 'skill' : 'basic', skillId: skill?.id || null, dodge: false, critical: false, rawDamage: 0, absorbed: 0, damage: 0, heal: 0, shieldGained: 0, cleansed: [], applied: [] };
      if (skill) {
        own.readyAt[skill.id] = own.turns + skill.cooldown + 1;
        own.nextSkillTurn = own.turns + 2;
        own.used[skill.id] = (own.used[skill.id] || 0) + 1;
      }
      if (action.cleanse) {
        for (const id of NEGATIVE_EFFECTS) if (own.effects[id]) { event.cleansed.push(id); delete own.effects[id]; }
      }
      const apply = (index, effects) => {
        for (const [id, amount] of Object.entries(effects || {})) {
          // Reapplying refreshes duration and keeps the stronger value; it never stacks.
          const current = state[index].effects[id];
          state[index].effects[id] = { value: Math.max(current?.value || 0, amount), until: round + 1 };
          event.applied.push({ index, id, label: EFFECT_LABELS[id] });
        }
      };
      apply(actor, action.self);
      const heal = amount => {
        const restored = Math.max(0, Math.min(Math.round(amount), fighters[actor].stats.hp - hp[actor]));
        hp[actor] += restored; event.heal += restored;
      };
      if (action.healing) heal(fighters[actor].stats.hp * action.healing);
      if (action.barrier) {
        const after = Math.min(Math.round(fighters[actor].stats.hp * .4), own.shield + Math.round(fighters[actor].stats.hp * action.barrier));
        event.shieldGained = after - own.shield;
        own.shield = after;
      }
      if (action.power > 0) {
        const avoid = clamp((fighters[target].stats.evasion + value(target, 'evasionUp') + value(actor, 'accuracyDown')) / 100, 0, .8);
        event.dodge = !action.sureHit && random() < avoid;
        event.critical = !event.dodge && random() < clamp(.1 + (action.criticalBonus || 0), 0, .6);
        if (!event.dodge) {
          const attack = fighters[actor].stats.attack * (1 + value(actor, 'attackUp')) * (1 - value(actor, 'attackDown'));
          const defense = fighters[target].stats.defense * (1 - (action.pierce || 0));
          event.rawDamage = Math.max(5, Math.round((attack * action.power * (.9 + random() * .25) - defense * .42) * (event.critical ? 1.5 : 1) * (1 + value(target, 'exposed'))));
          event.absorbed = Math.min(other.shield, event.rawDamage);
          other.shield -= event.absorbed;
          event.damage = Math.min(hp[target], event.rawDamage - event.absorbed);
          hp[target] -= event.damage;
          apply(target, action.enemy);
          if (action.drain) heal(event.damage * action.drain);
        }
      }
      events.push({ ...event, hp: [...hp], state: snapshot(round) });
    }
  }
  const ratios = hp.map((n, k) => n / fighters[k].stats.hp);
  const winner = hp[0] <= 0 ? 1 : hp[1] <= 0 ? 0 : Math.abs(ratios[0] - ratios[1]) < .000001 ? null : ratios[0] > ratios[1] ? 0 : 1;
  return { events, winner, rounds, hp: [...hp], state: events.at(-1)?.state || snapshot(rounds), skillUses: state.map(s => ({ ...s.used })), limitReached: hp.every(n => n > 0) };
}

export function describeEvent(event, fighters) {
  const actor = fighters[event.actor].name, target = fighters[event.target].name;
  const skill = SKILL_MAP[event.skillId];
  const parts = [];
  if (event.dodge) parts.push(`${target} 회피 성공`);
  else if (event.damage) parts.push(`${target} HP −${event.damage}${event.critical ? ' (치명타)' : ''}`);
  if (event.absorbed) parts.push(`보호막이 ${event.absorbed} 피해 흡수`);
  if (event.heal) parts.push(`자신의 HP +${event.heal}`);
  if (event.shieldGained) parts.push(`보호막 +${event.shieldGained}`);
  if (event.cleansed.length) parts.push('약화 효과 해제');
  for (const e of event.applied) parts.push(`${e.index === event.actor ? '자신' : target} ${e.label}`);
  return `${actor}의 ${skill ? skill.name : '기본 공격'}: ${parts.join(' / ') || '효과 유지'}`;
}
