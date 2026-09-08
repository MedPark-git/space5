/* Date-based occurrence and collection reports. Uses the shared authenticated API. */
function activityParams(filters, extra = {}) {
  return new URLSearchParams({ ...filters, ...extra }).toString();
}

function ActivityChart({ series, onSelect }) {
  const [selected, setSelected] = React.useState(null);
  const width = Math.max(850, series.length * 28 + 100), height = 320;
  const left = 120, right = 24, top = 24, bottom = 52;
  const maximum = Math.max(1, ...series.flatMap((r) => [r.shipment_amount, r.collection_amount]));
  const minimum = Math.min(0, ...series.map((r) => r.shipment_amount));
  const range = maximum - minimum, y = (amount) => top + (maximum - amount) / range * (height - top - bottom);
  const step = (width - left - right) / Math.max(series.length, 1);
  const x = (i) => left + (i + .5) * step;
  const ticks = Array.from({ length: 5 }, (_, i) => maximum - i * range / 4);
  const chosen = series.find((r) => r.period === selected);
  return <>
    <div className="activity-legend"><span><i className="activity-dot activity-dot--shipment" />채권발생 (출고 원금)</span>
      <span><i className="activity-dot activity-dot--collection" />승인 수금 (수금일 기준)</span><span>금액 단위: 원</span></div>
    <div className="activity-chart-scroll" aria-label="일자별·월별 금액 그래프. 좌우로 스크롤할 수 있습니다.">
      <svg width={width} height={height} role="group" aria-label="출고채권 발생액 막대와 승인 수금액 꺾은선 그래프">
        {ticks.map((v, i) => <g key={i}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="#e7ebf2" />
          <text x={left-10} y={y(v)+4} textAnchor="end" fill="#5c6b80" fontSize="11">{won(Math.round(v))}</text></g>)}
        <line x1={left} x2={width-right} y1={y(0)} y2={y(0)} stroke="#8b9ab1" />
        {series.map((r, i) => <rect key={r.period} x={x(i)-step*.28} width={Math.max(3, step*.56)}
          y={Math.min(y(r.shipment_amount), y(0))} height={Math.abs(y(r.shipment_amount)-y(0))}
          fill={r.shipment_amount < 0 ? '#b3352f' : '#1d4e89'} opacity={r.shipment_complete ? .85 : .5} />)}
        <polyline points={series.map((r, i) => `${x(i)},${y(r.collection_amount)}`).join(' ')} fill="none" stroke="#0f8b7e" strokeWidth="2.5" />
        {series.map((r, i) => <g key={r.period} role="button" tabIndex="0"
          aria-label={`${r.period}, 채권발생 ${won(r.shipment_amount)}원, 승인 수금 ${won(r.collection_amount)}원${!r.shipment_complete ? ', 일자 미보관 금액 있음' : ''}, 세부 내역 열기`}
          onFocus={() => setSelected(r.period)} onMouseEnter={() => setSelected(r.period)} onClick={() => onSelect(r.period)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r.period); } }}>
          <rect x={left+i*step} y={top} width={step} height={height-top-bottom} fill={selected === r.period ? '#1d4e890b' : 'transparent'} />
          <circle cx={x(i)} cy={y(r.collection_amount)} r="3" fill="#0f8b7e" />
          <title>{r.period} · 채권 {won(r.shipment_amount)}원 / 승인 수금 {won(r.collection_amount)}원</title>
          {(series.length <= 31 || i % Math.ceil(series.length / 24) === 0) && <text x={x(i)} y={height-26} textAnchor="middle" fontSize="11" fill="#5c6b80">
            {r.period.length === 10 ? r.period.slice(5) : r.period}</text>}
        </g>)}
      </svg>
    </div>
    <div className="activity-chart-caption" role="status">{chosen ? <>
      <b>{chosen.period}</b> · 채권발생 {won(chosen.shipment_amount)}원 · 승인 수금 {won(chosen.collection_amount)}원
      {!chosen.shipment_complete && <span> · 일자 미보관 금액은 월별 조회에서 확인</span>}
    </> : '그래프의 일자·월을 선택하면 해당 기간의 세부 내역으로 이동합니다.'}</div>
  </>;
}

