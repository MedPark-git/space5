"""Validate ERP receipt rows without changing the ledger. All amounts are KRW integers."""
import hashlib
import json
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

MAX_ROWS = 5000
MAX_AMOUNT = 9007199254740991  # Browser integer precision limit.
LABEL_METHODS = {
    '제예금': '계좌수금', '계좌': '계좌수금', '계좌수금': '계좌수금',
    '카드': '카드수금', '카드수금': '카드수금',
    '어음': '어음수금', '받을어음': '어음수금', '전자어음': '어음수금', '어음수금': '어음수금',
}
# Only codes verified against the supplied ERP export are fixed here.
TYPE_METHODS = {'1': '계좌수금', '5': '카드수금'}


def text(value):
    return str(value).strip() if value is not None else ''


def compact(value):
    return re.sub(r'\s+', '', text(value))


def integer(value, label, positive=False):
    value = text(value)
    if not re.fullmatch(r'(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?', value):
        raise ValueError(label + '은 원 단위 정수로 입력하세요. 공란·음수·소수·문자는 허용하지 않습니다.')
    try:
        number = Decimal(value.replace(',', ''))
    except InvalidOperation:
        raise ValueError(label + '을 확인하세요.')
    if number > MAX_AMOUNT or (positive and number <= 0):
        raise ValueError(label + '의 허용 범위를 확인하세요.')
    return int(number)


def payment_method(kind, kind_type):
    label, category = compact(kind), compact(kind_type)
    if not label or not category:
        raise ValueError('수금구분과 수금구분유형을 모두 입력하세요.')
    by_label = LABEL_METHODS.get(label)
    if not by_label:
        raise ValueError('지원하지 않는 수금구분입니다. 제예금·카드·어음 중 확인된 명칭을 사용하세요.')
    if re.fullmatch(r'\d+(?:\.0+)?', category):
        category = str(int(Decimal(category)))
        by_type = TYPE_METHODS.get(category)
    else:
        by_type = LABEL_METHODS.get(category)
        if not by_type:
            raise ValueError('지원하지 않는 수금구분유형입니다.')
    if by_type and by_type != by_label:
        raise ValueError('수금구분과 수금구분유형이 서로 다릅니다.')
    return by_label


def canonical_code(value):
    value = text(value)
    return value.zfill(5) if value.isdigit() else value


