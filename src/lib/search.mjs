import { TITLE_MAP } from './profiles.mjs';
export const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function matchesQuery(insect, query, scope = 'all') {
  const fields = {
    name: [insect.name, insect.scientificName], family: [insect.family, insect.familyLatin],
    genus: [insect.genus, insect.genusLatin],
  };
  const haystack = normalize((fields[scope] || [...fields.name, ...fields.family, ...fields.genus, insect.order, ...insect.traits.map(t => TITLE_MAP[t.id].name)]).join(' '));
  const compact = haystack.replace(/\s+/g, '');
  return normalize(query).split(' ').every(token => haystack.includes(token) || compact.includes(token));
}
export function filterInsects(insects, { query = '', scope = 'all', titles = [], family = '', genus = '', favorites = null } = {}) {
  return insects.filter(i => matchesQuery(i, query, scope) && (!family || i.family === family) && (!genus || i.genusLatin === genus) && titles.every(t => i.traits.some(it => it.id === t)) && (!favorites || favorites.includes(i.id)));
}
export function sortInsects(insects, sort = 'recommended') {
  const featured = ['ZRED0008', 'ZOEC0014', 'ZDAP0009', 'ZOBZ0037', 'ZTDV0012', 'ZREP0001', 'ZGBA0003', 'ZDAC0001', 'ZDAN0003', 'ZMAJ0111', 'ZOBL0115', 'ZOBH0441'];
  return [...insects].sort((a, b) => {
    if (sort === 'hp' || sort === 'attack' || sort === 'agility') return b.stats[sort] - a.stats[sort] || a.name.localeCompare(b.name, 'ko');
    if (sort === 'recommended') {
      const ar = featured.indexOf(a.id), br = featured.indexOf(b.id);
      if (ar !== -1 || br !== -1) return (ar === -1 ? 999 : ar) - (br === -1 ? 999 : br);
    }
    return a.name.localeCompare(b.name, 'ko');
  });
}
