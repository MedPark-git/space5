const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx');
const source = fs.readFileSync(path.join(__dirname, '../static/app.js'), 'utf8');
const headers = ['수금일자', '수금번호', '고객코드', '고객', '순번', '수금구분', '수금구분유형', '정상수금', '선수금', '관리고객코드'];
const row = ['2026-09-01', 'RC2609000001', '03791', '테스트', 1, '제 예 금', 1, 2000000, 0, 'D026'];

function harness(grid = [headers, row], approvePermission = true, previewChanges = {}) {
  const state = [], requests = [], notices = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useEffect() {},
    useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (v) => { state[index] = typeof v === 'function' ? v(state[index]) : v; }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
  };
  const checkedRow = { row_number: 2, status: 'ready', customer_code: '03791', customer_name: '테스트',
    receipt_no: 'RC2609000001', sequence: 1, amount: 2000000, normal_amount: 2000000, advance_amount: 0,
    method: '계좌수금', paid_at: '2026-09-01', errors: [], warnings: [] };
  let checked = { rows: [checkedRow], row_count: 1, ready_count: 1, review_count: 0, error_count: 0,
    total_amount: 2000000, offset_amount: 2000000, advance_remaining: 0, ...previewChanges };
  const context = vm.createContext({ console, Uint8Array, React: react,
    ReactDOM: { createRoot: () => ({ render() {} }) }, document: { getElementById() {} },
    XLSX: grid ? { ...XLSX, read: () => ({ Sheets: { Sheet1: {} }, SheetNames: ['Sheet1'] }),
      utils: { ...XLSX.utils, sheet_to_json: () => grid } } : XLSX,
    fetch: async (url, options = {}) => {
      const payload = options.body ? JSON.parse(options.body) : undefined;
      requests.push({ url, payload });
      return { ok: true, json: async () => url.endsWith('/preview') ? JSON.parse(JSON.stringify(checked)) : options.method === 'POST'
        ? { inserted: 1, approved: payload.approve_immediately ? 1 : 0, skipped: 0, total_amount: 2000000 }
        : { batches: [] } };
    },
  });
  vm.runInContext(source, context);
  const props = { can: (p) => p === 'collection_approve' ? approvePermission : true,
    notify: (...args) => notices.push(args), refresh: async () => {} };
  const render = () => { cursor = 0; return context.CollectionUpload(props); };
  const find = (predicate, node = render()) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of node.children || []) { const result = find(predicate, child); if (result) return result; }
    return null;
  };
  return { context, requests, notices, render, find, setPreview: (next) => { checked = { ...checked, ...next }; },
    parse: (bytes = new Uint8Array()) => context.parseCollectionWorkbook(bytes),
    select: async () => {
      const file = { name: 'receipts.xlsx', size: 1024, arrayBuffer: async () => new Uint8Array() };
      find((n) => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [file], value: 'file' } });
      // File read + API response are promises from the production handler.
      for (let i = 0; i < 10; i++) await Promise.resolve();
    },
  };
}

test('exact ERP headers preserve customer zeros and never use management customer code', () => {
  const data = harness().parse();
  assert.equal(data.rows[0].customer_code, '03791');
  assert.equal(data.rows[0].normal_amount, 2000000);
  assert.equal(data.rows[0].row_number, 2);
});

test('blank rows and final total are excluded while sequential receipts remain separate', () => {
  const second = [...row]; second[4] = 2; second[7] = 500000;
  const total = ['합계', '', '', '', '', '', '', 2500000, 0];
  const data = harness([['수금현황'], [], headers, row, [], second, total]).parse();
  assert.equal(data.rows.length, 2); assert.equal(data.skippedTotals, 1);
  assert.equal(data.rows[1].row_number, 6);
  assert.equal(data.rows[1].sequence, 2);
});

test('missing and repeated headers and incorrect grand totals block parsing', () => {
  const absent = [...headers]; absent[8] = '기타';
  assert.throws(() => harness([absent, row]).parse(), /필수 열 누락.*선수금/);
  assert.throws(() => harness([[...headers, '고객코드'], row]).parse(), /머리글이 중복/);
  assert.throws(() => harness([headers, row, ['합계', '', '', '', '', '', '', 1, 0]]).parse(), /합계행/);
  assert.throws(() => harness().parse(Buffer.from('BMS DocuRay\x03')), /보안 처리/);
});

test('numeric Excel dates are normalized and invalid dates are retained for server validation', () => {
  const serial = [...row]; serial[0] = 46266;
  assert.equal(harness([headers, serial]).parse().rows[0].paid_at, '2026-09-01');
  const bad = [...row]; bad[0] = '2026-02-30';
  assert.equal(harness([headers, bad]).parse().rows[0].paid_at, '2026-02-30');
});

