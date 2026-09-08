const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const series = [
  { period: '2026-08-01', shipment_amount: 100, collection_amount: 20, shipment_complete: true },
  { period: '2026-08-02', shipment_amount: -25, collection_amount: 50, shipment_complete: false },
];
const totals = { shipment_amount: 200, collection_amount: 70, difference: 130, pending_amount: 50,
  shipment_count: 3, collection_count: 2, undated_amount: 125, undated_count: 1 };
function harness(name = 'ReceivableActivity', props = {}) {
  const slots = [], effects = [], requests = [], navigations = [];
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (v) => { slots[index] = typeof v === 'function' ? v(slots[index]) : v; }];
    },
    useRef: (value) => { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; },
    useEffect: (fn, deps) => {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((x, i) => x !== old.deps[i])) {
        old?.cleanup?.(); const next = { deps }; slots[index] = next;
        effects.push(() => { next.cleanup = fn(); });
      }
    },
  };
  const context = vm.createContext({ React, ReactDOM: { createRoot: () => ({ render() {} }) }, URLSearchParams,
    document: { getElementById() {} }, console,
    fetch: async (url) => {
      requests.push(url);
      const response = url.includes('/source/') ? { filename: 'test.xlsx', source: { receipt_no: 'RC-A' } }
        : url.includes('/details?') ? { rows: [{ id: 'collection:1', source_id: 1, date: '2026-08-01', month: '2026-08', amount: 50,
          customer_code: '00020', customer_name: '시험', biz_unit: '덴탈', state: 'pending', origin: 'upload', filename: 'test.xlsx' }],
          count: 1, amount: 50, page: 1, pages: 1 }
        : { totals, series, undated: [{ month: '2026-08', amount: 125 }] };
      return { ok: true, json: async () => response };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/activity.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/app.js'), 'utf8'), context);
  const componentProps = { data: { meta: { today: '2026-08-10', units: ['덴탈', '메디컬', '에스테틱'] } },
    onDetails: (p) => navigations.push(p), ...props };
  const render = () => { cursor = 0; return context[name](componentProps); };
  const all = (predicate, node = render()) => !node || typeof node !== 'object' ? []
    : [...(predicate(node) ? [node] : []), ...(node.children || []).filter((c) => c != null).flatMap((c) => all(predicate, c))];
  const find = (p) => all(p)[0];
  const flush = async () => { render(); while (effects.length) effects.shift()(); for (let i = 0; i < 12; i++) await Promise.resolve(); return render(); };
  return { context, render, find, all, flush, requests, navigations };
}
function text(n) { return typeof n === 'string' || typeof n === 'number' ? String(n) : n && typeof n === 'object' ? (n.children || []).map(text).join(' ') : ''; }

test('menus follow summary and charts preserve filters and pending status when opening details', async () => {
  const h = harness(); await h.flush();
  const keys = vm.runInContext('SCREENS.map(s => s.key)', h.context);
  const index = keys.indexOf('summary'); assert.equal(keys[index+1], 'activity'); assert.equal(keys[index+2], 'activityDetails');
  assert.match(text(h.render()), /출고일이 보관되지 않은 월별 금액/);
  h.find((n) => n.type === 'button' && text(n).includes('승인 대기 수금')).props.onClick();
  assert.equal(h.navigations[0].kind, 'collections'); assert.equal(h.navigations[0].state, 'pending');
  h.find((n) => n.props['aria-label'] === '사업부 필터').props.onChange({ target: { value: '메디컬' } });
  h.find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); await h.flush();
  assert.match(h.requests.at(-1), /unit=%EB%A9%94%EB%94%94%EC%BB%AC/);
  const chart = h.find((n) => typeof n.type === 'function' && n.type.name === 'ActivityChart');
  chart.props.onSelect('2026-08-02');
  assert.equal(h.navigations.at(-1).period, '2026-08-02'); assert.equal(h.navigations.at(-1).unit, '메디컬');
  h.find((n) => n.type === 'button' && text(n) === '월별').props.onClick(); await h.flush();
  assert.match(h.requests.at(-1), /grain=month/);
});

test('detail drilldown uses chosen state and date and only requests read-only source API', async () => {
  const h = harness('ReceivableActivity', { detail: true, initialFilters: { start_month: '2026-08', end_month: '2026-08',
    kind: 'collections', state: 'pending', period: '2026-08-01' } });
  await h.flush();
  assert.match(h.requests[0], /state=pending/); assert.match(h.requests[0], /period=2026-08-01/);
  h.find((n) => n.props['aria-label'] === '수금 등록 경로').props.onChange({ target: { value: 'upload' } }); await h.flush();
  assert.match(h.requests.at(-1), /origin=upload/);
  h.find((n) => n.props['aria-label'] === '상세 월').props.onChange({ target: { value: '2026-08' } }); await h.flush();
  assert.match(h.requests.at(-1), /period=2026-08&/);
  await h.find((n) => n.type === 'button' && text(n) === '업로드 원본 보기').props.onClick();
  assert.equal(h.requests.at(-1), '/api/receivable-activity/source/collections/1');
  assert.ok(h.find((n) => typeof n.type === 'function' && n.type.name === 'ActivitySource'));
  h.find((n) => n.type === 'button' && text(n) === '기초·이월채권').props.onClick(); await h.flush();
  assert.match(h.requests.at(-1), /kind=opening/); assert.match(text(h.render()), /조회기간과 무관한 현재 원장/);
});

test('signed and zero charts have finite coordinates and keyboard drilldown for every period', () => {
  const selected = [];
  const h = harness('ActivityChart', { series, onSelect: (value) => selected.push(value) });
  for (const node of h.all((n) => n.type === 'rect')) {
    for (const key of ['x', 'y', 'height', 'width']) assert.ok(Number.isFinite(node.props[key]));
    assert.ok(node.props.height >= 0);
  }
  const points = h.all((n) => n.props.role === 'button'); assert.equal(points.length, 2);
  points[1].props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(selected, ['2026-08-02']); assert.match(points[1].props['aria-label'], /일자 미보관/);
  const zero = harness('ActivityChart', { series: [{ ...series[0], shipment_amount: 0, collection_amount: 0 }], onSelect() {} });
  assert.ok(!zero.find((n) => n.type === 'polyline').props.points.includes('NaN'));
});
