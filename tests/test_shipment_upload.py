"""Shipment API regression tests; all writes use a temporary local database."""
import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class ShipmentUploadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        # Redirect data_dir before importing the app; never use deployment DB settings.
        with patch.dict(os.environ, {"DB_BACKEND": "sqlite", "SECRET_KEY": "upload-test-only"}):
            with patch('os.makedirs'), patch('builtins.open', unittest.mock.mock_open()), patch('os.remove'):
                cls.db = importlib.import_module('db')
            cls.db.DB_PATH = str(Path(cls.temp.name) / 'test.db')
            cls.module = importlib.import_module('app')
        cls.module.app.config['TESTING'] = True

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.client = self.module.app.test_client()
        self.auth = patch.object(self.module, 'current_user', return_value={
            'username': 'upload-test', 'permissions': ['upload_data'],
        })
        self.auth.start()
        self.addCleanup(self.auth.stop)
        with self.db.connect() as conn:
            for table in ('upload_backups', 'uploads', 'receivable_items', 'monthly_shipment_units',
                          'receivable_unit_overrides', 'customers', 'month_locks'):
                conn.execute('DELETE FROM ' + table)

    def upload(self, rows, month='2026-08'):
        return self.client.post('/api/uploads', json={
            'mode': 'shipment', 'month': month, 'shipment_date': month + '-27',
            'filename': 'semifinished-test.xlsx', 'rows': rows,
        })

    def row(self, unit, amount):
        return {'code': '20', 'name': '테스트 거래처', 'biz_unit': unit,
                'shipment_amount': amount, 'collection_period_confirmed': False}

    def totals(self):
        with self.db.connect() as conn:
            return {(r['biz_unit'], r['issue_month']): r['balance'] for r in conn.execute(
                'SELECT biz_unit,issue_month,balance FROM receivable_items')}

    def test_selected_semifinished_and_product_merge_without_crossing_units(self):
        rows = [self.row('덴탈', 1100), self.row('덴탈', 220), self.row('덴탈', -30),
                self.row('메디컬', 450), self.row('메디컬', -50), self.row('에스테틱', 0)]
        response = self.upload(rows)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['inserted'], 3)
        self.assertEqual(self.totals(), {('덴탈', '2026-08'): 1290, ('메디컬', '2026-08'): 400,
                                       ('에스테틱', '2026-08'): 0})
        self.assertEqual(self.upload(rows).status_code, 200)
        self.assertEqual(self.totals()[('메디컬', '2026-08')], 400)
        with self.db.connect() as conn:
            customer = conn.execute('SELECT balance,period_confirmed FROM customers').fetchone()
        self.assertEqual(customer['balance'], 1690)
        self.assertEqual(customer['period_confirmed'], 0)

    def test_unassigned_or_invalid_unit_rejects_entire_batch_without_replacement(self):
        self.assertEqual(self.upload([self.row('메디컬', 100)]).status_code, 200)
        for unit in ('', '반제품', '원재료'):
            response = self.upload([self.row('덴탈', 200), self.row(unit, 500)])
            self.assertEqual(response.status_code, 400)
            self.assertIn('사업부', response.json['error'])
            self.assertEqual(self.totals(), {('메디컬', '2026-08'): 100})
        with self.db.connect() as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) AS n FROM uploads').fetchone()['n'], 1)

    def test_previous_manual_unit_override_and_other_month_are_preserved(self):
        self.assertEqual(self.upload([self.row('덴탈', 100)]).status_code, 200)
        with self.db.connect() as conn:
            conn.execute("INSERT INTO receivable_unit_overrides"
                         " (customer_code,issue_month,source_biz_unit,target_biz_unit,reason,updated_by)"
                         " VALUES ('00020','2026-09','덴탈','메디컬','테스트','upload-test')")
        response = self.upload([self.row('덴탈', 250)], month='2026-09')
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.totals(), {('덴탈', '2026-08'): 100, ('메디컬', '2026-09'): 250})


if __name__ == '__main__':
    unittest.main()
