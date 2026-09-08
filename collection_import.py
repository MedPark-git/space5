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


def customer_choices(raw_rows, customers, ledger, decisions, can_create, units):
    """Resolve missing/ambiguous codes for this upload only; never write in preview."""
    if decisions is None:
        decisions = []
    if not isinstance(decisions, list) or len(decisions) > MAX_ROWS:
        raise ValueError('거래처 확인 형식이 올바르지 않습니다.')
    submitted = {}
    for decision in decisions:
        if not isinstance(decision, dict) or not isinstance(decision.get('issue_key'), str):
            raise ValueError('거래처 확인 형식이 올바르지 않습니다.')
        key = decision['issue_key']
        if key in submitted:
            raise ValueError('같은 고객코드의 확인 결과가 중복 제출되었습니다.')
        submitted[key] = decision
    grouped = {}
    for raw in raw_rows:
        if not isinstance(raw, dict):
            continue
        code = canonical_code(raw.get('customer_code'))
        if code and not code.startswith('#') and len(code) <= 80:
            grouped.setdefault(code, []).append(raw)
    if set(submitted) - set(grouped):
        raise ValueError('현재 파일에 없는 거래처 확인 결과입니다. 파일을 다시 검증하세요.')
    issues, resolved = [], {}
    all_customers = [c for group in customers.values() for c in group]
    for code, rows in grouped.items():
        matches = customers.get(code, [])
        if len(matches) == 1 and code not in submitted:
            continue
        names = sorted({text(r.get('customer_name'))[:200] for r in rows if text(r.get('customer_name'))})
        name_keys = {compact(n).casefold() for n in names}
        candidates = [{k: c[k] for k in ('code', 'name', 'biz_unit', 'balance')} |
                      {'ledger_balance': int(ledger.get(c['code'], 0))}
                      for c in all_customers if c in matches or compact(c['name']).casefold() in name_keys]
        candidates.sort(key=lambda c: c['code'])
        allowed = ['exclude']
        if candidates:
            allowed.append('link')
        if not matches and can_create:
            allowed.append('create')
        message = ('같은 이름의 기존 거래처가 있습니다. 고객코드를 비교해 연결 여부를 선택하세요.' if candidates and not matches
                   else '고객코드가 미등록입니다. 신규 등록 또는 이번 업로드 제외를 선택하세요.' if not matches
                   else '고객코드의 등록 상태를 다시 확인하고 연결할 거래처를 선택하세요.')
        token = hashlib.sha256(json.dumps({'rows': rows, 'candidates': candidates, 'allowed': allowed},
                                         sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        issue = {'issue_key': code, 'source_code': code, 'source_names': names,
                 'row_numbers': [r.get('row_number', i + 1) for i, r in enumerate(rows)],
                 'candidates': candidates, 'allowed_actions': allowed, 'resolution_token': token,
                 'message': message, 'resolved': False, 'error': ''}
        issues.append(issue)
        d = submitted.get(code)
        if d is None:
            continue
        try:
            if d.get('resolution_token') != token:
                raise ValueError('확인 중 거래처 정보·잔액 또는 파일이 변경되었습니다. 최신 내용으로 다시 선택하세요.')
            action, reason = d.get('action'), text(d.get('reason'))
            if d.get('confirmed') is not True or action not in allowed:
                raise ValueError('처리 방법을 선택하고 확인란을 체크하세요. 신규 등록에는 수금 등록 권한이 필요합니다.')
            if len(reason) > 500 or (action == 'link' and len(reason) < 5):
                raise ValueError('기존 거래처 연결 사유를 5~500자로 입력하세요.')
            customer = None
            if action == 'link':
                customer = next((c for c in candidates if c['code'] == d.get('target_code')), None)
                if customer is None:
                    raise ValueError('표시된 기존 거래처 중 연결 대상을 선택하세요.')
            elif action == 'create':
                name, unit = text(d.get('name')), text(d.get('biz_unit'))
                if not name or len(name) > 200 or unit not in units:
                    raise ValueError('신규 거래처명(200자 이내)과 사업부를 입력하세요.')
                customer = {'code': code, 'name': name, 'biz_unit': unit, 'balance': 0, 'ledger_balance': 0}
            resolved[code] = {'action': action, 'reason': reason, 'customer': customer, 'issue': issue}
            issue['resolved'] = True
            issue['selection'] = {k: d.get(k) for k in ('action', 'target_code', 'name', 'biz_unit', 'reason')}
        except ValueError as exc:
            issue['error'] = str(exc)
    return issues, resolved


def validate_rows(conn, raw_rows, customer_resolutions=None, can_create=False, units=()):
    if not isinstance(raw_rows, list) or not raw_rows or len(raw_rows) > MAX_ROWS:
        raise ValueError('수금 내역은 1~5,000행까지 업로드할 수 있습니다.')
    customers = {}
    for customer in conn.execute('SELECT code,name,biz_unit,balance FROM customers'):
        customers.setdefault(canonical_code(customer['code']), []).append(customer)
    ledger_rows = list(conn.execute(
        'SELECT customer_code,SUM(balance) AS balance,SUM(CASE WHEN balance>0 THEN balance ELSE 0 END) AS positive_balance'
        ' FROM receivable_items GROUP BY customer_code'))
    ledger = {r['customer_code']: r['balance'] for r in ledger_rows}
    issues, resolutions = customer_choices(raw_rows, customers, ledger, customer_resolutions, can_create, units)
    issue_by_code = {i['issue_key']: i for i in issues}
    locked = {r['month'] for r in conn.execute('SELECT month FROM month_locks WHERE locked=1')}
    # This query is deliberately not limited to the 800 receipts shown by bootstrap.
    existing, matching = {}, {}
    for r in conn.execute(
            'SELECT c.id,c.customer_code,c.customer_name,c.amount,c.paid_at,c.method,c.state,c.registered_by,'
            'c.created_at,i.receipt_no,i.sequence,i.fingerprint,i.source_json FROM collections c'
            ' LEFT JOIN collection_import_rows i ON i.collection_id=c.id ORDER BY c.id'):
        source = json.loads(r.pop('source_json') or '{}')
        r['normal_amount'], r['advance_amount'] = source.get('normal_amount'), source.get('advance_amount')
        if r['receipt_no'] is not None:
            existing[(r['receipt_no'], r['sequence'])] = r
        if r['state'] in ('pending', 'approved'):
            key = (r['customer_code'], r['amount'], r['paid_at'], r['method'])
            matching.setdefault(key, []).append(r)
    today = datetime.now(timezone(timedelta(hours=9))).date()
    result = []
    for index, raw in enumerate(raw_rows, start=1):
        item = {'row_key': str(index), 'row_number': index, 'status': 'ready', 'errors': [], 'warnings': []}
        result.append(item)
        if not isinstance(raw, dict):
            item.update(status='error', errors=['수금 행 형식이 올바르지 않습니다.'])
            continue
        if isinstance(raw.get('row_number'), int) and 0 < raw['row_number'] <= 100000:
            item['row_number'] = raw['row_number']
        item['source_customer_name'] = text(raw.get('customer_name'))[:200]
        item['source_customer_code'] = canonical_code(raw.get('customer_code'))
        item['customer_code'] = item['source_customer_code']
        try:
            item['receipt_no'] = text(raw.get('receipt_no')).upper()
            if not re.fullmatch(r'[A-Z0-9_-]{1,80}', item['receipt_no']):
                raise ValueError('수금번호는 영문·숫자·하이픈·밑줄로 입력하세요.')
            item['sequence'] = integer(raw.get('sequence'), '순번', positive=True)
            if item['sequence'] > 2147483647:
                raise ValueError('순번이 허용 범위를 초과했습니다.')
            code = canonical_code(raw.get('customer_code'))
            item['customer_code'] = code
            item['source_customer_name'] = text(raw.get('customer_name'))[:200]
            if not code or code.startswith('#') or len(code) > 80:
                raise ValueError('고객코드를 확인하세요.')
            matches = customers.get(code, [])
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
            item['source'] = {k: raw.get(k) for k in (
                'row_number', 'receipt_month', 'receipt_no', 'sequence', 'customer_code', 'customer_name',
                'paid_at', 'receipt_kind', 'receipt_type', 'receipt_kind_code', 'normal_amount',
                'advance_amount', 'note', 'detail_note')}
            resolution = resolutions.get(code)
            if code in issue_by_code:
                item['customer_issue_key'] = code
                if not resolution:
                    item['error_type'] = 'customer_resolution'
                    issue = issue_by_code[code]
                    raise ValueError(issue['error'] or issue['message'])
                item['customer_resolution'] = {k: v for k, v in resolution.items() if k != 'issue'}
                if resolution['action'] == 'exclude':
                    item['status'] = 'excluded'
                    item['warnings'].append('거래처 확인 후 이번 업로드에서 제외하기로 선택했습니다.')
                    continue
                customer = resolution['customer']
                item['warnings'].append('신규 거래처 등록 예정 · 승인 시 선수금 처리' if resolution['action'] == 'create'
                                        else '거래처 연결 확인: %s → %s (승인 시 연결 거래처의 채권에 상계)' % (code, customer['code']))
            else:
                customer = matches[0]
            item['source_customer_code'] = code
            item['customer_code'], item['customer_name'] = customer['code'], customer['name']
            if item['source_customer_name'] and compact(item['source_customer_name']) != compact(customer['name']):
                item['warnings'].append('엑셀 고객명과 등록명이 다릅니다. 고객코드 기준으로 연결합니다.')
            payload = {k: item[k] for k in ('receipt_no', 'sequence', 'customer_code', 'paid_at',
                                           'method', 'normal_amount', 'advance_amount')}
            item['fingerprint'] = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            item['registration_errors'] = []
            if paid_at[:7] in locked:
                item['registration_errors'].append('수금일자의 월이 마감 잠금 상태입니다.')
            if int(ledger.get(customer['code'], 0)) != int(customer['balance']):
                item['registration_errors'].append('거래처 잔액과 채권 상세 원장이 일치하지 않습니다. 원장을 먼저 확인하세요.')
        except ValueError as exc:
            item['status'] = 'error'
            item['errors'].append(str(exc))
    seen = {}
    for item in result:
        if item['status'] in ('error', 'excluded'):
            continue
        key = (item['receipt_no'], item['sequence'])
        previous, in_file = existing.get(key), seen.get(key)
        if previous:
            kind = 'same_key' if previous['fingerprint'] == item['fingerprint'] else 'changed_key'
            candidates = [previous]
        elif in_file:
            kind = 'file_key'
            candidates = [{**{k: in_file[k] for k in ('receipt_no', 'sequence', 'customer_code', 'customer_name',
                            'paid_at', 'amount', 'method', 'normal_amount', 'advance_amount', 'row_number')},
                           'state': 'in_file', 'fingerprint': in_file['fingerprint']}]
        else:
            candidates = matching.get((item['customer_code'], item['amount'], item['paid_at'], item['method']), [])
            kind = 'similar' if candidates else None
        seen.setdefault(key, item)
        if kind:
            item['status'], item['review_kind'] = 'review', kind
            item['candidates'] = [{k: v for k, v in r.items() if k != 'fingerprint'} for r in candidates]
            item['allowed_actions'] = ['exclude']
            if kind == 'similar' and not item['registration_errors']:
                item['allowed_actions'].append('separate')
            item['review_token'] = hashlib.sha256(json.dumps({
                'row_key': item['row_key'], 'source': item['source'], 'fingerprint': item['fingerprint'],
                'kind': kind, 'candidates': candidates, 'allowed_actions': item['allowed_actions'],
            }, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            item['warnings'].append({
                'same_key': '기등록 내역입니다. 팝업에서 중복 여부를 확인해 주세요.',
                'changed_key': '같은 수금번호·순번의 내용이 달라졌습니다. 비교 후 중복 제외 여부를 확인해 주세요.',
                'file_key': '파일 안의 %s행과 수금번호·순번이 같습니다. 이 행을 제외할지 확인해 주세요.' % (in_file['row_number'] if in_file else ''),
                'similar': '기존 수금과 고객·날짜·방법·금액이 같습니다. 중복 또는 별도 수금인지 확인해 주세요.',
            }[kind])
        elif item['registration_errors']:
            item['status'] = 'error'
            item['errors'].extend(item['registration_errors'])
    ready = [r for r in result if r['status'] == 'ready']
    total = sum(r['amount'] for r in ready)
    if total > MAX_AMOUNT:
        raise ValueError('파일의 수금 합계가 허용 범위를 초과했습니다. 파일을 나누어 업로드하세요.')
    # Cumulative forecast: two receipts for the same customer must share its balance.
    positive = {r['customer_code']: int(r['positive_balance']) for r in ledger_rows}
    balances = {c['code']: positive.get(c['code'], 0) for group in customers.values() for c in group}
    for item in sorted(ready, key=lambda r: (r['customer_code'], r['paid_at'], r['receipt_no'], r['sequence'])):
        balance = balances.get(item['customer_code'], 0)
        item['offset_amount'] = min(balance, item['amount'])
        item['advance_remaining'] = item['amount'] - item['offset_amount']
        balances[item['customer_code']] = balance - item['offset_amount']
        if item['advance_remaining']:
            item['warnings'].append('승인 시 채권잔액 초과분 %s원은 선수금으로 보관됩니다.' % format(item['advance_remaining'], ','))
    return {
        'rows': result, 'row_count': len(result), 'ready_count': len(ready),
        'review_count': sum(r['status'] == 'review' for r in result),
        'error_count': sum(r['status'] == 'error' for r in result),
        'total_amount': total, 'offset_amount': sum(r['offset_amount'] for r in ready),
        'advance_remaining': sum(r['advance_remaining'] for r in ready),
        'customer_issues': issues, 'customer_issue_count': sum(not i['resolved'] for i in issues),
        'customer_excluded_count': sum(r['status'] == 'excluded' for r in result),
    }


class ReviewRequired(ValueError):
    pass


def resolve_reviews(result, decisions):
    """Bind each explicit decision to the freshly loaded candidate state."""
    if not isinstance(decisions, list) or len(decisions) > MAX_ROWS:
        raise ReviewRequired('중복 확인 내용을 확인해 주세요.')
    review_rows = {r['row_key']: r for r in result['rows'] if r['status'] == 'review'}
    submitted = {}
    for decision in decisions:
        if not isinstance(decision, dict) or not isinstance(decision.get('row_key'), str):
            raise ReviewRequired('중복 확인 내용을 확인해 주세요.')
        key = decision['row_key']
        if key in submitted:
            raise ReviewRequired('같은 행의 확인 결과가 중복 제출되었습니다.')
        submitted[key] = decision
    if set(submitted) != set(review_rows):
        raise ReviewRequired('중복 후보를 팝업에서 모두 확인해 주세요. 최신 내역으로 다시 확인합니다.')
    reviewed = []
    for key, item in review_rows.items():
        decision = submitted[key]
        if decision.get('review_token') != item['review_token']:
            raise ReviewRequired('확인 중 기존 수금 또는 업로드 내용이 변경되었습니다. 팝업에서 다시 확인해 주세요.')
        action, reason = decision.get('action'), text(decision.get('reason'))
        if decision.get('confirmed') is not True or action not in item['allowed_actions']:
            raise ReviewRequired('각 중복 후보의 처리 방법을 선택하고 확인 체크를 해 주세요.')
        if action == 'separate' and not 5 <= len(reason) <= 500:
            raise ReviewRequired('별도 수금으로 등록하는 사유를 5~500자로 입력해 주세요.')
        if len(reason) > 500:
            raise ReviewRequired('확인 사유는 500자 이내로 입력해 주세요.')
        reviewed.append({**item, 'decision': action, 'decision_reason': reason})
    ready = [r for r in result['rows'] if r['status'] == 'ready']
    ready.extend(r for r in reviewed if r['decision'] == 'separate')
    total = sum(r['amount'] for r in ready)
    if total > MAX_AMOUNT:
        raise ValueError('등록할 수금 합계가 허용 범위를 초과했습니다.')
    return ready, reviewed, total
