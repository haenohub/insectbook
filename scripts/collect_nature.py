#!/usr/bin/env python3
"""Collect public Nature insect encyclopedia records; retain photo-bearing entries."""
import argparse
import concurrent.futures
import csv
import gzip
import hashlib
import json
import math
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urljoin

import httpx
from bs4 import BeautifulSoup

BASE = 'https://www.nature.go.kr'
LIST = BASE + '/kbi/insct/pilbk/selectInsctPilbkGnrlList.do'
DETAIL = BASE + '/kbi/insct/pilbk/selectInsctPilbkDtl.do'
ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/workspace/.cache/insectbook/nature')
OUT = ROOT / 'data'
RANKS = {'목': 'order', '상과': 'superfamily', '과': 'family', '아과': 'subfamily', '족': 'tribe', '속': 'genus', '아속': 'subgenus'}
FIELDS = {'일반특징': 'general_description', '성충': 'adult', '성충(수)': 'adult_male', '성충(암)': 'adult_female',
          '유충': 'larva', '알': 'egg', '번데기': 'pupa', '생태': 'ecology', '습성': 'habits',
          '출현시기': 'season', '월동': 'overwintering', '국내외분포': 'distribution', '특기사항': 'notes',
          '방제법': 'pest_control', '참고사항': 'references'}
PROMPT = '참고 사진 속 곤충의 자세, 체형, 색상과 무늬를 유지해 정교한 색연필 자연도감 삽화로 그려줘. 배경과 식물은 제거하고 흰색의 미세한 종이 질감을 사용해줘. 털은 섬세한 연필 선으로, 날개는 반투명하게 표현해줘. 곤충 전체가 잘리지 않게 중앙에 배치하고 여백을 충분히 남겨줘. 글자나 장식은 넣지 마.'
local = threading.local()
gate = threading.Lock()
next_request = 0.0


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(path)


def text(node):
    if node is None:
        return None
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True)).strip() or None


def lines(node):
    if node is None:
        return None
    for br in node.find_all('br'):
        br.replace_with('\n')
    return '\n'.join(re.sub(r'[ \t\r\f\v]+', ' ', x).strip() for x in node.get_text().split('\n') if x.strip()) or None


def soup(html):
    # Navigation is large and contains unrelated species links; parse only content.
    start = html.find('class="default_info"')
    if start >= 0:
        start = html.rfind('<', 0, start)
        html = html[start:]
    return BeautifulSoup(html, 'html.parser')


def fetch(kind, key, url, refresh=False):
    global next_request
    path = CACHE / f'{kind}-{key}.html.gz'
    if path.exists() and not refresh:
        with gzip.open(path, 'rt', encoding='utf-8') as f:
            return f.read()
    if not hasattr(local, 'client'):
        local.client = httpx.Client(http2=False, follow_redirects=True, timeout=45,
                                   headers={'User-Agent': 'Mozilla/5.0 (compatible; Insectbook research)'})
    error = None
    for attempt in range(4):
        with gate:
            delay = max(0, next_request - time.monotonic())
            next_request = max(next_request, time.monotonic()) + 0.25
        if delay:
            time.sleep(delay)
        try:
            response = local.client.get(url)
            response.raise_for_status()
            html = response.content.decode('utf-8', errors='strict')
            marker = 'thumb_bbs_list' if kind == 'list' else 'default_info'
            if marker not in html:
                raise ValueError(f'Not an encyclopedia {kind} response')
            path.parent.mkdir(parents=True, exist_ok=True)
            with gzip.open(path.with_suffix('.tmp'), 'wt', encoding='utf-8') as f:
                f.write(html)
            path.with_suffix('.tmp').replace(path)
            return html
        except Exception as exc:
            error = exc
            time.sleep(min(2 ** attempt, 8))
    raise RuntimeError(f'{kind} {key}: {error}')


def parse_list(html, page):
    s = BeautifulSoup(html, 'html.parser')
    summary = text(s.select_one('.total_result'))
    match = re.search(r'전체\s*([\d,]+)건', summary or '')
    if not match:
        raise ValueError('List total missing')
    records = []
    for li in s.select('.thumb_bbs_list > li'):
        link = li.select_one('[onclick*="fn_detailInfo"]')
        ident = re.search(r"fn_detailInfo\('([^']+)'\)", link['onclick']).group(1)
        info = li.select_one('.thumb_bbs_info .pointer')
        name = text(info.select_one('.color_green'))
        ps = info.find_all('p', recursive=False)
        img = li.select_one('.thumb_first img')
        src = img.get('src', '') if img else ''
        records.append({'id': ident, 'name_ko': name, 'scientific_name': text(ps[1]) if len(ps) > 1 else None,
                        'family_ko': text(ps[0]).split('/')[-1].strip(),
                        'thumbnail_url': urljoin(BASE, src) if '/fileUpload/' in src else None,
                        'list_page': page})
    if not records:
        raise ValueError('Empty list page')
    return int(match.group(1).replace(',', '')), records


