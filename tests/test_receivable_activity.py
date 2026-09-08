"""Activity report correctness in an isolated SQLite database."""
import importlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, mock_open

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class ActivityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        with patch.dict(os.environ, {'DB_BACKEND': 'sqlite', 'SECRET_KEY': 'activity-test-only'}):
            with patch('os.makedirs'), patch('builtins.open', mock_open()), patch('os.remove'):
                cls.db = importlib.import_module('db')
            cls.db.DB_PATH = str(Path(cls.temp.name) / 'activity.db')
            cls.module = importlib.import_module('app')
            cls.db.init_db()
        cls.module.app.config['TESTING'] = True

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.client = self.module.app.test_client()
        self.user = {'username': 'activity-test', 'permissions': ['dashboard_view', 'upload_data',
            'collection_register', 'collection_approve', 'note_edit']}
        auth = patch.object(self.module, 'current_user', side_effect=lambda: self.user)
        auth.start(); self.addCleanup(auth.stop)
        with self.db.connect() as c:
            for table in ('collection_upload_reviews', 'collection_import_rows', 'collection_upload_batches',
                          'collections', 'shipment_upload_lines', 'upload_backups', 'uploads', 'receivable_items',
                          'monthly_shipment_units', 'receivable_unit_overrides', 'customers', 'month_locks', 'audit', 'targets'):
                c.execute('DELETE FROM ' + table)

    def upload(self, amounts=(100, 50, -25), month='2026-08', dated=True, filename='shipments.xlsx', unit='덴탈'):
        row = dict(code='20', name='시험 거래처', biz_unit=unit, shipment_amount=sum(amounts))
        if dated:
            row['source_lines'] = [dict(row_number=i+2, shipment_date=month+'-%02d' % (i+1), amount=a,
                                       columns=[{'column': 'AB', 'name': '합계액', 'value': a}]) for i, a in enumerate(amounts)]
        response = self.client.post('/api/uploads', json=dict(month=month, shipment_date=month+'-28',
                                    filename=filename, mode='shipment', rows=[row]))
        self.assertEqual(response.status_code, 200, response.json)
        return response

    def get(self, suffix='', **query):
        return self.client.get('/api/receivable-activity'+suffix, query_string=dict(
            start_month='2026-08', end_month='2026-08', **query))

    def collection(self, amount=60, state='approved', paid_at='2026-08-02'):
        r = self.client.post('/api/collections', json=dict(customer_code='00020', amount=amount,
                           method='계좌수금', paid_at=paid_at))
        self.assertEqual(r.status_code, 201, r.json)
        cid = r.json['collection']['id']
        if state == 'approved':
            self.assertEqual(self.client.post('/api/collections/%s/approve' % cid).status_code, 200)
        elif state == 'rejected':
            self.client.post('/api/collections/%s/reject' % cid, json={'reason': '시험'})
        return cid

    def test_signed_daily_occurrences_approved_receipts_and_detail_totals_reconcile(self):
        self.upload()
        self.collection(60); self.collection(20, 'pending'); self.collection(30, 'rejected')
        r = self.get().json
        self.assertEqual((r['totals']['shipment_amount'], r['totals']['collection_amount'], r['totals']['pending_amount']), (125, 60, 20))
        self.assertEqual([x['shipment_amount'] for x in r['series'][:3]], [100, 50, -25])
        self.assertEqual(r['series'][1]['collection_amount'], 60)
        self.assertEqual(sum(x['shipment_amount'] for x in r['series']), 125)
        self.assertEqual(self.get('/details', kind='shipments').json['amount'], 125)
        self.assertEqual(self.get('/details', kind='collections', state='approved').json['amount'], 60)
        self.assertEqual(self.get('/details', kind='collections', state='pending').json['amount'], 20)
        detail = self.get('/details', kind='shipments', period='2026-08-03').json
        self.assertEqual((detail['count'], detail['amount']), (1, -25))
        src = self.client.get('/api/receivable-activity/source/shipments/%s' % detail['rows'][0]['source_id']).json
        self.assertEqual((src['filename'], src['row_number'], src['source']['columns'][0]['value']), ('shipments.xlsx', 4, -25))

    def test_legacy_monthly_totals_never_appear_on_upload_day_and_opening_stays_separate(self):
        self.upload(dated=False)
        with self.db.connect() as c:
            c.execute("INSERT INTO receivable_items (customer_code,biz_unit,source_key,issue_month,original_amount,balance)"
                      " VALUES ('00020','덴탈','legacy:opening','2026-07',5000,4500)")
        daily = self.get().json
        self.assertEqual(daily['totals']['shipment_amount'], 125)
        self.assertEqual(daily['totals']['undated_amount'], 125)
        self.assertEqual(sum(x['shipment_amount'] for x in daily['series']), 0)
        self.assertTrue(all(not x['shipment_complete'] for x in daily['series']))
        monthly = self.get(grain='month').json
        self.assertEqual(monthly['series'][0]['shipment_amount'], 125)
        self.assertEqual(self.get('/details', kind='shipments', period='2026-08-28').json['count'], 0)
        self.assertEqual(self.get('/details', kind='opening').json['balance'], 4500)

    def test_reupload_replaces_active_source_version_and_rollback_restores_previous_daily_rows(self):
        self.upload(amounts=(100,), filename='first.xlsx')
        first = self.get('/details').json['rows'][0]
        self.upload(amounts=(200,), filename='second.xlsx')
        self.assertEqual(self.get().json['totals']['shipment_amount'], 200)
        self.assertEqual(self.get('/details').json['rows'][0]['filename'], 'second.xlsx')
        with self.db.connect() as c:
            upload_id = c.execute('SELECT MAX(id) AS id FROM uploads').fetchone()['id']
            self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM shipment_upload_lines').fetchone()['n'], 2)
        response = self.client.delete('/api/uploads/%s' % upload_id)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.get().json['totals']['shipment_amount'], 100)
        self.assertEqual(self.get('/details').json['rows'][0]['source_id'], first['source_id'])

    def test_invalid_source_totals_dates_and_money_cannot_change_ledger(self):
        self.upload((100,))
        for line in ({'amount': 999, 'shipment_date': '2026-08-01'}, {'amount': 100, 'shipment_date': '2026-09-01'},
                     {'amount': 100, 'shipment_date': '2026-08-40'}, {'amount': 100.5}, {'amount': True}):
            r = self.client.post('/api/uploads', json=dict(month='2026-08', shipment_date='2026-08-28', mode='shipment',
                rows=[dict(code='20', name='시험 거래처', biz_unit='덴탈', shipment_amount=100, source_lines=[line])]))
            self.assertEqual(r.status_code, 400, r.json)
            self.assertEqual(self.get().json['totals']['shipment_amount'], 100)
        with self.db.connect() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM uploads').fetchone()['n'], 1)

    def test_month_business_unit_search_and_permissions_apply_consistently(self):
        self.upload((100,))
        self.upload((200,), month='2026-09', unit='메디컬')
        self.assertEqual(self.get(q='00020').json['totals']['shipment_amount'], 100)
        self.assertEqual(self.get(unit='메디컬').json['totals']['shipment_amount'], 0)
        self.assertEqual(self.get('/details', q='없음').json['count'], 0)
        self.assertEqual(self.get(grain='quarter').status_code, 400)
        self.assertEqual(self.client.get('/api/receivable-activity?start_month=2026-09&end_month=2026-08').status_code, 400)
        self.assertEqual(self.client.get('/api/receivable-activity?start_month=2020-01&end_month=2026-08').status_code, 400)
        sid = self.get('/details').json['rows'][0]['source_id']
        self.user['permissions'] = ['upload_data']
        for url in ('/api/receivable-activity', '/api/receivable-activity/details', '/api/receivable-activity/source/shipments/%s' % sid):
            self.assertEqual(self.client.get(url).status_code, 403)
        self.user = None
        self.assertEqual(self.get().status_code, 401)

    def test_business_unit_override_keeps_daily_detail_and_monthly_amount_consistent(self):
        self.upload((100,))
        with self.db.connect() as c:
            c.execute("INSERT INTO receivable_unit_overrides (customer_code,issue_month,source_biz_unit,target_biz_unit,reason,updated_by)"
                      " VALUES ('00020','2026-08','덴탈','메디컬','시험','activity-test')")
            c.execute("UPDATE monthly_shipment_units SET biz_unit='메디컬'")
        r = self.get(unit='메디컬').json
        self.assertEqual((r['totals']['shipment_amount'], r['totals']['undated_amount']), (100, 0))
        self.assertEqual(self.get('/details', unit='메디컬').json['rows'][0]['biz_unit'], '메디컬')

    def test_uploaded_collection_origin_and_source_are_shown_once_after_duplicate_exclusion(self):
        self.upload((1000,))
        row = dict(receipt_no='RC-A', sequence=1, customer_code='20', paid_at='2026-08-03',
                   receipt_kind='제예금', receipt_type='1', normal_amount=1200, advance_amount=0, row_number=2)
        payload = dict(filename='receipts.xlsx', approve_immediately=True, rows=[row])
        result = self.client.post('/api/collection-uploads', json=payload)
        self.assertEqual(result.status_code, 201, result.json)
        preview = self.client.post('/api/collection-uploads/preview', json={'rows': [row]}).json
        payload['reviews'] = [dict(row_key=r['row_key'], review_token=r['review_token'], action='exclude', confirmed=True)
                              for r in preview['rows']]
        self.assertEqual(self.client.post('/api/collection-uploads', json=payload).status_code, 201)
        result = self.get('/details', kind='collections', origin='upload', state='approved').json
        self.assertEqual((result['count'], result['amount']), (1, 1200))
        self.assertEqual(self.get().json['totals']['collection_amount'], 1200)
        self.assertEqual(self.get().json['totals']['shipment_amount'], 1000)
        source_id = result['rows'][0]['source_id']
        raw = self.client.get('/api/receivable-activity/source/collections/%s' % source_id).json
        self.assertEqual((raw['filename'], raw['source']['receipt_no']), ('receipts.xlsx', 'RC-A'))

    def test_month_grain_crosses_year_and_pagination_total_is_not_page_total(self):
        lines = [dict(row_number=i+2, shipment_date='2026-08-01', amount=10) for i in range(55)]
        r = self.client.post('/api/uploads', json=dict(month='2026-08', shipment_date='2026-08-28', mode='shipment',
            rows=[dict(code='20', name='거래처', biz_unit='덴탈', shipment_amount=550, source_lines=lines)]))
        self.assertEqual(r.status_code, 200)
        result = self.get('/details', page=2).json
        self.assertEqual((result['count'], result['amount'], len(result['rows']), result['pages']), (55, 550, 5, 2))
        r = self.client.get('/api/receivable-activity?start_month=2025-12&end_month=2026-02&grain=month').json
        self.assertEqual([x['period'] for x in r['series']], ['2025-12', '2026-01', '2026-02'])


if __name__ == '__main__':
    unittest.main()
