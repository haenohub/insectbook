// Keep every local asset below Vite's configured project path (e.g. /insectbook/).
export function assetUrl(path, base = import.meta.env?.BASE_URL || '/') {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
}
