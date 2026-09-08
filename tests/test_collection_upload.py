"""Receipt import integrity checks. Uses an isolated temporary SQLite database only."""
import importlib
import json
import os
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch, mock_open

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class CollectionUploadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        with patch.dict(os.environ, {'DB_BACKEND': 'sqlite', 'SECRET_KEY': 'receipt-tests-only'}):
            with patch('os.makedirs'), patch('builtins.open', mock_open()), patch('os.remove'):
                cls.db = importlib.import_module('db')
            cls.db.DB_PATH = str(Path(cls.temp.name) / 'receipts.db')
            cls.module = importlib.import_module('app')
            cls.db.init_db()
        cls.module.app.config['TESTING'] = True

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.client = self.module.app.test_client()
        self.user = {'username': 'receipt-test', 'permissions': ['collection_register', 'collection_approve', 'upload_data', 'month_lock']}
        self.auth = patch.object(self.module, 'current_user', side_effect=lambda: self.user)
        self.auth.start(); self.addCleanup(self.auth.stop)
        with self.db.connect() as conn:
            for table in ('collection_import_rows', 'collection_upload_batches', 'collections', 'receivable_items',
                          'monthly_shipment_units', 'customers', 'month_locks', 'audit', 'uploads', 'upload_backups'):
                conn.execute('DELETE FROM ' + table)
        self.customer('00020', 1000)

    def customer(self, code, balance):
        with self.db.connect() as conn:
            conn.execute("INSERT INTO customers (code,name,biz_unit,balance,source_month,status) VALUES (%s,%s,%s,%s,%s,'정상')",
                         (code, '시험 거래처 ' + code, '덴탈', balance, '2026-08'))
            if balance:
                conn.execute('INSERT INTO receivable_items (customer_code,biz_unit,source_key,issue_month,target_month,original_amount,balance)'
                             ' VALUES (%s,%s,%s,%s,%s,%s,%s)', (code, '덴탈', 'test:' + code, '2026-08', '2026-09', balance, balance))

    def row(self, **changes):
        return dict({'receipt_no': 'RC2609000001', 'sequence': 1, 'customer_code': '20',
                     'paid_at': '2026-09-01', 'receipt_month': '2026-09', 'receipt_kind': '제 예 금',
                     'receipt_type': '1', 'normal_amount': 600, 'advance_amount': 0, 'row_number': 2}, **changes)

    def preview(self, rows):
        return self.client.post('/api/collection-uploads/preview', json={'rows': rows})

    def upload(self, rows, approve=False, client=None):
        return (client or self.client).post('/api/collection-uploads', json={
            'rows': rows, 'filename': 'receipts.xlsx', 'approve_immediately': approve})

    def counts(self):
        with self.db.connect() as conn:
            return [conn.execute('SELECT COUNT(*) AS n FROM ' + t).fetchone()['n']
                    for t in ('collections', 'collection_import_rows', 'collection_upload_batches')]

    def balance(self):
        with self.db.connect() as conn:
            return conn.execute("SELECT balance,advance,last_paid_at FROM customers WHERE code='00020'").fetchone()

    def test_pending_then_approval_uses_existing_collection_flow_once(self):
        self.assertEqual(self.preview([self.row()]).json['ready_count'], 1)
        self.assertEqual(self.counts(), [0, 0, 0])
        r = self.upload([self.row()]); self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual(self.balance()['balance'], 1000)
        with self.db.connect() as conn:
            cid = conn.execute('SELECT id FROM collections').fetchone()['id']
        self.assertEqual(self.client.post('/api/collections/%s/approve' % cid).status_code, 200)
        self.assertEqual(self.balance()['balance'], 400)
        self.assertEqual(self.client.post('/api/collections/%s/approve' % cid).status_code, 409)
        self.assertEqual(self.balance()['balance'], 400)

    def test_two_sequences_preserve_amount_and_only_excess_becomes_advance(self):
        rows = [self.row(), self.row(sequence=2, normal_amount=300, advance_amount=400)]
        p = self.preview(rows).json
        self.assertEqual((p['ready_count'], p['total_amount'], p['offset_amount'], p['advance_remaining']), (2, 1300, 1000, 300))
        r = self.upload(rows, True); self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual(self.balance(), {'balance': 0, 'advance': 300, 'last_paid_at': '2026-09-01'})
        self.assertEqual(self.counts(), [2, 2, 1])
        again = self.upload(rows, True)
        self.assertEqual((again.json['inserted'], again.json['skipped']), (0, 2))
        self.assertEqual(self.balance()['advance'], 300)

    def test_error_prevents_entire_batch_and_changed_duplicate_never_overwrites(self):
        bad = self.upload([self.row(), self.row(sequence=2, normal_amount='100원')], True)
        self.assertEqual(bad.status_code, 400); self.assertEqual(self.counts(), [0, 0, 0])
        self.upload([self.row()], True)
        self.assertEqual(self.upload([self.row(normal_amount=601)], True).status_code, 400)
        self.assertEqual(self.balance()['balance'], 400)
        mixed = self.upload([self.row(), self.row(sequence=2, normal_amount=200)], True)
        self.assertEqual((mixed.json['inserted'], mixed.json['skipped']), (1, 1))
        self.assertEqual(self.balance()['balance'], 200)

    def test_duplicate_keys_in_file_block_both_even_if_identical(self):
        result = self.preview([self.row(), self.row()]).json
        self.assertEqual((result['error_count'], result['ready_count']), (2, 0))
        self.assertEqual(self.upload([self.row(), self.row()]).status_code, 400)

    def test_method_mapping_and_type_conflict(self):
        for label, kind, expected in [('제 예 금', 1, '계좌수금'), ('카    드', 5, '카드수금'),
                                      ('어음', '어음', '어음수금'), ('받을어음', 99, '어음수금')]:
            p = self.preview([self.row(receipt_kind=label, receipt_type=kind)]).json
            self.assertEqual(p['rows'][0]['method'], expected)
        for changes in ({'receipt_kind': '카드', 'receipt_type': 1}, {'receipt_kind': '기타', 'receipt_type': 9},
                        {'receipt_type': ''}, {'receipt_kind': ''}):
            self.assertEqual(self.preview([self.row(**changes)]).json['error_count'], 1)

    def test_required_values_dates_and_money_are_strict(self):
        for changes in ({'normal_amount': -1}, {'normal_amount': ''}, {'normal_amount': 1.25},
                        {'normal_amount': '1,00'}, {'normal_amount': 'NaN'}, {'advance_amount': None},
                        {'normal_amount': 0}, {'normal_amount': 9007199254740992}, {'sequence': 0},
                        {'customer_code': ''}, {'customer_code': '99999'}, {'receipt_no': ''},
                        {'paid_at': '2026-02-30'}, {'paid_at': '2099-01-01'}, {'receipt_month': '2026-08'}):
            with self.subTest(changes=changes):
                self.assertEqual(self.preview([self.row(**changes)]).json['error_count'], 1)
        self.assertEqual(self.preview([self.row(normal_amount='1,000')]).json['total_amount'], 1000)
        self.assertEqual(self.client.post('/api/collection-uploads/preview', json=[]).status_code, 400)
        self.assertEqual(self.preview([]).status_code, 400)

    def test_registered_customer_name_warning_and_ambiguous_codes(self):
        p = self.preview([self.row(customer_name='옛 거래처명')]).json
        self.assertEqual(p['ready_count'], 1); self.assertTrue(p['rows'][0]['warnings'])
        self.customer('20', 0)
        self.assertEqual(self.preview([self.row()]).json['error_count'], 1)

    def test_permission_and_authentication_enforced_on_server(self):
        self.user['permissions'] = ['collection_register']
        self.assertEqual(self.upload([self.row()], True).status_code, 403)
        self.assertEqual(self.upload([self.row()]).status_code, 201)
        self.user['permissions'] = ['collection_approve']
        self.assertEqual(self.upload([self.row(sequence=2)], True).status_code, 201)
        self.user['permissions'] = ['upload_data']
        self.assertEqual(self.preview([self.row()]).status_code, 403)
        self.assertEqual(self.client.get('/api/collection-uploads').status_code, 403)
        self.user = None
        self.assertEqual(self.upload([self.row()]).status_code, 401)

    def test_manual_duplicate_requires_review_and_ledger_mismatch_blocks(self):
        self.client.post('/api/collections', json={'customer_code': '00020', 'amount': 600,
                                                  'method': '계좌수금', 'paid_at': '2026-09-01'})
        self.assertEqual(self.preview([self.row()]).json['error_count'], 1)
        with self.db.connect() as conn:
            conn.execute("UPDATE customers SET balance=300 WHERE code='00020'")
        p = self.preview([self.row(normal_amount=200)]).json
        self.assertIn('원장', p['rows'][0]['errors'][0])

    def test_closed_month_blocks_import_and_later_approval(self):
        self.upload([self.row()])
        with self.db.connect() as conn:
            cid = conn.execute('SELECT id FROM collections').fetchone()['id']
        self.client.post('/api/locks/2026-09', json={'locked': True})
        self.assertEqual(self.upload([self.row(sequence=2)]).status_code, 400)
        self.assertEqual(self.client.post('/api/collections/%s/approve' % cid).status_code, 423)
        self.assertEqual(self.upload([self.row()]).json['skipped'], 1)
        self.assertEqual(self.balance()['balance'], 1000)

    def test_rejected_import_cannot_be_replayed(self):
        self.upload([self.row()])
        with self.db.connect() as conn:
            cid = conn.execute('SELECT id FROM collections').fetchone()['id']
        self.client.post('/api/collections/%s/reject' % cid, json={'reason': '테스트'})
        self.assertEqual(self.upload([self.row()], True).json['inserted'], 0)
        self.assertEqual(self.balance()['balance'], 1000)

    def test_full_transaction_rolls_back_on_mid_batch_failure(self):
        original = self.module.approve_collection_in_transaction
        count = [0]
        def fail_second(*args):
            count[0] += 1
            if count[0] == 2:
                raise ValueError('강제 검증 실패')
            return original(*args)
        with patch.object(self.module, 'approve_collection_in_transaction', side_effect=fail_second):
            r = self.upload([self.row(), self.row(sequence=2)], True)
        self.assertEqual(r.status_code, 400); self.assertEqual(self.counts(), [0, 0, 0])
        self.assertEqual(self.balance()['balance'], 1000)

    def test_parallel_replay_is_registered_and_offset_exactly_once(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.upload([self.row()], True, self.module.app.test_client()), range(8)))
        self.assertTrue(all(r.status_code in (200, 201) for r in results))
        self.assertEqual(sum(r.json['inserted'] for r in results), 1)
        self.assertEqual(self.counts(), [1, 1, 1]); self.assertEqual(self.balance()['balance'], 400)

    def test_allocation_priority_shipments_and_historical_date(self):
        with self.db.connect() as conn:
            conn.execute('DELETE FROM receivable_items')
            for key, category, month, amount in [('normal', '정상', '2026-07', 400),
                                                  ('overdue', '연체', '2026-06', 300), ('bad', '부실', '2026-01', 300)]:
                conn.execute('INSERT INTO receivable_items (customer_code,source_key,category,issue_month,biz_unit,original_amount,balance)'
                             ' VALUES (%s,%s,%s,%s,%s,%s,%s)', ('00020', key, category, month, '덴탈', amount, amount))
            conn.execute("UPDATE customers SET last_paid_at='2026-09-07' WHERE code='00020'")
        r = self.upload([self.row(normal_amount=500)], True); self.assertEqual(r.status_code, 201)
        with self.db.connect() as conn:
            items = {r['source_key']: r['balance'] for r in conn.execute('SELECT source_key,balance FROM receivable_items')}
        self.assertEqual(items, {'normal': 400, 'overdue': 100, 'bad': 0})
        self.assertEqual(self.balance()['last_paid_at'], '2026-09-07')

    def test_shipment_reupload_preserves_imported_payment_and_stale_restore_is_blocked(self):
        with self.db.connect() as conn:
            conn.execute('DELETE FROM receivable_items')
            conn.execute("UPDATE customers SET balance=0 WHERE code='00020'")
        shipment = {'mode': 'shipment', 'month': '2026-08', 'shipment_date': '2026-08-27',
                    'filename': 'shipment.xlsx', 'rows': [{'code': '00020', 'name': '시험 거래처',
                    'biz_unit': '덴탈', 'shipment_amount': 1000, 'collection_period_confirmed': False}]}
        uploaded = self.client.post('/api/uploads', json=shipment)
        self.assertEqual(uploaded.status_code, 200, uploaded.json)
        with self.db.connect() as conn:
            last = conn.execute('SELECT id,uploaded_at FROM uploads ORDER BY id DESC LIMIT 1').fetchone()
        self.assertEqual(self.upload([self.row()], True).status_code, 201)
        self.assertEqual(self.balance()['balance'], 400)
        with self.db.connect() as conn:
            conn.execute('UPDATE collection_upload_batches SET created_at=%s', (last['uploaded_at'],))
            conn.execute('UPDATE audit SET created_at=%s', (last['uploaded_at'],))
            conn.execute('UPDATE collections SET created_at=%s', (last['uploaded_at'],))
        self.assertEqual(self.client.delete('/api/uploads/%s' % last['id']).status_code, 409)
        self.assertEqual(self.client.post('/api/uploads', json=shipment).status_code, 200)
        self.assertEqual(self.balance()['balance'], 400)
        with self.db.connect() as conn:
            self.assertEqual(conn.execute("SELECT balance FROM monthly_shipment_units WHERE code='00020'").fetchone()['balance'], 400)

    def test_no_receivable_advance_and_signed_ledger_do_not_double_credit(self):
        self.customer('00100', 0)
        r = self.upload([self.row(customer_code='00100', normal_amount=0, advance_amount=700)], True)
        self.assertEqual(r.status_code, 201)
        with self.db.connect() as conn:
            self.assertEqual(conn.execute("SELECT advance FROM customers WHERE code='00100'").fetchone()['advance'], 700)
            conn.execute("INSERT INTO receivable_items (customer_code,source_key,original_amount,balance)"
                         " VALUES ('00020','return-adjustment',-200,-200)")
            conn.execute("UPDATE customers SET balance=800 WHERE code='00020'")
        p = self.preview([self.row(sequence=2, normal_amount=900)]).json
        self.assertEqual((p['offset_amount'], p['advance_remaining']), (900, 0))
        self.assertEqual(self.upload([self.row(sequence=2, normal_amount=900)], True).status_code, 201)
        self.assertEqual((self.balance()['balance'], self.balance()['advance']), (-100, 0))

    @unittest.skipUnless(os.environ.get('COLLECTION_SAMPLE_JSON'), 'Supply locally parsed attachment for acceptance check')
    def test_supplied_attachment_19_rows_exact_total_and_replay(self):
        rows = json.loads(Path(os.environ['COLLECTION_SAMPLE_JSON']).read_text())
        for code in {r['customer_code'] for r in rows}:
            self.customer(code, 100000000)
        p = self.preview(rows).json
        self.assertEqual((p['row_count'], p['ready_count'], p['total_amount']), (19, 19, 98268581))
        r = self.upload(rows, True); self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual((r.json['inserted'], r.json['total_amount']), (19, 98268581))
        with self.db.connect() as conn:
            amount = conn.execute("SELECT SUM(amount) AS n FROM collections WHERE state='approved'").fetchone()['n']
            total = conn.execute("SELECT SUM(balance) AS n FROM receivable_items WHERE customer_code<>'00020'").fetchone()['n']
        self.assertEqual(amount, 98268581)
        self.assertEqual(total, 18 * 100000000 - 98268581)
        self.assertEqual(self.upload(rows, True).json['skipped'], 19)


if __name__ == '__main__':
    unittest.main()
