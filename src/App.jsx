import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Bookmark, Bug, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, Crosshair, Droplet, ExternalLink, Feather, Flower2, Heart, Info, Leaf, Menu, Moon, Palette, Play, Plus, Recycle, RotateCcw, Search, Shield, Shuffle, SlidersHorizontal, Sparkles, Sprout, Swords, Trophy, Wind, X, Zap } from 'lucide-react';
import catalog from '../data/web-catalog.json';
import { TITLES, TITLE_MAP, STAT_META } from './lib/profiles.mjs';
import { filterInsects, sortInsects } from './lib/search.mjs';
import { assetUrl } from './lib/asset-url.mjs';
import { randomPair, seededRandom, simulateBattle } from './lib/battle.mjs';

const INSECTS = catalog.insects;
const BY_ID = Object.fromEntries(INSECTS.map((i, n) => [i.id, { ...i, number: String(n + 1).padStart(3, '0') }]));
const ICONS = { wind: Wind, sprout: Sprout, shield: Shield, crosshair: Crosshair, zap: Zap, leaf: Leaf, flower: Flower2, droplet: Droplet, moon: Moon, recycle: Recycle, palette: Palette, sparkles: Sparkles, feather: Feather, compass: Compass };
const PAGE_SIZE = 12;
const FAMILY_OPTIONS = [...new Set(INSECTS.map(i => i.family))].sort((a, b) => a.localeCompare(b, 'ko'));
const EMPTY_FILTERS = { query: '', scope: 'all', titles: [], family: '', genus: '' };
const initialParams = new URLSearchParams(window.location.search);
function readStored(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; } catch { return fallback; } }
function initialFilters() {
  return { query: initialParams.get('q') || '', scope: ['all', 'name', 'family', 'genus'].includes(initialParams.get('scope')) ? initialParams.get('scope') : 'all', titles: initialParams.getAll('title').filter(t => TITLE_MAP[t]), family: FAMILY_OPTIONS.includes(initialParams.get('family')) ? initialParams.get('family') : '', genus: INSECTS.some(i => i.genusLatin === initialParams.get('genus')) ? initialParams.get('genus') : '' };
}
function TraitIcon({ id, size = 15, ...props }) { const Icon = ICONS[TITLE_MAP[id]?.icon] || Sparkles; return <Icon size={size} strokeWidth={1.7} {...props} />; }
function Trait({ id, onClick, small = false }) {
  const title = TITLE_MAP[id];
  return onClick ? <button className={`trait ${title.color} ${small ? 'small' : ''}`} onClick={() => onClick(id)} title={`${title.name} 곤충 모아보기`}><TraitIcon id={id} size={small ? 12 : 14} />{title.name}</button> : <span className={`trait ${title.color} ${small ? 'small' : ''}`}><TraitIcon id={id} size={small ? 12 : 14} />{title.name}</span>;
}
function Illustration({ insect, className = '', eager = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [insect?.id]);
  return failed ? <div className={`image-fallback ${className}`}><Bug size={36} /><span>그림을 불러오지 못했어요.</span><button onClick={() => setFailed(false)}>다시 불러오기</button></div> : <img className={`illustration ${className}`} src={assetUrl(insect.image)} alt={`${insect.name} 색연필 손그림`} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
}
function Modal({ onClose, label, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = old; if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={label} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>{children}<button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><X size={21} /></button></dialog>;
}
function Stats({ insect, compact = false }) {
  return <div className={`stats ${compact ? 'compact' : ''}`}>{STAT_META.map(s => <div className="stat-row" key={s.key}><span>{s.label}</span><div className="stat-track"><i className={s.color} style={{ width: `${insect.stats[s.key] / s.max * 100}%` }} /></div><strong>{insect.stats[s.key]}{s.unit}</strong></div>)}</div>;
}
function Detail({ insect, onClose, favorite, onFavorite, selected, onSelect, onTitle }) {
  const [tab, setTab] = useState('note');
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRecord(null); setError(false);
    fetch(assetUrl(`data/insects/${insect.id}.json`), { signal: controller.signal }).then(r => { if (!r.ok) throw new Error('정보 로드 실패'); return r.json(); }).then(setRecord).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [insect.id, retry]);
  return <Modal label={`${insect.name} 상세 도감`} onClose={onClose} className="detail-modal">
    <div className="detail-art"><span className="eyebrow">FIELD NOTE · NO. {BY_ID[insect.id].number}</span><Illustration insect={insect} eager /><p className="art-caption">색연필로 담은 작은 자연</p><div className="detail-taxon"><span>{insect.order}</span><span>{insect.family}</span></div></div>
    <div className="detail-content"><span className="eyebrow green-text">MEET THE LITTLE WILD</span><h2>{insect.name}</h2><p className="latin">{insect.scientificName}</p><div className="traits">{insect.traits.filter(t => t.id !== 'explorer').map(t => <Trait key={t.id} id={t.id} onClick={id => { onClose(); onTitle(id); }} />)}</div>
      <div className="detail-tabs" role="tablist" aria-label="곤충 정보"><button role="tab" aria-selected={tab === 'note'} onClick={() => setTab('note')} id="note-tab" aria-controls="detail-note"><BookOpen size={16} />관찰 노트</button><button role="tab" aria-selected={tab === 'stats'} onClick={() => setTab('stats')} id="stats-tab" aria-controls="detail-stats"><Swords size={16} />게임 능력치</button></div>
      {tab === 'note' ? <div role="tabpanel" id="detail-note" aria-labelledby="note-tab" className="detail-tab-content"><dl className="taxonomy"><div><dt>과</dt><dd>{insect.family} <em>{insect.familyLatin}</em></dd></div><div><dt>속</dt><dd>{insect.genus || '국명 미등록'} <em>{insect.genusLatin}</em></dd></div>{insect.size !== null && <div><dt>몸길이</dt><dd>약 {insect.size} mm <small>원문 수치 요약</small></dd></div>}</dl>
      {error ? <div className="inline-error">관찰 기록을 불러오지 못했어요. <button onClick={() => setRetry(x => x + 1)}>다시 시도</button></div> : !record ? <p className="loading" role="status">관찰 기록을 펼치는 중…</p> : <div className="source-sections">{record.sections.length ? record.sections.map((s, n) => <section key={n}><h3>{s.title}</h3><p>{s.text}</p></section>) : <p>원문에 자세한 관찰 설명이 등록되어 있지 않습니다.</p>}</div>}
      <a className="source-link" href={insect.sourceUrl} target="_blank" rel="noreferrer">국립수목원 원문 도감 보기 <ExternalLink size={13} /></a></div> : <div role="tabpanel" id="detail-stats" aria-labelledby="stats-tab" className="detail-tab-content"><p className="game-note"><Info size={16} />곤충의 특징을 재해석한 게임용 수치예요.</p><Stats insect={insect} /><p className="stat-reason">{insect.statReason}</p><h3 className="evidence-heading">이 타이틀을 얻은 이유</h3><div className="evidence-list">{insect.traits.map(t => <details key={t.id}><summary><TraitIcon id={t.id} /><span>{TITLE_MAP[t.id].name}</span><small>{t.basis === 'source' ? '원문 기록' : t.basis === 'game' ? '공통 별명' : '분류에서 착안'}</small><ChevronDown size={14} /></summary><p>{t.reason}</p></details>)}</div></div>}
      <div className="detail-actions"><button className={`button secondary ${favorite ? 'saved' : ''}`} onClick={() => onFavorite(insect.id)}><Bookmark size={17} fill={favorite ? 'currentColor' : 'none'} />{favorite ? '관찰함에 담았어요' : '관찰함에 담기'}</button><button className="button primary" onClick={() => { onSelect(insect.id); }}><Swords size={17} />{selected ? '배틀 선택 해제' : '배틀 선수로 선택'}</button></div>
    </div>
  </Modal>;
}
function Picker({ slot, selected, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const available = filterInsects(INSECTS, { query }).filter(i => i.id !== selected[1 - slot]);
  const [shown, setShown] = useState(24);
  useEffect(() => setShown(24), [query]);
  return <Modal label={`${slot + 1}번 배틀 선수 선택`} className="picker-modal" onClose={onClose}><span className="eyebrow green-text">CHOOSE YOUR EXPLORER</span><h2>{slot + 1}번 선수를 골라주세요</h2><p className="muted">이름, 과, 속, 타이틀로 찾을 수 있어요.</p><div className="picker-search"><Search size={19} /><input autoFocus aria-label="배틀 선수 검색" placeholder="어떤 곤충을 만나볼까요?" value={query} onChange={e => setQuery(e.target.value)} /></div><p className="picker-count">{available.length}종의 곤충</p><div className="picker-grid">{sortInsects(available).slice(0, shown).map(i => <button key={i.id} aria-label={`${i.name} 선택`} onClick={() => onPick(slot, i.id)} className={selected[slot] === i.id ? 'picked' : ''}><Illustration insect={i} /><strong>{i.name}</strong><span>{i.family}</span>{selected[slot] === i.id && <Check size={16} />}</button>)}</div>{!available.length && <p className="empty-small">검색 결과가 없어요. 다른 이름이나 타이틀로 찾아보세요.</p>}{available.length > shown && <button className="button secondary load-more" onClick={() => setShown(n => n + 24)}>24종 더 보기 <Plus size={15} /></button>}</Modal>;
}
function InsectCard({ insect, favorite, selected, onFavorite, onSelect, onOpen, onTitle }) {
  return <article className={`insect-card ${selected ? 'selected-card' : ''}`}>
    <div className="card-art"><span className="specimen-number">NO. {BY_ID[insect.id].number}</span><button className={`icon-button bookmark-button ${favorite ? 'is-saved' : ''}`} aria-label={`${insect.name} ${favorite ? '관찰함에서 빼기' : '관찰함에 담기'}`} aria-pressed={favorite} onClick={() => onFavorite(insect.id)}><Bookmark size={18} strokeWidth={1.5} fill={favorite ? 'currentColor' : 'none'} /></button><button className="art-button" onClick={() => onOpen(insect)} aria-label={`${insect.name} 상세 보기`}><Illustration insect={insect} /></button>{selected && <span className="selected-ribbon"><Check size={12} /> 배틀 선택</span>}</div>
    <div className="card-info"><p className="family-name">{insect.family}</p><button className="card-name" onClick={() => onOpen(insect)}>{insect.name}<ArrowRight size={16} /></button><p className="card-latin" title={insect.scientificName}>{insect.genusLatin}</p><div className="traits card-traits">{insect.traits.filter(t => t.id !== 'explorer').slice(0, 2).map(t => <Trait key={t.id} id={t.id} onClick={onTitle} small />)}</div><div className="card-bottom"><div><span><Heart size={12} />HP <b>{insect.stats.hp}</b></span><span><Zap size={12} />민첩 <b>{insect.stats.agility}</b></span></div><button className={`select-fighter ${selected ? 'active' : ''}`} aria-label={`${insect.name} 배틀 ${selected ? '선택 해제' : '선택'}`} aria-pressed={selected} onClick={() => onSelect(insect.id)}>{selected ? <Check size={15} /> : <Plus size={15} />}<span>배틀</span></button></div></div>
  </article>;
}
function Fighter({ insect, index, hp, onPick, locked, event, shown, winner }) {
  return <div className={`fighter fighter-${index} ${winner ? 'winner' : ''} ${insect && hp === 0 ? 'knocked-out' : ''}`}>
    <div className="fighter-top"><span>EXPLORER {String(index + 1).padStart(2, '0')}</span><span className="fighter-dot" /></div>
    {!insect ? <button className="empty-fighter" onClick={() => onPick(index)}><span><Plus size={31} strokeWidth={1.2} /></span><strong>함께할 곤충을 골라주세요</strong><small>{INSECTS.length}종의 손그림 친구들이 기다려요</small></button> : <>
      <div className="fighter-head"><p>{insect.family}</p><h3>{insect.name}</h3><span className="latin">{insect.genusLatin}</span></div>
      <div key={shown} className={`fighter-illustration ${event?.actor === index ? 'attacking' : ''} ${event?.target === index && !event.dodge ? 'hit' : ''}`}><Illustration insect={insect} eager />{event?.target === index && <span className={`damage-pop ${event.dodge ? 'dodged' : ''}`}>{event.dodge ? '회피!' : `${event.critical ? 'CRITICAL ' : ''}−${event.damage}`}</span>}{winner && <span className="winner-stamp"><Trophy size={17} />WINNER</span>}</div>
      <div className="fighter-hp"><div><span><Heart size={14} /> HP</span><strong>{hp}<small> / {insect.stats.hp}</small></strong></div><div className="hp-track"><i style={{ width: `${hp / insect.stats.hp * 100}%` }} /></div></div><div className="fighter-stat-line"><span><Swords size={14} />공격 <b>{insect.stats.attack}</b></span><span><Shield size={14} />방어 <b>{insect.stats.defense}</b></span><span><Zap size={14} />민첩 <b>{insect.stats.agility}</b></span><span><Wind size={14} />회피 <b>{insect.stats.evasion}%</b></span></div><button className="change-fighter" disabled={locked} onClick={() => onPick(index)}><RotateCcw size={13} />다른 곤충 고르기</button>
    </>}
  </div>;
}
function BattleArena({ active, selected, setSelected, onPick, onRunning, onComplete, history, onBrowse }) {
  const [match, setMatch] = useState(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const completed = useRef(null);
  const fighters = match ? match.fighters : selected.map(id => BY_ID[id] || null);
  useEffect(() => { if (!running) setMatch(null); }, [selected[0], selected[1]]);
  useEffect(() => { onRunning(running); }, [running, onRunning]);
  const finish = useCallback(m => {
    setRunning(false);
    if (completed.current === m.id) return;
    completed.current = m.id;
    onComplete({ id: m.id, left: m.fighters[0].id, right: m.fighters[1].id, winner: m.result.winner === null ? null : m.fighters[m.result.winner].id, rounds: m.result.rounds, at: new Date().toISOString() });
  }, [onComplete]);
  useEffect(() => {
    if (!running || !match) return;
    if (match.shown >= match.result.events.length) { finish(match); return; }
    const timer = setTimeout(() => setMatch(m => m ? { ...m, shown: m.shown + 1 } : m), 680 / speed);
    return () => clearTimeout(timer);
  }, [running, match, speed, finish]);
  const start = (pair = selected.map(id => BY_ID[id])) => {
    if (!pair[0] || !pair[1] || pair[0].id === pair[1].id || running) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const result = simulateBattle(pair[0], pair[1], seededRandom(seed));
    setMatch({ id: `${Date.now()}-${seed}`, fighters: pair, result, shown: 0 }); setRunning(true);
  };
  const randomMatch = () => { if (running) return; const pair = randomPair(INSECTS).map(i => BY_ID[i.id]); setSelected(pair.map(i => i.id)); start(pair); };
  const event = match?.shown > 0 ? match.result.events[match.shown - 1] : null;
  const hp = event?.hp || fighters.map(i => i?.stats.hp ?? 0);
  const done = match && !running && match.shown >= match.result.events.length;
  const logs = match?.result.events.slice(0, match.shown).slice(-5).reverse() || [];
  return <main className="battle-page page-width" hidden={!active}>
    <div className="battle-heading"><span className="eyebrow green-text"><Swords size={15} />THE LITTLE WILD ARENA</span><h1>작은 곤충들의 <span>커다란 대결.</span></h1><p>마음에 드는 두 곤충을 골라, 숨겨진 능력을 만나보세요.</p></div>
    <div className="arena-toolbar"><span><span className="live-dot" />손그림 곤충 {INSECTS.length}종 참전</span><button className="button secondary" disabled={running} onClick={randomMatch}><Shuffle size={16} />랜덤 매칭</button></div>
    <div className="arena"><Fighter insect={fighters[0]} index={0} hp={hp[0]} onPick={onPick} locked={running} event={running ? event : null} shown={match?.shown || 0} winner={done && match.result.winner === 0} /><div className="versus"><span>VS</span><small>{match ? `ROUND ${event?.round || 1}` : 'READY?'}</small></div><Fighter insect={fighters[1]} index={1} hp={hp[1]} onPick={onPick} locked={running} event={running ? event : null} shown={match?.shown || 0} winner={done && match.result.winner === 1} /></div>
    <div className="battle-control">{running ? <><div className="battle-in-progress" role="status"><span className="live-dot" />{event ? `${fighters[event.actor].name}의 공격${event.dodge ? '을 회피했어요!' : '!'}` : '두 선수가 서로를 살피고 있어요…'}</div><div className="running-actions"><button className="button secondary" onClick={() => setSpeed(s => s === 1 ? 3 : 1)}><Zap size={16} />{speed}배속</button><button className="button primary" onClick={() => setMatch(m => ({ ...m, shown: m.result.events.length }))}>결과 바로 보기 <ArrowRight size={16} /></button></div></> : done ? <div className="battle-result" role="status"><Trophy size={29} /><span className="eyebrow">GREAT LITTLE ADVENTURE</span><h2>{match.result.winner === null ? '멋진 대결, 무승부예요!' : `${fighters[match.result.winner].name}의 승리!`}</h2><p>{match.result.rounds}라운드 동안 펼쳐진 대결{match.result.limitReached ? ' · 제한 라운드 후 남은 HP 비율로 판정했어요.' : ' · 두 선수 모두 멋졌어요.'}</p><div><button className="button secondary" onClick={() => start(fighters)}><RotateCcw size={16} />다시 대결</button><button className="button primary" onClick={randomMatch}><Shuffle size={16} />새로운 랜덤 매칭</button></div></div> : <><button className="button primary start-battle" disabled={!fighters[0] || !fighters[1]} onClick={() => start()}><Swords size={19} />배틀 시작하기 <ArrowRight size={17} /></button><p className="muted">서로 다른 곤충 두 마리를 선택하면 대결을 시작할 수 있어요.</p></>}</div>
    {match && <section className="battle-log"><div><h2><BookOpen size={17} />대결 관찰 일지</h2><span>{match.shown}번의 움직임</span></div>{logs.length ? logs.map((e, n) => <p key={match.shown - n}><b>R{e.round}</b><span>{fighters[e.actor].name}의 공격 → {e.dodge ? `${fighters[e.target].name} 회피 성공!` : `${fighters[e.target].name} HP −${e.damage}${e.critical ? ' · 치명타!' : ''}`}</span></p>) : <p>첫 움직임을 기다리는 중이에요.</p>}</section>}
    <div className="battle-rules"><div className="rule-icon"><Sparkles size={23} /></div><div><h2>특징은 능력으로, 관찰은 놀이로.</h2><p>민첩성이 높을수록 먼저 움직일 확률이 커지고, 회피율에 따라 공격을 피합니다. 공격력과 방어력으로 피해를 계산하며, 치명타와 운도 승부를 바꿔요.</p><small>게임을 위한 가상 대결입니다. 능력치는 실제 측정값이 아닙니다. 최대 40라운드 후 남은 HP 비율로 판정합니다.</small></div></div>
    <section className="history-section"><div className="section-heading"><div><span className="eyebrow">OUR LITTLE MATCHES</span><h2>지난 대결 기록 <span>{history.length}</span></h2></div><button className="text-button" onClick={onBrowse}>도감에서 선수 찾기 <ArrowRight size={15} /></button></div>{history.length ? <div className="history-list">{history.map(h => <div className="history-item" key={h.id}><Trophy size={18} /><div><strong>{BY_ID[h.left].name} <small>vs</small> {BY_ID[h.right].name}</strong><p>{h.winner ? `${BY_ID[h.winner].name} 승리` : '무승부'} · {h.rounds}라운드</p></div><time dateTime={h.at}>{new Date(h.at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</time><button disabled={running} className="icon-button" aria-label={`${BY_ID[h.left].name} 대결 다시 선택`} onClick={() => setSelected([h.left, h.right])}><RotateCcw size={16} /></button></div>)}</div> : <div className="empty-history"><Swords size={25} /><p>아직 펼쳐지지 않은 이야기.<br />첫 번째 대결을 시작해보세요.</p></div>}</section>
  </main>;
}

export default function App() {
  const [view, setView] = useState(['battle', 'favorites'].includes(initialParams.get('view')) ? initialParams.get('view') : 'catalog');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState(['recommended', 'name', 'hp', 'attack', 'agility'].includes(initialParams.get('sort')) ? initialParams.get('sort') : 'recommended');
  const [page, setPage] = useState(Math.max(1, Math.floor(Number(initialParams.get('page'))) || 1));
  const [favorites, setFavorites] = useState(() => [...new Set(readStored('insectbook-favorites-v1', []).filter(id => BY_ID[id]))]);
  const [history, setHistory] = useState(() => readStored('insectbook-matches-v1', []).filter(h => h && BY_ID[h.left] && BY_ID[h.right] && h.left !== h.right && (!h.winner || [h.left, h.right].includes(h.winner)) && Number.isFinite(h.rounds) && !Number.isNaN(Date.parse(h.at))).slice(0, 10));
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);
  const [picker, setPicker] = useState(null);
  const [battleRunning, setBattleRunning] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toast, setToast] = useState('');
  const resultsRef = useRef(null), searchRef = useRef(null);
  const hero = BY_ID.ZRED0008 || BY_ID[INSECTS[0].id];
  const heroBeetle = BY_ID.ZOEC0014 || hero;
  useEffect(() => { try { localStorage.setItem('insectbook-favorites-v1', JSON.stringify(favorites)); } catch { /* In-memory favorites still work in private storage contexts. */ } }, [favorites]);
  useEffect(() => { try { localStorage.setItem('insectbook-matches-v1', JSON.stringify(history)); } catch { /* In-memory history remains usable. */ } }, [history]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t); }, [toast]);
  const onComplete = useCallback(h => setHistory(old => [h, ...old.filter(x => x.id !== h.id)].slice(0, 10)), []);
  const genusOptions = useMemo(() => [...new Map(INSECTS.filter(i => !filters.family || i.family === filters.family).map(i => [i.genusLatin, { latin: i.genusLatin, name: i.genus }])).values()].filter(g => g.latin).sort((a, b) => a.latin.localeCompare(b.latin)), [filters.family]);
  const filtered = useMemo(() => sortInsects(filterInsects(INSECTS, { ...filters, favorites: view === 'favorites' ? favorites : null }), sort), [filters, favorites, view, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = filters.query || filters.titles.length || filters.family || filters.genus;
  useEffect(() => {
    const p = new URLSearchParams();
    if (view !== 'catalog') p.set('view', view);
    if (filters.query) p.set('q', filters.query);
    if (filters.scope !== 'all') p.set('scope', filters.scope);
    filters.titles.forEach(t => p.append('title', t));
    if (filters.family) p.set('family', filters.family);
    if (filters.genus) p.set('genus', filters.genus);
    if (sort !== 'recommended') p.set('sort', sort);
    if (currentPage > 1) p.set('page', String(currentPage));
    window.history.replaceState(null, '', `${window.location.pathname}${p.size ? '?' + p : ''}`);
  }, [view, filters, sort, currentPage]);
  const updateFilter = patch => { setFilters(old => ({ ...old, ...patch })); setPage(1); };
  const resetFilters = () => { setFilters({ ...EMPTY_FILTERS }); setPage(1); };
  const onTitle = id => { setView('catalog'); updateFilter({ titles: [id], query: '' }); setFilterOpen(false); requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const navigate = next => { setView(next); setFilterOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const onFavorite = id => setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  const onSelect = id => {
    if (battleRunning) { setToast('대결이 끝난 뒤 선수를 바꿀 수 있어요.'); return; }
    if (selected.includes(id)) setSelected(old => old.filter(x => x !== id));
    else if (selected.length < 2) { setSelected(old => [...old, id]); setToast(`${BY_ID[id].name}, 배틀 선수로 선택했어요.`); }
    else setToast('두 선수가 모두 선택됐어요. 한 선수를 해제하고 골라주세요.');
  };
  const pickSlot = (slot, id) => { if (battleRunning) return; setSelected(old => { const next = [...old]; next[slot] = id; return next; }); setPicker(null); };
  const jumpToCollection = () => { setView('catalog'); requestAnimationFrame(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth' }); searchRef.current?.focus({ preventScroll: true }); }); };
  return <>
    <header className="site-header"><div className="header-inner page-width"><button className="brand" onClick={() => navigate('catalog')} aria-label="서치! 곤충도감 홈"><span className="brand-mark"><Bug size={26} strokeWidth={1.6} /></span><span><b>서치!</b><i>곤충도감</i></span></button><nav aria-label="주 메뉴"><button className={view === 'catalog' ? 'active' : ''} onClick={() => navigate('catalog')}><BookOpen size={16} />곤충도감</button><button className={view === 'battle' ? 'active' : ''} onClick={() => navigate('battle')}><Swords size={16} />곤충 배틀<span className="nav-new">PLAY</span></button><button className={view === 'favorites' ? 'active' : ''} onClick={() => navigate('favorites')}><Bookmark size={16} />나의 관찰함{favorites.length > 0 && <span className="nav-count">{favorites.length}</span>}</button></nav><span className="header-note"><span className="live-dot" />작은 자연을 발견하는 곳</span></div></header>
    {view === 'catalog' && <section className="hero page-width"><div className="hero-copy"><span className="eyebrow"><span />A LITTLE CURIOSITY, A BIG DISCOVERY</span><h1>작은 날갯짓,<br /><span>커다란 발견.</span><span className="hero-spark">✳</span></h1><p>이름을 몰라도, 특징만 알아도 괜찮아요.<br />손그림 속 작은 친구들의 특별한 능력을 찾아보세요.</p><div className="hero-actions"><button className="button primary" onClick={jumpToCollection}>나의 곤충 찾기 <ArrowDown size={16} /></button><span><i className="mini-leaves"><Leaf size={19} /><Sprout size={19} /></i>지금까지 <b>{INSECTS.length}종</b>을 그렸어요</span></div></div><div className="hero-art" aria-label="색연필 곤충 관찰 노트"><span className="hero-coordinate">37° N · A FIELD OF WONDER</span><div className="hero-orbit" /><div className="hero-main-sketch"><Illustration insect={hero} eager /><span className="sketch-label"><i />{hero.name}<small>{hero.genusLatin}</small></span></div><button className="hero-mini-sketch" onClick={() => setDetail(heroBeetle)}><span>작지만 강한,</span><Illustration insect={heroBeetle} eager /><strong>{heroBeetle.name}</strong><Trait id="armor" small /></button><div className="hero-sticker"><Sparkles size={16} /><span>자세히 볼수록<br /><b>더 놀라운 세계</b></span></div><span className="hero-flower flower-one">✳</span><span className="hero-flower flower-two">✧</span><span className="pencil-line" /></div></section>}
    {view === 'favorites' && <div className="favorites-heading page-width"><span className="eyebrow green-text">MY FIELD NOTES</span><h1>오래 보고 싶은 <span>작은 친구들.</span></h1><p>마음에 담아 둔 {favorites.length}종의 곤충을 다시 만나보세요.</p></div>}
    <main className="collection page-width" ref={resultsRef} hidden={view === 'battle'}>
      <div className="collection-heading"><div><span className="eyebrow green-text">{view === 'favorites' ? 'MY COLLECTION' : 'THE ILLUSTRATED COLLECTION'}</span><h2>{view === 'favorites' ? '나의 관찰함' : '곤충 탐험하기'} <span>{view === 'favorites' ? favorites.length : INSECTS.length}</span></h2></div><span className="section-note"><Feather size={15} />하나하나, 색연필로 기록한 자연</span></div>
      <div className="search-box"><Search size={23} strokeWidth={1.6} /><select aria-label="검색 범위" value={filters.scope} onChange={e => updateFilter({ scope: e.target.value })}><option value="all">전체 검색</option><option value="name">이름·학명</option><option value="family">과</option><option value="genus">속</option></select><span className="search-divider" /><input ref={searchRef} aria-label="곤충 검색" placeholder="이름, 과, 속 또는 ‘비행의 대가’를 검색해보세요" value={filters.query} onChange={e => updateFilter({ query: e.target.value })} />{filters.query ? <button className="icon-button" onClick={() => updateFilter({ query: '' })} aria-label="검색어 지우기"><X size={18} /></button> : <kbd>⌕</kbd>}</div>
      <div className="suggestions"><span>이런 발견은 어때요?</span>{['flight', 'survivor', 'armor', 'pattern'].map(id => <button key={id} onClick={() => onTitle(id)}>#{TITLE_MAP[id].name}</button>)}</div>
      <div className="collection-layout"><aside className={`filters ${filterOpen ? 'mobile-open' : ''}`}><div className="filter-heading"><h3><SlidersHorizontal size={16} />특징으로 찾아보기</h3><button className="mobile-only icon-button" onClick={() => setFilterOpen(false)} aria-label="필터 닫기"><X size={18} /></button></div><p className="filter-subtitle">어떤 재능이 궁금한가요?</p><button className={`title-filter all-title ${filters.titles.length === 0 ? 'chosen' : ''}`} onClick={() => updateFilter({ titles: [] })} aria-pressed={filters.titles.length === 0}><span><Compass size={17} />모든 타이틀</span><small>{INSECTS.length}</small></button><div className="title-filter-list">{TITLES.filter(t => t.id !== 'explorer' && catalog.titleCounts[t.id] > 0).map(t => <button key={t.id} className={`title-filter ${filters.titles.includes(t.id) ? 'chosen' : ''}`} aria-pressed={filters.titles.includes(t.id)} title={t.description} onClick={() => updateFilter({ titles: filters.titles.includes(t.id) ? filters.titles.filter(id => id !== t.id) : [...filters.titles, t.id] })}><span><TraitIcon id={t.id} size={17} />{t.name}</span><small>{catalog.titleCounts[t.id]}</small></button>)}</div><div className="filter-tip"><Leaf size={19} /><p>여러 타이틀을 선택하면<br /><b>모두 가진 곤충</b>을 찾아요.</p></div><button className="text-button reset-filters" onClick={resetFilters}><RotateCcw size={13} />필터 초기화</button><button className="button primary mobile-only" onClick={() => setFilterOpen(false)}>{filtered.length}종 결과 보기</button></aside>
        <section className="results" aria-label="곤충 검색 결과"><div className="results-toolbar"><p aria-live="polite">{hasFilters ? '발견한 곤충' : view === 'favorites' ? '담아 둔 곤충' : '전체 곤충'} <b>{filtered.length}</b><span>종</span></p><div><button className="mobile-only filter-toggle" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={15} />특징{filters.titles.length ? ` ${filters.titles.length}` : ''}</button><label className="sort-label"><span className="sr-only">정렬</span><select aria-label="정렬" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="recommended">발견 추천순</option><option value="name">이름순</option><option value="hp">HP 높은순</option><option value="attack">공격력 높은순</option><option value="agility">민첩성 높은순</option></select></label></div></div>
          <div className="taxonomy-filters"><label><span>과</span><select aria-label="과 분류" value={filters.family} onChange={e => updateFilter({ family: e.target.value, genus: '' })}><option value="">모든 과</option>{FAMILY_OPTIONS.map(f => <option key={f}>{f}</option>)}</select></label><label><span>속</span><select aria-label="속 분류" value={filters.genus} onChange={e => updateFilter({ genus: e.target.value })}><option value="">모든 속</option>{genusOptions.map(g => <option key={g.latin} value={g.latin}>{g.name ? `${g.name} · ` : ''}{g.latin}</option>)}</select></label><span>{filters.family || filters.genus ? '분류를 좁혀 탐험 중' : '이름을 몰라도 찾을 수 있어요'}</span></div>
          {hasFilters && <div className="active-filters">{filters.titles.map(id => <button key={id} onClick={() => updateFilter({ titles: filters.titles.filter(t => t !== id) })}>{TITLE_MAP[id].name}<X size={12} /></button>)}{filters.family && <button onClick={() => updateFilter({ family: '', genus: '' })}>{filters.family}<X size={12} /></button>}{filters.genus && <button onClick={() => updateFilter({ genus: '' })}>{filters.genus}<X size={12} /></button>}<button className="clear-all" onClick={resetFilters}>모두 지우기</button></div>}
          {visible.length ? <div className="insect-grid">{visible.map(i => <InsectCard key={i.id} insect={i} favorite={favorites.includes(i.id)} selected={selected.includes(i.id)} onFavorite={onFavorite} onSelect={onSelect} onOpen={setDetail} onTitle={onTitle} />)}</div> : <div className="empty-state"><div><Search size={37} strokeWidth={1.2} /></div><span className="eyebrow">A NEW DISCOVERY AWAITS</span><h3>{view === 'favorites' && !favorites.length ? '첫 번째 친구를 담아볼까요?' : '아직 발견하지 못했어요.'}</h3><p>{view === 'favorites' && !favorites.length ? '곤충 카드의 책갈피를 누르면 이곳에 모아둘 수 있어요.' : '검색어를 짧게 바꾸거나 선택한 분류·타이틀을 줄여보세요.'}</p><button className="button primary" onClick={() => { resetFilters(); if (view === 'favorites' && !favorites.length) navigate('catalog'); }}>{view === 'favorites' && !favorites.length ? '곤충 만나러 가기' : '검색 조건 초기화'}<ArrowRight size={16} /></button></div>}
          {filtered.length > PAGE_SIZE && <nav className="pagination" aria-label="검색 결과 페이지"><button className="icon-button" disabled={currentPage === 1} aria-label="이전 페이지" onClick={() => { setPage(currentPage - 1); resultsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}><ChevronLeft size={18} /></button>{[...new Set([1, ...Array.from({ length: 3 }, (_, n) => currentPage - 1 + n).filter(p => p > 1 && p < pageCount), pageCount])].flatMap((p, n, arr) => [n > 0 && p - arr[n - 1] > 1 ? <span key={`gap-${p}`}>…</span> : null, <button key={p} className={currentPage === p ? 'current' : ''} aria-current={currentPage === p ? 'page' : undefined} onClick={() => { setPage(p); resultsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>{p}</button>])}<button className="icon-button" disabled={currentPage === pageCount} aria-label="다음 페이지" onClick={() => { setPage(currentPage + 1); resultsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}><ChevronRight size={18} /></button><small>{currentPage} / {pageCount} 페이지</small></nav>}
          <div className="battle-invitation"><div className="invite-icon"><Swords size={26} strokeWidth={1.3} /></div><div><span className="eyebrow">A LITTLE FRIENDLY COMPETITION</span><h3>이 작은 친구가 얼마나 강할까?</h3><p>두 곤충을 골라, 특징이 능력이 되는 대결을 즐겨보세요.</p></div><button className="text-button" onClick={() => navigate('battle')}>곤충 배틀 가기 <ArrowRight size={17} /></button></div>
        </section>
      </div>
    </main>
    <BattleArena active={view === 'battle'} selected={selected} setSelected={setSelected} onPick={setPicker} onRunning={setBattleRunning} onComplete={onComplete} history={history} onBrowse={jumpToCollection} />
    <footer className="site-footer page-width"><div><span className="footer-brand"><Bug size={19} /><b>서치!</b> 곤충도감</span><p>작은 세계를 발견하는 당신의 호기심을 응원해요.</p></div><div><a href="https://www.nature.go.kr/kbi/insct/pilbk/selectInsctPilbkGnrlList.do" target="_blank" rel="noreferrer">관찰 정보 · 국립수목원 <ExternalLink size={12} /></a><small>원본 사진을 참고한 손그림 · 타이틀과 능력치는 게임을 위한 재해석입니다.</small></div></footer>
    {selected.some(Boolean) && view !== 'battle' && <div className="selection-tray"><div className="tray-label"><Swords size={19} /><strong>대결할 친구들</strong><span>{selected.filter(Boolean).length} / 2</span></div><div className="tray-fighters">{[0, 1].map(n => selected[n] ? <button disabled={battleRunning} key={n} onClick={() => onSelect(selected[n])} aria-label={`${BY_ID[selected[n]].name} 배틀 선택 해제`}><img src={assetUrl(BY_ID[selected[n]].image)} alt="" /><span>{BY_ID[selected[n]].name}</span><X size={13} /></button> : <span key={n} className="tray-empty"><Plus size={15} />친구를 골라주세요</span>)}</div><button className="button primary" disabled={selected.filter(Boolean).length < 2} onClick={() => navigate('battle')}>대결하러 가기 <ArrowRight size={16} /></button></div>}
    {detail && <Detail key={detail.id} insect={detail} onClose={() => setDetail(null)} favorite={favorites.includes(detail.id)} onFavorite={onFavorite} selected={selected.includes(detail.id)} onSelect={onSelect} onTitle={onTitle} />}
    {picker !== null && <Picker slot={picker} selected={selected} onPick={pickSlot} onClose={() => setPicker(null)} />}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
  </>;
}
