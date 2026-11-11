import sys
import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from collect_nature import parse_detail
import collect_nature

FIXTURES = Path(__file__).parent / 'fixtures'


class DetailParsingTest(unittest.TestCase):
    def entry(self, **overrides):
        return dict(id='ZOBT0118', name_ko='흰활무늬잎벌레', scientific_name='', family_ko='잎벌레과', **overrides)

    def test_photo_record_and_source_fields(self):
        record = parse_detail((FIXTURES / 'with-photo.html').read_text(), self.entry())
        self.assertEqual(record['scientific_name'], 'Trichochrysea japana (Motschulsky, 1958)')
        self.assertEqual(record['taxonomy']['order']['name_latin'], 'Coleoptera')
        self.assertIn('6.2~8.2mm', record['information']['general_description'])
        self.assertEqual(record['information']['distribution'], '[일본]\n[중국]')
        self.assertEqual(record['information']['ecology'], '기주식물 밤나무, 상수리나무.')
        self.assertEqual(len(record['images']), 1)  # Three specimen photos are not gallery photos.
        self.assertTrue(record['images'][0]['original_url'].endswith('/ZOBT0118_1.jpg'))
        self.assertEqual([r['name_ko'] for r in record['related_species']], ['밤나무', '상수리나무'])
        self.assertIsNone(record['illustration']['image_path'])

    def test_no_photo_is_excluded(self):
        entry = {'id': 'ZTBU0287', 'name_ko': '히게부토맵시벌', 'scientific_name': '', 'family_ko': '맵시벌과'}
        self.assertIsNone(parse_detail((FIXTURES / 'without-photo.html').read_text(), entry))

    def test_wrong_or_error_page_cannot_be_saved(self):
        with self.assertRaises(ValueError):
            parse_detail('<html><h1>Sorry Page</h1></html>', self.entry())
        with self.assertRaises(ValueError):
            parse_detail((FIXTURES / 'without-photo.html').read_text(), self.entry())

    def test_image_credit_argument_order(self):
        html = (FIXTURES / 'with-photo.html').read_text()
        html = html.replace("'', '', '', '/fileUpload/photo/O1/ZOBT0118_1.jpg'",
                            "'촬영자', '20200102', '광릉', '/fileUpload/photo/O1/ZOBT0118_1.jpg'")
        image = parse_detail(html, self.entry())['images'][0]
        self.assertEqual(image['photographer'], '촬영자')
        self.assertEqual(image['photographed_at'], '20200102')
        self.assertEqual(image['location'], '광릉')

    def test_photo_without_korean_name_uses_scientific_display_name(self):
        entry = {'id': 'ZLBX0028', 'name_ko': None,
                 'scientific_name': 'Eurydema gebleri rugosa Motschulsky, 1861', 'family_ko': '노린재과'}
        record = parse_detail((FIXTURES / 'without-korean-name.html').read_text(), entry)
        self.assertIsNone(record['name_ko'])
        self.assertEqual(record['display_name'], entry['scientific_name'])
        self.assertTrue(record['images'])


class PhotoReviewTest(unittest.TestCase):
    def test_changed_gallery_requires_new_review(self):
        record = {'id': 'moth', 'images': [{'original_url': 'new-photo.jpg'}]}
        reviews = {'moth': {'decision': 'exclude_anatomy_only', 'images': [{'original_url': 'old-diagram.jpg'}]}}
        self.assertIsNone(collect_nature.review_exclusion_reason(record, reviews))

    def test_missing_images_remain_distinct_from_anatomy(self):
        record = {'id': 'beetle', 'images': [{'original_url': 'missing.jpg'}]}
        reviews = {'beetle': {'decision': 'source_unavailable', 'images': record['images']}}
        self.assertEqual(collect_nature.review_exclusion_reason(record, reviews), 'gallery_image_unavailable')

    def test_export_archives_excluded_record_and_retains_review_on_repeat(self):
        entry = {'id': 'ZOBT0118', 'name_ko': '흰활무늬잎벌레', 'scientific_name': '', 'family_ko': '잎벌레과'}
        record = parse_detail((FIXTURES / 'with-photo.html').read_text(), entry)
        review = {'records': [{'id': entry['id'], 'decision': 'exclude_anatomy_only', 'images': record['images']}]}
        with tempfile.TemporaryDirectory() as tmp, patch.object(collect_nature, 'OUT', Path(tmp)):
            collect_nature.dump(Path(tmp) / 'insects' / (entry['id'] + '.json'), record)
            collect_nature.dump(Path(tmp) / 'photo-review.json', review)
            for _ in range(2):
                collect_nature.export([entry], {entry['id']: {'status': 'included'}})
                saved = json.loads((Path(tmp) / 'insects.json').read_text())
                self.assertEqual(saved['insects'], [])
                self.assertEqual(saved['counts']['excluded_anatomy_only'], 1)
                archived = json.loads((Path(tmp) / 'excluded-records' / (entry['id'] + '.json')).read_text())
                self.assertEqual(archived, record)
                self.assertFalse((Path(tmp) / 'insects' / (entry['id'] + '.json')).exists())


if __name__ == '__main__':
    unittest.main()
