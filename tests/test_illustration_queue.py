import unittest

from scripts.illustration_queue import pending_records, select_reference


class ReferenceSelectionTests(unittest.TestCase):
    def test_blocked_reference_is_skipped_without_losing_pending_status(self):
        blocked = {'illustration': {'status': 'pending', 'reference_review_status': 'blocked'}}
        pending = {'illustration': {'status': 'pending'}}
        generated = {'illustration': {'status': 'generated'}}
        self.assertEqual(pending_records([blocked, pending, generated]), [pending])
        self.assertEqual(blocked['illustration']['status'], 'pending')

    def test_uses_whole_body_instead_of_detail_plate(self):
        record = {
            'images': [
                {'id': 'moth-1', 'caption': '가슴 확대 이미지'},
                {'id': 'moth-2', 'caption': '배 등면 이미지'},
                {'id': 'moth-3', 'caption': '전체 등면 이미지'},
            ],
            'illustration': {'reference_image_id': 'moth-1'},
        }
        self.assertEqual(select_reference(record)['id'], 'moth-3')

    def test_keeps_chosen_whole_body_reference(self):
        record = {
            'images': [
                {'id': 'bug-1', 'caption': '전체 등면 이미지'},
                {'id': 'bug-2', 'caption': '전체 측면 이미지'},
            ],
            'illustration': {'reference_image_id': 'bug-2'},
        }
        self.assertEqual(select_reference(record)['id'], 'bug-2')

    def test_without_whole_body_keeps_original_for_visual_review(self):
        record = {
            'images': [{'id': 'bug-1', 'caption': None}],
            'illustration': {'reference_image_id': 'bug-1'},
        }
        self.assertEqual(select_reference(record)['id'], 'bug-1')


if __name__ == '__main__':
    unittest.main()
