import { skillsFor, NEGATIVE_EFFECTS } from './skills.mjs';

// Boss names and illustrations come from the catalog. All mechanics are game fiction.
export const BOSSES = [
  { id: 'ZOGG0007', title: '구릿빛 문지기', mechanic: 'armor', hint: '홀수 턴에는 받는 피해가 35% 줄어요. 방어 관통 스킬로 갑옷을 뚫어보세요.', move: '갑옷 돌진' },
  { id: 'ZEAA0021', title: '초원의 도약왕', mechanic: 'jump', hint: '3턴마다 빠른 도약으로 모두를 공격해요. 예고된 턴에 방어를 준비하세요.', move: '대지 도약' },
  { id: 'ZFAB0002', title: '숨은 숲의 수호자', mechanic: 'camouflage', hint: '홀수 턴에는 회피율이 35%가 돼요. 필중 공격과 강화로 빈틈을 노려보세요.', move: '나뭇잎 기습' },
  { id: 'ZOBZ0037', title: '붉은 반격의 성채', mechanic: 'counter', hint: '3턴마다 반격 태세! 공격한 곤충에게 7 피해를 돌려줘요. 회복과 보호막을 준비하세요.', move: '반격의 파동' },
  { id: 'ZOGP0001', title: '고요한 재생술사', mechanic: 'regenerate', hint: '3턴마다 최대 HP의 8%를 회복해요. 공격 약화와 집중 공격으로 버텨보세요.', move: '숲의 재생' },
  { id: 'ZOBL0096', title: '네 눈의 추적자', mechanic: 'mark', hint: 'HP 비율이 가장 낮은 친구를 추적해요. 3턴마다 추적 대상에게 강한 필중 공격을 해요.', move: '추적의 일격' },
  { id: 'ZOCR0049', title: '깊은 물의 파수꾼', mechanic: 'shield', hint: '3턴마다 최대 HP의 8%만큼 보호막을 얻고 모두를 공격해요. 공격을 모아 깨뜨리세요.', move: '물결 방벽' },
  { id: 'ZOBH0105', title: '황금 테의 질주자', mechanic: 'haste', hint: '짝수 턴에는 민첩성이 1.6배가 돼요. 속도 약화 스킬로 행동 순서를 바꿔보세요.', move: '황금 질주' },
  { id: 'ZOBH0002', title: '검은 갑옷의 폭군', mechanic: 'enrage', hint: 'HP가 절반 이하가 되면 공격력이 30% 강해져요. 3턴마다 모두에게 강공격을 해요.', move: '폭군의 포효' },
  { id: 'ZOEC0014', title: '거대한 숲의 왕', mechanic: 'king', hint: '3턴마다 전체 공격! HP 절반 이하에서는 공격력 25% 증가와 단단한 갑옷이 함께 발동해요.', move: '왕의 집게 폭풍' },
];
const copy = value => structuredClone(value);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const alive = actor => actor.hp > 0;
const effect = (actor, key) => actor.effects[key]?.value || 0;
function combatant(insect, key, stats = insect.stats) {
  return { ...copy(insect), key, stats: { ...stats }, hp: stats.hp, shield: 0, effects: {}, readyAt: {}, guarding: false };
}
export function createBoss(stageIndex, catalog) {
  const spec = BOSSES[stageIndex];
  if (!spec) throw new Error('존재하지 않는 스테이지예요.');
  const insect = catalog.find(i => i.id === spec.id);
  if (!insect) throw new Error(`보스 도감 정보가 없어요: ${spec.id}`);
  const hp = Math.round(insect.stats.hp * (3 + stageIndex * .27));
  return { ...combatant(insect, 'boss', { ...insect.stats, hp, attack: Math.round(insect.stats.attack * (.65 + stageIndex * .035)), defense: Math.round(insect.stats.defense * .8), evasion: 5 }), ...spec };
}
export function createRaid(team, catalog) {
  if (team.length !== 3 || new Set(team.map(i => i?.id)).size !== 3 || team.some(i => !i || !catalog.some(c => c.id === i.id))) throw new Error('서로 다른 곤충 세 마리를 골라주세요.');
  return { stageIndex: 0, cleared: 0, round: 1, status: 'planning', team: team.map((i, n) => combatant(i, `ally-${n}`)), boss: createBoss(0, catalog), log: [] };
}
export function effectiveStats(actor, state) {
  const boss = actor.key === 'boss';
  const low = actor.hp <= actor.stats.hp / 2;
  return {
    attack: Math.round(actor.stats.attack * (1 + effect(actor, 'attackUp')) * (1 - effect(actor, 'attackDown')) * (boss && low && ['king', 'enrage'].includes(actor.mechanic) ? actor.mechanic === 'king' ? 1.25 : 1.3 : 1)),
    agility: Math.round(actor.stats.agility * (1 + effect(actor, 'agilityUp')) * (1 - effect(actor, 'agilityDown')) * (boss && actor.mechanic === 'haste' && state.round % 2 === 0 ? 1.6 : 1)),
    evasion: clamp(actor.stats.evasion + effect(actor, 'evasionUp') + (boss && actor.mechanic === 'camouflage' && state.round % 2 === 1 ? 30 : 0), 0, 80),
  };
}
export function bossIntent(state) {
  const { boss, round, team } = state;
  const special = round % 3 === 0;
  const target = [...team].filter(alive).sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp || a.key.localeCompare(b.key))[0];
  const all = special && ['jump', 'shield', 'enrage', 'king'].includes(boss.mechanic);
  const heal = special && boss.mechanic === 'regenerate';
  const counter = boss.mechanic === 'counter' && special;
  return { name: special ? boss.move : '보스 기본 공격', targetKey: target?.key, all, heal, counter, sureHit: special && boss.mechanic === 'mark', power: special ? all ? .9 : 1.65 : 1, description: heal ? '공격 대신 최대 HP의 8%를 회복해요.' : `${all ? '살아 있는 아군 모두' : target?.name || '대상 없음'}에게 ${special ? '특수' : '기본'} 공격${special && boss.mechanic === 'mark' ? ' · 필중' : ''}${counter ? ' · 이번 턴 반격 태세' : ''}${special && boss.mechanic === 'shield' ? ' · 보호막 생성' : ''}` };
}
export function availableActions(actor, state) {
  return [
    { id: 'basic', name: '기본 공격', description: '보스를 공격해요.', target: 'boss', disabled: !alive(actor) },
    { id: 'guard', name: '방어', description: '다음 자기 행동 전까지 받는 피해가 60% 줄어요.', target: 'self', disabled: !alive(actor) },
    ...skillsFor(actor).map(s => {
      const wait = Math.max(0, (actor.readyAt[s.id] || 0) - state.round);
      // Raid healing is deliberately targetable; health thresholds from auto-duels do not apply.
      const target = s.healing || s.barrier ? 'ally' : s.power > 0 ? 'boss' : 'self';
      return { ...s, target, wait, disabled: !alive(actor) || wait > 0, description: raidSkillDescription(s) };
    }),
  ];
}
export function raidSkillDescription(skill) {
  return `${skill.description.replace(/ HP \d+% 이하에서 사용\./, '').replace(/ 전용 스킬을 쓸 수 없을 때 사용\./, '')}${skill.healing || skill.barrier ? ' 살아 있는 아군 한 마리에게 회복·보호막을 줄 수 있어요.' : ''}`;
}
export function validatePlans(state, plans) {
  if (state.status !== 'planning') throw new Error('지금은 행동을 선택할 수 없어요.');
  for (const actor of state.team.filter(alive)) {
    const plan = plans[actor.key];
    const action = availableActions(actor, state).find(a => a.id === plan?.actionId);
    if (!action || action.disabled) throw new Error(`${actor.name}의 가능한 행동을 골라주세요.`);
    if (action.target === 'ally' && !state.team.some(a => a.key === plan.targetKey && alive(a))) throw new Error('살아 있는 아군 대상을 골라주세요.');
  }
  return true;
}
export function turnOrder(state) {
  return [...state.team.filter(alive), state.boss].filter(alive).sort((a, b) => effectiveStats(b, state).agility - effectiveStats(a, state).agility || (a.key === 'boss' ? 1 : b.key === 'boss' ? -1 : a.key.localeCompare(b.key))).map(a => a.key);
}
export function resolveRound(input, plans, random = Math.random) {
  validatePlans(input, plans);
  const state = copy(input), events = [], order = turnOrder(state), intent = bossIntent(state);
  const actorByKey = key => key === 'boss' ? state.boss : state.team.find(a => a.key === key);
  function record(actor, action, text, kind = 'action') {
    state.log = [...state.log, { round: state.round, text }].slice(-100);
    events.push({ actorKey: actor.key, actionName: action, text, kind, snapshot: copy(state) });
  }
  function heal(target, amount) { const n = Math.min(target.stats.hp - target.hp, Math.round(amount)); target.hp += n; return n; }
  function shield(target, amount) { const n = Math.min(Math.round(target.stats.hp * .4) - target.shield, Math.round(amount)); target.shield += Math.max(0, n); return Math.max(0, n); }
  function apply(target, effects) { for (const [id, value] of Object.entries(effects || {})) target.effects[id] = { value: Math.max(effect(target, id), value), until: state.round + 1 }; }
  function hit(actor, target, action) {
    const miss = !action.sureHit && random() < clamp(effectiveStats(target, state).evasion + effect(actor, 'accuracyDown'), 0, 80) / 100;
    if (miss) return `${target.name} 회피!`;
    const crit = random() < .1 + (action.criticalBonus || 0);
    const armored = target.key === 'boss' && ((target.mechanic === 'armor' && state.round % 2 === 1) || (target.mechanic === 'king' && target.hp <= target.stats.hp / 2));
    let amount = Math.max(5, Math.round((effectiveStats(actor, state).attack * (action.power ?? 1) * (.95 + random() * .15) - target.stats.defense * (1 - (action.pierce || 0)) * .42) * (crit ? 1.5 : 1) * (1 + effect(target, 'exposed'))));
    if (armored) amount = Math.max(1, Math.round(amount * (1 - .35 * (1 - (action.pierce || 0)))));
    if (target.guarding) amount = Math.max(1, Math.round(amount * .4));
    const absorbed = Math.min(target.shield, amount); target.shield -= absorbed;
    const damage = Math.min(target.hp, amount - absorbed); target.hp -= damage;
    apply(target, action.enemy);
    const drain = action.drain && alive(actor) ? heal(actor, damage * action.drain) : 0;
    let counter = 0;
    if (target.key === 'boss' && alive(target) && intent.counter) { counter = Math.min(actor.hp, actor.guarding ? 3 : 7); const block = Math.min(actor.shield, counter); actor.shield -= block; counter -= block; actor.hp -= counter; }
    return `${target.name} ${crit ? '치명타 ' : ''}−${damage} HP${absorbed ? ` · 보호막 ${absorbed} 흡수` : ''}${drain ? ` · ${actor.name} +${drain} 회복` : ''}${counter ? ` · 반격 −${counter} HP` : ''}${!alive(target) ? ' · 쓰러짐' : ''}${!alive(actor) ? ` · ${actor.name} 쓰러짐` : ''}`;
  }
  for (const key of order) {
    if (!alive(state.boss) || state.team.every(a => !alive(a))) break;
    const actor = actorByKey(key);
    if (!alive(actor)) { record(actor, '행동 취소', `${actor.name}은 쓰러져 행동할 수 없어요.`, 'skip'); continue; }
    actor.guarding = false;
    if (key === 'boss') {
      const notes = [];
      if (intent.heal) notes.push(`HP +${heal(actor, actor.stats.hp * .08)} 회복`);
      else {
        if (actor.mechanic === 'shield' && state.round % 3 === 0) notes.push(`보호막 +${shield(actor, actor.stats.hp * .08)}`);
        const target = actorByKey(intent.targetKey);
        const targets = intent.all ? state.team.filter(alive) : [target?.hp > 0 ? target : state.team.find(alive)].filter(Boolean);
        targets.forEach(t => notes.push(hit(actor, t, intent)));
      }
      record(actor, intent.name, `${actor.name} · ${intent.name}: ${notes.join(' / ')}`);
    } else {
      const plan = plans[key], action = availableActions(actor, state).find(a => a.id === plan.actionId), notes = [];
      if (action.id === 'guard') { actor.guarding = true; notes.push('다음 자기 행동 전까지 받는 피해 60% 감소'); }
      else {
        if (action.id !== 'basic') actor.readyAt[action.id] = state.round + action.cooldown + 1;
        apply(actor, action.self);
        // If a chosen ally falls before this action, support retargets the caster rather than reviving.
        const chosen = actorByKey(plan.targetKey), target = action.target === 'ally' && chosen?.hp > 0 ? chosen : actor;
        if (action.cleanse) { NEGATIVE_EFFECTS.forEach(id => delete target.effects[id]); notes.push(`${target.name} 약화 해제`); }
        if (action.healing) notes.push(`${target.name} HP +${heal(target, target.stats.hp * action.healing)}`);
        if (action.barrier) notes.push(`${target.name} 보호막 +${shield(target, target.stats.hp * action.barrier)}`);
        if (action.power !== 0 && action.id !== 'guard') notes.push(hit(actor, state.boss, action));
      }
      record(actor, action.name, `${actor.name} · ${action.name}: ${notes.join(' / ')}`);
    }
  }
  if (!alive(state.boss)) { state.cleared = state.stageIndex + 1; state.status = state.cleared === BOSSES.length ? 'victory' : 'stageClear'; }
  else if (state.team.every(a => !alive(a))) state.status = 'gameOver';
  else {
    state.round++;
    for (const a of [...state.team, state.boss]) for (const [id, e] of Object.entries(a.effects)) if (e.until < state.round) delete a.effects[id];
  }
  return { state, events, order };
}
export function advanceStage(input, catalog) {
  if (input.status !== 'stageClear' || input.stageIndex >= BOSSES.length - 1) throw new Error('스테이지를 클리어한 뒤 이동할 수 있어요.');
  const state = copy(input);
  state.stageIndex++; state.round = 1; state.status = 'planning'; state.boss = createBoss(state.stageIndex, catalog); state.log = [];
  state.team = state.team.map(a => ({ ...a, hp: a.hp === 0 ? Math.ceil(a.stats.hp * .5) : Math.min(a.stats.hp, a.hp + Math.ceil(a.stats.hp * .4)), shield: 0, effects: {}, readyAt: {}, guarding: false }));
  return state;
}
