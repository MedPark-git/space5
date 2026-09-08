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
            for table in ('collection_upload_reviews', 'collection_import_rows', 'collection_upload_batches', 'collections', 'receivable_items',
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

    def preview(self, rows, customer_resolutions=None):
        return self.client.post('/api/collection-uploads/preview', json={'rows': rows, 'customer_resolutions': customer_resolutions})

    def upload(self, rows, approve=False, client=None, reviews=None, customer_resolutions=None):
        return (client or self.client).post('/api/collection-uploads', json={
            'rows': rows, 'filename': 'receipts.xlsx', 'approve_immediately': approve, 'reviews': reviews or [],
            'customer_resolutions': customer_resolutions})

    def customer_decision(self, rows, action, **fields):
        issue = self.preview(rows).json['customer_issues'][0]
        return {'issue_key': issue['issue_key'], 'resolution_token': issue['resolution_token'],
                'action': action, 'confirmed': True, 'reason': '거래처 증빙 대조 완료', **fields}

    def test_missing_customer_choices_are_read_only_and_new_customer_is_atomic(self):
        rows = [self.row(customer_code='93001', customer_name='신규 시험 거래처'),
                self.row(customer_code='93001', customer_name='신규 시험 거래처', sequence=2, normal_amount=250)]
        decision = self.customer_decision(rows, 'create', name='신규 시험 거래처', biz_unit='메디컬')
        preview = self.preview(rows, [decision]).json
        self.assertEqual((preview['error_count'], preview['ready_count'], preview['advance_remaining']), (0, 2, 850))
        with self.db.connect() as conn:
            self.assertIsNone(conn.execute("SELECT code FROM customers WHERE code='93001'").fetchone())
        with patch.object(self.module, 'approve_collection_in_transaction', side_effect=ValueError('검증용 승인 실패')):
            failed = self.upload(rows, True, customer_resolutions=[decision])
            self.assertEqual(failed.status_code, 400)
        self.assertEqual(self.counts(), [0, 0, 0])
        with self.db.connect() as conn:
            self.assertIsNone(conn.execute("SELECT code FROM customers WHERE code='93001'").fetchone())
        result = self.upload(rows, True, customer_resolutions=[decision])
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(result.json['customers_created'], 1)
        with self.db.connect() as conn:
            c = conn.execute("SELECT balance,advance,period_confirmed,biz_unit FROM customers WHERE code='93001'").fetchone()
        self.assertEqual(c, {'balance': 0, 'advance': 850, 'period_confirmed': 0, 'biz_unit': '메디컬'})
        self.assertEqual(self.preview(rows).json['review_count'], 2)

    def test_same_name_link_keeps_codes_and_original_source_then_offsets_on_approval(self):
        rows = [self.row(customer_code='93001', customer_name='시험 거래처 00020')]
        p = self.preview(rows).json
        self.assertEqual(p['error_count'], 1)
        self.assertEqual(p['customer_issues'][0]['candidates'][0]['code'], '00020')
        d = self.customer_decision(rows, 'link', target_code='00020')
        p = self.preview(rows, [d]).json
        self.assertEqual((p['rows'][0]['customer_code'], p['offset_amount']), ('00020', 600))
        result = self.upload(rows, customer_resolutions=[d])
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(self.balance()['balance'], 1000)
        with self.db.connect() as conn:
            c = conn.execute('SELECT id,customer_code,note FROM collections').fetchone()
            src = json.loads(conn.execute('SELECT source_json FROM collection_import_rows').fetchone()['source_json'])
            self.assertEqual(src['customer_code'], '93001')
            self.assertEqual(c['customer_code'], '00020')
            self.assertIn('93001 → 00020', c['note'])
            self.assertIsNone(conn.execute("SELECT code FROM customers WHERE code='93001'").fetchone())
        self.assertEqual(self.client.post('/api/collections/%s/approve' % c['id']).status_code, 200)
        self.assertEqual(self.balance()['balance'], 400)
        history = self.client.get('/api/collection-uploads/%s/reviews' % result.json['batch_id']).json['reviews']
        self.assertEqual(history[0]['action'], 'customer_link')
        self.assertEqual(history[0]['reviewed_by'], 'receipt-test')
        self.assertEqual(history[0]['details']['selection']['customer']['code'], '00020')

    def test_link_rechecks_manual_duplicates_and_reupload_without_deducting_again(self):
        self.upload([self.row()], True)
        rows = [self.row(receipt_no='RC-OTHER', customer_code='93001', customer_name='시험 거래처 00020')]
        d = self.customer_decision(rows, 'link', target_code='00020')
        p = self.preview(rows, [d]).json
        self.assertEqual((p['error_count'], p['review_count']), (0, 1))
        self.assertEqual(p['rows'][0]['review_kind'], 'similar')
        self.assertEqual(self.upload(rows, True, customer_resolutions=[d]).status_code, 409)
        reviews = [{'row_key': r['row_key'], 'review_token': r['review_token'], 'action': 'exclude', 'confirmed': True}
                   for r in p['rows'] if r['status'] == 'review']
        result = self.upload(rows, True, customer_resolutions=[d], reviews=reviews)
        self.assertEqual((result.json['inserted'], result.json['skipped']), (0, 1))
        self.assertEqual(self.balance()['balance'], 400)

    def test_same_name_new_master_is_explicit_and_does_not_touch_existing_debt(self):
        rows = [self.row(customer_code='93001', customer_name='시험 거래처 00020')]
        d = self.customer_decision(rows, 'create', name='시험 거래처 00020', biz_unit='덴탈')
        result = self.upload(rows, True, customer_resolutions=[d])
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(self.balance()['balance'], 1000)
        with self.db.connect() as conn:
            self.assertEqual(conn.execute("SELECT advance FROM customers WHERE code='93001'").fetchone()['advance'], 600)

    def test_customer_selection_requires_confirmation_reason_valid_target_and_permission(self):
        rows = [self.row(customer_code='93001', customer_name='시험 거래처 00020')]
        d = self.customer_decision(rows, 'link', target_code='00020')
        self.customer('00021', 200)
        for changes in ({'confirmed': False}, {'reason': ''}, {'target_code': '00021'}, {'resolution_token': 'forged'}):
            with self.subTest(changes=changes):
                result = self.upload(rows, True, customer_resolutions=[{**d, **changes}])
                self.assertEqual(result.status_code, 409, result.json)
        self.assertEqual(self.counts(), [0, 0, 0])
        create = self.customer_decision(rows, 'create', name='시험', biz_unit='메디컬')
        self.user['permissions'] = ['collection_approve']
        self.assertNotIn('create', self.preview(rows).json['customer_issues'][0]['allowed_actions'])
        self.assertEqual(self.upload(rows, True, customer_resolutions=[create]).status_code, 409)
        self.assertEqual(self.preview(rows, [d, d]).status_code, 400)

    def test_customer_choice_refreshes_when_balance_or_master_changes(self):
        rows = [self.row(customer_code='93001', customer_name='시험 거래처 00020')]
        d = self.customer_decision(rows, 'link', target_code='00020')
        self.upload([self.row(normal_amount=100)], True)
        p = self.preview(rows, [d]).json
        self.assertEqual(p['error_count'], 1)
        self.assertIn('변경', p['customer_issues'][0]['error'])
        self.assertEqual(self.upload(rows, customer_resolutions=[d]).status_code, 409)
        create = self.customer_decision(rows, 'create', name='시험', biz_unit='덴탈')
        self.customer('93001', 0)
        result = self.upload(rows, customer_resolutions=[create])
        self.assertEqual(result.status_code, 409)
        self.assertEqual(self.counts()[0], 1)

    def test_same_name_multiple_candidates_never_selects_automatically(self):
        self.customer('00021', 200)
        with self.db.connect() as conn:
            conn.execute("UPDATE customers SET name='같은 이름'")
        rows = [self.row(customer_code='93001', customer_name='같은 이름')]
        issue = self.preview(rows).json['customer_issues'][0]
        self.assertEqual(len(issue['candidates']), 2)
        self.assertFalse(issue['resolved'])
        d = self.customer_decision(rows, 'link', target_code='00021')
        result = self.upload(rows, True, customer_resolutions=[d])
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(self.balance()['balance'], 1000)

    def test_customer_exclusion_continues_new_rows_and_all_excluded_keeps_history(self):
        unknown = self.row(customer_code='93001', customer_name='미등록', receipt_no='RC-MISSING')
        rows = [self.row(), unknown]
        d = self.customer_decision(rows, 'exclude')
        result = self.upload(rows, customer_resolutions=[d])
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual((result.json['inserted'], result.json['customer_excluded']), (1, 1))
        d = self.customer_decision([unknown], 'exclude')
        result = self.upload([unknown], customer_resolutions=[d])
        self.assertEqual((result.json['inserted'], result.json['customer_excluded']), (0, 1))
        history = self.client.get('/api/collection-uploads/%s/reviews' % result.json['batch_id']).json['reviews']
        self.assertEqual(history[0]['action'], 'customer_exclude')
        self.assertEqual(self.balance()['balance'], 1000)

    def test_customer_resolution_keeps_other_errors_and_month_lock_checks(self):
        rows = [self.row(customer_code='93001', customer_name='신규')]
        d = self.customer_decision(rows, 'create', name='신규', biz_unit='덴탈')
        with self.db.connect() as conn:
            conn.execute("INSERT INTO month_locks (month,locked) VALUES ('2026-09',1)")
        result = self.upload(rows, True, customer_resolutions=[d])
        self.assertEqual(result.status_code, 400)
        self.assertIn('마감', result.json['preview']['rows'][0]['errors'][0])
        self.assertEqual(self.counts(), [0, 0, 0])
        p = self.preview([self.row(customer_code='93001', normal_amount='문자')]).json
        self.assertEqual(p['error_count'], 1)
        self.assertIn('정상수금', p['rows'][0]['errors'][0])

    def test_concurrent_new_customer_requests_create_one_master_and_receipt(self):
        rows = [self.row(customer_code='93001', customer_name='동시 등록 시험')]
        d = self.customer_decision(rows, 'create', name='동시 등록 시험', biz_unit='덴탈')
        def send(_):
            with self.module.app.test_client() as client:
                return self.upload(rows, True, client=client, customer_resolutions=[d]).status_code
        with ThreadPoolExecutor(max_workers=8) as pool:
            statuses = list(pool.map(send, range(8)))
        self.assertEqual(statuses.count(201), 1, statuses)
        self.assertEqual(statuses.count(409), 7, statuses)
        self.assertEqual(self.counts(), [1, 1, 1])
        with self.db.connect() as conn:
            self.assertEqual(conn.execute("SELECT advance FROM customers WHERE code='93001'").fetchone()['advance'], 600)

    def test_duplicate_receipt_exclusion_does_not_create_unused_customer(self):
        self.upload([self.row()], True)
        rows = [self.row(customer_code='93001', customer_name='새 거래처 선택')]
        d = self.customer_decision(rows, 'create', name='새 거래처 선택', biz_unit='덴탈')
        p = self.preview(rows, [d]).json
        self.assertEqual(p['rows'][0]['review_kind'], 'changed_key')
        reviews = [{'row_key': r['row_key'], 'review_token': r['review_token'], 'action': 'exclude', 'confirmed': True}
                   for r in p['rows'] if r['status'] == 'review']
        result = self.upload(rows, customer_resolutions=[d], reviews=reviews)
        self.assertEqual((result.json['inserted'], result.json['customers_created']), (0, 0))
        with self.db.connect() as conn:
            self.assertIsNone(conn.execute("SELECT code FROM customers WHERE code='93001'").fetchone())
        history = self.client.get('/api/collection-uploads/%s/reviews' % result.json['batch_id']).json['reviews']
        self.assertFalse(next(r for r in history if r['action'] == 'customer_create')['details']['created'])

    def decisions(self, rows, action='exclude', reason=''):
        return [{'row_key': r['row_key'], 'review_token': r['review_token'], 'action': action,
                 'reason': reason, 'confirmed': True}
                for r in self.preview(rows).json['rows'] if r['status'] == 'review']

    def upload_reviewed(self, rows, approve=False):
        return self.upload(rows, approve, reviews=self.decisions(rows))

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
        self.assertEqual(self.upload(rows, True).status_code, 409)
        again = self.upload_reviewed(rows, True)
        self.assertEqual((again.json['inserted'], again.json['skipped']), (0, 2))
        self.assertEqual(self.balance()['advance'], 300)

    def test_error_prevents_entire_batch_and_changed_duplicate_never_overwrites(self):
        bad = self.upload([self.row(), self.row(sequence=2, normal_amount='100원')], True)
        self.assertEqual(bad.status_code, 400); self.assertEqual(self.counts(), [0, 0, 0])
        self.upload([self.row()], True)
        self.assertEqual(self.upload([self.row(normal_amount=601)], True).status_code, 409)
        self.assertEqual(self.balance()['balance'], 400)
        mixed = self.upload_reviewed([self.row(), self.row(sequence=2, normal_amount=200)], True)
        self.assertEqual((mixed.json['inserted'], mixed.json['skipped']), (1, 1))
        self.assertEqual(self.balance()['balance'], 200)

    def test_duplicate_keys_in_file_require_review_then_keep_first_row_once(self):
        result = self.preview([self.row(), self.row()]).json
        self.assertEqual((result['error_count'], result['ready_count'], result['review_count']), (0, 1, 1))
        self.assertEqual(self.upload([self.row(), self.row()]).status_code, 409)
        r = self.upload_reviewed([self.row(), self.row()])
        self.assertEqual((r.json['inserted'], r.json['skipped']), (1, 1))

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

    def test_two_customer_resolutions_seven_duplicates_register_and_approve_atomically(self):
        prior = [self.row(receipt_no='PRIOR-%s' % i, normal_amount=10 + i) for i in range(7)]
        self.assertEqual(self.upload(prior, True).status_code, 201)
        remaining = self.balance()['balance']
        rows = prior + [self.row(receipt_no='LINK', customer_code='92018',
                                 customer_name='시험 거래처 00020', normal_amount=150),
                        self.row(receipt_no='CREATE', customer_code='70265',
                                 customer_name='신규 거래처', normal_amount=250),
                        self.row(receipt_no='NEW', normal_amount=600)]
        before = self.preview(rows).json
        self.assertEqual((before['error_count'], before['review_count'], before['ready_count']), (2, 7, 1))
        decisions = [dict(issue_key=i['issue_key'], resolution_token=i['resolution_token'], confirmed=True,
                          reason='거래처와 수금 증빙 확인', **({'action': 'link', 'target_code': '00020'}
                          if i['source_code'] == '92018' else {'action': 'create', 'name': '신규 거래처', 'biz_unit': '덴탈'}))
                     for i in before['customer_issues']]
        reviews = [{'row_key': r['row_key'], 'review_token': r['review_token'], 'action': 'exclude', 'confirmed': True}
                   for r in before['rows'] if r['status'] == 'review']
        self.assertEqual(self.upload(rows, True, reviews=reviews).status_code, 409)
        self.assertEqual(self.balance()['balance'], remaining)
        checked = self.preview(rows, decisions).json
        self.assertEqual((checked['error_count'], checked['review_count'], checked['ready_count']), (0, 7, 3))
        result = self.upload(rows, True, customer_resolutions=decisions, reviews=reviews)
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual((result.json['inserted'], result.json['approved'], result.json['skipped']), (3, 3, 7))
        self.assertEqual(result.json['total_amount'], 1000)
        self.assertEqual(self.balance()['balance'], remaining - 750)
        with self.db.connect() as conn:
            self.assertEqual(conn.execute("SELECT advance FROM customers WHERE code='70265'").fetchone()['advance'], 250)
            states = list(conn.execute("SELECT state,approved_by FROM collections"))
            self.assertEqual(len(states), 10)
            self.assertTrue(all(r['state'] == 'approved' and r['approved_by'] == 'receipt-test' for r in states))
        # A retry cannot create or offset any row again using now-stale customer choices.
        self.assertEqual(self.upload(rows, True, customer_resolutions=decisions, reviews=reviews).status_code, 409)
        self.assertEqual(self.balance()['balance'], remaining - 750)

    def test_permission_and_authentication_enforced_on_server(self):
        self.user['permissions'] = ['collection_register']
        self.assertEqual(self.upload([self.row()], True).status_code, 403)
        self.assertEqual(self.upload([self.row()]).status_code, 201)
        self.user['permissions'] = ['collection_approve']
        self.assertEqual(self.upload([self.row(sequence=2, normal_amount=300)], True).status_code, 201)
        self.user['permissions'] = ['upload_data']
        self.assertEqual(self.preview([self.row()]).status_code, 403)
        self.assertEqual(self.client.get('/api/collection-uploads').status_code, 403)
        self.user = None
        self.assertEqual(self.upload([self.row()]).status_code, 401)

    def test_manual_duplicate_requires_review_and_ledger_mismatch_blocks(self):
        self.client.post('/api/collections', json={'customer_code': '00020', 'amount': 600,
                                                  'method': '계좌수금', 'paid_at': '2026-09-01'})
        self.assertEqual(self.preview([self.row()]).json['review_count'], 1)
        with self.db.connect() as conn:
            conn.execute("UPDATE customers SET balance=300 WHERE code='00020'")
        p = self.preview([self.row(normal_amount=200)]).json
        self.assertIn('원장', p['rows'][0]['errors'][0])

    def test_closed_month_blocks_import_and_later_approval(self):
        self.upload([self.row()])
        with self.db.connect() as conn:
            cid = conn.execute('SELECT id FROM collections').fetchone()['id']
        self.client.post('/api/locks/2026-09', json={'locked': True})
        self.assertEqual(self.upload([self.row(sequence=2, normal_amount=300)]).status_code, 400)
        self.assertEqual(self.client.post('/api/collections/%s/approve' % cid).status_code, 423)
        self.assertEqual(self.upload_reviewed([self.row()]).json['skipped'], 1)
        self.assertEqual(self.balance()['balance'], 1000)

    def test_rejected_import_cannot_be_replayed(self):
        self.upload([self.row()])
        with self.db.connect() as conn:
            cid = conn.execute('SELECT id FROM collections').fetchone()['id']
        self.client.post('/api/collections/%s/reject' % cid, json={'reason': '테스트'})
        self.assertEqual(self.upload_reviewed([self.row()], True).json['inserted'], 0)
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
        self.assertTrue(all(r.status_code in (409, 201) for r in results))
        self.assertEqual(sum(r.json.get('inserted', 0) for r in results), 1)
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

    def test_every_candidate_requires_check_and_review_history_is_persisted(self):
        rows = [self.row(), self.row(sequence=2, normal_amount=200)]
        self.upload(rows, True)
        p = self.preview(rows).json
        self.assertEqual((p['error_count'], p['review_count']), (0, 2))
        decisions = self.decisions(rows)
        self.assertEqual(self.upload(rows, True, reviews=decisions[:1]).status_code, 409)
        unchecked = [dict(d) for d in decisions]; unchecked[0]['confirmed'] = False
        self.assertEqual(self.upload(rows, True, reviews=unchecked).status_code, 409)
        self.assertEqual(self.counts(), [2, 2, 1])
        response = self.upload(rows, True, reviews=decisions)
        self.assertEqual((response.json['inserted'], response.json['skipped'], response.json['reviewed']), (0, 2, 2))
        self.assertEqual(self.balance()['balance'], 200)
        history = self.client.get('/api/collection-uploads/%s/reviews' % response.json['batch_id']).json['reviews']
        self.assertEqual(len(history), 2)
        self.assertTrue(all(r['action'] == 'exclude' and r['reviewed_by'] == 'receipt-test' for r in history))
        self.assertEqual(history[0]['details']['candidates'][0]['amount'], 600)
        self.assertEqual(self.client.get('/api/collection-uploads').json['batches'][0]['excluded_count'], 2)
        self.user['permissions'] = []
        self.assertEqual(self.client.get('/api/collection-uploads/%s/reviews' % response.json['batch_id']).status_code, 403)

    def test_changed_same_key_can_be_compared_and_excluded_but_never_reinserted(self):
        self.upload([self.row()], True)
        rows = [self.row(normal_amount=650), self.row(sequence=2, normal_amount=100)]
        p = self.preview(rows).json
        self.assertEqual((p['review_count'], p['error_count']), (1, 0))
        self.assertEqual(p['rows'][0]['review_kind'], 'changed_key')
        self.assertEqual(p['rows'][0]['candidates'][0]['amount'], 600)
        invalid = self.decisions(rows, action='separate', reason='별도 수금 확인')
        self.assertEqual(self.upload(rows, True, reviews=invalid).status_code, 409)
        r = self.upload_reviewed(rows, True)
        self.assertEqual((r.json['inserted'], r.json['skipped'], r.json['total_amount']), (1, 1, 100))
        self.assertEqual(self.balance()['balance'], 300)

    def test_similar_manual_receipt_can_be_excluded_or_explicitly_separate_with_reason(self):
        self.client.post('/api/collections', json={'customer_code': '00020', 'amount': 600,
                                                  'method': '계좌수금', 'paid_at': '2026-09-01'})
        rows = [self.row()]
        p = self.preview(rows).json
        self.assertEqual(p['rows'][0]['review_kind'], 'similar')
        self.assertIn('separate', p['rows'][0]['allowed_actions'])
        self.assertEqual(self.upload(rows, reviews=self.decisions(rows, 'separate', '짧음')).status_code, 409)
        excluded = self.upload_reviewed(rows)
        self.assertEqual((excluded.json['inserted'], excluded.json['skipped']), (0, 1))
        r = self.upload(rows, reviews=self.decisions(rows, 'separate', '같은 날 별도 입금 내역 확인'))
        self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual((r.json['inserted'], r.json['skipped']), (1, 0))
        h = self.client.get('/api/collection-uploads/%s/reviews' % r.json['batch_id']).json['reviews'][0]
        self.assertEqual(h['action'], 'separate'); self.assertIn('별도 입금', h['reason'])

    def test_stale_or_tampered_confirmation_requires_new_review(self):
        self.upload([self.row()])
        rows = [self.row()]; decisions = self.decisions(rows)
        tampered = [dict(decisions[0], review_token='forged')]
        self.assertEqual(self.upload(rows, reviews=tampered).status_code, 409)
        with self.db.connect() as conn:
            cid = conn.execute('SELECT id FROM collections').fetchone()['id']
        self.client.post('/api/collections/%s/approve' % cid)
        self.assertEqual(self.upload(rows, reviews=decisions).status_code, 409)
        self.assertEqual(self.counts(), [1, 1, 1])
        self.assertEqual(self.upload_reviewed(rows).json['skipped'], 1)
        changed_rows = [self.row(normal_amount=610)]
        self.assertEqual(self.upload(changed_rows, reviews=self.decisions(rows)).status_code, 409)

    def test_similar_imported_receipts_and_closed_month_cannot_bypass_registration_rules(self):
        self.upload([self.row()])
        rows = [self.row(receipt_no='RC2609000020')]
        self.assertEqual(self.preview(rows).json['rows'][0]['review_kind'], 'similar')
        self.client.post('/api/locks/2026-09', json={'locked': True})
        p = self.preview(rows).json
        self.assertEqual(p['rows'][0]['allowed_actions'], ['exclude'])
        self.assertEqual(self.upload(rows, reviews=self.decisions(rows, 'separate', '별도 수금 확인 완료')).status_code, 409)
        self.assertEqual(self.upload_reviewed(rows).json['skipped'], 1)

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
        self.assertEqual(self.upload_reviewed(rows, True).json['skipped'], 19)


if __name__ == '__main__':
    unittest.main()
