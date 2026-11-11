#!/usr/bin/env python3
"""Validate saved data independently of the HTML collector."""
import csv
import json
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1] / 'data'


def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def main():
    report = read('collection-report.json')
    source = read('source-index.json')
    dataset = read('insects.json')
    catalog = read('catalog.json')
    excluded = read('excluded.json')
    errors = read('errors.json')
    records = dataset['insects']
    ids = {r['id'] for r in records}
    source_ids = {r['id'] for r in source['entries']}
    excluded_ids = {r['id'] for r in excluded}
    assert report['complete'], report
    assert not errors, errors[:5]
    assert len(source_ids) == len(source['entries']) == source['source_total']
    assert len(ids) == len(records) == report['counts']['included']
    assert ids.isdisjoint(excluded_ids)
    assert ids | excluded_ids == source_ids
    assert len(excluded_ids) == len(excluded) == report['counts'].get('excluded_total', report['counts']['excluded_without_gallery_photos'])
    excluded_counts = Counter(r['reason'] for r in excluded)
    assert excluded_counts['no_encyclopedia_gallery_photo'] == report['counts']['excluded_without_gallery_photos']
    for item in excluded:
        if item.get('record_path'):
            assert read(item['record_path'])['id'] == item['id'], item['id']
    assert {r['id'] for r in catalog['insects']} == ids
    assert catalog['count'] == len(records)
    images = 0
    section_counts = Counter()
    for record in records:
        ident = record['id']
        assert record == read(f'insects/{ident}.json'), ident
        assert record['display_name'] and record['scientific_name'], ident
        assert record['display_name'] == (record['name_ko'] or record['scientific_name']), ident
        assert record['images'], ident
        image_ids = {im['id'] for im in record['images']}
        assert len(image_ids) == len(record['images']), ident
        assert record['representative_image_id'] in image_ids, ident
        assert record['illustration']['reference_image_id'] in image_ids, ident
        art = record['illustration']
        assert art['status'] in ('pending', 'generated', 'approved'), ident
        if art['status'] == 'pending':
            assert art['image_path'] is None, ident
        else:
            assert art['image_path'] and (ROOT.parent / art['image_path']).is_file(), ident
        src = urlsplit(record['source']['url'])
        assert src.hostname == 'www.nature.go.kr', ident
        assert parse_qs(src.query)['insctPilbkNo'] == [ident], ident
        assert len(record['source']['html_sha256']) == 64, ident
        for image in record['images']:
            url = urlsplit(image['original_url'])
            assert url.hostname == 'www.nature.go.kr' and '/fileUpload/' in url.path, (ident, url)
            assert 'nothum' not in url.path.lower(), ident
        for section in record['sections']:
            assert section['title'], ident
            section_counts[section['title']] += 1
        images += len(record['images'])
    assert images == report['counts']['gallery_photos']
    assert images == dataset['counts']['gallery_photos']
    with (ROOT / 'insects.csv').open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    assert {r['id'] for r in rows} == ids and len(rows) == len(ids)
    jobs = [json.loads(line) for line in (ROOT / 'illustration-jobs.jsonl').read_text().splitlines()]
    assert {r['insect_id'] for r in jobs} == ids and len(jobs) == len(ids)
    actual_files = {p.stem for p in (ROOT / 'insects').glob('*.json')}
    assert actual_files == ids, ('Stale or missing per-insect files', actual_files ^ ids)
    result = {'passed': True, 'source_count': len(source_ids), 'photo_bearing_insects': len(ids),
              'excluded': len(excluded_ids), 'image_references': images, 'csv_rows': len(rows),
              'illustration_jobs': len(jobs), 'section_counts': dict(section_counts)}
    (ROOT / 'validation-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
