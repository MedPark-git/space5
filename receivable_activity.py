"""Read-only activity reports and lossless shipment source capture.

Shipment amount is the active monthly upload's signed gross amount, never its
remaining balance. Missing historical dates are not invented. Collections use
paid_at and only approved rows enter the chart. Opening balances are separate.
"""
import calendar
import json
import re
from collections import defaultdict
from datetime import date, timedelta


def month_value(value):
    if not re.fullmatch(r'\d{4}-\d{2}', str(value or '')):
        raise ValueError('조회월은 YYYY-MM 형식으로 입력하세요.')
    try:
        date.fromisoformat(value + '-01')
    except ValueError:
        raise ValueError('조회월에 유효한 연도와 월을 입력하세요.')
    return value


def parameters(args):
    start = month_value(args.get('start_month') or date.today().strftime('%Y-%m'))
    end = month_value(args.get('end_month') or start)
    span = (int(end[:4]) - int(start[:4])) * 12 + int(end[5:]) - int(start[5:])
    if not 0 <= span < 24:
        raise ValueError('조회기간은 시작월부터 최대 24개월까지 선택하세요.')
    grain = args.get('grain', 'day')
    unit = args.get('unit', '')
    if grain not in ('day', 'month') or unit not in ('', '덴탈', '메디컬', '에스테틱'):
        raise ValueError('조회 단위 또는 사업부를 확인하세요.')
    return dict(start_month=start, end_month=end, grain=grain, unit=unit,
                q=str(args.get('q', '')).strip()[:100])


def source_lines(rows, month):
    """Validate nested source totals before the upload can change any ledger."""
    result = []
    for index, row in enumerate(rows, 1):
        code = str(row.get('code') or '').strip()
        if not code:
            continue
        if code.isdigit():
            code = code.zfill(5)
        lines = row.get('source_lines')
        if lines is None:
            # Old clients send monthly groups with their last date. It is NOT a
            # transaction date for the entire group, so retain unknown precision.
            continue
        if not isinstance(lines, list) or not lines or len(result) + len(lines) > 50000:
            raise ValueError('출고 원본 상세는 1~50,000행까지 보관할 수 있습니다.')
        total = 0
        for line in lines:
            if not isinstance(line, dict):
                raise ValueError('출고 원본 행의 형식을 확인하세요.')
            amount = line.get('amount')
            if isinstance(amount, bool) or not isinstance(amount, int) or abs(amount) > 9007199254740991:
                raise ValueError('출고 원본 금액은 원 단위 정수여야 합니다.')
            occurred = str(line.get('shipment_date') or '')
            if occurred:
                try:
                    valid = date.fromisoformat(occurred)
                except ValueError:
                    raise ValueError('출고 원본 일자가 올바르지 않습니다.')
                if valid.isoformat() != occurred or occurred[:7] != month:
                    raise ValueError('출고 원본 일자는 반영할 기준월 안의 날짜여야 합니다.')
            number = line.get('row_number', index)
            if isinstance(number, bool) or not isinstance(number, int) or number < 1:
                raise ValueError('출고 원본 행 번호를 확인하세요.')
            result.append(dict(month=month, row_number=number, occurred_on=occurred,
                               customer_code=code, customer_name=str(row.get('name') or code),
                               source_biz_unit=row['biz_unit'], amount=amount,
                               source_json=json.dumps(line, ensure_ascii=False)))
            total += amount
        raw = row.get('shipment_amount')
        if raw in (None, ''):
            raw = row.get('total_amount')
        try:
            expected = int(raw)
        except (TypeError, ValueError):
            raise ValueError('출고 합계 금액을 확인하세요.')
        if total != expected:
            raise ValueError('출고 원본 행 금액과 거래처별 합계가 다릅니다. 파일을 다시 선택하세요.')
    return result


def matches(row, p):
    query = p['q'].casefold()
    return (not p['unit'] or row.get('biz_unit') == p['unit']) and (
        not query or query in (row.get('customer_code', '') + ' ' + row.get('customer_name', '')).casefold())