def validate_rows(conn, raw_rows):
    if not isinstance(raw_rows, list) or not raw_rows or len(raw_rows) > MAX_ROWS:
        raise ValueError('수금 내역은 1~5,000행까지 업로드할 수 있습니다.')
    customers = {}
    for customer in conn.execute('SELECT code,name,balance FROM customers'):
        customers.setdefault(canonical_code(customer['code']), []).append(customer)
    ledger_rows = list(conn.execute(
        'SELECT customer_code,SUM(balance) AS balance,SUM(CASE WHEN balance>0 THEN balance ELSE 0 END) AS positive_balance'
        ' FROM receivable_items GROUP BY customer_code'))
    ledger = {r['customer_code']: r['balance'] for r in ledger_rows}
    locked = {r['month'] for r in conn.execute('SELECT month FROM month_locks WHERE locked=1')}
    # This query is deliberately not limited to the 800 receipts shown by bootstrap.
    existing = {(r['receipt_no'], r['sequence']): r for r in conn.execute(
        'SELECT i.receipt_no,i.sequence,i.fingerprint,c.id,c.state FROM collection_import_rows i'
        ' JOIN collections c ON c.id=i.collection_id')}
    manual = {}
    for r in conn.execute(
            "SELECT c.id,c.customer_code,c.amount,c.paid_at,c.method FROM collections c"
            " LEFT JOIN collection_import_rows i ON i.collection_id=c.id"
            " WHERE i.collection_id IS NULL AND c.state IN ('pending','approved')"):
        key = (r['customer_code'], r['amount'], r['paid_at'], r['method'])
        manual.setdefault(key, []).append(r['id'])
    today = datetime.now(timezone(timedelta(hours=9))).date()
    seen, result = {}, []
    for index, raw in enumerate(raw_rows, start=1):
        item = {'row_number': index, 'status': 'ready', 'errors': [], 'warnings': []}
        result.append(item)
        if not isinstance(raw, dict):
            item.update(status='error', errors=['수금 행 형식이 올바르지 않습니다.'])
            continue
        if isinstance(raw.get('row_number'), int) and 0 < raw['row_number'] <= 100000:
            item['row_number'] = raw['row_number']
        try:
            item['receipt_no'] = text(raw.get('receipt_no')).upper()
            if not re.fullmatch(r'[A-Z0-9_-]{1,80}', item['receipt_no']):
                raise ValueError('수금번호는 영문·숫자·하이픈·밑줄로 입력하세요.')
            item['sequence'] = integer(raw.get('sequence'), '순번', positive=True)
            if item['sequence'] > 2147483647:
                raise ValueError('순번이 허용 범위를 초과했습니다.')
            key = (item['receipt_no'], item['sequence'])
            if key in seen:
                seen[key]['errors'].append('파일 안에 동일한 수금번호·순번이 중복되었습니다.')
                seen[key]['status'] = 'error'
                raise ValueError('파일 안에 동일한 수금번호·순번이 중복되었습니다.')
            seen[key] = item
            code = canonical_code(raw.get('customer_code'))
            item['customer_code'] = code
            item['source_customer_name'] = text(raw.get('customer_name'))[:200]
            if not code or code.startswith('#') or len(code) > 80:
                raise ValueError('고객코드를 확인하세요.')
            matches = customers.get(code, [])
            if len(matches) != 1:
                raise ValueError('등록되지 않은 고객코드입니다. 거래처를 먼저 등록하세요.' if not matches
                                 else '동일하게 인식되는 고객코드가 여러 개입니다. 거래처 코드를 정리하세요.')
            customer = matches[0]
            item['customer_code'], item['customer_name'] = customer['code'], customer['name']
            if item['source_customer_name'] and compact(item['source_customer_name']) != compact(customer['name']):
                item['warnings'].append('엑셀 고객명과 등록명이 다릅니다. 고객코드 기준으로 연결합니다.')
            paid_at = text(raw.get('paid_at'))
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', paid_at):
                raise ValueError('수금일자는 YYYY-MM-DD 형식으로 입력하세요.')
            try:
                paid_date = date.fromisoformat(paid_at)
            except ValueError:
                raise ValueError('존재하지 않는 수금일자입니다.')
            if paid_date > today:
                raise ValueError('미래 날짜의 수금은 등록할 수 없습니다. 수금목표 메뉴를 이용하세요.')
            month = text(raw.get('receipt_month'))
            if month and month != paid_at[:7]:
                raise ValueError('수금년월과 수금일자가 일치하지 않습니다.')
            item['paid_at'] = paid_at
            item['method'] = payment_method(raw.get('receipt_kind'), raw.get('receipt_type'))
            item['normal_amount'] = integer(raw.get('normal_amount'), '정상수금')
            item['advance_amount'] = integer(raw.get('advance_amount'), '선수금')
            item['amount'] = item['normal_amount'] + item['advance_amount']
            if not 0 < item['amount'] <= MAX_AMOUNT:
                raise ValueError('정상수금+선수금은 0보다 큰 안전한 원 단위 금액이어야 합니다.')
            item['note'] = ' / '.join(filter(None, [text(raw.get('note')), text(raw.get('detail_note'))]))[:2000]
            payload = {k: item[k] for k in ('receipt_no', 'sequence', 'customer_code', 'paid_at',
                                           'method', 'normal_amount', 'advance_amount')}
            item['fingerprint'] = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            previous = existing.get(key)
            if previous:
                if previous['fingerprint'] != item['fingerprint']:
                    raise ValueError('이미 등록된 수금번호·순번의 고객·날짜·금액·방법이 다릅니다. 기존 내역을 확인하세요.')
                item['status'] = 'duplicate'
                item['warnings'].append('기등록 수금 #%s (%s): 재등록하지 않습니다.' % (previous['id'], previous['state']))
                continue
            if paid_at[:7] in locked:
                raise ValueError('수금일자의 월이 마감 잠금 상태입니다.')
            if int(ledger.get(customer['code'], 0)) != int(customer['balance']):
                raise ValueError('거래처 잔액과 채권 상세 원장이 일치하지 않습니다. 원장을 먼저 확인하세요.')
            manual_ids = manual.get((customer['code'], item['amount'], paid_at, item['method']))
            if manual_ids:
                raise ValueError('같은 고객·수금일·금액·방법의 수기등록이 있습니다 (#%s). 중복 여부를 먼저 확인하세요.'
                                 % ', #'.join(map(str, manual_ids)))
            item['source'] = {k: raw.get(k) for k in (
                'row_number', 'receipt_month', 'receipt_no', 'sequence', 'customer_code', 'customer_name',
                'paid_at', 'receipt_kind', 'receipt_type', 'receipt_kind_code', 'normal_amount',
                'advance_amount', 'note', 'detail_note')}
        except ValueError as exc:
            item['status'] = 'error'
            item['errors'].append(str(exc))
    ready = [r for r in result if r['status'] == 'ready']
    total = sum(r['amount'] for r in ready)
    if total > MAX_AMOUNT:
        raise ValueError('파일의 수금 합계가 허용 범위를 초과했습니다. 파일을 나누어 업로드하세요.')
    # Cumulative forecast: two receipts for the same customer must share its balance.
    positive = {r['customer_code']: int(r['positive_balance']) for r in ledger_rows}
    balances = {c['code']: positive.get(c['code'], 0) for group in customers.values() for c in group}
    for item in sorted(ready, key=lambda r: (r['customer_code'], r['paid_at'], r['receipt_no'], r['sequence'])):
        balance = balances[item['customer_code']]
        item['offset_amount'] = min(balance, item['amount'])
        item['advance_remaining'] = item['amount'] - item['offset_amount']
        balances[item['customer_code']] -= item['offset_amount']
        if item['advance_remaining']:
            item['warnings'].append('승인 시 채권잔액 초과분 %s원은 선수금으로 보관됩니다.' % format(item['advance_remaining'], ','))
    return {
        'rows': result, 'row_count': len(result), 'ready_count': len(ready),
        'duplicate_count': sum(r['status'] == 'duplicate' for r in result),
        'error_count': sum(r['status'] == 'error' for r in result),
        'total_amount': total, 'offset_amount': sum(r['offset_amount'] for r in ready),
        'advance_remaining': sum(r['advance_remaining'] for r in ready),
    }