def parse_detail(html, entry):
    s = soup(html)
    default = s.select_one('.default_info')
    if default is None:
        raise ValueError('Missing default_info')
    basic = {}
    taxonomy = {}
    taxonomy_text = None
    for li in default.select('ul > li'):
        label = li.find('p', recursive=False)
        if label is None:
            continue
        label_text = text(label)
        if label_text == '분류학적위치':
            node = li.find('div')
            taxonomy_text = lines(node)
            for line in (taxonomy_text or '').splitlines():
                m = re.match(r'([^:]+)\s*:\s*(.*?)\s*\(([^)]+)\)\s*$', line)
                if m:
                    rank, ko, latin = m.groups()
                    taxonomy[RANKS.get(rank.strip(), rank.strip())] = {'name_ko': ko.strip(), 'name_latin': latin.strip()}
        else:
            copy = li.select_one('[data-name]')
            if copy:
                basic[label_text] = copy['data-name'].strip()
            else:
                label.extract()
                for button in li.select('.btn_copy'):
                    button.extract()
                basic[label_text] = text(li)
    if (basic.get('곤충명') or None) != entry['name_ko']:
        raise ValueError(f"Detail name mismatch: {basic.get('곤충명')!r} != {entry['name_ko']!r}")
    sections = []
    for container in s.select('.bbs_detail_txt'):
        for h in container.select('h4'):
            chunks = []
            for sibling in h.next_siblings:
                if getattr(sibling, 'name', None) in ('h3', 'h4'):
                    break
                if getattr(sibling, 'name', None):
                    value = lines(sibling)
                    if value:
                        chunks.append(value)
            sections.append({'title': text(h), 'text': '\n'.join(chunks) or None})
    images = []
    seen = set()
    for img in s.select('.pictures img[data-original]'):
        original = urljoin(BASE, img['data-original'])
        if '/fileUpload/' not in original or original in seen:
            continue
        seen.add(original)
        images.append({'id': f"{entry['id']}-{len(images)+1}", 'original_url': original,
                       'thumbnail_url': urljoin(BASE, img['src']), 'alt': img.get('alt') or None,
                       'display_url': None, 'caption': None, 'photographed_at': None,
                       'location': None, 'photographer': None})
    gallery = {}
    for a in s.select('.thumbImgWrap a[onclick]'):
        args = re.findall(r"'((?:\\.|[^'\\])*)'", a['onclick'])
        args = [x.replace("\\'", "'").replace('\\\\', '\\') for x in args]
        if len(args) >= 6:
            gallery[urljoin(BASE, args[5])] = args
    for img in images:
        args = gallery.get(img['original_url'])
        if args:
            img.update({'display_url': urljoin(BASE, args[0]), 'caption': args[1] or None,
                        'photographer': args[2] or None, 'photographed_at': args[3] or None,
                        'location': args[4] or None})
    # Use only encyclopedia gallery photos, never related plants or specimen thumbnails.
    if not images:
        return None
    info = {field: None for field in FIELDS.values()}
    for section in sections:
        if section['title'] in FIELDS:
            field = FIELDS[section['title']]
            info[field] = '\n'.join(filter(None, [info[field], section['text']])) or None
    specimens = []
    for a in s.select('a[title="곤충표본 상세정보"]'):
        m = re.search(r"'smplDtl'\s*,\s*'([^']+)'", a.get('onclick', ''))
        if m:
            specimens.append({'id': m.group(1), 'description': text(a)})
    related = []
    for li in s.select('.connect_info > li'):
        heading = li.select_one('h2')
        name = heading.select_one('strong') if heading else None
        if name:
            full = text(heading)
            related.append({'group': text(li.find('p', recursive=False)), 'name_ko': text(name),
                            'scientific_name': full.split(' - ', 1)[1] if ' - ' in full else None})
    return {'id': entry['id'], 'name_ko': entry['name_ko'], 'scientific_name': basic.get('학명') or entry['scientific_name'],
            'display_name': entry['name_ko'] or basic.get('학명') or entry['scientific_name'],
            'family_ko': entry['family_ko'], 'taxonomy': taxonomy, 'taxonomy_text': taxonomy_text, 'basic_information': basic,
            'information': info, 'sections': sections, 'images': images,
            'representative_image_id': images[0]['id'], 'specimen_examples': specimens, 'related_species': related,
            'illustration': {'status': 'pending', 'image_path': None, 'reference_image_id': images[0]['id']},
            'source': {'provider': '국립수목원 국가생물종지식정보시스템',
                       'url': DETAIL + '?' + urlencode({'insctPilbkNo': entry['id'], 'tabId': 'tab1'}),
                       'collected_at': now(), 'html_sha256': hashlib.sha256(html.encode('utf-8')).hexdigest(),
                       'rights_url': BASE + '/kbi/us/open/KBI_2006_030000.do',
                       'license': None}}