def activity_rows(conn, p):
    start, end = p['start_month'], p['end_month']
    latest = {r['month']: r for r in conn.execute(
        "SELECT u.* FROM uploads u WHERE u.upload_type='shipment' AND u.month>=%s AND u.month<=%s"
        " AND u.id=(SELECT MAX(v.id) FROM uploads v WHERE v.month=u.month AND v.upload_type='shipment')", (start, end))}
    overrides = {(r['issue_month'], r['customer_code'], r['source_biz_unit']): r['target_biz_unit']
                 for r in conn.execute('SELECT * FROM receivable_unit_overrides WHERE issue_month>=%s AND issue_month<=%s', (start, end))}
    details = defaultdict(list)
    for r in conn.execute('SELECT l.id,l.month,l.customer_code,l.source_biz_unit,l.amount,l.row_number,l.occurred_on'
                          ' FROM shipment_upload_lines l JOIN uploads u ON u.id=l.upload_id'
                          " WHERE l.month>=%s AND l.month<=%s AND u.upload_type='shipment'"
                          " AND u.id=(SELECT MAX(v.id) FROM uploads v WHERE v.month=u.month AND v.upload_type='shipment')", (start, end)):
        unit = overrides.get((r['month'], r['customer_code'], r['source_biz_unit']), r['source_biz_unit'])
        details[(r['month'], r['customer_code'], unit)].append(r)
    shipments = []
    for r in conn.execute('SELECT * FROM monthly_shipment_units WHERE month>=%s AND month<=%s', (start, end)):
        upload = latest.get(r['month'], {})
        common = dict(month=r['month'], customer_code=r['code'], customer_name=r['name'], biz_unit=r['biz_unit'],
                      filename=upload.get('filename', ''), uploaded_by=upload.get('uploaded_by', ''),
                      uploaded_at=upload.get('uploaded_at', ''), upload_id=upload.get('id'), state='active', origin='upload')
        if not matches(common, p):
            continue
        lines = details.get((r['month'], r['code'], r['biz_unit']), [])
        if lines and sum(x['amount'] for x in lines) == r['amount']:
            for line in lines:
                shipments.append(dict(common, id='shipment:%s' % line['id'], source_id=line['id'],
                                      date=line['occurred_on'], amount=line['amount'], row_number=line['row_number'],
                                      precision='day' if line['occurred_on'] else 'month', note=''))
        else:
            # Monthly ledger is authoritative. Do not inflate totals by combining
            # incomplete line archives with its aggregate, or use upload_date.
            shipments.append(dict(common, id='month:%s:%s:%s' % (r['month'], r['code'], r['biz_unit']),
                                  source_id=None, date='', precision='month', amount=r['amount'], row_number=None,
                                  note='원본 일자 미보관 · 월별 합계' if not lines else '원본 상세와 현재 월 합계 차이 · 월 합계 기준'))
    collections = []
    end_date = end + '-%02d' % calendar.monthrange(int(end[:4]), int(end[5:]))[1]
    for r in conn.execute(
        'SELECT c.*, COALESCE(m.biz_unit,\'\') AS biz_unit, i.receipt_no,i.sequence,i.batch_id,b.filename'
        ' FROM collections c LEFT JOIN customers m ON m.code=c.customer_code'
        ' LEFT JOIN collection_import_rows i ON i.collection_id=c.id'
        ' LEFT JOIN collection_upload_batches b ON b.id=i.batch_id WHERE c.paid_at>=%s AND c.paid_at<=%s',
        (start + '-01', end_date)):
        if matches(r, p):
            collections.append(dict(id='collection:%s' % r['id'], source_id=r['id'] if r['batch_id'] else None,
                                    date=r['paid_at'], month=r['paid_at'][:7], precision='day', amount=r['amount'],
                                    customer_code=r['customer_code'], customer_name=r['customer_name'], biz_unit=r['biz_unit'],
                                    method=r['method'], state=r['state'], origin='upload' if r['batch_id'] else 'manual',
                                    receipt_no=r['receipt_no'] or '', sequence=r['sequence'], filename=r['filename'] or '수기등록',
                                    uploaded_by=r['registered_by'], uploaded_at=r['created_at'], approved_by=r['approved_by'],
                                    approved_at=r['approved_at'], note=r['note']))
    return shipments, collections


def opening_rows(conn, p):
    # A balance snapshot is neither a dated sale nor a cash receipt.
    result = []
    for r in conn.execute("SELECT r.*,c.name AS customer_name FROM receivable_items r"
                          " LEFT JOIN customers c ON c.code=r.customer_code WHERE r.source_key NOT LIKE 'shipment:%%'"):
        item = dict(id='opening:%s' % r['id'], source_id=None, date='', month=r['issue_month'], precision='opening',
                    customer_code=r['customer_code'], customer_name=r['customer_name'] or r['customer_code'],
                    biz_unit=r['biz_unit'], amount=r['original_amount'], balance=r['balance'], state=r['category'],
                    filename='기초·이월 원장', note=r['note'], source_key=r['source_key'], target_month=r['target_month'])
        if matches(item, p):
            result.append(item)
    return result