test('selection previews without importing, explicit approval checkbox controls submit', async () => {
  const h = harness(); await h.select();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].url, '/api/collection-uploads/preview');
  let button = h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary');
  assert.ok(button); assert.equal(button.props.disabled, false);
  const checkbox = h.find((n) => n.type === 'input' && n.props.type === 'checkbox');
  assert.equal(checkbox.props.checked, false);
  checkbox.props.onChange({ target: { checked: true } });
  button = h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary');
  await Promise.all([button.props.onClick(), button.props.onClick()]);
  const writes = h.requests.filter((r) => r.url === '/api/collection-uploads' && r.payload);
  assert.equal(writes.length, 1); assert.equal(writes[0].payload.approve_immediately, true);
  assert.equal(writes[0].payload.rows[0].normal_amount, 2000000);
});

test('validation errors prevent submit and non-approvers cannot select immediate approval', async () => {
  const h = harness(undefined, false, { error_count: 1, ready_count: 0 }); await h.select();
  assert.equal(h.find((n) => n.type === 'input' && n.props.type === 'checkbox'), null);
  const button = h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary');
  assert.equal(button.props.disabled, true); await button.props.onClick();
  assert.equal(h.requests.length, 1);
});

function reviewRow(key, kind = 'same_key') {
  return { row_key: key, row_number: Number(key) + 1, status: 'review', receipt_no: 'RC2609000001', sequence: 1,
    customer_code: '03791', customer_name: '테스트', paid_at: '2026-09-01', method: '계좌수금',
    normal_amount: 2000000, advance_amount: 0, amount: 2000000, errors: [], warnings: ['중복 비교 확인'],
    review_kind: kind, review_token: 'verified-' + key, allowed_actions: kind === 'similar' ? ['exclude', 'separate'] : ['exclude'],
    candidates: [{ id: 10, customer_code: '03791', customer_name: '기존 거래처', paid_at: '2026-09-01',
      method: '계좌수금', amount: 2000000, state: 'approved', registered_by: '기존 등록자' }] };
}

test('duplicates automatically open comparison dialog and require every checkbox before upload', async () => {
  const h = harness(undefined, true, { rows: [reviewRow('1'), reviewRow('2', 'changed_key')],
    row_count: 2, ready_count: 0, review_count: 2, total_amount: 0 });
  await h.select();
  const modal = () => h.find((n) => n.props.role === 'dialog');
  assert.ok(modal());
  const confirm = () => h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary', modal());
  assert.equal(confirm().props.disabled, true);
  await confirm().props.onClick(); assert.equal(h.requests.length, 1);
  h.find((n) => n.type === 'input' && n.props['aria-label'] === '엑셀 2행 중복 여부 확인').props.onChange({ target: { checked: true } });
  assert.equal(confirm().props.disabled, true);
  h.find((n) => n.type === 'input' && n.props['aria-label'] === '엑셀 3행 중복 여부 확인').props.onChange({ target: { checked: true } });
  assert.equal(confirm().props.disabled, false);
  await confirm().props.onClick();
  const request = h.requests.find((r) => r.url === '/api/collection-uploads' && r.payload);
  assert.equal(request.payload.reviews.length, 2);
  assert.ok(request.payload.reviews.every((r) => r.confirmed && r.action === 'exclude'));
  assert.equal(request.payload.reviews[1].review_token, 'verified-2');
});

