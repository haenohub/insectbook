export const TITLES = [
  { id: 'flight', name: '비행의 대가', icon: 'wind', color: 'sky', description: '가볍게, 때로는 누구보다 빠르게.' },
  { id: 'survivor', name: '생존왕', icon: 'sprout', color: 'green', description: '계절을 건너는 작은 생명력.' },
  { id: 'armor', name: '갑옷 전사', icon: 'shield', color: 'stone', description: '단단한 겉날개에서 얻은 방어력.' },
  { id: 'hunter', name: '사냥의 고수', icon: 'crosshair', color: 'coral', description: '날카로운 감각의 공격형 선수.' },
  { id: 'jump', name: '점프 챔피언', icon: 'zap', color: 'amber', description: '뒷다리에 숨겨 둔 도약의 힘.' },
  { id: 'camouflage', name: '위장술사', icon: 'leaf', color: 'green', description: '주변에 스며드는 숨바꼭질 선수.' },
  { id: 'flower', name: '꽃의 친구', icon: 'flower', color: 'pink', description: '꽃을 찾아다니는 분류군의 별명.' },
  { id: 'water', name: '물속 모험가', icon: 'droplet', color: 'sky', description: '물과 이어진 생태에서 찾은 능력.' },
  { id: 'night', name: '밤의 탐험가', icon: 'moon', color: 'purple', description: '원문에 기록된 밤의 활동.' },
  { id: 'recycler', name: '숲속 재활용가', icon: 'recycle', color: 'amber', description: '순환하는 자연 속 작은 역할.' },
  { id: 'pattern', name: '패턴 아티스트', icon: 'palette', color: 'purple', description: '점, 선, 색으로 완성한 개성.' },
  { id: 'tiny', name: '작은 거인', icon: 'sparkles', color: 'pink', description: '작은 몸집을 위한 특별한 별명.' },
  { id: 'wing', name: '날개의 화가', icon: 'feather', color: 'amber', description: '나비목의 날개에서 얻은 상상력.' },
  { id: 'precision', name: '정밀한 기술자', icon: 'crosshair', color: 'sky', description: '섬세한 몸 구조에서 착안한 정밀함.' },
  { id: 'pincers', name: '집게의 명수', icon: 'shield', color: 'coral', description: '배 끝 집게를 게임 능력으로.' },
  { id: 'sense', name: '더듬이 탐정', icon: 'compass', color: 'green', description: '더듬이의 감각을 상상 속 능력으로.' },
  { id: 'explorer', name: '작은 탐험가', icon: 'compass', color: 'green', description: '모든 곤충에게 열려 있는 모험.' },
];
export const TITLE_MAP = Object.fromEntries(TITLES.map(t => [t.id, t]));
export const STAT_META = [
  { key: 'hp', label: 'HP', max: 170, unit: '', color: 'green' },
  { key: 'attack', label: '공격력', max: 44, unit: '', color: 'coral' },
  { key: 'defense', label: '방어력', max: 36, unit: '', color: 'stone' },
  { key: 'agility', label: '민첩성', max: 96, unit: '', color: 'amber' },
  { key: 'evasion', label: '회피율', max: 32, unit: '%', color: 'sky' },
];
const clamp = (n, min, max) => Math.max(min, Math.min(max, Math.round(n)));
function findBodySize(text) {
  const matches = [...text.matchAll(/(?:몸\s*길이|체장)(?:는|가|이|은)?[^.\n\d]{0,20}(\d+(?:\.\d+)?)\s*(?:[~～∼\-–]\s*(\d+(?:\.\d+)?))?\s*(mm|㎜|cm|㎝)/gi)];
  if (!matches.length) return null;
  const m = matches[0];
  const size = ((Number(m[1]) + Number(m[2] || m[1])) / 2) * (/c|㎝/i.test(m[3]) ? 10 : 1);
  return size > 0 && size <= 250 ? Math.round(size * 10) / 10 : null;
}
function excerpt(text, regex) {
  return text.split(/(?<=[.!?。])\s+|\n/).find(line => regex.test(line))?.trim().slice(0, 190) || '';
}
export function createProfile(record) {
  const order = record.taxonomy?.order?.name_ko || '기타';
  const family = record.family_ko || record.taxonomy?.family?.name_latin || '과 미상';
  const genus = record.taxonomy?.genus || {};
  const general = record.information?.general_description || '';
  const ecology = ['ecology', 'habits', 'overwintering', 'larva', 'adult', 'adult_male', 'adult_female'].map(k => record.information?.[k] || '').join('\n');
  const size = findBodySize(general);
  const traits = [];
  const add = (id, reason, basis = 'classification') => { if (!traits.some(t => t.id === id)) traits.push({ id, reason, basis }); };
  if (order === '잠자리목' || order === '파리목' || family === '박각시과') add('flight', `${order === '잠자리목' ? '잠자리목' : family}의 비행 형태에서 착안한 기동형 게임 타이틀입니다.`);
  if (/월동|겨울을|겨울에/.test(ecology)) add('survivor', `계절을 견디는 생태 기록에서 착안했어요. “${excerpt(ecology, /월동|겨울을|겨울에/)}”`, 'source');
  if (order === '딱정벌레목') add('armor', '딱정벌레목의 단단한 앞날개에서 착안한 방어형 게임 타이틀입니다.');
  if (order === '잠자리목' || ['딱정벌레과', '길앞잡이과', '사마귀과', '말벌과', '사슴벌레과'].includes(family)) add('hunter', `${family}의 턱·운동 형태를 공격형 역할로 재해석한 게임 별명입니다. 종별 먹이를 단정하는 뜻은 아니에요.`);
  if (order === '메뚜기목' || ['매미충과', '거품벌레과', '벼룩과', '방아벌레과'].includes(family)) add('jump', `${family}의 다리와 도약 형태에서 착안한 민첩형 게임 타이틀입니다.`);
  if (/보호색|의태|위장|나뭇가지처럼|낙엽처럼/.test(ecology) || order === '대벌레목') add('camouflage', excerpt(ecology, /보호색|의태|위장|나뭇가지처럼|낙엽처럼/) || '대벌레목의 나뭇가지 같은 몸 형태에서 착안한 게임 별명입니다.', /보호색|의태|위장|나뭇가지처럼|낙엽처럼/.test(ecology) ? 'source' : 'classification');
  if (['꿀벌과', '꼬마꽃벌과', '가위벌과', '꽃등에과'].includes(family)) add('flower', `${family}라는 분류군과 꽃의 관계에서 착안한 게임 별명입니다.`);
  if (['물방개과', '물맴이과', '물땡땡이과', '장구애비과', '송장헤엄치게과', '소금쟁이과'].includes(family) || /물속|물 속|수중|수서|유충은.*(?:연못|하천|방죽)/.test(ecology)) add('water', excerpt(ecology, /물속|물 속|수중|수서|유충은.*(?:연못|하천|방죽)/) || `${family}의 물과 관련된 생활 형태에서 착안한 게임 별명입니다.`, /물속|물 속|수중|수서|유충은.*(?:연못|하천|방죽)/.test(ecology) ? 'source' : 'classification');
  if (/야간|야행성|밤에|등불|불빛|유아등/.test(ecology)) add('night', `“${excerpt(ecology, /야간|야행성|밤에|등불|불빛|유아등/)}”라는 활동 기록에서 착안했어요.`, 'source');
  if (/배설물|분변|사체|썩은|똥|퇴비/.test(ecology) || /^(Onthophagus|Aphodius|Geotrupes|Silpha|Nicrophorus)$/.test(genus.name_latin || '')) add('recycler', excerpt(ecology, /배설물|분변|사체|썩은|똥|퇴비/) || `${genus.name_latin}속의 생태적 역할에서 착안한 게임 별명입니다.`, /배설물|분변|사체|썩은|똥|퇴비/.test(ecology) ? 'source' : 'classification');
  if (/무늬|반점|얼룩|금속|색띠/.test(general)) add('pattern', `색과 무늬에 관한 관찰 기록에서 착안했어요. “${excerpt(general, /무늬|반점|얼룩|금속|색띠/)}”`, 'source');
  if (size !== null && size <= 5) add('tiny', `원문에서 읽은 몸길이 약 ${size}mm를 작은 몸의 기동성으로 재해석했어요.`, 'source');
  if (order === '나비목') add('wing', '나비목의 날개 형태와 색에서 착안한 게임 별명입니다.');
  if (/산란관|기생/.test(general + '\n' + ecology)) add('precision', `섬세한 몸 구조 또는 기생 습성에 관한 원문에서 착안한 정밀형 게임 타이틀입니다. “${excerpt(general + '\n' + ecology, /산란관|기생/)}”`, 'source');
  if (order === '집게벌레목') add('pincers', '집게벌레목의 배 끝 집게를 공격형 게임 능력으로 재해석했어요.');
  if (traits.length < 2) add('sense', '곤충의 더듬이를 감각 능력으로 재해석한 공통 게임 별명입니다. 종별 감각 성능의 측정값을 뜻하지 않아요.', 'game');
  add('explorer', '자연을 관찰하는 이 도감의 모든 곤충에게 붙이는 공통 게임 별명입니다.', 'game');
  const base = {
    '잠자리목': [106, 29, 13, 86, 24], '딱정벌레목': [128, 27, 28, 43, 9],
    '나비목': [91, 20, 12, 66, 20], '벌목': [104, 28, 17, 73, 19],
    '파리목': [84, 18, 10, 85, 26], '노린재목': [108, 21, 21, 51, 13],
    '메뚜기목': [111, 25, 18, 74, 20], '집게벌레목': [121, 29, 24, 48, 11],
    '대벌레목': [108, 17, 15, 38, 24],
  }[order] || [100, 22, 18, 56, 15];
  let [hp, attack, defense, agility, evasion] = base;
  const has = id => traits.some(t => t.id === id);
  if (size !== null) { const b = clamp((size - 15) * 0.65, -12, 24); hp += b; }
  if (has('survivor')) { hp += 13; defense += 2; }
  if (has('hunter')) attack += 6;
  if (has('jump')) { agility += 9; evasion += 3; }
  if (has('camouflage')) evasion += 6;
  if (has('tiny')) { agility += 6; evasion += 3; }
  if (has('precision')) { attack += 2; evasion += 2; }
  if (has('pincers')) { attack += 5; defense += 2; }
  if (has('sense')) { agility += 3; evasion += 2; }
  if (has('water')) { hp += 4; defense += 1; }
  if (family === '사슴벌레과') { hp += 15; attack += 6; agility -= 6; }
  if (family === '박각시과') { agility += 12; attack += 3; }
  const stats = { hp: clamp(hp, 70, 170), attack: clamp(attack, 14, 44), defense: clamp(defense, 8, 36), agility: clamp(agility, 25, 96), evasion: clamp(evasion, 5, 32) };
  return {
    id: record.id, name: record.display_name, scientificName: record.scientific_name,
    family, familyLatin: record.taxonomy?.family?.name_latin || '', order,
    genus: genus.name_ko || '', genusLatin: genus.name_latin || '',
    image: '/' + record.illustration.image_path, traits, stats, size,
    summary: general ? general.split(/(?<=[.!?。])\s+|\n/)[0].slice(0, 160) : `${family}에 속하는 곤충입니다. 자세한 관찰 기록을 펼쳐보세요.`,
    sourceUrl: record.source.url,
    statReason: `${order}의 기본 능력치에${size !== null ? ` 원문의 몸길이 약 ${size}mm와` : ''} 특징 타이틀의 보정을 더한 게임 수치예요. 실제 측정값이나 생물학적 우열을 뜻하지 않습니다.`,
  };
}