def collect_lists(refresh=False):
    total, first = parse_list(fetch('list', 1, LIST + '?pageIndex=1&pageUnit=100', refresh), 1)
    pages = math.ceil(total / 100)
    results = {1: first}
    def work(page):
        got_total, items = parse_list(fetch('list', page, LIST + '?' + urlencode({'pageIndex': page, 'pageUnit': 100}), refresh), page)
        if got_total != total:
            raise ValueError('Source total changed during pagination')
        return items
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(work, page): page for page in range(2, pages + 1)}
        for f in concurrent.futures.as_completed(futures):
            results[futures[f]] = f.result()
            print(f'Lists: {len(results)}/{pages}', flush=True)
    entries = [item for page in sorted(results) for item in results[page]]
    if len(entries) != total or len({x['id'] for x in entries}) != total:
        raise ValueError(f'Pagination mismatch: expected {total}, got {len(entries)}')
    dump(OUT / 'source-index.json', {'collected_at': now(), 'source_total': total, 'entries': entries})
    print(f'Lists complete: total={total}, list_photos={sum(bool(x["thumbnail_url"]) for x in entries)}', flush=True)
    return entries


def collect_details(entries, workers, refresh=False, reparse=False):
    outcomes = {}
    progress = CACHE / 'outcomes.json'
    if progress.exists() and not refresh:
        outcomes = json.loads(progress.read_text())
    pending = [e for e in entries if reparse or e['id'] not in outcomes or outcomes[e['id']]['status'] == 'error'
               or (outcomes[e['id']]['status'] == 'included'
                   and not (OUT / 'insects' / (e['id'] + '.json')).exists()
                   and not (OUT / 'excluded-records' / (e['id'] + '.json')).exists())]
    def work(entry):
        ident = entry['id']
        try:
            html = fetch('detail', ident, DETAIL + '?' + urlencode({'insctPilbkNo': ident, 'tabId': 'tab1'}), refresh)
            record = parse_detail(html, entry)
            if record:
                saved_path = OUT / 'insects' / f'{ident}.json'
                if saved_path.exists():
                    previous = json.loads(saved_path.read_text())
                    previous_art = previous.get('illustration', {})
                    old_ref = next((i for i in previous.get('images', []) if i['id'] == previous_art.get('reference_image_id')), None)
                    new_ref = next((i for i in record['images'] if old_ref and i['original_url'] == old_ref['original_url']), None)
                    if new_ref:
                        record['illustration'] = {**previous_art, 'reference_image_id': new_ref['id']}
                cache_path = CACHE / f'detail-{ident}.html.gz'
                record['source']['collected_at'] = datetime.fromtimestamp(cache_path.stat().st_mtime, timezone.utc).isoformat(timespec='seconds')
                dump(OUT / 'insects' / f'{ident}.json', record)
                return {'status': 'included', 'image_count': len(record['images'])}
            return {'status': 'excluded', 'reason': 'no_encyclopedia_gallery_photo'}
        except Exception as exc:
            return {'status': 'error', 'error': str(exc)}
    print(f'Details: {len(entries)-len(pending)} retained; {len(pending)} pending', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(work, e): e for e in pending}
        for count, f in enumerate(concurrent.futures.as_completed(futures), 1):
            e = futures[f]
            outcomes[e['id']] = f.result()
            if count % 25 == 0 or count == len(pending):
                dump(progress, outcomes)
                counts = {k: sum(v['status'] == k for v in outcomes.values()) for k in ('included', 'excluded', 'error')}
                print(f'Details {len(outcomes)}/{len(entries)}: {counts}', flush=True)
    dump(progress, outcomes)
    return outcomes


def review_exclusion_reason(record, reviews):
    review = reviews.get(record['id'])
    if not review or {i['original_url'] for i in record['images']} != {i['original_url'] for i in review['images']}:
        return None
    return {'exclude_anatomy_only': 'gallery_anatomy_only',
            'source_unavailable': 'gallery_image_unavailable'}.get(review['decision'])