test('identical-only bulk check leaves changed candidates for individual confirmation', async () => {
  const h = harness(undefined, false, { rows: [reviewRow('1'), reviewRow('2', 'changed_key')],
    row_count: 2, ready_count: 0, review_count: 2, total_amount: 0 });
  await h.select();
  const modal = h.find((n) => n.props.role === 'dialog');
  const bulk = h.find((n) => n.type === 'input' && n.props.type === 'checkbox' && !n.props['aria-label'], modal);
  bulk.props.onChange({ target: { checked: true } });
  assert.equal(h.find((n) => n.props['aria-label'] === '엑셀 2행 중복 여부 확인').props.checked, true);
  assert.equal(h.find((n) => n.props['aria-label'] === '엑셀 3행 중복 여부 확인').props.checked, false);
  const updatedModal = h.find((n) => n.props.role === 'dialog');
  assert.equal(h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary', updatedModal).props.disabled, true);
});

test('separate payment selection requires reason and a new explicit check', async () => {
  const h = harness(undefined, false, { rows: [reviewRow('1', 'similar')], row_count: 1, ready_count: 0,
    review_count: 1, total_amount: 0 });
  await h.select();
  const modal = () => h.find((n) => n.props.role === 'dialog');
  const confirm = () => h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary', modal());
  h.find((n) => n.props['aria-label'] === '엑셀 2행 처리 방법').props.onChange({ target: { value: 'separate' } });
  h.find((n) => n.props['aria-label'] === '엑셀 2행 중복 여부 확인').props.onChange({ target: { checked: true } });
  assert.equal(confirm().props.disabled, true);
  h.find((n) => n.props['aria-label'] === '엑셀 2행 별도 등록 사유').props.onChange({ target: { value: '당일 별도 입금 증빙 확인' } });
  assert.equal(confirm().props.disabled, true);
  h.find((n) => n.props['aria-label'] === '엑셀 2행 중복 여부 확인').props.onChange({ target: { checked: true } });
  assert.equal(confirm().props.disabled, false);
  await confirm().props.onClick();
  const request = h.requests.find((r) => r.url === '/api/collection-uploads' && r.payload);
  assert.equal(request.payload.reviews[0].action, 'separate');
  assert.equal(request.payload.reviews[0].reason, '당일 별도 입금 증빙 확인');
  assert.equal(request.payload.approve_immediately, false);
});

test('attached ERP export parses all 19 rows with exact amounts despite its unusual styles',
  { skip: !process.env.COLLECTION_SAMPLE_XLSX }, () => {
    const data = harness(null).parse(fs.readFileSync(process.env.COLLECTION_SAMPLE_XLSX));
    assert.equal(data.rows.length, 19); assert.equal(data.skippedTotals, 1);
    assert.equal(data.rows.reduce((s, r) => s + r.normal_amount + r.advance_amount, 0), 98268581);
    assert.equal(data.rows[4].customer_code, '03791');
    assert.equal(data.rows[4].receipt_no, data.rows[5].receipt_no);
    assert.notEqual(data.rows[4].sequence, data.rows[5].sequence);
    if (process.env.COLLECTION_SAMPLE_JSON) fs.writeFileSync(process.env.COLLECTION_SAMPLE_JSON, JSON.stringify(data.rows));
  });

function customerIssue(allowed = ['link', 'create', 'exclude']) {
  return { issue_key: '03791', source_code: '03791', source_names: ['테스트'], row_numbers: [2],
    message: '같은 이름의 거래처 코드가 다릅니다.', error: '', resolved: false, resolution_token: 'customer-token',
    candidates: [{ code: '00020', name: '테스트', biz_unit: '덴탈', balance: 3000000, ledger_balance: 3000000 }],
    allowed_actions: allowed };
}
function customerError() {
  return { row_key: '1', row_number: 2, status: 'error', customer_code: '03791', source_customer_name: '테스트',
    receipt_no: 'RC2609000001', sequence: 1, errors: ['미등록 코드 · 기존 거래처를 확인하세요.'], warnings: [] };
}
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node)
  : node && typeof node === 'object' ? (node.children || []).map(textOf).join(' ') : '';

test('customer error dialog shows row and reason before duplicates and rechecks link without writing', async () => {
  const issue = customerIssue();
  const h = harness(undefined, true, { rows: [customerError(), reviewRow('2')], row_count: 2, ready_count: 0,
    error_count: 1, review_count: 1, customer_issue_count: 1, customer_issues: [issue] });
  await h.select();
  const dialog = () => h.find((n) => n.props['aria-labelledby'] === 'collection-customer-title');
  assert.ok(dialog());
  assert.equal(h.find((n) => n.props['aria-labelledby'] === 'collection-review-title'), null);
  assert.match(textOf(dialog()), /엑셀\s+2\s*행/); assert.match(textOf(dialog()), /미등록 코드/);
  const next = () => h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary', dialog());
  assert.equal(next().props.disabled, true);
  h.find((n) => n.props['aria-label'] === '03791 거래처 처리 방법').props.onChange({ target: { value: 'link' } });
  h.find((n) => n.props['aria-label'] === '03791 연결 거래처').props.onChange({ target: { value: '00020' } });
  h.find((n) => n.props['aria-label'] === '03791 거래처 확인 완료').props.onChange({ target: { checked: true } });
  assert.equal(next().props.disabled, true);
  h.find((n) => n.props['aria-label'] === '03791 거래처 확인 사유').props.onChange({ target: { value: '동일 거래처 입금 증빙 확인' } });
  assert.equal(h.find((n) => n.props['aria-label'] === '03791 거래처 확인 완료').props.checked, false);
  h.find((n) => n.props['aria-label'] === '03791 거래처 확인 완료').props.onChange({ target: { checked: true } });
  assert.equal(next().props.disabled, false);
  h.setPreview({ rows: [reviewRow('1', 'similar')], row_count: 1, ready_count: 0, total_amount: 0,
    error_count: 0, review_count: 1, customer_issue_count: 0, customer_issues: [{ ...issue, resolved: true }] });
  await next().props.onClick();
  assert.equal(h.requests.length, 2); assert.ok(h.requests.every((r) => r.url.endsWith('/preview')));
  assert.equal(h.requests[1].payload.rows[0].customer_code, '03791');
  assert.equal(h.requests[1].payload.customer_resolutions[0].target_code, '00020');
  assert.equal(dialog(), null);
  let duplicate = h.find((n) => n.props['aria-labelledby'] === 'collection-review-title');
  assert.ok(duplicate);
  h.find((n) => n.props['aria-label'] === '엑셀 2행 중복 여부 확인').props.onChange({ target: { checked: true } });
  duplicate = h.find((n) => n.props['aria-labelledby'] === 'collection-review-title');
  await h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary', duplicate).props.onClick();
  const write = h.requests.find((r) => r.url === '/api/collection-uploads' && r.payload);
  assert.equal(write.payload.customer_resolutions[0].action, 'link');
  assert.equal(write.payload.customer_resolutions[0].confirmed, true);
  assert.equal(write.payload.reviews[0].action, 'exclude');
});

