import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, Crown, Heart, Info, Plus, RotateCcw, Shield, Shuffle, Sparkles, Swords, Trophy, Wind, Zap } from 'lucide-react';
import { BOSSES, advanceStage, availableActions, bossIntent, createBoss, createRaid, effectiveStats, resolveRound, turnOrder } from './lib/raid.mjs';
import { assetUrl } from './lib/asset-url.mjs';
import { describeEffect } from './lib/skills.mjs';
import './raid.css';

function Portrait({ insect, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [insect.id]);
  return failed ? <button className="raid-art-retry" onClick={() => setFailed(false)}>그림 다시 불러오기</button> : <img className={`raid-portrait ${className}`} src={assetUrl(insect.image)} alt={`${insect.name} 색연필 손그림`} onError={() => setFailed(true)} />;
}
function Health({ actor, boss = false }) {
  return <div className={`raid-health ${boss ? 'boss-health' : ''}`}><div><span><Heart size={15} />{boss ? 'BOSS HP' : 'HP'}</span><strong>{actor.hp}<small> / {actor.stats.hp}</small></strong></div><div className="raid-hp-track" role="progressbar" aria-label={`${actor.name} HP`} aria-valuenow={actor.hp} aria-valuemin={0} aria-valuemax={actor.stats.hp}><i style={{ width: `${actor.hp / actor.stats.hp * 100}%` }} /></div></div>;
}
function Conditions({ actor, round }) {
  return <div className="raid-conditions" aria-label={`${actor.name} 현재 효과`}>{actor.guarding && <span><Shield size={13} />방어 중</span>}{actor.shield > 0 && <span><Shield size={13} />보호막 {actor.shield}</span>}{Object.entries(actor.effects).map(([id, e]) => <span key={id}>{describeEffect({ id, value: e.value, rounds: Math.max(1, e.until - round + 1) })}</span>)}</div>;
}
export default function BossRaid({ active, catalog, selected, setSelected, onPick, onRunning, onBrowse }) {
  const [raid, setRaid] = useState(null), [plans, setPlans] = useState({}), [playback, setPlayback] = useState(null), [speed, setSpeed] = useState(1), [error, setError] = useState('');
  const signature = selected.join('|');
  const signatureRef = useRef(signature);
  useEffect(() => { if (signatureRef.current !== signature) { setRaid(null); setPlans({}); setPlayback(null); setError(''); signatureRef.current = signature; } }, [signature]);
  const locked = !!raid && !['gameOver', 'victory'].includes(raid.status);
  useEffect(() => { onRunning(locked || !!playback); }, [locked, !!playback, onRunning]);
  useEffect(() => {
    if (!playback) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      const index = playback.index + 1;
      if (index >= playback.result.events.length) { setRaid(playback.result.state); setPlayback(null); return; }
      setRaid(playback.result.events[index].snapshot);
      setPlayback({ ...playback, index });
    }, reduced ? 80 : 850 / speed);
    return () => clearTimeout(timer);
  }, [playback, speed]);
  const team = raid?.team || [0, 1, 2].map(n => catalog.find(i => i.id === selected[n]) || null);
  const boss = raid?.boss || createBoss(0, catalog);
  const stage = raid?.stageIndex || 0;
  const intent = raid ? bossIntent(raid) : null;
  const planning = raid?.status === 'planning' && !playback;
  const living = raid?.team.filter(a => a.hp > 0) || [];
  const chosen = living.filter(a => plans[a.key]).length;
  const current = playback?.index >= 0 ? playback.result.events[playback.index] : null;
  const order = raid ? turnOrder(raid) : [];
  const getActor = key => key === 'boss' ? boss : raid?.team.find(a => a.key === key);
  const begin = () => {
    try { setRaid(createRaid(team, catalog)); setPlans({}); setError(''); } catch (e) { setError(e.message); }
  };
  const commit = () => {
    if (!planning) return;
    try { const result = resolveRound(raid, plans); setPlayback({ result, index: -1 }); setPlans({}); setError(''); } catch (e) { setError(e.message); }
  };
  const choose = (actor, action) => {
    if (!planning || action.disabled) return;
    setPlans(old => ({ ...old, [actor.key]: { actionId: action.id, targetKey: action.target === 'ally' ? actor.key : action.target === 'boss' ? 'boss' : actor.key } })); setError('');
  };
  return <main className={`raid-page page-width ${raid ? 'is-started' : ''}`} hidden={!active}>
    <div className="raid-heading"><div><span className="eyebrow green-text"><Crown size={16} />THE LITTLE WILD EXPEDITION</span><h1>작은 세 친구의<br /><span>커다란 보스 도전.</span></h1><p>곤충 세 마리의 재능을 모아, 숲의 열 보스를 만나보세요.</p></div><div className="raid-progress-stamp"><span>숲의 탐험 기록</span><strong>{raid?.cleared || 0}<small> / 10</small></strong><span>스테이지 클리어</span></div></div>

    <section className="raid-route" aria-label="보스 스테이지 진행"><ol>{BOSSES.map((b, n) => <li className={n < (raid?.cleared || 0) ? 'cleared' : n === stage ? 'current' : ''} key={b.id} aria-current={n === stage ? 'step' : undefined}><span>{n < (raid?.cleared || 0) ? <Check size={15} /> : String(n + 1).padStart(2, '0')}</span><small>{catalog.find(i => i.id === b.id).name}</small></li>)}</ol></section>

    <section className={`raid-boss ${current?.actorKey === 'boss' ? 'raid-acting' : ''}`} aria-label="현재 보스"><div className="raid-boss-art"><span className="raid-boss-badge"><Crown size={15} />BOSS {String(stage + 1).padStart(2, '0')}</span><Portrait insect={boss} /><span className="raid-art-note">숲의 수호자 · {boss.family}</span></div><div className="raid-boss-content"><span className="eyebrow">STAGE {String(stage + 1).padStart(2, '0')} / 10</span><p className="raid-boss-title">{boss.title}</p><h2>{boss.name}</h2><Health actor={boss} boss /><div className="raid-statline"><span><Swords size={15} />공격 {raid ? effectiveStats(boss, raid).attack : boss.stats.attack}</span><span><Shield size={15} />방어 {boss.stats.defense}</span><span><Zap size={15} />민첩 {raid ? effectiveStats(boss, raid).agility : boss.stats.agility}</span></div>{raid && <Conditions actor={boss} round={raid.round} />}<div className="raid-mechanic"><Sparkles size={18} /><div><h3>보스 공략 노트</h3><p>{boss.hint}</p></div></div>{raid && <div className={`raid-intent ${intent.all ? 'is-danger' : ''}`}><span>{playback ? '행동 진행 중' : `TURN ${raid.round} · 다음 보스 행동`}</span><strong>{intent.name}</strong><p>{intent.description}</p></div>}</div></section>

    <div className="raid-team-heading"><div><span className="eyebrow green-text">YOUR THREE LITTLE HEROES</span><h2>우리 탐험대 <span>{team.filter(Boolean).length} / 3</span></h2></div>{!locked && !playback && <button className="button secondary" onClick={() => { const pool = [...catalog]; const picks = []; for (let n = 0; n < 3; n++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id); setSelected(picks); }}><Shuffle size={16} />랜덤 팀 구성</button>}</div>
    <div className="raid-team">{team.map((ally, n) => {
      if (!ally) return <button className="raid-empty-ally" key={n} onClick={() => onPick(n)}><Plus size={28} /><span>EXPLORER 0{n + 1}</span><strong>{n + 1}번 친구 고르기</strong><small>{catalog.length}종의 곤충 중 함께할 친구를 골라주세요.</small></button>;
      const actor = raid ? ally : { ...ally, key: `ally-${n}`, hp: ally.stats.hp, effects: {}, shield: 0, readyAt: {}, guarding: false };
      const dead = actor.hp === 0, actions = raid ? availableActions(actor, raid) : [], plan = plans[actor.key], action = actions.find(a => a.id === plan?.actionId);
      return <section className={`raid-ally ${dead ? 'is-down' : ''} ${current?.actorKey === actor.key ? 'raid-acting' : ''} ${plan ? 'has-plan' : ''}`} key={n} aria-label={`${ally.name} 행동 선택`}><div className="raid-ally-top"><span>EXPLORER 0{n + 1}</span>{dead ? <b>쓰러짐</b> : plan ? <b><Check size={13} />선택 완료</b> : null}</div><div className="raid-ally-summary"><Portrait insect={ally} /><div><p>{ally.family}</p><h3>{ally.name}</h3><span><Zap size={14} />민첩 {raid ? effectiveStats(actor, raid).agility : ally.stats.agility}</span></div></div><Health actor={actor} /><Conditions actor={actor} round={raid?.round || 1} />
        {!raid ? <button className="text-button raid-change" onClick={() => onPick(n)}><RotateCcw size={14} />다른 곤충 고르기</button> : dead ? <p className="raid-down-note">행동할 수 없어요.<br />스테이지 클리어 후 HP 50%로 다시 합류해요.</p> : <><div className="raid-action-label">이번 턴 행동 <span>{planning ? '하나를 골라주세요' : playback ? '행동 실행 중' : '도전 결과 확인'}</span></div><div className="raid-action-grid" role="group" aria-label={`${ally.name} 행동`}>{actions.map(a => <button key={a.id} disabled={!planning || a.disabled} aria-pressed={plan?.actionId === a.id} className={plan?.actionId === a.id ? 'chosen' : ''} onClick={() => choose(actor, a)} title={a.description}><span>{a.id === 'guard' ? <Shield size={15} /> : a.id === 'basic' ? <Swords size={15} /> : <Sparkles size={15} />}{a.name}</span><small>{a.wait ? `${a.wait}턴 대기` : a.id === 'basic' ? '공격' : a.id === 'guard' ? '피해 감소' : `대기 ${a.cooldown}턴`}</small></button>)}</div>{action && <div className="raid-action-description"><p>{action.description}</p>{action.target === 'ally' && <label>지원 대상<select aria-label={`${ally.name} 지원 대상`} disabled={!planning} value={plan.targetKey} onChange={e => setPlans(old => ({ ...old, [actor.key]: { ...old[actor.key], targetKey: e.target.value } }))}>{living.map(t => <option key={t.key} value={t.key}>{t.name} · HP {t.hp}/{t.stats.hp}</option>)}</select></label>}</div>}</>}
      </section>;
    })}</div>

    <section className={`raid-command ${planning ? 'is-planning' : ''}`} aria-label="턴 진행">{!raid ? <><button className="button primary" disabled={team.filter(Boolean).length !== 3} onClick={begin}><Crown size={18} />보스 도전 시작 <ArrowRight size={17} /></button><p>서로 다른 세 곤충을 선택해 주세요. 첫 보스부터 순서대로 도전해요.</p></> : playback ? <><div className="raid-current-action" role="status"><Sparkles size={18} />{current?.text || '선택을 마쳤어요. 민첩성 순서로 행동합니다.'}</div><div className="raid-play-controls"><button className="button secondary" onClick={() => setSpeed(s => s === 1 ? 3 : 1)}><Zap size={16} />{speed}배속</button><button className="button primary" onClick={() => { setRaid(playback.result.state); setPlayback(null); }}>턴 결과 바로 보기 <ArrowRight size={16} /></button></div></> : planning ? <><div className="raid-turn-label">TURN {raid.round} <span>행동 선택 {chosen} / {living.length}{living.length < 3 ? ' · 쓰러진 친구는 제외' : ''}</span></div><div className="raid-order"><span>예상 행동 순서</span><ol>{order.map((key, n) => <li key={key} className={key === 'boss' ? 'is-boss' : ''}><b>{n + 1}</b>{getActor(key).name}<small>{effectiveStats(getActor(key), raid).agility}</small></li>)}</ol></div><button className="button primary" disabled={chosen !== living.length} onClick={commit}>행동 확정 · 턴 진행 <ArrowRight size={17} /></button><p>살아 있는 친구들의 행동을 모두 골라야 시작해요. 민첩성이 같으면 아군부터 행동해요.</p></> : <div className={`raid-result ${raid.status}`} role="status"><Trophy size={32} /><span className="eyebrow">{raid.status === 'gameOver' ? 'GAME OVER' : raid.status === 'victory' ? 'EXPEDITION COMPLETE' : 'STAGE CLEAR'}</span><h2>{raid.status === 'gameOver' ? '잠깐 쉬어 가는 탐험.' : raid.status === 'victory' ? '열 보스 클리어! 숲의 새로운 전설.' : `${stage + 1} 스테이지 클리어!`}</h2><p>{raid.status === 'gameOver' ? '세 친구가 모두 쓰러졌어요. 팀과 스킬 조합을 바꿔 다시 도전해보세요.' : raid.status === 'victory' ? '세 친구와 함께 모든 보스를 쓰러뜨렸어요. 멋진 탐험이었어요!' : '다음 스테이지에서 생존자는 HP 40% 회복, 쓰러진 친구는 HP 50%로 합류해요. 스킬 대기와 상태 효과도 초기화돼요.'}</p><div>{raid.status === 'stageClear' ? <button className="button primary" onClick={() => { setRaid(advanceStage(raid, catalog)); setPlans({}); }}>다음 스테이지 <ArrowRight size={17} /></button> : <><button className="button primary" onClick={begin}><RotateCcw size={16} />처음부터 다시 도전</button><button className="button secondary" onClick={() => { setRaid(null); setPlans({}); }}>팀 다시 고르기</button></>}</div></div>}{error && <p className="raid-error" role="alert">{error}</p>}</section>

    {raid && <section className="raid-log"><h2><BookOpen size={18} />이번 스테이지의 전투 기록</h2>{raid.log.length ? <><p className="raid-last-log" aria-live="polite">{raid.log.at(-1).text}</p><details><summary>전투 기록 펼치기 ({raid.log.length}) <ChevronDown size={15} /></summary><ol>{raid.log.map((entry, n) => <li key={n}><b>T{entry.round}</b><span>{entry.text}</span></li>)}</ol></details></> : <p>세 친구의 첫 행동을 골라보세요.</p>}</section>}
    <details className="raid-guide"><summary><Info size={18} />탐험대 작전 노트 <ChevronDown size={16} /></summary><ul><li>세 곤충의 행동을 선택하고 확정하면 보스까지 민첩성 순서로 한 번씩 행동해요. 쓰러진 곤충의 예정된 행동은 취소돼요.</li><li>방어는 자신의 행동부터 다음 자기 행동 전까지 피해를 60% 줄여요. 버프와 약화는 발동 턴과 다음 턴 끝까지 유지돼요. 속도 변화는 다음 턴의 순서에 반영돼요.</li><li>회복·보호막은 살아 있는 아군을 지정할 수 있어요. 대상이 먼저 쓰러지면 시전자에게 사용해요. 회복은 최대 HP까지만, 보호막은 최대 HP의 40%까지 쌓여요.</li><li>스킬은 사용 후 표시된 턴 수만큼 기다려야 다시 사용할 수 있어요. 지원 스킬도 공격 효과가 있다면 보스를 함께 공격해요.</li><li>보스 HP가 0이면 클리어, 아군 셋의 HP가 모두 0이면 게임 오버예요. 진행 중 팀은 바꿀 수 없어요. 이 탐험은 현재 탭에서 이어지며 새로고침하면 처음부터 시작해요.</li><li>곤충의 특징에서 착안한 가상 게임이에요. 보스 기믹과 능력치는 실제 생물의 성능을 뜻하지 않아요.</li></ul><button className="text-button" onClick={onBrowse}>도감에서 친구 살펴보기 <ArrowRight size={15} /></button></details>
    {raid && locked && !playback && <button className="text-button raid-retire" onClick={() => { setRaid(null); setPlans({}); }}>탐험 종료하고 팀 바꾸기 <RotateCcw size={14} /></button>}
    {planning && <div className="raid-dock" aria-label="모바일 턴 조작"><div><strong>TURN {raid.round} · 선택 {chosen}/{living.length}</strong><small>{intent.name} · {intent.all ? '아군 전체' : getActor(intent.targetKey)?.name}</small></div><button className="button primary" disabled={chosen !== living.length} onClick={commit}>행동 확정 · 턴 진행 <ArrowRight size={16} /></button></div>}
  </main>;
}
