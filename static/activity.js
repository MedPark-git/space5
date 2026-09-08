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
    return React.createElement(React.Fragment, null,
        React.createElement("div", { className: "activity-legend" },
            React.createElement("span", null,
                React.createElement("i", { className: "activity-dot activity-dot--shipment" }),
                "\uCC44\uAD8C\uBC1C\uC0DD (\uCD9C\uACE0 \uC6D0\uAE08)"),
            React.createElement("span", null,
                React.createElement("i", { className: "activity-dot activity-dot--collection" }),
                "\uC2B9\uC778 \uC218\uAE08 (\uC218\uAE08\uC77C \uAE30\uC900)"),
            React.createElement("span", null, "\uAE08\uC561 \uB2E8\uC704: \uC6D0")),
        React.createElement("div", { className: "activity-chart-scroll", "aria-label": "\uC77C\uC790\uBCC4\u00B7\uC6D4\uBCC4 \uAE08\uC561 \uADF8\uB798\uD504. \uC88C\uC6B0\uB85C \uC2A4\uD06C\uB864\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." },
            React.createElement("svg", { width: width, height: height, role: "group", "aria-label": "\uCD9C\uACE0\uCC44\uAD8C \uBC1C\uC0DD\uC561 \uB9C9\uB300\uC640 \uC2B9\uC778 \uC218\uAE08\uC561 \uAEBE\uC740\uC120 \uADF8\uB798\uD504" },
                ticks.map((v, i) => React.createElement("g", { key: i },
                    React.createElement("line", { x1: left, x2: width - right, y1: y(v), y2: y(v), stroke: "#e7ebf2" }),
                    React.createElement("text", { x: left - 10, y: y(v) + 4, textAnchor: "end", fill: "#5c6b80", fontSize: "11" }, won(Math.round(v))))),
                React.createElement("line", { x1: left, x2: width - right, y1: y(0), y2: y(0), stroke: "#8b9ab1" }),
                series.map((r, i) => React.createElement("rect", { key: r.period, x: x(i) - step * .28, width: Math.max(3, step * .56), y: Math.min(y(r.shipment_amount), y(0)), height: Math.abs(y(r.shipment_amount) - y(0)), fill: r.shipment_amount < 0 ? '#b3352f' : '#1d4e89', opacity: r.shipment_complete ? .85 : .5 })),
                React.createElement("polyline", { points: series.map((r, i) => `${x(i)},${y(r.collection_amount)}`).join(' '), fill: "none", stroke: "#0f8b7e", strokeWidth: "2.5" }),
                series.map((r, i) => React.createElement("g", { key: r.period, role: "button", tabIndex: "0", "aria-label": `${r.period}, 채권발생 ${won(r.shipment_amount)}원, 승인 수금 ${won(r.collection_amount)}원${!r.shipment_complete ? ', 일자 미보관 금액 있음' : ''}, 세부 내역 열기`, onFocus: () => setSelected(r.period), onMouseEnter: () => setSelected(r.period), onClick: () => onSelect(r.period), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(r.period);
                    } } },
                    React.createElement("rect", { x: left + i * step, y: top, width: step, height: height - top - bottom, fill: selected === r.period ? '#1d4e890b' : 'transparent' }),
                    React.createElement("circle", { cx: x(i), cy: y(r.collection_amount), r: "3", fill: "#0f8b7e" }),
                    React.createElement("title", null,
                        r.period,
                        " \u00B7 \uCC44\uAD8C ",
                        won(r.shipment_amount),
                        "\uC6D0 / \uC2B9\uC778 \uC218\uAE08 ",
                        won(r.collection_amount),
                        "\uC6D0"),
                    (series.length <= 31 || i % Math.ceil(series.length / 24) === 0) && React.createElement("text", { x: x(i), y: height - 26, textAnchor: "middle", fontSize: "11", fill: "#5c6b80" }, r.period.length === 10 ? r.period.slice(5) : r.period))))),
        React.createElement("div", { className: "activity-chart-caption", role: "status" }, chosen ? React.createElement(React.Fragment, null,
            React.createElement("b", null, chosen.period),
            " \u00B7 \uCC44\uAD8C\uBC1C\uC0DD ",
            won(chosen.shipment_amount),
            "\uC6D0 \u00B7 \uC2B9\uC778 \uC218\uAE08 ",
            won(chosen.collection_amount),
            "\uC6D0",
            !chosen.shipment_complete && React.createElement("span", null, " \u00B7 \uC77C\uC790 \uBBF8\uBCF4\uAD00 \uAE08\uC561\uC740 \uC6D4\uBCC4 \uC870\uD68C\uC5D0\uC11C \uD655\uC778")) : '그래프의 일자·월을 선택하면 해당 기간의 세부 내역으로 이동합니다.'));
}
function ActivitySource({ record, onClose }) {
    React.useEffect(() => {
        const listener = (e) => { if (e.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, [onClose]);
    const labels = { receipt_no: '수금번호', sequence: '순번', customer_code: '고객코드', customer_name: '고객명',
        paid_at: '수금일자', receipt_month: '수금년월', receipt_kind: '수금구분', receipt_type: '수금구분유형',
        normal_amount: '정상수금', advance_amount: '선수금', row_number: '엑셀 행', note: '비고' };
    const source = record.source || {};
    const cells = Array.isArray(source.columns) ? source.columns.map((c) => [c.column + ' · ' + (c.name || '머리글 없음'), c.value])
        : Object.entries(source).map(([k, v]) => [labels[k] || k, typeof v === 'object' ? JSON.stringify(v) : v]);
    return React.createElement("div", { className: "modal-backdrop", onMouseDown: onClose },
        React.createElement("section", { className: "modal-card modal-card--wide activity-source", role: "dialog", "aria-modal": "true", "aria-labelledby": "activity-source-title", onMouseDown: (e) => e.stopPropagation() },
            React.createElement("div", { className: "btnrow" },
                React.createElement("h2", { id: "activity-source-title" }, "\uC5C5\uB85C\uB4DC \uC6D0\uBCF8 \uB0B4\uC5ED"),
                React.createElement("div", { className: "spacer" }),
                React.createElement("button", { className: "btn", autoFocus: true, onClick: onClose }, "\uB2EB\uAE30")),
            React.createElement("p", null,
                React.createElement("b", null, record.filename),
                React.createElement("br", null),
                "\uB4F1\uB85D\uC790 ",
                record.uploaded_by,
                " \u00B7 ",
                record.uploaded_at,
                (record.row_number || source.row_number) && React.createElement(React.Fragment, null,
                    " \u00B7 \uC5D1\uC140 ",
                    record.row_number || source.row_number,
                    "\uD589")),
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uC5D1\uC140 \uD56D\uBAA9"),
                            React.createElement("th", null, "\uC6D0\uBCF8 \uAC12"))),
                    React.createElement("tbody", null, cells.map(([k, v], i) => React.createElement("tr", { key: i },
                        React.createElement("td", null, k),
                        React.createElement("td", { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, String(v !== null && v !== void 0 ? v : '')))))))));
}
function ReceivableActivity({ data, detail = false, initialFilters, onDetails }) {
    const firstMonth = new Date(data.meta.today.slice(0, 7) + '-01T12:00:00Z');
    if (!detail)
        firstMonth.setUTCMonth(firstMonth.getUTCMonth() - 5);
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
        let active = true;
        setBusy(true);
        setError('');
        setItems(null);
        setReport(null);
        setSourceBusy(false);
        setSource(null);
        api('/api/receivable-activity' + (detail ? '/details' : '') + '?' + query)
            .then((r) => { if (active)
            detail ? setItems(r) : setReport(r); })
            .catch((e) => { if (active)
            setError(e.message); }).finally(() => { if (active)
            setBusy(false); });
        return () => { active = false; sourceRequest.current++; };
    }, [query, detail, reload]);
    function apply(e) { e === null || e === void 0 ? void 0 : e.preventDefault(); setPeriod(''); setPage(1); setFilters({ ...draft }); setReload((n) => n + 1); }
    function quick(months) {
        const end = data.meta.today.slice(0, 7), d = new Date(end + '-01T12:00:00Z');
        d.setUTCMonth(d.getUTCMonth() - months + 1);
        const next = { ...draft, start_month: d.toISOString().slice(0, 7), end_month: end, grain: months > 1 ? 'month' : 'day' };
        setDraft(next);
        setFilters(next);
        setPeriod('');
        setPage(1);
    }
    function chooseKind(value) { setKind(value); setPage(1); setSource(null); }
    async function openSource(row) {
        const version = ++sourceRequest.current;
        setSourceBusy(true);
        setError('');
        try {
            const response = await api(`/api/receivable-activity/source/${kind}/${row.source_id}`);
            if (version === sourceRequest.current)
                setSource(response);
        }
        catch (e) {
            if (version === sourceRequest.current)
                setError(e.message);
        }
        finally {
            if (version === sourceRequest.current)
                setSourceBusy(false);
        }
    }
    const totals = report === null || report === void 0 ? void 0 : report.totals;
    const labels = { approved: '승인 완료', pending: '승인 대기', rejected: '반려', active: '현재 반영' };
    return React.createElement(React.Fragment, null,
        React.createElement(Card, { title: detail ? '채권·수금 상세내역' : '채권발생·수금 추이' },
            React.createElement("form", { onSubmit: apply },
                React.createElement("div", { className: "activity-filters" },
                    React.createElement(Field, { label: "\uC2DC\uC791\uC6D4" },
                        React.createElement("input", { className: "input", type: "month", "aria-label": "\uC2DC\uC791\uC6D4", value: draft.start_month, required: true, onChange: (e) => setDraft({ ...draft, start_month: e.target.value }) })),
                    React.createElement(Field, { label: "\uC885\uB8CC\uC6D4" },
                        React.createElement("input", { className: "input", type: "month", "aria-label": "\uC885\uB8CC\uC6D4", value: draft.end_month, required: true, onChange: (e) => setDraft({ ...draft, end_month: e.target.value }) })),
                    React.createElement(Field, { label: "\uC0AC\uC5C5\uBD80" },
                        React.createElement("select", { className: "select", "aria-label": "\uC0AC\uC5C5\uBD80 \uD544\uD130", value: draft.unit, onChange: (e) => setDraft({ ...draft, unit: e.target.value }) },
                            React.createElement("option", { value: "" }, "\uC804\uCCB4"),
                            data.meta.units.map((u) => React.createElement("option", { key: u }, u)))),
                    React.createElement(Field, { label: "\uAC70\uB798\uCC98\uBA85\u00B7\uACE0\uAC1D\uCF54\uB4DC" },
                        React.createElement("input", { className: "input", "aria-label": "\uAC70\uB798\uCC98 \uAC80\uC0C9", value: draft.q, maxLength: 100, placeholder: "\uAC70\uB798\uCC98\uBA85 \uB610\uB294 \uCF54\uB4DC", onChange: (e) => setDraft({ ...draft, q: e.target.value }) })),
                    React.createElement("button", { className: "btn btn--primary", type: "submit", disabled: busy }, "\uC870\uD68C")),
                React.createElement("div", { className: "btnrow" },
                    React.createElement("button", { className: "btn btn--sm", type: "button", onClick: () => quick(1) }, "\uC774\uBC88 \uB2EC"),
                    React.createElement("button", { className: "btn btn--sm", type: "button", onClick: () => quick(6) }, "\uCD5C\uADFC 6\uAC1C\uC6D4"),
                    React.createElement("button", { className: "btn btn--sm", type: "button", onClick: () => quick(12) }, "\uCD5C\uADFC 12\uAC1C\uC6D4"),
                    !detail && React.createElement("div", { className: "chiprow", "aria-label": "\uADF8\uB798\uD504 \uC9D1\uACC4 \uB2E8\uC704" }, [['day', '일별'], ['month', '월별']].map(([value, label]) => React.createElement("button", { type: "button", className: "chip", key: value, "aria-pressed": filters.grain === value, onClick: () => {
                            setDraft((d) => ({ ...d, grain: value }));
                            setFilters((f) => ({ ...f, grain: value }));
                        } }, label))))),
            React.createElement("p", { className: "t-sm t-muted" },
                "\uD604\uC7AC \uC6B4\uC601 \uC6D0\uC7A5 \u00B7 ",
                filters.start_month,
                " ~ ",
                filters.end_month,
                " \u00B7 \uC218\uAE08\uC77C \uAE30\uC900 \uC2B9\uC778 \uC218\uAE08 \u00B7 \uCD5C\uB300 24\uAC1C\uC6D4 \uC870\uD68C"),
            React.createElement("p", { className: "t-sm" }, "\uCD9C\uACE0\uCC44\uAD8C\uC740 \uAC19\uC740 \uC6D4\uC758 \uCD5C\uC2E0 \uBC18\uC601\uBD84\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uC218\uAE08\uC561\uC740 \uC120\uC218\uAE08\uC744 \uD3EC\uD568\uD55C \uC2B9\uC778 \uAE08\uC561\uC774\uBA70 \uAE30\uCD08\u00B7\uC774\uC6D4\uCC44\uAD8C\uACFC \uC2B9\uC778 \uB300\uAE30\uB294 \uADF8\uB798\uD504\uC5D0 \uD569\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0AC\uC5C5\uBD80\uBCC4 \uC218\uAE08\uC740 \uD604\uC7AC \uAC70\uB798\uCC98\uC758 \uC0AC\uC5C5\uBD80 \uAE30\uC900\uC785\uB2C8\uB2E4.")),
        error && React.createElement("div", { className: "alert alert--bad", role: "alert" },
            error,
            " ",
            React.createElement("button", { className: "btn btn--sm", onClick: () => setReload((n) => n + 1) }, "\uB2E4\uC2DC \uC870\uD68C")),
        busy && React.createElement(Card, null,
            React.createElement("div", { className: "empty", role: "status" }, "\uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.")),
        !busy && report && React.createElement(React.Fragment, null,
            React.createElement("div", { className: "grid grid--kpi activity-kpis" }, [
                ['출고채권 발생액', totals.shipment_amount, '원본 출고금액 · 반품·조정 포함', 'shipments'],
                ['승인 수금액', totals.collection_amount, `${totals.collection_count}건 · 수금일 기준`, 'collections'],
                ['발생액 − 수금액', totals.difference, '기간 내 증감 비교 · 채권잔액과 다름', null],
                ['승인 대기 수금', totals.pending_amount, '그래프 수금액에서 제외', 'pending'],
            ].map(([label, value, hint, target]) => React.createElement("button", { className: "kpi", key: label, disabled: !target, onClick: () => onDetails({ ...filters, kind: target === 'pending' ? 'collections' : target, state: target === 'pending' ? 'pending' : 'approved', period: '' }) },
                React.createElement("span", { className: "kpi__label" }, label),
                React.createElement("div", { className: "kpi__value num" },
                    won(value),
                    React.createElement("em", null, "\uC6D0")),
                React.createElement("div", { className: "kpi__meta" }, hint)))),
            !!totals.undated_count && React.createElement("div", { className: "alert alert--warn", role: "status" },
                "\uCD9C\uACE0\uC77C\uC774 \uBCF4\uAD00\uB418\uC9C0 \uC54A\uC740 \uC6D4\uBCC4 \uAE08\uC561 ",
                React.createElement("b", null,
                    won(totals.undated_amount),
                    "\uC6D0"),
                " (",
                totals.undated_count,
                "\uAC1C \uB0B4\uC5ED)\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
                filters.grain === 'day' ? ' 일별 그래프에는 날짜가 확인된 금액만 표시합니다.' : ' 월별 그래프에는 이 금액도 포함합니다.',
                ' ',
                "\uACFC\uAC70 \uC5C5\uB85C\uB4DC \uC77C\uC790\uB97C \uCD9C\uACE0\uC77C\uB85C \uB300\uC2E0 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
                React.createElement("div", { className: "btnrow" }, report.undated.map((r) => React.createElement("button", { key: r.month, className: "btn btn--sm", onClick: () => onDetails({ ...filters, kind: 'shipments', period: r.month }) },
                    r.month,
                    " \u00B7 ",
                    won(r.amount),
                    "\uC6D0 \uC0C1\uC138")))),
            React.createElement(Card, { title: filters.grain === 'day' ? '일자별 채권발생·수금액' : '월별 채권발생·수금액', actions: React.createElement("button", { className: "btn btn--sm", onClick: () => onDetails({ ...filters, period: '' }) }, "\uC138\uBD80 \uB0B4\uC5ED \uBCF4\uAE30") }, !totals.shipment_count && !totals.collection_count ? React.createElement(Empty, { title: "\uC120\uD0DD\uD55C \uAE30\uAC04\uC5D0 \uBC18\uC601\uB41C \uCD9C\uACE0\u00B7\uC2B9\uC778 \uC218\uAE08 \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." })
                : React.createElement(ActivityChart, { series: report.series, onSelect: (value) => onDetails({ ...filters, period: value, kind: 'shipments' }) })),
            React.createElement(Card, { title: "\uAE30\uAC04\uBCC4 \uAE08\uC561 \uB300\uC870", flush: true },
                React.createElement("div", { className: "tablewrap activity-periods" },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, filters.grain === 'day' ? '일자' : '월'),
                                React.createElement("th", { className: "r" }, "\uCC44\uAD8C\uBC1C\uC0DD\uC561"),
                                React.createElement("th", { className: "r" }, "\uC2B9\uC778 \uC218\uAE08\uC561"),
                                React.createElement("th", { className: "r" }, "\uBC1C\uC0DD\uC561 \u2212 \uC218\uAE08\uC561"),
                                React.createElement("th", null, "\uC0C1\uC138"))),
                        React.createElement("tbody", null, report.series.map((r) => React.createElement("tr", { key: r.period },
                            React.createElement("td", null,
                                r.period,
                                !r.shipment_complete && filters.grain === 'day' && React.createElement("small", { className: "t-muted" }, " \u00B7 \uC77C\uC790 \uBBF8\uBCF4\uAD00 \uAE08\uC561 \uC788\uC74C")),
                            React.createElement("td", { className: "r num" }, won(r.shipment_amount)),
                            React.createElement("td", { className: "r num" }, won(r.collection_amount)),
                            React.createElement("td", { className: "r num" }, won(r.shipment_amount - r.collection_amount)),
                            React.createElement("td", null,
                                React.createElement("button", { className: "btn btn--sm", onClick: () => onDetails({ ...filters, period: r.period, kind: 'shipments' }) }, "\uCC44\uAD8C"),
                                ' ',
                                React.createElement("button", { className: "btn btn--sm", onClick: () => onDetails({ ...filters, period: r.period, kind: 'collections' }) }, "\uC218\uAE08"))))))))),
        detail && React.createElement(Card, { title: "\uC138\uBD80 \uB0B4\uC5ED", flush: true },
            React.createElement("div", { className: "activity-detail-toolbar" },
                React.createElement("div", { className: "chiprow" }, [['shipments', '출고채권'], ['collections', '수금'], ['opening', '기초·이월채권']].map(([k, label]) => React.createElement("button", { className: "chip", key: k, "aria-pressed": kind === k, onClick: () => chooseKind(k) }, label))),
                period && kind !== 'opening' && React.createElement("div", { className: "btnrow" },
                    React.createElement("span", null,
                        "\uC120\uD0DD \uAE30\uAC04: ",
                        React.createElement("b", null, period)),
                    React.createElement("button", { className: "btn btn--sm", onClick: () => { setPeriod(''); setPage(1); } }, "\uC804\uCCB4 \uC870\uD68C\uAE30\uAC04 \uBCF4\uAE30")),
                kind !== 'opening' && React.createElement("div", { className: "formrow" },
                    React.createElement(Field, { label: "\uD2B9\uC815 \uC77C\uC790 \uC0C1\uC138 (\uC120\uD0DD)" },
                        React.createElement("input", { type: "date", className: "input", "aria-label": "\uC0C1\uC138 \uC77C\uC790", value: period.length === 10 ? period : '', onChange: (e) => { setPeriod(e.target.value); setPage(1); } })),
                    React.createElement(Field, { label: "\uD2B9\uC815 \uC6D4 \uC0C1\uC138 (\uC120\uD0DD)" },
                        React.createElement("input", { type: "month", className: "input", "aria-label": "\uC0C1\uC138 \uC6D4", value: period.length === 7 ? period : '', onChange: (e) => { setPeriod(e.target.value); setPage(1); } }))),
                kind === 'collections' && React.createElement("div", { className: "btnrow" },
                    React.createElement("select", { className: "select", "aria-label": "\uC218\uAE08 \uC0C1\uD0DC", value: state, onChange: (e) => { setState(e.target.value); setPage(1); } },
                        React.createElement("option", { value: "approved" }, "\uC2B9\uC778 \uC644\uB8CC"),
                        React.createElement("option", { value: "pending" }, "\uC2B9\uC778 \uB300\uAE30"),
                        React.createElement("option", { value: "rejected" }, "\uBC18\uB824"),
                        React.createElement("option", { value: "" }, "\uC804\uCCB4 \uC0C1\uD0DC")),
                    React.createElement("select", { className: "select", "aria-label": "\uC218\uAE08 \uB4F1\uB85D \uACBD\uB85C", value: origin, onChange: (e) => { setOrigin(e.target.value); setPage(1); } },
                        React.createElement("option", { value: "" }, "\uC804\uCCB4 \uB4F1\uB85D \uACBD\uB85C"),
                        React.createElement("option", { value: "upload" }, "\uC5D1\uC140 \uC5C5\uB85C\uB4DC"),
                        React.createElement("option", { value: "manual" }, "\uC218\uAE30\uB4F1\uB85D"))),
                kind === 'opening' && React.createElement("p", { className: "t-sm" }, "\uAE30\uCD08\u00B7\uC774\uC6D4\uCC44\uAD8C\uC740 \uC870\uD68C\uAE30\uAC04\uACFC \uBB34\uAD00\uD55C \uD604\uC7AC \uC6D0\uC7A5\uC785\uB2C8\uB2E4. \uAE30\uB85D\uB41C \uBC1C\uC0DD\uC6D4\uC740 \uCD94\uC815 \uB610\uB294 \uC774\uC6D4 \uAE30\uC900\uC744 \uD3EC\uD568\uD558\uBA70 \uC77C\uBCC4 \uC2E0\uADDC \uBC1C\uC0DD\uC561\uC73C\uB85C \uC9D1\uACC4\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
                kind === 'shipments' && React.createElement("p", { className: "t-sm" }, "\uCD9C\uACE0\uC77C \uBBF8\uBCF4\uAD00 \uB0B4\uC5ED\uC740 \u2018\uC6D4 \uC9D1\uACC4\u2019\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC7AC\uC5C5\uB85C\uB4DC \uC774\uC804 \uBC84\uC804\uACFC \uC911\uBCF5 \uC81C\uC678 \uB0B4\uC5ED\uC740 \uD604\uC7AC \uBC1C\uC0DD\uC561\uC5D0 \uB354\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
                items && !busy && React.createElement("b", { className: "num" },
                    "\uCD1D ",
                    items.count,
                    "\uAC1C \uB0B4\uC5ED \u00B7 ",
                    kind === 'opening' ? '기초 원금' : '합계',
                    " ",
                    won(items.amount),
                    "\uC6D0",
                    kind === 'opening' && React.createElement(React.Fragment, null,
                        " \u00B7 \uD604\uC7AC \uC794\uC561 ",
                        won(items.balance),
                        "\uC6D0"))),
            !busy && items && (items.rows.length ? React.createElement(React.Fragment, null,
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, kind === 'collections' ? '수금일' : kind === 'opening' ? '기록된 발생월' : '출고일 / 월'),
                                React.createElement("th", null, "\uACE0\uAC1D\uCF54\uB4DC"),
                                React.createElement("th", null, "\uAC70\uB798\uCC98"),
                                React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                                React.createElement("th", { className: "r" }, kind === 'opening' ? '기초 원금' : '금액'),
                                kind === 'opening' && React.createElement("th", { className: "r" }, "\uD604\uC7AC \uC794\uC561"),
                                React.createElement("th", null, kind === 'collections' ? '수금방법 / 상태' : '구분'),
                                React.createElement("th", null, "\uC6D0\uBCF8 / \uB4F1\uB85D\uC815\uBCF4"),
                                React.createElement("th", null, "\uC138\uBD80 \uB0B4\uC6A9"))),
                        React.createElement("tbody", null, items.rows.map((r) => React.createElement("tr", { key: r.id },
                            React.createElement("td", { className: "num" },
                                r.date || r.month || '미확인',
                                r.precision === 'month' && React.createElement("div", { className: "t-sm t-muted" }, "\uC6D4 \uC9D1\uACC4 \u00B7 \uC77C\uC790 \uBBF8\uBCF4\uAD00")),
                            React.createElement("td", null, r.customer_code),
                            React.createElement("td", { className: "t-strong" }, r.customer_name),
                            React.createElement("td", null, r.biz_unit || '미분류'),
                            React.createElement("td", { className: "r num" }, won(r.amount)),
                            kind === 'opening' && React.createElement("td", { className: "r num" }, won(r.balance)),
                            React.createElement("td", null,
                                r.method && React.createElement("div", null, r.method),
                                labels[r.state] || r.state),
                            React.createElement("td", { className: "activity-wrap" },
                                r.filename || '파일정보 없음',
                                r.row_number && React.createElement("div", null,
                                    "\uC5D1\uC140 ",
                                    r.row_number,
                                    "\uD589"),
                                React.createElement("div", { className: "t-sm t-muted" },
                                    r.uploaded_by,
                                    " ",
                                    r.uploaded_at)),
                            React.createElement("td", { className: "activity-wrap" },
                                r.receipt_no && React.createElement("div", null,
                                    r.receipt_no,
                                    " / ",
                                    r.sequence),
                                r.note,
                                r.approved_by && React.createElement("div", { className: "t-sm" },
                                    "\uC2B9\uC778: ",
                                    r.approved_by,
                                    " \u00B7 ",
                                    r.approved_at),
                                r.source_id && React.createElement("div", null,
                                    React.createElement("button", { className: "btn btn--sm", disabled: sourceBusy, onClick: () => openSource(r) }, "\uC5C5\uB85C\uB4DC \uC6D0\uBCF8 \uBCF4\uAE30")))))))),
                React.createElement("div", { className: "btnrow activity-pagination" },
                    React.createElement("button", { className: "btn btn--sm", disabled: items.page <= 1 || busy, onClick: () => setPage(page - 1) }, "\uC774\uC804"),
                    React.createElement("span", null,
                        items.page,
                        " / ",
                        items.pages),
                    React.createElement("button", { className: "btn btn--sm", disabled: items.page >= items.pages || busy, onClick: () => setPage(page + 1) }, "\uB2E4\uC74C"))) : React.createElement(Empty, { title: "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uC138\uBD80 \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, "\uC6D4 \uC9D1\uACC4 \uC790\uB8CC\uB294 \uC77C\uC790\uB97C \uC9C0\uC815\uD558\uC9C0 \uC54A\uACE0 \uC6D4 \uC804\uCCB4\uB85C \uC870\uD68C\uD574 \uC8FC\uC138\uC694."))),
        source && React.createElement(ActivitySource, { record: source, onClose: () => setSource(null) }));
}