def report(conn, p):
    shipments, collections = activity_rows(conn, p)
    months = []
    current = date.fromisoformat(p['start_month'] + '-01')
    end = p['end_month']
    while current.strftime('%Y-%m') <= end:
        months.append(current.strftime('%Y-%m'))
        current = (current.replace(day=28) + timedelta(days=4)).replace(day=1)
    periods = months if p['grain'] == 'month' else [m + '-%02d' % d for m in months
        for d in range(1, calendar.monthrange(int(m[:4]), int(m[5:]))[1] + 1)]
    buckets = {period: dict(period=period, shipment_amount=0, collection_amount=0,
                            shipment_count=0, collection_count=0, undated_amount=0, undated_count=0) for period in periods}
    undated = defaultdict(lambda: dict(amount=0, count=0))
    for row in shipments:
        if not row['date']:
            undated[row['month']]['amount'] += row['amount']; undated[row['month']]['count'] += 1
        key = row['month'] if p['grain'] == 'month' else row['date']
        if key in buckets:
            buckets[key]['shipment_amount'] += row['amount']; buckets[key]['shipment_count'] += 1
    approved = [r for r in collections if r['state'] == 'approved']
    for row in approved:
        key = row['month'] if p['grain'] == 'month' else row['date']
        if key in buckets:
            buckets[key]['collection_amount'] += row['amount']; buckets[key]['collection_count'] += 1
    for key, bucket in buckets.items():
        unknown = undated.get(key[:7], {})
        bucket['shipment_complete'] = not unknown.get('count')
        if p['grain'] == 'month':
            bucket['undated_amount'] = unknown.get('amount', 0); bucket['undated_count'] = unknown.get('count', 0)
    shipment_total = sum(r['amount'] for r in shipments)
    collected = sum(r['amount'] for r in approved)
    return dict(filters=p, series=list(buckets.values()), undated=[dict(month=m, **v) for m, v in sorted(undated.items())],
                totals=dict(shipment_amount=shipment_total, collection_amount=collected, difference=shipment_total-collected,
                            shipment_count=len(shipments), collection_count=len(approved),
                            undated_amount=sum(v['amount'] for v in undated.values()), undated_count=sum(v['count'] for v in undated.values()),
                            pending_amount=sum(r['amount'] for r in collections if r['state'] == 'pending')))


def details(conn, p, args):
    kind = args.get('kind', 'shipments')
    if kind not in ('shipments', 'collections', 'opening'):
        raise ValueError('상세 내역 구분을 확인하세요.')
    if kind == 'opening':
        rows = opening_rows(conn, p)
    else:
        shipments, collections = activity_rows(conn, p)
        rows = shipments if kind == 'shipments' else collections
    state, origin, period = args.get('state', ''), args.get('origin', ''), args.get('period', '')
    if state not in ('', 'approved', 'pending', 'rejected') or origin not in ('', 'upload', 'manual'):
        raise ValueError('수금 상태 또는 등록 경로를 확인하세요.')
    if period and not re.fullmatch(r'\d{4}-\d{2}(?:-\d{2})?', period):
        raise ValueError('상세 조회 일자 또는 월을 확인하세요.')
    if period:
        try:
            date.fromisoformat(period if len(period) == 10 else period + '-01')
        except ValueError:
            raise ValueError('상세 조회 일자 또는 월을 확인하세요.')
    if kind != 'opening':
        rows = [r for r in rows if (not period or (r['date'] if len(period) == 10 else r['month']) == period)
                and (kind != 'collections' or ((not state or r['state'] == state) and (not origin or r['origin'] == origin)))]
    rows.sort(key=lambda r: (r['date'] or r['month'], r['customer_code'], r['id']), reverse=True)
    try:
        page = max(int(args.get('page', 1)), 1)
    except (TypeError, ValueError):
        raise ValueError('페이지 번호를 확인하세요.')
    pages = max((len(rows) + 49) // 50, 1); page = min(page, pages)
    return dict(kind=kind, page=page, pages=pages, count=len(rows), amount=sum(r['amount'] for r in rows),
                balance=sum(r.get('balance', 0) for r in rows), rows=rows[(page-1)*50:page*50])


def source(conn, kind, source_id):
    if kind == 'shipments':
        row = conn.execute('SELECT l.source_json,l.row_number,u.filename,u.uploaded_by,u.uploaded_at'
                           ' FROM shipment_upload_lines l JOIN uploads u ON u.id=l.upload_id WHERE l.id=%s', (source_id,)).fetchone()
    elif kind == 'collections':
        row = conn.execute('SELECT i.source_json,b.filename,b.uploaded_by,b.created_at AS uploaded_at'
                           ' FROM collection_import_rows i JOIN collection_upload_batches b ON b.id=i.batch_id'
                           ' WHERE i.collection_id=%s', (source_id,)).fetchone()
    else:
        raise ValueError('원본 내역 구분을 확인하세요.')
    if not row:
        return None
    row['source'] = json.loads(row.pop('source_json'))
    return row