function ActivitySource({ record, onClose }) {
  React.useEffect(() => {
    const listener = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [onClose]);
  const labels = { receipt_no: '수금번호', sequence: '순번', customer_code: '고객코드', customer_name: '고객명',
    paid_at: '수금일자', receipt_month: '수금년월', receipt_kind: '수금구분', receipt_type: '수금구분유형',
    normal_amount: '정상수금', advance_amount: '선수금', row_number: '엑셀 행', note: '비고' };
  const source = record.source || {};
  const cells = Array.isArray(source.columns) ? source.columns.map((c) => [c.column + ' · ' + (c.name || '머리글 없음'), c.value])
    : Object.entries(source).map(([k, v]) => [labels[k] || k, typeof v === 'object' ? JSON.stringify(v) : v]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal-card modal-card--wide activity-source"
    role="dialog" aria-modal="true" aria-labelledby="activity-source-title" onMouseDown={(e) => e.stopPropagation()}>
    <div className="btnrow"><h2 id="activity-source-title">업로드 원본 내역</h2><div className="spacer" /><button className="btn" autoFocus onClick={onClose}>닫기</button></div>
    <p><b>{record.filename}</b><br />등록자 {record.uploaded_by} · {record.uploaded_at}
      {(record.row_number || source.row_number) && <> · 엑셀 {record.row_number || source.row_number}행</>}</p>
    <div className="tablewrap"><table><thead><tr><th>엑셀 항목</th><th>원본 값</th></tr></thead><tbody>
      {cells.map(([k, v], i) => <tr key={i}><td>{k}</td><td style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(v ?? '')}</td></tr>)}
    </tbody></table></div></section></div>;
}

function ReceivableActivity({ data, detail = false, initialFilters, onDetails }) {
  const firstMonth = new Date(data.meta.today.slice(0, 7) + '-01T12:00:00Z');
  if (!detail) firstMonth.setUTCMonth(firstMonth.getUTCMonth() - 5);
  const initial = { start_month: firstMonth.toISOString().slice(0, 7), end_month: data.meta.today.slice(0, 7),
    grain: detail ? 'day' : 'month', unit: '', q: '', ...initialFilters };
  const [draft, setDraft] = React.useState(initial), [filters, setFilters] = React.useState(initial);
  const [kind, setKind] = React.useState(initial.kind || 'shipments');
  const [period, setPeriod] = React.useState(initial.period || '');
  const [state, setState] = React.useState(initial.state || 'approved'), [origin, setOrigin] = React.useState('');
  const [page, setPage] = React.useState(1), [reload, setReload] = React.useState(0);
  const [report, setReport] = React.useState(null), [items, setItems] = React.useState(null);
  const [busy, setBusy] = React.useState(true), [error, setError] = React.useState('');
  const [source, setSource] = React.useState(null), [sourceBusy, setSourceBusy] = React.useState(false);
  const sourceRequest = React.useRef(0);
  const query = activityParams(filters, detail ? { kind, period, state: kind === 'collections' ? state : '', origin, page } : {});
  React.useEffect(() => {
    let active = true; setBusy(true); setError(''); setItems(null); setReport(null); setSourceBusy(false); setSource(null);
    api('/api/receivable-activity' + (detail ? '/details' : '') + '?' + query)
      .then((r) => { if (active) detail ? setItems(r) : setReport(r); })
      .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; sourceRequest.current++; };
  }, [query, detail, reload]);
  function apply(e) { e?.preventDefault(); setPeriod(''); setPage(1); setFilters({ ...draft }); setReload((n) => n + 1); }
  function quick(months) {
    const end = data.meta.today.slice(0, 7), d = new Date(end + '-01T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - months + 1);
    const next = { ...draft, start_month: d.toISOString().slice(0, 7), end_month: end, grain: months > 1 ? 'month' : 'day' };
    setDraft(next); setFilters(next); setPeriod(''); setPage(1);
  }
  function chooseKind(value) { setKind(value); setPage(1); setSource(null); }
  async function openSource(row) {
    const version = ++sourceRequest.current; setSourceBusy(true); setError('');
    try {
      const response = await api(`/api/receivable-activity/source/${kind}/${row.source_id}`);
      if (version === sourceRequest.current) setSource(response);
    } catch (e) { if (version === sourceRequest.current) setError(e.message); }
    finally { if (version === sourceRequest.current) setSourceBusy(false); }
  }
  const totals = report?.totals;
  const labels = { approved: '승인 완료', pending: '승인 대기', rejected: '반려', active: '현재 반영' };
  return <>
    <Card title={detail ? '채권·수금 상세내역' : '채권발생·수금 추이'}>
      <form onSubmit={apply}>
        <div className="activity-filters">
          <Field label="시작월"><input className="input" type="month" aria-label="시작월" value={draft.start_month} required
            onChange={(e) => setDraft({ ...draft, start_month: e.target.value })} /></Field>
          <Field label="종료월"><input className="input" type="month" aria-label="종료월" value={draft.end_month} required
            onChange={(e) => setDraft({ ...draft, end_month: e.target.value })} /></Field>
          <Field label="사업부"><select className="select" aria-label="사업부 필터" value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}><option value="">전체</option>
            {data.meta.units.map((u) => <option key={u}>{u}</option>)}</select></Field>
          <Field label="거래처명·고객코드"><input className="input" aria-label="거래처 검색" value={draft.q} maxLength={100}
            placeholder="거래처명 또는 코드" onChange={(e) => setDraft({ ...draft, q: e.target.value })} /></Field>
          <button className="btn btn--primary" type="submit" disabled={busy}>조회</button>
        </div>
        <div className="btnrow"><button className="btn btn--sm" type="button" onClick={() => quick(1)}>이번 달</button>
          <button className="btn btn--sm" type="button" onClick={() => quick(6)}>최근 6개월</button>
          <button className="btn btn--sm" type="button" onClick={() => quick(12)}>최근 12개월</button>
          {!detail && <div className="chiprow" aria-label="그래프 집계 단위">{[['day', '일별'], ['month', '월별']].map(([value, label]) =>
            <button type="button" className="chip" key={value} aria-pressed={filters.grain === value} onClick={() => {
              setDraft((d) => ({ ...d, grain: value })); setFilters((f) => ({ ...f, grain: value }));
            }}>{label}</button>)}</div>}</div>
      </form>
      <p className="t-sm t-muted">현재 운영 원장 · {filters.start_month} ~ {filters.end_month} · 수금일 기준 승인 수금 · 최대 24개월 조회</p>
      <p className="t-sm">출고채권은 같은 월의 최신 반영분을 사용합니다. 수금액은 선수금을 포함한 승인 금액이며 기초·이월채권과 승인 대기는 그래프에 합산하지 않습니다.
        사업부별 수금은 현재 거래처의 사업부 기준입니다.</p>
    </Card>
    {error && <div className="alert alert--bad" role="alert">{error} <button className="btn btn--sm" onClick={() => setReload((n) => n + 1)}>다시 조회</button></div>}
    {busy && <Card><div className="empty" role="status">내역을 불러오는 중입니다.</div></Card>}
    {!busy && report && <>
      <div className="grid grid--kpi activity-kpis">
        {[
          ['출고채권 발생액', totals.shipment_amount, '원본 출고금액 · 반품·조정 포함', 'shipments'],
          ['승인 수금액', totals.collection_amount, `${totals.collection_count}건 · 수금일 기준`, 'collections'],
          ['발생액 − 수금액', totals.difference, '기간 내 증감 비교 · 채권잔액과 다름', null],
          ['승인 대기 수금', totals.pending_amount, '그래프 수금액에서 제외', 'pending'],
        ].map(([label, value, hint, target]) => <button className="kpi" key={label} disabled={!target} onClick={() =>
          onDetails({ ...filters, kind: target === 'pending' ? 'collections' : target, state: target === 'pending' ? 'pending' : 'approved', period: '' })}>
          <span className="kpi__label">{label}</span><div className="kpi__value num">{won(value)}<em>원</em></div><div className="kpi__meta">{hint}</div></button>)}
      </div>
      {!!totals.undated_count && <div className="alert alert--warn" role="status">
        출고일이 보관되지 않은 월별 금액 <b>{won(totals.undated_amount)}원</b> ({totals.undated_count}개 내역)이 있습니다.
        {filters.grain === 'day' ? ' 일별 그래프에는 날짜가 확인된 금액만 표시합니다.' : ' 월별 그래프에는 이 금액도 포함합니다.'}
        {' '}과거 업로드 일자를 출고일로 대신 사용하지 않습니다.
        <div className="btnrow">{report.undated.map((r) => <button key={r.month} className="btn btn--sm" onClick={() => onDetails({ ...filters, kind: 'shipments', period: r.month })}>
          {r.month} · {won(r.amount)}원 상세</button>)}</div>
      </div>}
      <Card title={filters.grain === 'day' ? '일자별 채권발생·수금액' : '월별 채권발생·수금액'}
        actions={<button className="btn btn--sm" onClick={() => onDetails({ ...filters, period: '' })}>세부 내역 보기</button>}>
        {!totals.shipment_count && !totals.collection_count ? <Empty title="선택한 기간에 반영된 출고·승인 수금 내역이 없습니다." />
          : <ActivityChart series={report.series} onSelect={(value) => onDetails({ ...filters, period: value, kind: 'shipments' })} />}
      </Card>
      <Card title="기간별 금액 대조" flush><div className="tablewrap activity-periods"><table><thead><tr>
        <th>{filters.grain === 'day' ? '일자' : '월'}</th><th className="r">채권발생액</th><th className="r">승인 수금액</th><th className="r">발생액 − 수금액</th><th>상세</th>
      </tr></thead><tbody>{report.series.map((r) => <tr key={r.period}><td>{r.period}{!r.shipment_complete && filters.grain === 'day' && <small className="t-muted"> · 일자 미보관 금액 있음</small>}</td>
        <td className="r num">{won(r.shipment_amount)}</td><td className="r num">{won(r.collection_amount)}</td>
        <td className="r num">{won(r.shipment_amount-r.collection_amount)}</td><td><button className="btn btn--sm" onClick={() => onDetails({ ...filters, period: r.period, kind: 'shipments' })}>채권</button>{' '}
          <button className="btn btn--sm" onClick={() => onDetails({ ...filters, period: r.period, kind: 'collections' })}>수금</button></td></tr>)}</tbody></table></div></Card>
    </>}
    {detail && <Card title="세부 내역" flush>
      <div className="activity-detail-toolbar"><div className="chiprow">{[['shipments', '출고채권'], ['collections', '수금'], ['opening', '기초·이월채권']].map(([k, label]) =>
        <button className="chip" key={k} aria-pressed={kind === k} onClick={() => chooseKind(k)}>{label}</button>)}</div>
        {period && kind !== 'opening' && <div className="btnrow"><span>선택 기간: <b>{period}</b></span><button className="btn btn--sm" onClick={() => { setPeriod(''); setPage(1); }}>전체 조회기간 보기</button></div>}
        {kind !== 'opening' && <div className="formrow">
          <Field label="특정 일자 상세 (선택)"><input type="date" className="input" aria-label="상세 일자" value={period.length === 10 ? period : ''}
            onChange={(e) => { setPeriod(e.target.value); setPage(1); }} /></Field>
          <Field label="특정 월 상세 (선택)"><input type="month" className="input" aria-label="상세 월" value={period.length === 7 ? period : ''}
            onChange={(e) => { setPeriod(e.target.value); setPage(1); }} /></Field></div>}
        {kind === 'collections' && <div className="btnrow"><select className="select" aria-label="수금 상태" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
          <option value="approved">승인 완료</option><option value="pending">승인 대기</option><option value="rejected">반려</option><option value="">전체 상태</option></select>
          <select className="select" aria-label="수금 등록 경로" value={origin} onChange={(e) => { setOrigin(e.target.value); setPage(1); }}>
            <option value="">전체 등록 경로</option><option value="upload">엑셀 업로드</option><option value="manual">수기등록</option></select></div>}
        {kind === 'opening' && <p className="t-sm">기초·이월채권은 조회기간과 무관한 현재 원장입니다. 기록된 발생월은 추정 또는 이월 기준을 포함하며 일별 신규 발생액으로 집계하지 않습니다.</p>}
        {kind === 'shipments' && <p className="t-sm">출고일 미보관 내역은 ‘월 집계’로 표시합니다. 재업로드 이전 버전과 중복 제외 내역은 현재 발생액에 더하지 않습니다.</p>}
        {items && !busy && <b className="num">총 {items.count}개 내역 · {kind === 'opening' ? '기초 원금' : '합계'} {won(items.amount)}원
          {kind === 'opening' && <> · 현재 잔액 {won(items.balance)}원</>}</b>}
      </div>
      {!busy && items && (items.rows.length ? <>
        <div className="tablewrap"><table><thead><tr><th>{kind === 'collections' ? '수금일' : kind === 'opening' ? '기록된 발생월' : '출고일 / 월'}</th><th>고객코드</th><th>거래처</th><th>사업부</th>
          <th className="r">{kind === 'opening' ? '기초 원금' : '금액'}</th>{kind === 'opening' && <th className="r">현재 잔액</th>}
          <th>{kind === 'collections' ? '수금방법 / 상태' : '구분'}</th><th>원본 / 등록정보</th><th>세부 내용</th></tr></thead>
          <tbody>{items.rows.map((r) => <tr key={r.id}><td className="num">{r.date || r.month || '미확인'}{r.precision === 'month' && <div className="t-sm t-muted">월 집계 · 일자 미보관</div>}</td>
            <td>{r.customer_code}</td><td className="t-strong">{r.customer_name}</td><td>{r.biz_unit || '미분류'}</td><td className="r num">{won(r.amount)}</td>
            {kind === 'opening' && <td className="r num">{won(r.balance)}</td>}
            <td>{r.method && <div>{r.method}</div>}{labels[r.state] || r.state}</td>
            <td className="activity-wrap">{r.filename || '파일정보 없음'}{r.row_number && <div>엑셀 {r.row_number}행</div>}
              <div className="t-sm t-muted">{r.uploaded_by} {r.uploaded_at}</div></td>
            <td className="activity-wrap">{r.receipt_no && <div>{r.receipt_no} / {r.sequence}</div>}{r.note}
              {r.approved_by && <div className="t-sm">승인: {r.approved_by} · {r.approved_at}</div>}
              {r.source_id && <div><button className="btn btn--sm" disabled={sourceBusy} onClick={() => openSource(r)}>업로드 원본 보기</button></div>}</td></tr>)}</tbody>
        </table></div><div className="btnrow activity-pagination"><button className="btn btn--sm" disabled={items.page <= 1 || busy} onClick={() => setPage(page-1)}>이전</button>
          <span>{items.page} / {items.pages}</span><button className="btn btn--sm" disabled={items.page >= items.pages || busy} onClick={() => setPage(page+1)}>다음</button></div>
      </> : <Empty title="조건에 맞는 세부 내역이 없습니다.">월 집계 자료는 일자를 지정하지 않고 월 전체로 조회해 주세요.</Empty>)}
    </Card>}
    {source && <ActivitySource record={source} onClose={() => setSource(null)} />}
  </>;
}