def export(entries, outcomes):
    records = []
    excluded = []
    errors = []
    review_path = OUT / 'photo-review.json'
    reviews = {r['id']: r for r in json.loads(review_path.read_text())['records']} if review_path.exists() else {}
    for entry in entries:
        outcome = outcomes.get(entry['id'], {'status': 'error', 'error': 'Not processed'})
        if outcome['status'] == 'included':
            saved = OUT / 'insects' / (entry['id'] + '.json')
            archive = OUT / 'excluded-records' / saved.name
            record = json.loads((saved if saved.exists() else archive).read_text())
            reason = review_exclusion_reason(record, reviews)
            if reason:
                if record['illustration']['status'] != 'pending':
                    raise ValueError('Review exclusion conflicts with generated illustration: ' + entry['id'])
                archive.parent.mkdir(parents=True, exist_ok=True)
                if saved.exists():
                    saved.replace(archive)
                excluded.append({**entry, 'reason': reason, 'record_path': archive.relative_to(OUT).as_posix(),
                                 'image_review_path': 'photo-review.json'})
            else:
                if not saved.exists():
                    archive.replace(saved)
                records.append(record)
        elif outcome['status'] == 'excluded':
            excluded.append({**entry, 'reason': outcome['reason']})
        else:
            errors.append({**entry, 'error': outcome['error']})
    counts = {'source_total': len(entries), 'included': len(records), 'excluded_total': len(excluded),
              'excluded_without_gallery_photos': sum(r['reason'] == 'no_encyclopedia_gallery_photo' for r in excluded),
              'excluded_anatomy_only': sum(r['reason'] == 'gallery_anatomy_only' for r in excluded),
              'excluded_image_unavailable': sum(r['reason'] == 'gallery_image_unavailable' for r in excluded),
              'errors': len(errors), 'gallery_photos': sum(len(r['images']) for r in records)}
    dataset = {'schema_version': 1, 'generated_at': now(), 'source': LIST, 'counts': counts, 'insects': records}
    dump(OUT / 'insects.json', dataset)
    dump(OUT / 'excluded.json', excluded)
    dump(OUT / 'errors.json', errors)
    dump(OUT / 'collection-report.json', {'generated_at': now(), 'complete': not errors and len(outcomes) == len(entries),
                                        'counts': counts, 'filter': 'Gallery image present; visual review excludes anatomy-only and unavailable-image records',
                                        'network': {'max_concurrency': 8, 'minimum_request_interval_seconds': 0.25},
                                        'image_files_downloaded': False, 'all_image_urls_http_verified': False})
    catalog = []
    for r in records:
        catalog.append({'id': r['id'], 'name_ko': r['name_ko'], 'display_name': r['display_name'], 'scientific_name': r['scientific_name'],
                        'taxonomy': r['taxonomy'], 'family_ko': r['family_ko'], 'photo_count': len(r['images']),
                        'thumbnail_url': r['images'][0]['thumbnail_url'], 'record_path': f"insects/{r['id']}.json",
                        'illustration': r['illustration']})
    dump(OUT / 'catalog.json', {'schema_version': 1, 'count': len(catalog), 'insects': catalog})
    fields = ['id', 'name_ko', 'display_name', 'scientific_name', 'order_ko', 'family_ko', 'photo_count',
              'general_description', 'ecology', 'distribution', 'notes', 'original_image_url', 'source_url']
    with (OUT / 'insects.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in records:
            writer.writerow({'id': r['id'], 'name_ko': r['name_ko'], 'display_name': r['display_name'], 'scientific_name': r['scientific_name'],
                             'order_ko': r['taxonomy'].get('order', {}).get('name_ko'), 'family_ko': r['family_ko'],
                             **{k: r['information'][k] for k in ('general_description', 'ecology', 'distribution', 'notes')},
                             'photo_count': len(r['images']), 'original_image_url': r['images'][0]['original_url'],
                             'source_url': r['source']['url']})
    with (OUT / 'illustration-jobs.jsonl').open('w', encoding='utf-8') as f:
        for r in records:
            ref = next(i for i in r['images'] if i['id'] == r['illustration']['reference_image_id'])
            job = {'insect_id': r['id'], 'name_ko': r['name_ko'], 'display_name': r['display_name'], 'reference_image_id': ref['id'],
                   'reference_image_url': ref['original_url'], 'prompt_path': 'illustration-prompt.json',
                   'suggested_output_path': f"assets/illustrations/{r['id']}.png", 'status': r['illustration']['status'],
                   'image_path': r['illustration']['image_path'], 'style_id': r['illustration'].get('style_id', 'gentle-colored-pencil-v1')}
            f.write(json.dumps(job, ensure_ascii=False) + '\n')
    if not (OUT / 'illustration-prompt.json').exists():
        dump(OUT / 'illustration-prompt.json', {'prompt': PROMPT, 'reference': 'Use original_url of illustration.reference_image_id',
                                              'output_field': 'illustration.image_path'})
    print(json.dumps(counts, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, choices=range(1, 9), default=8)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--lists-only', action='store_true')
    parser.add_argument('--reparse', action='store_true', help='Rebuild records using retained HTML, without refreshing network responses')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    entries = collect_lists(args.refresh)
    if args.lists_only:
        return
    outcomes = collect_details(entries, args.workers, args.refresh, args.reparse)
    export(entries, outcomes)
    if any(outcomes[e['id']]['status'] == 'error' for e in entries):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