test('new customer requires business unit and confirmation and discloses advance handling', async () => {
  const issue = customerIssue();
  const h = harness(undefined, false, { rows: [customerError()], ready_count: 0, error_count: 1,
    customer_issue_count: 1, customer_issues: [issue] });
  await h.select();
  const dialog = () => h.find((n) => n.props['aria-labelledby'] === 'collection-customer-title');
  const next = () => h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary', dialog());
  h.find((n) => n.props['aria-label'] === '03791 거래처 처리 방법').props.onChange({ target: { value: 'create' } });
  assert.match(textOf(dialog()), /채권잔액 0원/); assert.match(textOf(dialog()), /선수금/);
  h.find((n) => n.props['aria-label'] === '03791 거래처 확인 완료').props.onChange({ target: { checked: true } });
  assert.equal(next().props.disabled, true);
  h.find((n) => n.props['aria-label'] === '03791 신규 사업부').props.onChange({ target: { value: '메디컬' } });
  assert.equal(next().props.disabled, true);
  h.find((n) => n.props['aria-label'] === '03791 거래처 확인 완료').props.onChange({ target: { checked: true } });
  assert.equal(next().props.disabled, false);
  await next().props.onClick();
  assert.equal(h.requests[1].payload.customer_resolutions[0].biz_unit, '메디컬');
  assert.ok(h.requests.every((r) => r.url.endsWith('/preview')));
});

test('error-only filter shows exact faulty rows and excludes normal rows', async () => {
  const error = { ...customerError(), errors: ['수금일자가 존재하지 않습니다.'] };
  const h = harness(undefined, false, { rows: [error, { ...reviewRow('2'), status: 'ready' }],
    row_count: 2, error_count: 1 });
  await h.select();
  assert.match(textOf(h.render()), /수금일자가 존재하지 않습니다/);
  const filter = h.find((n) => n.type === 'button' && textOf(n) === '오류 1건만 보기');
  filter.props.onClick();
  assert.equal(h.find((n) => n.type === 'button' && textOf(n) === '전체 내역 보기').props['aria-pressed'], true);
  const rows = h.find((n) => n.type === 'tbody');
  assert.equal(rows.children.filter((n) => n && n.type === 'tr').length, 1);
});

test('all customer exclusions can save audit without creating receipt, and new action follows server permission', async () => {
  const issue = customerIssue(['link', 'exclude']);
  const h = harness(undefined, true, { rows: [customerError()], ready_count: 0, error_count: 1,
    customer_issue_count: 1, customer_issues: [issue] });
  await h.select();
  const select = h.find((n) => n.props['aria-label'] === '03791 거래처 처리 방법');
  assert.equal(h.find((n) => n.type === 'option' && n.props.value === 'create', select), null);
  select.props.onChange({ target: { value: 'exclude' } });
  h.find((n) => n.props['aria-label'] === '03791 거래처 확인 완료').props.onChange({ target: { checked: true } });
  h.setPreview({ rows: [{ ...customerError(), status: 'excluded', errors: [] }], error_count: 0,
    customer_issue_count: 0, customer_excluded_count: 1, customer_issues: [{ ...issue, resolved: true }] });
  const dialog = h.find((n) => n.props['aria-labelledby'] === 'collection-customer-title');
  await h.find((n) => n.type === 'button' && n.props.className === 'btn btn--primary', dialog).props.onClick();
  const save = h.find((n) => n.type === 'button' && textOf(n) === '제외 확인 이력 저장');
  assert.equal(save.props.disabled, false); await save.props.onClick();
  assert.equal(h.requests.find((r) => r.url === '/api/collection-uploads' && r.payload).payload.customer_resolutions[0].action, 'exclude');
});
