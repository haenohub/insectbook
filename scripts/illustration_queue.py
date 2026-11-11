#!/usr/bin/env python3
"""Prepare references and register real generated images; never invent completion."""
import argparse
import hashlib
import json
import shutil
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
CACHE = Path('/workspace/.cache/insectbook/references')


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def sync():
    dataset = read(DATA / 'insects.json')
    records = [read(DATA / 'insects' / (r['id'] + '.json')) for r in dataset['insects']]
    for r in records:
        art = r['illustration']
        if art['status'] != 'pending':
            if not art['image_path'] or not (ROOT / art['image_path']).is_file():
                raise ValueError('Missing generated image: ' + r['id'])
    dataset['insects'] = records
    write(DATA / 'insects.json', dataset)
    by_id = {r['id']: r for r in records}
    catalog = read(DATA / 'catalog.json')
    for r in catalog['insects']:
        r['illustration'] = by_id[r['id']]['illustration']
        ref = next(i for i in by_id[r['id']]['images'] if i['id'] == r['illustration']['reference_image_id'])
        r['thumbnail_url'] = ref['thumbnail_url']
    write(DATA / 'catalog.json', catalog)
    path = DATA / 'illustration-jobs.jsonl'
    jobs = [json.loads(line) for line in path.read_text().splitlines()]
    for job in jobs:
        art = by_id[job['insect_id']]['illustration']
        ref = next(i for i in by_id[job['insect_id']]['images'] if i['id'] == art['reference_image_id'])
        job['reference_image_id'] = ref['id']
        job['reference_image_url'] = ref['original_url']
        job['status'] = art['status']
        job['image_path'] = art['image_path']
        job['style_id'] = art.get('style_id', 'gentle-colored-pencil-v1')
    tmp = path.with_suffix('.tmp')
    tmp.write_text(''.join(json.dumps(j, ensure_ascii=False) + '\n' for j in jobs))
    tmp.replace(path)
    counts = Counter(r['illustration']['status'] for r in records)
    report = {'updated_at': datetime.now(timezone.utc).isoformat(), 'total': len(records),
              'completed': sum(counts[s] for s in ('generated', 'approved')), 'pending': counts['pending'],
              'statuses': dict(counts), 'complete': counts['pending'] == 0,
              'style_id': 'gentle-colored-pencil-v1'}
    write(DATA / 'illustration-progress.json', report)
    run_path = DATA / 'illustration-run.json'
    if run_path.exists():
        run = read(run_path)
        done = sum(by_id[ident]['illustration']['status'] in ('generated', 'approved')
                   for ident in run['insect_ids'])
        run.update(completed=done, remaining=len(run['insect_ids']) - done,
                   updated_at=report['updated_at'])
        if done == len(run['insect_ids']):
            run['status'] = 'complete'
        write(run_path, run)
    return report


def select_reference(record):
    current = next(i for i in record['images'] if i['id'] == record['illustration']['reference_image_id'])
    if '전체' in (current.get('caption') or ''):
        return current
    return next((i for i in record['images'] if '전체' in (i.get('caption') or '')), current)


def pending_records(records):
    return [r for r in records if r['illustration']['status'] == 'pending'
            and r['illustration'].get('reference_review_status') != 'blocked']


def prepare(count):
    CACHE.mkdir(parents=True, exist_ok=True)
    records = read(DATA / 'insects.json')['insects']
    pending = pending_records(records)[:count]
    batch = []
    with httpx.Client(timeout=45, follow_redirects=True,
                      headers={'User-Agent': 'Mozilla/5.0 (compatible; Insectbook research)'}) as client:
        for record in pending:
            ref = select_reference(record)
            path = CACHE / (ref['id'] + '.jpg')
            if not path.exists():
                last = None
                for attempt in range(3):
                    try:
                        response = client.get(ref['original_url'])
                        response.raise_for_status()
                        raw = response.content
                        if not raw.startswith((b'\xff\xd8\xff', b'\x89PNG', b'GIF8', b'RIFF')):
                            raise ValueError('Response is not an image')
                        path.write_bytes(raw)
                        break
                    except Exception as exc:
                        last = exc
                        time.sleep(2 ** attempt)
                else:
                    raise RuntimeError(f"Reference unavailable: {record['id']}: {last}")
            record['illustration']['reference_image_id'] = ref['id']
            write(DATA / 'insects' / (record['id'] + '.json'), record)
            batch.append({'id': record['id'], 'name': record['display_name'], 'family': record['family_ko'],
                          'reference_path': str(path), 'reference_image_id': ref['id'], 'caption': ref['caption']})
            time.sleep(.25)
    write(CACHE / 'current-batch.json', batch)
    sync()
    print(json.dumps(batch, ensure_ascii=False))


def register(ident, source, revision=False):
    path = DATA / 'insects' / (ident + '.json')
    if not path.is_file():
        raise ValueError('Unknown insect ID')
    record = read(path)
    source = Path(source).resolve()
    if not source.is_file() or not source.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Generated PNG required')
    target = ROOT / 'assets' / 'illustrations' / (ident + '.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(source.read_bytes()).digest():
            if not revision:
                raise ValueError('Existing illustration differs; use --revision to preserve and replace')
            archive = target.parent / 'revisions' / (ident + '-' + hashlib.sha256(target.read_bytes()).hexdigest()[:12] + '.png')
            archive.parent.mkdir(parents=True, exist_ok=True)
            if not archive.exists():
                shutil.copy2(target, archive)
            if archive.read_bytes() != target.read_bytes():
                raise ValueError('Revision archive verification failed')
            shutil.copy2(source, target)
    else:
        shutil.copy2(source, target)
    record['illustration'].update(status='generated', image_path=target.relative_to(ROOT).as_posix(),
                                  style_id='gentle-colored-pencil-v1',
                                  generated_at=datetime.now(timezone.utc).isoformat(),
                                  prompt_sha256=hashlib.sha256((DATA / 'illustration-prompt.json').read_bytes()).hexdigest(),
                                  sha256=hashlib.sha256(target.read_bytes()).hexdigest())
    write(path, record)
    print(json.dumps(sync(), ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    p = commands.add_parser('prepare')
    p.add_argument('--count', type=int, default=4)
    p = commands.add_parser('register')
    p.add_argument('id')
    p.add_argument('generated_file')
    p.add_argument('--revision', action='store_true')
    commands.add_parser('status')
    args = parser.parse_args()
    if args.command == 'prepare':
        prepare(args.count)
    elif args.command == 'register':
        register(args.id, args.generated_file, args.revision)
    else:
        print(json.dumps(sync(), ensure_ascii=False))


if __name__ == '__main__':
    main()
