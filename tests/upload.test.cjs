// Run with Node's test runner and xlsx@0.18.5 available on NODE_PATH.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx');

function workbook(rows) {
  const headers = Array(37).fill('');
  headers[0] = '출고일자'; headers[4] = '고객코드'; headers[5] = '고객';
  headers[27] = '합계액'; headers[36] = '대분류';
  const grid = rows.map(([code, category, amount, date = '2026-08-27']) => {
    const row = Array(37).fill('');
    row[0] = date; row[4] = code; row[5] = '테스트 ' + code;
    row[27] = amount; row[36] = category;
    return row;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...grid]), '출고현황');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function harness(rows, locks = []) {
  const state = [], requests = [], notices = [];
  let cursor = 0;
  const context = vm.createContext({
    XLSX, console,
    React: {
      createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useRef: () => ({ current: null }),
    },
    ReactDOM: { createRoot: () => ({ render() {} }) },
    document: { getElementById() {} },
    FileReader: class {
      readAsArrayBuffer(file) { this.onload({ target: { result: file.bytes } }); }
    },
    fetch: async (url, options) => {
      const payload = JSON.parse(options.body);
      requests.push({ url, payload });
      return { ok: true, json: async () => ({ inserted: payload.rows.length, replaced: 0 }) };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/app.js'), 'utf8'), context);
  const props = {
    data: { meta: { today: '2026-08-31', units: ['덴탈', '메디컬', '에스테틱'] }, locks, uploads: [] },
    can: () => true, notify: (...args) => notices.push(args), applyUpload() {}, refresh() {},
  };
  const render = () => { cursor = 0; return context.Upload(props); };
  const find = (predicate, node = render()) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of node.children || []) { const result = find(predicate, child); if (result) return result; }
    return null;
  };
  const all = (predicate, node = render()) => {
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...(node.children || []).flatMap((child) => all(predicate, child))];
  };
  find((n) => n.type === 'input' && n.props.type === 'file').props.onChange({
    target: { files: [{ name: 'semifinished.xlsx', bytes: workbook(rows) }] },
  });
  return {
    find, all, requests, notices,
    parsed: () => state[2],
    sendButton: () => find((n) => n.type === 'button' && n.props.className === 'btn btn--primary'),
  };
}

test('product and semifinished categories share the correct unit and preserve signed AB totals', async () => {
  const rows = ['덴탈', '메디컬', '에스테틱'].flatMap((unit) => [
    [20, `제품_${unit}_국내`, '1,100'],
    [20, `반제품_${unit}_국내`, '220'],
    [20, ` 반제품 _ ${unit} _ 국내 `, '(30)'],
  ]);
  rows.push(['', '', 99999]); // ERP's final total row must not become a receivable.
  const h = harness(rows);
  assert.equal(h.parsed().issues.length, 0);
  assert.equal(h.parsed().rows.length, 3);
  assert.deepEqual(Array.from(h.parsed().rows, (r) => [r.code, r.biz_unit, r.shipment_amount, r.total_amount]), [
    ['00020', '덴탈', 1290, 1290], ['00020', '메디컬', 1290, 1290], ['00020', '에스테틱', 1290, 1290],
  ]);
  assert.ok(h.parsed().rows.every((r) => r.collection_period_confirmed === false));
  assert.equal(h.sendButton().props.disabled, false);
  await h.sendButton().props.onClick();
  assert.equal(h.requests[0].url, '/api/uploads');
  assert.equal(h.requests[0].payload.month, '2026-08');
  assert.equal(h.requests[0].payload.rows.reduce((sum, r) => sum + r.shipment_amount, 0), 3870);
});

test('bare semifinished category past row 12 is selectable and cannot be sent unassigned', async () => {
  const rows = Array.from({ length: 13 }, (_, i) => [100 + i, '제품_덴탈_국내', 100]);
  rows.push([999, '반제품', 450], [999, '반제품', -50]);
  const h = harness(rows);
  assert.equal(h.parsed().issues.length, 0);
  assert.equal(h.sendButton().props.disabled, true);
  await h.sendButton().props.onClick();
  assert.equal(h.requests.length, 0);
  const select = h.find((n) => n.type === 'select');
  assert.ok(select.props['aria-label'].includes('00999'));
  select.props.onChange({ target: { value: '메디컬' } });
  assert.equal(h.sendButton().props.disabled, true);
  assert.equal(h.all((n) => n.type === 'select').length, 2);
  h.all((n) => n.type === 'select')[1].props.onChange({ target: { value: '덴탈' } });
  assert.equal(h.sendButton().props.disabled, false);
  h.find((n) => n.type === 'select').props.onChange({ target: { value: '' } });
  assert.equal(h.sendButton().props.disabled, true);
  h.find((n) => n.type === 'select').props.onChange({ target: { value: '메디컬' } });
  await h.sendButton().props.onClick();
  const selected = h.requests[0].payload.rows.filter((r) => r.code === '00999');
  assert.deepEqual(selected.map((r) => [r.biz_unit, r.shipment_amount]), [['메디컬', 450], ['덴탈', -50]]);
});

test('unknown and overseas categories remain validation errors', () => {
  const h = harness([[1, '원재료', 10], [2, '반제품_덴탈_해외', 20], [3, '', 30]]);
  assert.equal(h.parsed().issues.length, 3);
  assert.equal(h.sendButton().props.disabled, true);
  assert.ok(h.parsed().issues[0].includes('원재료'));
});

test('dated semifinished shipments retain month splitting and closed-month exclusion', async () => {
  const h = harness([
    [1, '반제품_덴탈_국내', 110, '2026-08-01'],
    [1, '반제품_덴탈_국내', 220, '2026-09-01'],
  ], [{ month: '2026-08', locked: 1 }]);
  await h.sendButton().props.onClick();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].payload.month, '2026-09');
  assert.equal(h.requests[0].payload.rows[0].shipment_amount, 220);
});

test('grouped monthly shipments preserve each original date amount and Excel row for daily reports', async () => {
  const h = harness([[20, '제품_덴탈_국내', 100, '2026-08-02'], [20, '반제품_덴탈_국내', -25, '2026-08-03'],
    [20, '제품_덴탈_국내', 50, '2026-08-05']]);
  assert.equal(h.parsed().rows.length, 1);
  await h.sendButton().props.onClick();
  const group = h.requests[0].payload.rows[0];
  assert.equal(group.shipment_amount, 125);
  assert.deepEqual(group.source_lines.map((r) => [r.row_number, r.shipment_date, r.amount]),
    [[2, '2026-08-02', 100], [3, '2026-08-03', -25], [4, '2026-08-05', 50]]);
  assert.equal(group.source_lines[1].columns.find((c) => c.column === 'AB').value, -25);
});
