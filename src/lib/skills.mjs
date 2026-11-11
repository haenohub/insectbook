import { TITLE_MAP } from './profiles.mjs';

// These are game abilities inspired by title names, not biological claims.
export const SKILLS = [
  { id: 'flight', name: '바람 가르기', cooldown: 3, power: 1.05, self: { evasionUp: 20 }, description: '1.05배 공격. 다음 라운드 끝까지 회피율 +20%p.' },
  { id: 'survivor', name: '질긴 생명력', cooldown: 5, power: 0, healing: .30, cleanse: true, healthBelow: .65, description: '최대 HP의 30% 회복. 약화 효과를 모두 해제해요. HP 65% 이하에서 사용.' },
  { id: 'armor', name: '철벽 갑옷', cooldown: 4, power: 0, barrier: .30, description: '최대 HP의 30%만큼 보호막. 소진될 때까지 피해를 대신 받아요.' },
  { id: 'hunter', name: '급소 사냥', cooldown: 3, power: 1.5, pierce: .35, criticalBonus: .15, description: '1.5배 공격. 방어력 35%를 무시하고 치명타 확률 +15%p.' },
  { id: 'jump', name: '도약 강타', cooldown: 3, power: 1.3, self: { agilityUp: .4 }, description: '1.3배 공격. 다음 라운드의 민첩성이 40% 높아져요.' },
  { id: 'camouflage', name: '완벽 위장', cooldown: 4, power: .8, self: { evasionUp: 40 }, description: '0.8배 공격. 다음 라운드 끝까지 회피율 +40%p.' },
  { id: 'flower', name: '꽃꿀 회복', cooldown: 4, power: 0, healing: .22, barrier: .10, healthBelow: .75, description: '최대 HP의 22% 회복과 10% 보호막. HP 75% 이하에서 사용.' },
  { id: 'water', name: '물결 방패', cooldown: 4, power: .85, barrier: .20, description: '0.85배 공격과 최대 HP의 20% 보호막을 함께 얻어요.' },
  { id: 'night', name: '어둠의 기습', cooldown: 3, power: 1.3, enemy: { attackDown: .25 }, description: '1.3배 공격. 명중하면 다음 라운드 끝까지 상대 공격력 25% 감소.' },
  { id: 'recycler', name: '자연의 순환', cooldown: 3, power: 1, drain: .65, description: '공격으로 실제 깎은 HP의 65%만큼 자신의 HP를 회복해요.' },
  { id: 'pattern', name: '눈속임 무늬', cooldown: 3, power: .9, enemy: { accuracyDown: 25 }, description: '0.9배 공격. 명중하면 다음 라운드 끝까지 상대의 빗나갈 확률 +25%p.' },
  { id: 'tiny', name: '빈틈 파고들기', cooldown: 3, power: 1.15, pierce: .70, description: '1.15배 공격. 상대 방어력의 70%를 무시해요.' },
  { id: 'wing', name: '날개 돌풍', cooldown: 3, power: 1.1, enemy: { agilityDown: .35 }, description: '1.1배 공격. 명중하면 다음 라운드의 상대 민첩성이 35% 감소.' },
  { id: 'precision', name: '정밀 타격', cooldown: 3, power: 1.15, sureHit: true, description: '상대의 회피와 자신의 명중 약화를 무시하는 1.15배 필중 공격.' },
  { id: 'pincers', name: '집게 조이기', cooldown: 3, power: 1.25, enemy: { attackDown: .20 }, description: '1.25배 공격. 명중하면 다음 라운드 끝까지 상대 공격력 20% 감소.' },
  { id: 'sense', name: '약점 간파', cooldown: 3, power: .9, enemy: { exposed: .30 }, description: '0.9배 공격. 명중하면 다음 라운드 끝까지 상대가 받는 피해 +30%.' },
  { id: 'explorer', name: '탐험가의 용기', cooldown: 4, power: 1, self: { attackUp: .20 }, description: '다음 라운드 끝까지 공격력 +20%를 얻고 공격해요. 전용 스킬을 쓸 수 없을 때 사용.' },
].map(s => ({ ...s, title: TITLE_MAP[s.id].name, icon: TITLE_MAP[s.id].icon, color: TITLE_MAP[s.id].color }));
export const SKILL_MAP = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export function skillsFor(insect) {
  return [...new Set((insect?.traits || []).map(t => t.id))].map(id => SKILL_MAP[id]).filter(Boolean);
}
export const EFFECT_LABELS = {
  evasionUp: '회피 상승', agilityUp: '민첩 상승', attackUp: '공격 상승',
  attackDown: '공격 약화', accuracyDown: '명중 약화', agilityDown: '민첩 약화', exposed: '약점 노출',
};
export const NEGATIVE_EFFECTS = ['attackDown', 'accuracyDown', 'agilityDown', 'exposed'];

export function describeEffect(effect) {
  const names = { evasionUp: '회피', agilityUp: '민첩', attackUp: '공격', attackDown: '공격', accuracyDown: '빗나감', agilityDown: '민첩', exposed: '받는 피해' };
  const points = ['evasionUp', 'accuracyDown'].includes(effect.id);
  const negative = ['attackDown', 'agilityDown'].includes(effect.id);
  return `${names[effect.id] || effect.label} ${negative ? '−' : '+'}${Math.round(effect.value * (points ? 1 : 100))}${points ? '%p' : '%'} (${effect.rounds}R)`;
}
