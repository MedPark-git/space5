"use strict";
const { useState, useEffect, useMemo, useRef, useCallback } = React;
/* ══════════════════ 유틸 ══════════════════ */
const won = (n) => (Number(n) || 0).toLocaleString("ko-KR");
function short(n) {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1e8)
        return { value: (v / 1e8).toFixed(1), unit: "억" };
    if (Math.abs(v) >= 1e4)
        return { value: Math.round(v / 1e4).toLocaleString("ko-KR"), unit: "만" };
    return { value: v.toLocaleString("ko-KR"), unit: "원" };
}
const STATUS_STYLE = { 정상: "ok", 연체: "warn", 부실: "bad" };
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const sum = (list, key) => list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
async function api(path, options = {}) {
    const res = await fetch(path, {
        credentials: "same-origin",
        headers: options.body ? { "Content-Type": "application/json" } : {},
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = {};
    try {
        data = await res.json();
    }
    catch (e) { /* 본문 없음 */ }
    if (!res.ok)
        throw new Error(data.error || "요청을 처리하지 못했습니다. (" + res.status + ")");
    return data;
}
/* ══════════════════ 공용 컴포넌트 ══════════════════ */
function Card({ title, actions, children, flush }) {
    return (React.createElement("section", { className: "card" },
        (title || actions) && (React.createElement("header", { className: "card__head" },
            React.createElement("h3", null, title),
            React.createElement("div", { className: "spacer" }),
            actions)),
        React.createElement("div", { className: "card__body" + (flush ? " card__body--flush" : "") }, children)));
}
function Empty({ title, children }) {
    return React.createElement("div", { className: "empty" },
        React.createElement("b", null, title),
        children);
}
function Badge({ status }) {
    return React.createElement("span", { className: "badge badge--" + (STATUS_STYLE[status] || "mute") }, status);
}
function Field({ label, children }) {
    return React.createElement("div", { className: "field" },
        React.createElement("label", null, label),
        children);
}
/* ══════════════════ 로그인 ══════════════════ */
function Login({ onDone }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const usernameRef = React.useRef(null);
    const passwordRef = React.useRef(null);
    async function submit() {
        const loginUsername = (usernameRef.current?.value || username).trim();
        const loginPassword = passwordRef.current?.value || password;
        if (!loginUsername || !loginPassword) {
            setError("아이디와 비밀번호를 모두 입력해 주세요.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const { user } = await api("/api/login", { method: "POST", body: { username: loginUsername, password: loginPassword } });
            onDone(user);
        }
        catch (e) {
            setError(e.message);
            setBusy(false);
        }
    }
    return (React.createElement("div", { className: "login" },
        React.createElement("aside", { className: "login__aside" },
            React.createElement("div", { className: "login__brand" }, "MEDPARK"),
            React.createElement("div", null,
                React.createElement("h1", { className: "login__head" },
                    "\uBBF8\uC218\uCC44\uAD8C",
                    React.createElement("br", null),
                    "\uAD00\uB9AC \uC2DC\uC2A4\uD15C"),
                React.createElement("p", { className: "login__sub" }, "\uB374\uD0C8\u00B7\uBA54\uB514\uCEEC\u00B7\uC5D0\uC2A4\uD14C\uD2F1 \uC138 \uC0AC\uC5C5\uBD80\uC758 \uCC44\uAD8C \uC794\uC561\uACFC \uC218\uAE08 \uC9C4\uD589\uC744 \uD55C \uD654\uBA74\uC5D0\uC11C \uBD05\uB2C8\uB2E4."),
                React.createElement("div", { className: "login__stat" },
                    React.createElement("div", null,
                        React.createElement("b", null, "3"),
                        "\uC0AC\uC5C5\uBD80"),
                    React.createElement("div", null,
                        React.createElement("b", null, "9"),
                        "\uCC44\uAD8C \uBD84\uB958"),
                    React.createElement("div", null,
                        React.createElement("b", null, "11"),
                        "\uAD8C\uD55C \uAD6C\uBD84"))),
            React.createElement("div", { className: "login__brand", style: { opacity: .55 } }, "\uB0B4\uBD80 \uC5C5\uBB34\uC6A9 \u00B7 \uC678\uBD80 \uACF5\uC720 \uAE08\uC9C0")),
        React.createElement("div", { className: "login__panel" },
            React.createElement("div", { className: "login__form" },
                React.createElement("h2", null, "\uB85C\uADF8\uC778"),
                React.createElement("p", { className: "hint" }, "\uD68C\uC0AC\uC5D0\uC11C \uBC1C\uAE09\uBC1B\uC740 \uACC4\uC815\uC73C\uB85C \uC811\uC18D\uD558\uC138\uC694."),
                error && React.createElement("div", { className: "alert alert--bad" }, error),
                React.createElement(Field, { label: "\uC544\uC774\uB514" },
                    React.createElement("input", { ref: usernameRef, className: "input", value: username, autoFocus: true, autoComplete: "username", onChange: (e) => setUsername(e.target.value), onInput: (e) => setUsername(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit(), placeholder: "Medpark0" })),
                React.createElement(Field, { label: "\uBE44\uBC00\uBC88\uD638" },
                    React.createElement("input", { ref: passwordRef, className: "input", type: "password", value: password, autoComplete: "current-password", onChange: (e) => setPassword(e.target.value), onInput: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() })),
                React.createElement("button", { className: "btn btn--primary", style: { width: "100%", marginTop: 6 }, onClick: submit, disabled: busy }, busy ? "확인하는 중" : "로그인")))));
}
/* ══════════════════ 대시보드 ══════════════════ */
function Dashboard({ data, setScreen, setPreset }) {
    const { customers, collections, targets } = data;
    const [unit, setUnit] = useState("전체");
    const [normalTopUnit, setNormalTopUnit] = useState("전체");
    const [overdueTopUnit, setOverdueTopUnit] = useState("전체");
    const scoped = useMemo(() => (unit === "전체" ? customers : customers.filter((c) => c.biz_unit === unit)), [customers, unit]);
    const totals = useMemo(() => {
        const by = { 정상: sum(scoped, "normal_balance"), 연체: sum(scoped, "overdue_balance"), 부실: sum(scoped, "bad_balance") };
        const cnt = {
            정상: scoped.filter((c) => c.normal_balance !== 0).length,
            연체: scoped.filter((c) => c.overdue_balance !== 0).length,
            부실: scoped.filter((c) => c.bad_balance !== 0).length,
        };
        return { by, cnt, all: sum(scoped, "balance") };
    }, [scoped]);
    const byUnit = useMemo(() => data.meta.units.map((u) => {
        const rows = customers.filter((c) => c.biz_unit === u);
        const g = { unit: u, 정상: 0, 연체: 0, 부실: 0, count: rows.length };
        rows.forEach((c) => { g.정상 += c.normal_balance; g.연체 += c.overdue_balance; g.부실 += c.bad_balance; });
        g.total = g.정상 + g.연체 + g.부실;
        return g;
    }), [customers, data.meta.units]);
    const approved = collections.filter((c) => c.state === "approved");
    const monthly = useMemo(() => {
        const map = {};
        approved.forEach((c) => {
            const m = (c.paid_at || "").slice(0, 7);
            if (!m)
                return;
            map[m] = map[m] || { month: m, amount: 0, count: 0 };
            map[m].amount += c.amount;
            map[m].count += 1;
        });
        return Object.values(map).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
    }, [approved]);
    const normalTop5 = customers
        .filter((c) => (normalTopUnit === "전체" || c.biz_unit === normalTopUnit) && c.normal_balance > 0)
        .sort((a, b) => b.normal_balance - a.normal_balance).slice(0, 5);
    const overdueTop5 = customers
        .filter((c) => (overdueTopUnit === "전체" || c.biz_unit === overdueTopUnit) && c.overdue_balance > 0)
        .sort((a, b) => b.overdue_balance - a.overdue_balance).slice(0, 5);
    const topUnitSelect = (value, setter, label) => (React.createElement("select", { className: "select", style: { width: 110, padding: "6px 9px" }, value: value, onChange: (e) => setter(e.target.value), "aria-label": label }, ["전체", ...data.meta.units].map((u) => React.createElement("option", { key: u, value: u }, u))));
    const todayStr = today();
    const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const openTargets = targets.filter((t) => t.state !== "done");
    const dueToday = openTargets.filter((t) => t.target_date === todayStr);
    const dueWeek = openTargets.filter((t) => t.target_date > todayStr && t.target_date <= weekEnd);
    const overdueTargets = openTargets.filter((t) => t.target_date < todayStr);
    const owners = useMemo(() => {
        const map = {};
        scoped.forEach((c) => {
            const key = c.owner || "미지정";
            map[key] = map[key] || { owner: key, 정상: 0, 연체: 0, 부실: 0, total: 0, count: 0 };
            map[key].정상 += c.normal_balance;
            map[key].연체 += c.overdue_balance;
            map[key].부실 += c.bad_balance;
            map[key].total += c.balance;
            map[key].count += 1;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [scoped]);
    const jump = (status) => { setPreset({ status, unit }); setScreen("customers"); };
    const maxUnit = Math.max(1, ...byUnit.map((g) => g.total));
    const kpis = [
        { key: "전체", label: "전체 채권 잔액", value: totals.all, count: scoped.length, color: "var(--brand)" },
        { key: "정상", label: "정상채권 잔액", value: totals.by.정상, count: totals.cnt.정상, color: "var(--ok)" },
        { key: "연체", label: "미수채권(11개월 내) 잔액", value: totals.by.연체, count: totals.cnt.연체, color: "var(--warn)" },
        { key: "부실", label: "부실채권(12개월 이상)", value: totals.by.부실, count: totals.cnt.부실, color: "var(--bad)" },
    ];
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "chiprow" }, ["전체", ...data.meta.units].map((u) => (React.createElement("button", { key: u, className: "chip", "aria-pressed": unit === u, onClick: () => setUnit(u) }, u)))),
        React.createElement("div", { className: "grid grid--kpi" }, kpis.map((k) => {
            const s = short(k.value);
            return (React.createElement("button", { key: k.key, className: "kpi", onClick: () => k.key !== "전체" && jump(k.key) },
                React.createElement("div", { className: "kpi__label" },
                    React.createElement("i", { className: "kpi__dot", style: { background: k.color } }),
                    k.label),
                React.createElement("div", { className: "kpi__value num" },
                    s.value,
                    React.createElement("em", null, s.unit)),
                React.createElement("div", { className: "kpi__meta num" },
                    "\uAC70\uB798\uCC98 ",
                    k.count,
                    "\uACF3 \u00B7 ",
                    won(k.value),
                    "\uC6D0")));
        })),
        React.createElement("div", { className: "grid grid--2" },
            React.createElement(Card, { title: "\uC0AC\uC5C5\uBD80\uBCC4 \uCC44\uAD8C \uBD84\uB958 \uD604\uD669", actions: React.createElement("div", { className: "legend" },
                    React.createElement("span", null,
                        React.createElement("i", { style: { background: "var(--ok)" } }),
                        "\uC815\uC0C1"),
                    React.createElement("span", null,
                        React.createElement("i", { style: { background: "var(--warn)" } }),
                        "\uC5F0\uCCB4"),
                    React.createElement("span", null,
                        React.createElement("i", { style: { background: "var(--bad)" } }),
                        "\uBD80\uC2E4")) },
                React.createElement("div", { className: "signal" }, byUnit.map((g) => (React.createElement("div", { className: "signal__row", key: g.unit },
                    React.createElement("div", { className: "signal__unit" }, g.unit),
                    React.createElement("div", { className: "signal__bar", style: { width: (Math.max(8, (g.total / maxUnit) * 100)) + "%" } }, ["정상", "연체", "부실"].map((s) => g[s] > 0 && (React.createElement("button", { key: s, className: "signal__seg signal__seg--" + STATUS_STYLE[s], style: { width: (g[s] / g.total) * 100 + "%" }, title: g.unit + " " + s + " " + won(g[s]) + "원", onClick: () => { setPreset({ status: s, unit: g.unit }); setScreen("customers"); } })))),
                    React.createElement("div", { className: "signal__total num" },
                        short(g.total).value,
                        short(g.total).unit))))),
                React.createElement("p", { className: "t-sm t-muted", style: { margin: "14px 0 0" } }, "\uB9C9\uB300\uB97C \uB204\uB974\uBA74 \uD574\uB2F9 \uC0AC\uC5C5\uBD80\u00B7\uBD84\uB958\uC758 \uAC70\uB798\uCC98 \uBAA9\uB85D\uC73C\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.")),
            React.createElement(Card, { title: "\uC6D4\uBCC4 \uC218\uAE08 \uC2E4\uC801", flush: true }, monthly.length === 0 ? (React.createElement(Empty, { title: "\uC2B9\uC778\uB41C \uC218\uAE08 \uB0B4\uC5ED\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4." }, "\uC218\uAE08 \uB4F1\uB85D \uD654\uBA74\uC5D0\uC11C \uC785\uB825\uD558\uACE0 \uC7AC\uBB34\uB2F4\uB2F9\uC774 \uC2B9\uC778\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uC9D1\uACC4\uB429\uB2C8\uB2E4.")) : (React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uAE30\uC900\uC6D4"),
                            React.createElement("th", { className: "r" }, "\uAC74\uC218"),
                            React.createElement("th", { className: "r" }, "\uC218\uAE08\uC561 (\uC6D0)"))),
                    React.createElement("tbody", null, monthly.map((m) => (React.createElement("tr", { key: m.month },
                        React.createElement("td", { className: "t-strong num" }, m.month),
                        React.createElement("td", { className: "r num" }, m.count),
                        React.createElement("td", { className: "r num t-strong" }, won(m.amount)))))),
                    React.createElement("tfoot", null,
                        React.createElement("tr", null,
                            React.createElement("td", null, "\uD569\uACC4"),
                            React.createElement("td", { className: "r num" }, sum(monthly, "count")),
                            React.createElement("td", { className: "r num" }, won(sum(monthly, "amount")))))))))),
        React.createElement("div", { className: "grid grid--3" },
            React.createElement(Card, { title: "\uC218\uAE08\uBAA9\uD45C \uC694\uC57D" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uAD6C\uBD84"),
                            React.createElement("th", { className: "r" }, "\uAC74\uC218"),
                            React.createElement("th", { className: "r" }, "\uBAA9\uD45C\uAE08\uC561 (\uC6D0)"))),
                    React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("td", null, "\uC624\uB298 \uBAA9\uD45C"),
                            React.createElement("td", { className: "r num t-strong" }, dueToday.length),
                            React.createElement("td", { className: "r num" }, won(sum(dueToday, "amount")))),
                        React.createElement("tr", null,
                            React.createElement("td", null, "\uC774\uBC88 \uC8FC \uBAA9\uD45C"),
                            React.createElement("td", { className: "r num t-strong" }, dueWeek.length),
                            React.createElement("td", { className: "r num" }, won(sum(dueWeek, "amount")))),
                        React.createElement("tr", null,
                            React.createElement("td", null, "\uAE30\uD55C \uCD08\uACFC"),
                            React.createElement("td", { className: "r num t-strong", style: { color: overdueTargets.length ? "var(--bad)" : "inherit" } }, overdueTargets.length),
                            React.createElement("td", { className: "r num" }, won(sum(overdueTargets, "amount")))))),
                React.createElement("button", { className: "btn btn--sm", style: { marginTop: 12 }, onClick: () => setScreen("targets") }, "\uC218\uAE08\uBAA9\uD45C \uAD00\uB9AC\uB85C \uC774\uB3D9")),
            React.createElement(Card, { title: "정상채권 TOP 5", actions: topUnitSelect(normalTopUnit, setNormalTopUnit, "정상채권 사업부 선택"), flush: true },
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", null,
                        React.createElement("tbody", null,
                            normalTop5.map((c, i) => (React.createElement("tr", { key: c.code },
                                React.createElement("td", { className: "t-muted num", style: { width: 26 } }, i + 1),
                                React.createElement("td", { className: "t-strong" }, c.name),
                                React.createElement("td", null,
                                    React.createElement(Badge, { status: "정상" })),
                                React.createElement("td", { className: "r num" }, won(c.normal_balance))))),
                            normalTop5.length === 0 && React.createElement("tr", null,
                                React.createElement("td", { className: "t-muted" }, "정상채권 데이터가 없습니다.")))))),
            React.createElement(Card, { title: "미수채권 TOP 5", actions: topUnitSelect(overdueTopUnit, setOverdueTopUnit, "미수채권 사업부 선택"), flush: true },
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", null,
                        React.createElement("tbody", null,
                            overdueTop5.map((c, i) => (React.createElement("tr", { key: c.code },
                                React.createElement("td", { className: "t-muted num", style: { width: 26 } }, i + 1),
                                React.createElement("td", { className: "t-strong" }, c.name),
                                React.createElement("td", { className: "num t-sm t-muted" },
                                    c.overdue_days,
                                    "\uC77C"),
                                React.createElement("td", { className: "r num" }, won(c.overdue_balance))))),
                            overdueTop5.length === 0 && (React.createElement("tr", null,
                                React.createElement("td", { className: "t-muted" }, "미수채권 데이터가 없습니다.")))))))),
        React.createElement(Card, { title: "\uB2F4\uB2F9\uC790\uBCC4 \uCC44\uAD8C \uD604\uD669", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uB2F4\uB2F9\uC790"),
                            React.createElement("th", { className: "r" }, "\uAC70\uB798\uCC98"),
                            React.createElement("th", { className: "r" }, "\uC815\uC0C1"),
                            React.createElement("th", { className: "r" }, "\uC5F0\uCCB4"),
                            React.createElement("th", { className: "r" }, "\uBD80\uC2E4"),
                            React.createElement("th", { className: "r" }, "\uD569\uACC4"),
                            React.createElement("th", { style: { width: 130 } }, "\uC5F0\uCCB4\u00B7\uBD80\uC2E4 \uBE44\uC911"))),
                    React.createElement("tbody", null, owners.map((o) => {
                        const risk = o.total ? ((o.연체 + o.부실) / o.total) * 100 : 0;
                        return (React.createElement("tr", { key: o.owner },
                            React.createElement("td", { className: "t-strong" }, o.owner),
                            React.createElement("td", { className: "r num" }, o.count),
                            React.createElement("td", { className: "r num" }, won(o.정상)),
                            React.createElement("td", { className: "r num" }, won(o.연체)),
                            React.createElement("td", { className: "r num" }, won(o.부실)),
                            React.createElement("td", { className: "r num t-strong" }, won(o.total)),
                            React.createElement("td", null,
                                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                                    React.createElement("div", { className: "bar" },
                                        React.createElement("i", { style: {
                                                width: risk + "%",
                                                background: risk > 40 ? "var(--bad)" : risk > 15 ? "var(--warn)" : "var(--ok)"
                                            } })),
                                    React.createElement("span", { className: "t-sm num t-muted" },
                                        risk.toFixed(0),
                                        "%")))));
                    })))))));
}
/* ══════════════════ 거래처별 현황 ══════════════════ */
function Customers({ data, can, preset, notify, patchCustomer }) {
    const [open, setOpen] = useState({}); // 사업부는 모두 접힌 상태로 시작
    const [sel, setSel] = useState(preset || { unit: "전체", status: "전체" });
    const [q, setQ] = useState("");
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState("");
    useEffect(() => { if (preset) {
        setSel(preset);
        setOpen((o) => ({ ...o, [preset.unit]: true }));
    } }, [preset]);
    const rows = useMemo(() => data.customers.filter((c) => {
        if (sel.unit !== "전체" && c.biz_unit !== sel.unit)
            return false;
        if (sel.status !== "전체" && c.status !== sel.status)
            return false;
        if (q && !(c.name.includes(q) || c.code.includes(q) || (c.owner || "").includes(q)))
            return false;
        return true;
    }), [data.customers, sel, q]);
    const countOf = (unit, status) => data.customers.filter((c) => (unit === "전체" || c.biz_unit === unit) && (status === "전체" || c.status === status)).length;
    async function saveNote(code) {
        try {
            const { customer } = await api("/api/customers/" + encodeURIComponent(code), { method: "PATCH", body: { note: draft } });
            patchCustomer(customer);
            setEditing(null);
            notify("비고를 저장했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    return (React.createElement("div", { className: "grid grid--split" },
        React.createElement(Card, { title: "\uBD84\uB958" },
            React.createElement("div", { className: "tree" },
                React.createElement("button", { className: "tree__leaf", style: { paddingLeft: 10, fontWeight: 600 }, "aria-current": sel.unit === "전체" && sel.status === "전체", onClick: () => setSel({ unit: "전체", status: "전체" }) },
                    React.createElement("span", null, "\uC804\uCCB4 \uAC70\uB798\uCC98"),
                    React.createElement("span", { className: "tree__count" }, data.customers.length)),
                data.meta.units.map((u) => (React.createElement("div", { key: u },
                    React.createElement("button", { className: "tree__unit", onClick: () => setOpen((o) => ({ ...o, [u]: !o[u] })), "aria-expanded": !!open[u] },
                        React.createElement("span", { className: "tree__caret" + (open[u] ? " tree__caret--open" : "") }, "\u25B8"),
                        u,
                        React.createElement("span", { className: "spacer", style: { flex: 1 } }),
                        React.createElement("span", { className: "tree__count" }, countOf(u, "전체"))),
                    open[u] && (React.createElement(React.Fragment, null,
                        React.createElement("button", { className: "tree__leaf", "aria-current": sel.unit === u && sel.status === "전체", onClick: () => setSel({ unit: u, status: "전체" }) },
                            React.createElement("span", null, "\uC804\uCCB4"),
                            React.createElement("span", { className: "tree__count" }, countOf(u, "전체"))),
                        data.meta.statuses.map((s) => (React.createElement("button", { key: s, className: "tree__leaf", "aria-current": sel.unit === u && sel.status === s, onClick: () => setSel({ unit: u, status: s }) },
                            React.createElement("span", null,
                                React.createElement(Badge, { status: s })),
                            React.createElement("span", { className: "tree__count" }, countOf(u, s)))))))))))),
        React.createElement(Card, { title: sel.unit + " · " + sel.status + " (" + rows.length + "곳)", actions: React.createElement("input", { className: "input", style: { width: 220 }, value: q, placeholder: "\uAC70\uB798\uCC98\uBA85\u00B7\uCF54\uB4DC\u00B7\uB2F4\uB2F9\uC790", onChange: (e) => setQ(e.target.value) }), flush: true }, rows.length === 0 ? (React.createElement(Empty, { title: "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uAC70\uB798\uCC98\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, "\uC67C\uCABD \uBD84\uB958\uB098 \uAC80\uC0C9\uC5B4\uB97C \uBC14\uAFD4\uBCF4\uC138\uC694.")) : (React.createElement("div", { className: "tablewrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "\uCF54\uB4DC"),
                        React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                        React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                        React.createElement("th", null, "\uBD84\uB958"),
                        React.createElement("th", null, "\uB2F4\uB2F9\uC790"),
                        React.createElement("th", { className: "r" }, "\uBBF8\uC218\uC794\uC561"),
                        React.createElement("th", { className: "r" }, "\uC120\uC218\uAE08"),
                        React.createElement("th", { className: "r" }, "\uACBD\uACFC\uC77C"),
                        React.createElement("th", null, "\uCD5C\uC885\uC218\uAE08\uC77C"),
                        React.createElement("th", { style: { minWidth: 200 } }, "\uBE44\uACE0"))),
                React.createElement("tbody", null, rows.map((c) => (React.createElement("tr", { key: c.code },
                    React.createElement("td", { className: "num t-muted" }, c.code),
                    React.createElement("td", { className: "t-strong" }, c.name),
                    React.createElement("td", null, c.biz_unit),
                    React.createElement("td", null,
                        React.createElement(Badge, { status: c.status })),
                    React.createElement("td", null, c.owner || React.createElement("span", { className: "t-muted" }, "\uBBF8\uC9C0\uC815")),
                    React.createElement("td", { className: "r num t-strong" }, won(c.balance)),
                    React.createElement("td", { className: "r num" }, c.advance ? won(c.advance) : "–"),
                    React.createElement("td", { className: "r num" }, c.overdue_days || "–"),
                    React.createElement("td", { className: "num t-muted t-sm" }, c.last_paid_at || "–"),
                    React.createElement("td", { style: { whiteSpace: "normal" } }, editing === c.code ? (React.createElement("div", { style: { display: "flex", gap: 6 } },
                        React.createElement("input", { className: "input", value: draft, autoFocus: true, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => e.key === "Enter" && saveNote(c.code) }),
                        React.createElement("button", { className: "btn btn--sm btn--primary", onClick: () => saveNote(c.code) }, "\uC800\uC7A5"),
                        React.createElement("button", { className: "btn btn--sm", onClick: () => setEditing(null) }, "\uCDE8\uC18C"))) : (React.createElement("span", { onClick: () => { if (can("note_edit")) {
                            setEditing(c.code);
                            setDraft(c.note || "");
                        } }, style: { cursor: can("note_edit") ? "text" : "default" }, className: c.note ? "" : "t-muted t-sm" }, c.note || (can("note_edit") ? "클릭해 입력" : "–")))))))),
                React.createElement("tfoot", null,
                    React.createElement("tr", null,
                        React.createElement("td", { colSpan: 5 },
                            "\uD569\uACC4 ",
                            rows.length,
                            "\uACF3"),
                        React.createElement("td", { className: "r num" }, won(sum(rows, "balance"))),
                        React.createElement("td", { className: "r num" }, won(sum(rows, "advance"))),
                        React.createElement("td", { colSpan: 3 })))))))));
}
/* ══════════════════ 담당자별 채권현황 ══════════════════ */
function Owners({ data }) {
    const [owner, setOwner] = useState("전체");
    const list = useMemo(() => {
        const map = {};
        data.customers.forEach((c) => {
            const k = c.owner || "미지정";
            map[k] = map[k] || { owner: k, rows: [], total: 0, 정상: 0, 연체: 0, 부실: 0 };
            map[k].rows.push(c);
            map[k].total += c.balance;
            map[k][c.status] += c.balance;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [data.customers]);
    const active = owner === "전체" ? null : list.find((o) => o.owner === owner);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "chiprow" },
            React.createElement("button", { className: "chip", "aria-pressed": owner === "전체", onClick: () => setOwner("전체") }, "\uC804\uCCB4"),
            list.map((o) => (React.createElement("button", { key: o.owner, className: "chip", "aria-pressed": owner === o.owner, onClick: () => setOwner(o.owner) },
                o.owner,
                " (",
                o.rows.length,
                ")")))),
        React.createElement("div", { className: "grid grid--3" }, (active ? [active] : list).map((o) => (React.createElement(Card, { key: o.owner, title: o.owner },
            React.createElement("div", { className: "kpi__value num", style: { marginTop: 0 } },
                short(o.total).value,
                React.createElement("em", null, short(o.total).unit)),
            React.createElement("div", { className: "kpi__meta num", style: { marginBottom: 12 } },
                "\uAC70\uB798\uCC98 ",
                o.rows.length,
                "\uACF3 \u00B7 ",
                won(o.total),
                "\uC6D0"),
            React.createElement("div", { className: "signal__bar" }, ["정상", "연체", "부실"].map((s) => o[s] > 0 && (React.createElement("div", { key: s, className: "signal__seg signal__seg--" + STATUS_STYLE[s], style: { width: (o[s] / o.total) * 100 + "%" }, title: s + " " + won(o[s]) })))))))),
        active && (React.createElement(Card, { title: active.owner + " 담당 거래처", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uCF54\uB4DC"),
                            React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                            React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                            React.createElement("th", null, "\uBD84\uB958"),
                            React.createElement("th", { className: "r" }, "\uBBF8\uC218\uC794\uC561"),
                            React.createElement("th", { className: "r" }, "\uACBD\uACFC\uC77C"),
                            React.createElement("th", null, "\uBE44\uACE0"))),
                    React.createElement("tbody", null, [...active.rows].sort((a, b) => b.balance - a.balance).map((c) => (React.createElement("tr", { key: c.code },
                        React.createElement("td", { className: "num t-muted" }, c.code),
                        React.createElement("td", { className: "t-strong" }, c.name),
                        React.createElement("td", null, c.biz_unit),
                        React.createElement("td", null,
                            React.createElement(Badge, { status: c.status })),
                        React.createElement("td", { className: "r num t-strong" }, won(c.balance)),
                        React.createElement("td", { className: "r num" }, c.overdue_days || "–"),
                        React.createElement("td", { className: "t-sm t-muted", style: { whiteSpace: "normal" } }, c.note || "–"))))),
                    React.createElement("tfoot", null,
                        React.createElement("tr", null,
                            React.createElement("td", { colSpan: 4 }, "\uD569\uACC4"),
                            React.createElement("td", { className: "r num" }, won(active.total)),
                            React.createElement("td", { colSpan: 2 })))))))));
}
/* ══════════════════ 수금 등록 ══════════════════ */
function Collections({ data, can, notify, refresh }) {
    const [form, setForm] = useState({
        customer_code: "", amount: "", method: "계좌수금", paid_at: today(), note: "",
    });
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const pending = data.collections.filter((c) => c.state === "pending");
    const decided = data.collections.filter((c) => c.state !== "pending").slice(0, 40);
    const target = data.customers.find((c) => c.code === form.customer_code);
    async function register() {
        setBusy(true);
        try {
            await api("/api/collections", { method: "POST", body: form });
            notify("수금 건을 등록했습니다. 재무담당 승인 후 잔액에 반영됩니다.");
            setForm({ ...form, customer_code: "", amount: "", note: "" });
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
        setBusy(false);
    }
    async function decide(id, action) {
        try {
            const body = action === "reject" ? { reason: prompt("반려 사유를 입력하세요.") || "" } : {};
            await api("/api/collections/" + id + "/" + action, { method: "POST", body });
            notify(action === "approve" ? "승인했습니다. 잔액이 갱신되었습니다." : "반려했습니다.");
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    return (React.createElement(React.Fragment, null,
        can("collection_register") && (React.createElement(Card, { title: "\uC218\uAE08 \uB4F1\uB85D" },
            React.createElement("div", { className: "formrow" },
                React.createElement(Field, { label: "\uAC70\uB798\uCC98" },
                    React.createElement("select", { className: "select", value: form.customer_code, onChange: set("customer_code") },
                        React.createElement("option", { value: "" }, "\uC120\uD0DD\uD558\uC138\uC694"),
                        data.customers.map((c) => (React.createElement("option", { key: c.code, value: c.code },
                            c.name,
                            " \u00B7 ",
                            c.biz_unit,
                            " (",
                            won(c.balance),
                            "\uC6D0)"))))),
                React.createElement(Field, { label: "\uC218\uAE08\uC561 (\uC6D0)" },
                    React.createElement("input", { className: "input num", inputMode: "numeric", value: form.amount, onChange: set("amount"), placeholder: "0" })),
                React.createElement(Field, { label: "\uC218\uAE08\uBC29\uBC95" },
                    React.createElement("select", { className: "select", value: form.method, onChange: set("method") }, data.meta.methods.map((m) => React.createElement("option", { key: m }, m)))),
                React.createElement(Field, { label: "\uC218\uAE08\uC77C" },
                    React.createElement("input", { className: "input", type: "date", value: form.paid_at, onChange: set("paid_at") }))),
            React.createElement(Field, { label: "\uBE44\uACE0" },
                React.createElement("input", { className: "input", value: form.note, onChange: set("note"), placeholder: "\uC785\uAE08\uC790\uBA85, \uBD84\uD560 \uD68C\uCC28 \uB4F1" })),
            target && Number(form.amount) > target.balance && (React.createElement("div", { className: "alert alert--warn" },
                "\uC785\uB825\uD55C \uC218\uAE08\uC561\uC774 \uD604\uC7AC \uBBF8\uC218\uC794\uC561(",
                won(target.balance),
                "\uC6D0)\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4. \uAE08\uC561\uC744 \uD655\uC778\uD558\uC138\uC694.")),
            React.createElement("button", { className: "btn btn--primary", onClick: register, disabled: busy || !form.customer_code || !form.amount }, "\uC2B9\uC778 \uC694\uCCAD\uC73C\uB85C \uB4F1\uB85D"))),
        React.createElement(Card, { title: "승인 대기 " + pending.length + "건", flush: true }, pending.length === 0 ? (React.createElement(Empty, { title: "\uB300\uAE30 \uC911\uC778 \uC218\uAE08 \uAC74\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, "\uC601\uC5C5\uB2F4\uB2F9\uC774 \uB4F1\uB85D\uD558\uBA74 \uC774\uACF3\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.")) : (React.createElement("div", { className: "tablewrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "\uB4F1\uB85D\uC77C"),
                        React.createElement("th", null, "\uAC70\uB798\uCC98"),
                        React.createElement("th", { className: "r" }, "\uC218\uAE08\uC561"),
                        React.createElement("th", null, "\uBC29\uBC95"),
                        React.createElement("th", null, "\uC218\uAE08\uC77C"),
                        React.createElement("th", null, "\uB4F1\uB85D\uC790"),
                        React.createElement("th", null, "\uBE44\uACE0"),
                        React.createElement("th", null))),
                React.createElement("tbody", null, pending.map((c) => (React.createElement("tr", { key: c.id },
                    React.createElement("td", { className: "t-sm t-muted num" }, (c.created_at || "").slice(0, 10)),
                    React.createElement("td", { className: "t-strong" }, c.customer_name),
                    React.createElement("td", { className: "r num t-strong" }, won(c.amount)),
                    React.createElement("td", null, c.method),
                    React.createElement("td", { className: "num" }, c.paid_at),
                    React.createElement("td", null, c.registered_by),
                    React.createElement("td", { className: "t-sm t-muted", style: { whiteSpace: "normal" } }, c.note || "–"),
                    React.createElement("td", { className: "r" }, can("collection_approve") ? (React.createElement("div", { className: "btnrow", style: { justifyContent: "flex-end" } },
                        React.createElement("button", { className: "btn btn--sm btn--ok", onClick: () => decide(c.id, "approve") }, "\uC2B9\uC778"),
                        React.createElement("button", { className: "btn btn--sm btn--danger", onClick: () => decide(c.id, "reject") }, "\uBC18\uB824"))) : React.createElement("span", { className: "badge badge--mute" }, "\uC2B9\uC778 \uB300\uAE30")))))),
                React.createElement("tfoot", null,
                    React.createElement("tr", null,
                        React.createElement("td", { colSpan: 2 }, "\uB300\uAE30 \uD569\uACC4"),
                        React.createElement("td", { className: "r num" }, won(sum(pending, "amount"))),
                        React.createElement("td", { colSpan: 5 }))))))),
        React.createElement(Card, { title: "\uCC98\uB9AC \uB0B4\uC5ED", flush: true }, decided.length === 0 ? React.createElement(Empty, { title: "\uCC98\uB9AC\uB41C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }) : (React.createElement("div", { className: "tablewrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "\uC0C1\uD0DC"),
                        React.createElement("th", null, "\uAC70\uB798\uCC98"),
                        React.createElement("th", { className: "r" }, "\uC218\uAE08\uC561"),
                        React.createElement("th", null, "\uBC29\uBC95"),
                        React.createElement("th", null, "\uC218\uAE08\uC77C"),
                        React.createElement("th", null, "\uB4F1\uB85D\uC790"),
                        React.createElement("th", null, "\uCC98\uB9AC\uC790"),
                        React.createElement("th", null, "\uC0AC\uC720\u00B7\uBE44\uACE0"))),
                React.createElement("tbody", null, decided.map((c) => (React.createElement("tr", { key: c.id },
                    React.createElement("td", null,
                        React.createElement("span", { className: "badge badge--" + (c.state === "approved" ? "ok" : "bad") }, c.state === "approved" ? "승인" : "반려")),
                    React.createElement("td", { className: "t-strong" }, c.customer_name),
                    React.createElement("td", { className: "r num" }, won(c.amount)),
                    React.createElement("td", null, c.method),
                    React.createElement("td", { className: "num" }, c.paid_at),
                    React.createElement("td", null, c.registered_by),
                    React.createElement("td", null, c.approved_by),
                    React.createElement("td", { className: "t-sm t-muted", style: { whiteSpace: "normal" } }, c.reject_reason || c.note || "–")))))))))));
}
/* ══════════════════ 수금목표 관리 ══════════════════ */
function Targets({ data, notify, refresh }) {
    const blank = {
        customer_code: "", amount: "", target_date: today(), method: "계좌수금", assignee: "", note: "",
    };
    const [form, setForm] = useState(blank);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const [filter, setFilter] = useState("진행");
    const rows = data.targets.filter((t) => filter === "전체" ? true : filter === "완료" ? t.state === "done" : t.state !== "done");
    async function create() {
        try {
            await api("/api/targets", { method: "POST", body: form });
            setForm(blank);
            notify("수금목표를 추가했습니다.");
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function patch(id, body) {
        try {
            await api("/api/targets/" + id, { method: "PATCH", body });
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function remove(id) {
        if (!confirm("이 목표를 삭제할까요?"))
            return;
        try {
            await api("/api/targets/" + id, { method: "DELETE" });
            notify("삭제했습니다.");
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\uC218\uAE08\uBAA9\uD45C \uCD94\uAC00" },
            React.createElement("div", { className: "formrow" },
                React.createElement(Field, { label: "\uAC70\uB798\uCC98" },
                    React.createElement("select", { className: "select", value: form.customer_code, onChange: set("customer_code") },
                        React.createElement("option", { value: "" }, "\uC120\uD0DD\uD558\uC138\uC694"),
                        data.customers.map((c) => (React.createElement("option", { key: c.code, value: c.code },
                            c.name,
                            " (",
                            won(c.balance),
                            "\uC6D0)"))))),
                React.createElement(Field, { label: "\uBAA9\uD45C\uAE08\uC561 (\uC6D0)" },
                    React.createElement("input", { className: "input num", inputMode: "numeric", value: form.amount, onChange: set("amount") })),
                React.createElement(Field, { label: "\uBAA9\uD45C\uC77C" },
                    React.createElement("input", { className: "input", type: "date", value: form.target_date, onChange: set("target_date") })),
                React.createElement(Field, { label: "\uC218\uAE08\uBC29\uBC95" },
                    React.createElement("select", { className: "select", value: form.method, onChange: set("method") }, data.meta.methods.map((m) => React.createElement("option", { key: m }, m)))),
                React.createElement(Field, { label: "\uB2F4\uB2F9\uC790" },
                    React.createElement("input", { className: "input", value: form.assignee, onChange: set("assignee"), placeholder: "\uC774\uB984" }))),
            React.createElement(Field, { label: "\uBE44\uACE0" },
                React.createElement("input", { className: "input", value: form.note, onChange: set("note"), placeholder: "\uC57D\uC18D \uB0B4\uC6A9, \uC5F0\uB77D \uACB0\uACFC \uB4F1" })),
            React.createElement("button", { className: "btn btn--primary", onClick: create, disabled: !form.customer_code || !form.target_date }, "\uBAA9\uD45C \uCD94\uAC00")),
        React.createElement(Card, { title: "수금목표 " + rows.length + "건", flush: true, actions: React.createElement("div", { className: "chiprow" }, ["진행", "완료", "전체"].map((f) => (React.createElement("button", { key: f, className: "chip", "aria-pressed": filter === f, onClick: () => setFilter(f) }, f)))) }, rows.length === 0 ? React.createElement(Empty, { title: "\uB4F1\uB85D\uB41C \uBAA9\uD45C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, "\uC704\uC5D0\uC11C \uCCAB \uBAA9\uD45C\uB97C \uCD94\uAC00\uD558\uC138\uC694.") : (React.createElement("div", { className: "tablewrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "\uBAA9\uD45C\uC77C"),
                        React.createElement("th", null, "\uAC70\uB798\uCC98"),
                        React.createElement("th", { className: "r" }, "\uBAA9\uD45C\uAE08\uC561"),
                        React.createElement("th", null, "\uC218\uAE08\uBC29\uBC95"),
                        React.createElement("th", null, "\uB2F4\uB2F9\uC790"),
                        React.createElement("th", null, "\uC644\uB8CC\uC77C"),
                        React.createElement("th", null, "\uBE44\uACE0"),
                        React.createElement("th", null))),
                React.createElement("tbody", null, rows.map((t) => {
                    const late = t.state !== "done" && t.target_date < today();
                    return (React.createElement("tr", { key: t.id },
                        React.createElement("td", { className: "num", style: { color: late ? "var(--bad)" : "inherit", fontWeight: late ? 600 : 400 } },
                            t.target_date,
                            late && " ⚠"),
                        React.createElement("td", { className: "t-strong" }, t.customer_name),
                        React.createElement("td", { className: "r num" }, won(t.amount)),
                        React.createElement("td", null, t.method || "–"),
                        React.createElement("td", null, t.assignee || "–"),
                        React.createElement("td", null,
                            React.createElement("input", { className: "input num", type: "date", style: { width: 148 }, value: t.done_date || "", onChange: (e) => patch(t.id, { done_date: e.target.value }) })),
                        React.createElement("td", { style: { whiteSpace: "normal", minWidth: 180 } },
                            React.createElement("input", { className: "input", defaultValue: t.note, onBlur: (e) => e.target.value !== t.note && patch(t.id, { note: e.target.value }) })),
                        React.createElement("td", { className: "r" },
                            React.createElement("button", { className: "btn btn--sm btn--danger", onClick: () => remove(t.id) }, "\uC0AD\uC81C"))));
                })),
                React.createElement("tfoot", null,
                    React.createElement("tr", null,
                        React.createElement("td", { colSpan: 2 }, "\uD569\uACC4"),
                        React.createElement("td", { className: "r num" }, won(sum(rows, "amount"))),
                        React.createElement("td", { colSpan: 5 })))))))));
}
/* ══════════════════ 출고 데이터 업로드 ══════════════════ */
const COLUMN_ALIASES = {
    code: ["거래처코드", "코드", "거래처 코드", "고객코드", "code"],
    name: ["거래처명", "거래처", "업체명", "고객명", "name"],
    biz_unit: ["사업부", "사업부문", "부문", "unit"],
    status: ["채권분류", "분류", "채권상태", "상태", "status"],
    owner: ["담당자", "영업담당", "담당", "owner"],
    balance: ["미수잔액", "미수금액", "채권잔액", "잔액", "미수금", "balance"],
    normal_balance: ["정상채권잔액", "정상채권", "normal_balance"],
    overdue_balance: ["미수채권(11개월내)", "11개월내", "overdue_balance"],
    bad_balance: ["부실채권(12개월이상)", "12개월이상", "bad_balance"],
    advance: ["선수금", "선수금액", "advance"],
    overdue_days: ["경과일", "연체일", "경과일수", "연체일수"],
    last_paid_at: ["최종수금일", "최근수금일", "최종입금일"],
    note: ["비고", "특이사항", "메모"],
};
function mapHeaders(headers) {
    const map = {};
    headers.forEach((h, i) => {
        const clean = String(h || "").replace(/\s/g, "");
        for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
            if (map[field] !== undefined)
                continue;
            if (aliases.some((a) => clean === a.replace(/\s/g, "") || clean.includes(a.replace(/\s/g, "")))) {
                map[field] = i;
            }
        }
    });
    return map;
}
function Upload({ data, can, notify, applyUpload, refresh }) {
    const [month, setMonth] = useState(thisMonth());
    const [parsed, setParsed] = useState(null);
    const [error, setError] = useState("");
    const [over, setOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const lockOf = (m) => data.locks.find((l) => l.month === m);
    const locked = !!(lockOf(month) && lockOf(month).locked);
    function readFile(file) {
        setError("");
        setParsed(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: "array" });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
                let headerRow = -1, map = {};
                for (let i = 0; i < Math.min(grid.length, 15); i++) {
                    const candidate = mapHeaders(grid[i] || []);
                    if (candidate.code !== undefined && candidate.name !== undefined) {
                        headerRow = i;
                        map = candidate;
                        break;
                    }
                }
                if (headerRow < 0) {
                    setError("머리글 행을 찾지 못했습니다. '거래처코드'와 '거래처명' 열이 있는지 확인하세요.");
                    return;
                }
                const rows = [];
                for (let i = headerRow + 1; i < grid.length; i++) {
                    const raw = grid[i] || [];
                    const pick = (f) => (map[f] === undefined ? "" : raw[map[f]]);
                    const code = String(pick("code") || "").trim();
                    if (!code || /^#REF|^#N\/A/.test(code))
                        continue;
                    rows.push({
                        code,
                        name: String(pick("name") || "").trim(),
                        biz_unit: String(pick("biz_unit") || "").trim(),
                        status: String(pick("status") || "").trim(),
                        owner: String(pick("owner") || "").trim(),
                        balance: pick("balance"),
                        normal_balance: pick("normal_balance"),
                        overdue_balance: pick("overdue_balance"),
                        bad_balance: pick("bad_balance"),
                        advance: pick("advance"),
                        overdue_days: pick("overdue_days"),
                        last_paid_at: String(pick("last_paid_at") || "").trim(),
                        note: String(pick("note") || "").trim(),
                    });
                }
                const seen = new Set(), dupes = [];
                rows.forEach((r) => { if (seen.has(r.code))
                    dupes.push(r.code); seen.add(r.code); });
                setParsed({ filename: file.name, rows, dupes, mapped: Object.keys(map) });
            }
            catch (err) {
                setError("파일을 읽지 못했습니다: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
    async function send() {
        setBusy(true);
        try {
            const res = await api("/api/uploads", {
                method: "POST",
                body: { month, filename: parsed.filename, rows: parsed.rows },
            });
            applyUpload(res);
            notify(res.inserted + "행을 반영했습니다. 기존 " + res.replaced + "행은 교체되었습니다.");
            setParsed(null);
            if (fileRef.current)
                fileRef.current.value = "";
        }
        catch (e) {
            notify(e.message, true);
        }
        setBusy(false);
    }
    async function toggleLock() {
        try {
            await api("/api/locks/" + month, { method: "POST", body: { locked: !locked } });
            notify(locked ? month + " 잠금을 해제했습니다." : month + " 을 마감 잠금했습니다.");
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\uCD9C\uACE0 \uB370\uC774\uD130 \uC5C5\uB85C\uB4DC" },
            React.createElement("div", { className: "formrow" },
                React.createElement(Field, { label: "\uAE30\uC900\uC6D4" },
                    React.createElement("input", { className: "input", type: "month", value: month, onChange: (e) => setMonth(e.target.value) })),
                React.createElement(Field, { label: "\uB9C8\uAC10 \uC0C1\uD0DC" },
                    React.createElement("div", { className: "btnrow", style: { alignItems: "center", minHeight: 38 } },
                        React.createElement("span", { className: "badge badge--" + (locked ? "bad" : "ok") }, locked ? "잠김" : "열림"),
                        can("month_lock") && (React.createElement("button", { className: "btn btn--sm", onClick: toggleLock }, locked ? "잠금 해제" : "마감 잠금"))))),
            React.createElement("div", { className: "dropzone" + (over ? " is-over" : ""), onDragOver: (e) => { e.preventDefault(); setOver(true); }, onDragLeave: () => setOver(false), onDrop: (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0])
                    readFile(e.dataTransfer.files[0]); } },
                React.createElement("p", { style: { margin: "0 0 10px" } }, "\uC5D1\uC140 \uD30C\uC77C\uC744 \uB04C\uC5B4\uB2E4 \uB193\uAC70\uB098 \uC544\uB798\uC5D0\uC11C \uC120\uD0DD\uD558\uC138\uC694."),
                React.createElement("input", { ref: fileRef, type: "file", accept: ".xlsx,.xls,.csv", onChange: (e) => e.target.files[0] && readFile(e.target.files[0]) }),
                React.createElement("p", { className: "t-sm t-muted", style: { margin: "12px 0 0" } }, "\uCCAB \uBC88\uC9F8 \uC2DC\uD2B8\uB97C \uC77D\uC2B5\uB2C8\uB2E4. \uC778\uC2DD\uD558\uB294 \uC5F4: \uAC70\uB798\uCC98\uCF54\uB4DC \u00B7 \uAC70\uB798\uCC98\uBA85 \u00B7 \uC0AC\uC5C5\uBD80 \u00B7 \uCC44\uAD8C\uBD84\uB958 \u00B7 \uB2F4\uB2F9\uC790 \u00B7 \uBBF8\uC218\uC794\uC561 \u00B7 \uC120\uC218\uAE08 \u00B7 \uACBD\uACFC\uC77C \u00B7 \uCD5C\uC885\uC218\uAE08\uC77C \u00B7 \uBE44\uACE0")),
            error && React.createElement("div", { className: "alert alert--bad", style: { marginTop: 12 } }, error),
            locked && (React.createElement("div", { className: "alert alert--warn", style: { marginTop: 12 } },
                month,
                " \uC740 \uB9C8\uAC10 \uC7A0\uAE08 \uC0C1\uD0DC\uB77C \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uAE08\uC744 \uD574\uC81C\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.")),
            parsed && (React.createElement("div", { style: { marginTop: 16 } },
                React.createElement("div", { className: "alert alert--info" },
                    React.createElement("b", null, parsed.filename),
                    " \u2014 \uC720\uD6A8\uD55C ",
                    parsed.rows.length,
                    "\uD589\uC744 \uC77D\uC5C8\uC2B5\uB2C8\uB2E4. \uC778\uC2DD\uD55C \uC5F4: ",
                    parsed.mapped.length,
                    "\uAC1C.",
                    parsed.dupes.length > 0 && " 중복 코드 " + parsed.dupes.length + "건은 마지막 값으로 덮어씁니다."),
                React.createElement("p", { className: "t-sm t-muted" },
                    month,
                    " \uC758 \uAE30\uC874 \uB370\uC774\uD130\uB97C \uC774 \uD30C\uC77C\uB85C \uAD50\uCCB4\uD569\uB2C8\uB2E4. \uB2E4\uB978 \uC6D4 \uB370\uC774\uD130\uB294 \uADF8\uB300\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4."),
                React.createElement("div", { className: "tablewrap", style: { maxHeight: 260, overflowY: "auto", marginBottom: 12 } },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "\uCF54\uB4DC"),
                                React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                                React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                                React.createElement("th", null, "\uBD84\uB958"),
                                React.createElement("th", null, "\uB2F4\uB2F9\uC790"),
                                React.createElement("th", { className: "r" }, "\uBBF8\uC218\uC794\uC561"))),
                        React.createElement("tbody", null, parsed.rows.slice(0, 12).map((r, i) => (React.createElement("tr", { key: i },
                            React.createElement("td", { className: "num" }, r.code),
                            React.createElement("td", null, r.name),
                            React.createElement("td", null, r.biz_unit || "–"),
                            React.createElement("td", null, r.status || "자동판정"),
                            React.createElement("td", null, r.owner || "–"),
                            React.createElement("td", { className: "r num" }, won(r.balance)))))))),
                React.createElement("div", { className: "btnrow" },
                    React.createElement("button", { className: "btn btn--primary", onClick: send, disabled: busy || locked },
                        month,
                        " \uB370\uC774\uD130\uB85C \uBC18\uC601"),
                    React.createElement("button", { className: "btn", onClick: () => setParsed(null) }, "\uCDE8\uC18C"))))),
        React.createElement(Card, { title: "\uC5C5\uB85C\uB4DC \uC774\uB825", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uC77C\uC2DC"),
                            React.createElement("th", null, "\uAE30\uC900\uC6D4"),
                            React.createElement("th", null, "\uD30C\uC77C\uBA85"),
                            React.createElement("th", { className: "r" }, "\uBC18\uC601 \uD589"),
                            React.createElement("th", { className: "r" }, "\uAD50\uCCB4\uB41C \uD589"),
                            React.createElement("th", null, "\uC5C5\uB85C\uB354"),
                            React.createElement("th", null, "\uB9C8\uAC10"))),
                    React.createElement("tbody", null, data.uploads.map((u) => {
                        const l = lockOf(u.month);
                        return (React.createElement("tr", { key: u.id },
                            React.createElement("td", { className: "num t-sm" }, u.uploaded_at),
                            React.createElement("td", { className: "num t-strong" }, u.month),
                            React.createElement("td", null, u.filename),
                            React.createElement("td", { className: "r num" }, u.row_count),
                            React.createElement("td", { className: "r num t-muted" }, u.replaced),
                            React.createElement("td", null, u.uploaded_by),
                            React.createElement("td", null,
                                React.createElement("span", { className: "badge badge--" + (l && l.locked ? "bad" : "mute") }, l && l.locked ? "잠김" : "열림"))));
                    })))))));
}
/* ══════════════════ 계정·권한 관리 ══════════════════ */
function Users({ data, notify, refresh }) {
    const [sel, setSel] = useState(null);
    const [perms, setPerms] = useState([]);
    const [role, setRole] = useState("sales");
    function choose(u) {
        setSel(u.username);
        setPerms(u.permissions || []);
        setRole(u.role);
    }
    function applyTemplate(r) {
        setRole(r);
        setPerms(data.meta.roles[r].perms);
    }
    async function save() {
        try {
            await api("/api/users/" + sel, { method: "PATCH", body: { role, permissions: perms } });
            notify(sel + " 권한을 저장했습니다.");
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function toggleActive(u) {
        try {
            await api("/api/users/" + u.username, { method: "PATCH", body: { active: !u.active } });
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function resetPassword(u) {
        const pw = prompt(u.username + " 의 새 비밀번호 (8자 이상)");
        if (!pw)
            return;
        if (pw.length < 8) {
            notify("8자 이상으로 입력하세요.", true);
            return;
        }
        try {
            await api("/api/users/" + u.username, { method: "PATCH", body: { password: pw } });
            notify("비밀번호를 변경했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\uACC4\uC815", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uC544\uC774\uB514"),
                            React.createElement("th", null, "\uC774\uB984"),
                            React.createElement("th", null, "\uC9C1\uC704"),
                            React.createElement("th", null, "\uC5ED\uD560"),
                            React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                            React.createElement("th", { className: "r" }, "\uAD8C\uD55C \uC218"),
                            React.createElement("th", null, "\uC0C1\uD0DC"),
                            React.createElement("th", null))),
                    React.createElement("tbody", null, data.users.map((u) => (React.createElement("tr", { key: u.username, style: { background: sel === u.username ? "var(--brand-soft)" : undefined } },
                        React.createElement("td", { className: "t-strong" }, u.username),
                        React.createElement("td", null, u.name),
                        React.createElement("td", { className: "t-muted" }, u.title || "–"),
                        React.createElement("td", null,
                            React.createElement("span", { className: "badge badge--brand" }, data.meta.roles[u.role].label)),
                        React.createElement("td", null, u.biz_unit || "–"),
                        React.createElement("td", { className: "r num" },
                            (u.permissions || []).length,
                            " / 11"),
                        React.createElement("td", null,
                            React.createElement("span", { className: "badge badge--" + (u.active ? "ok" : "mute") }, u.active ? "사용" : "정지")),
                        React.createElement("td", { className: "r" },
                            React.createElement("div", { className: "btnrow", style: { justifyContent: "flex-end" } },
                                React.createElement("button", { className: "btn btn--sm", onClick: () => choose(u) }, "\uAD8C\uD55C \uD3B8\uC9D1"),
                                React.createElement("button", { className: "btn btn--sm", onClick: () => resetPassword(u) }, "\uBE44\uBC00\uBC88\uD638"),
                                React.createElement("button", { className: "btn btn--sm", onClick: () => toggleActive(u) }, u.active ? "정지" : "사용")))))))))),
        sel && (React.createElement(Card, { title: sel + " 권한", actions: React.createElement("button", { className: "btn btn--sm btn--primary", onClick: save }, "\uBCC0\uACBD \uC800\uC7A5") },
            React.createElement(Field, { label: "\uC5ED\uD560 \uD15C\uD50C\uB9BF" },
                React.createElement("div", { className: "chiprow" }, Object.entries(data.meta.roles).map(([key, r]) => (React.createElement("button", { key: key, className: "chip", "aria-pressed": role === key, onClick: () => applyTemplate(key) }, r.label))))),
            React.createElement("div", { className: "permgrid", style: { marginTop: 12 } }, data.meta.permissions.map((p) => (React.createElement("label", { key: p.key },
                React.createElement("input", { type: "checkbox", checked: perms.includes(p.key), onChange: (e) => setPerms(e.target.checked
                        ? [...perms, p.key] : perms.filter((x) => x !== p.key)) }),
                p.label))))))));
}
/* ══════════════════ 셸 ══════════════════ */
const SCREENS = [
    { key: "dashboard", label: "대시보드", perm: "dashboard_view", group: "현황" },
    { key: "customers", label: "거래처별 현황", perm: "customer_view", group: "현황" },
    { key: "owners", label: "담당자별 채권현황", perm: "owner_view", group: "현황" },
    { key: "collections", label: "수금 등록", perm: "collection_register", group: "수금", alt: "collection_approve" },
    { key: "targets", label: "수금목표 관리", perm: "target_manage", group: "수금" },
    { key: "upload", label: "출고 데이터 업로드", perm: "upload_data", group: "관리" },
    { key: "users", label: "계정·권한 관리", perm: "user_manage", group: "관리" },
];
function App() {
    const [user, setUser] = useState(undefined);
    const [data, setData] = useState(null);
    const [screen, setScreen] = useState("dashboard");
    const [preset, setPreset] = useState(null);
    const [toast, setToast] = useState(null);
    const notify = useCallback((message, bad) => {
        setToast({ message, bad });
        setTimeout(() => setToast(null), 4000);
    }, []);
    const load = useCallback(async () => {
        const d = await api("/api/bootstrap");
        setData(d);
        setUser(d.user);
    }, []);
    useEffect(() => {
        api("/api/me").then((r) => {
            if (r.user)
                load().catch((e) => notify(e.message, true));
            else
                setUser(null);
        }).catch(() => setUser(null));
    }, [load, notify]);
    const can = useCallback((perm) => !!(user && user.permissions.includes(perm)), [user]);
    const visible = useMemo(() => SCREENS.filter((s) => can(s.perm) || (s.alt && can(s.alt))), [can]);
    useEffect(() => {
        if (visible.length && !visible.some((s) => s.key === screen))
            setScreen(visible[0].key);
    }, [visible, screen]);
    if (user === undefined) {
        return React.createElement("div", { className: "boot" },
            React.createElement("div", { className: "boot__mark" }, "MP"),
            React.createElement("p", { className: "boot__text" }, "\uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4."));
    }
    if (user === null)
        return React.createElement(Login, { onDone: () => load() });
    if (!data)
        return React.createElement("div", { className: "boot" },
            React.createElement("div", { className: "boot__mark" }, "MP"),
            React.createElement("p", { className: "boot__text" }, "\uB370\uC774\uD130\uB97C \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4."));
    const patchCustomer = (c) => setData((d) => ({
        ...d, customers: d.customers.map((x) => (x.code === c.code ? c : x)),
    }));
    const applyUpload = (res) => setData((d) => ({
        ...d, customers: res.customers, uploads: res.uploads,
    }));
    const current = SCREENS.find((s) => s.key === screen) || SCREENS[0];
    const groups = [...new Set(visible.map((s) => s.group))];
    const pendingCount = data.collections.filter((c) => c.state === "pending").length;
    async function signOut() {
        await api("/api/logout", { method: "POST" });
        setUser(null);
        setData(null);
    }
    return (React.createElement("div", { className: "shell" },
        React.createElement("nav", { className: "side" },
            React.createElement("div", { className: "side__top" },
                React.createElement("div", { className: "side__logo" },
                    React.createElement("span", null, "MP"),
                    "\uBBF8\uC218\uCC44\uAD8C \uAD00\uB9AC")),
            React.createElement("div", { className: "side__nav" }, groups.map((g) => (React.createElement("div", { key: g },
                React.createElement("div", { className: "side__group" }, g),
                visible.filter((s) => s.group === g).map((s) => (React.createElement("button", { key: s.key, className: "side__item", "aria-current": screen === s.key, onClick: () => { setPreset(null); setScreen(s.key); } },
                    s.label,
                    s.key === "collections" && pendingCount > 0 && React.createElement("small", null, pendingCount)))))))),
            React.createElement("div", { className: "side__foot" },
                "\uAE30\uC900\uC77C ",
                data.meta.today)),
        React.createElement("main", { className: "main" },
            React.createElement("header", { className: "topbar" },
                React.createElement("div", null,
                    React.createElement("h1", null, current.label),
                    React.createElement("div", { className: "sub" },
                        "\uAC70\uB798\uCC98 ",
                        data.customers.length,
                        "\uACF3 \u00B7 \uBBF8\uC218 \uD569\uACC4 ",
                        won(sum(data.customers, "balance")),
                        "\uC6D0")),
                React.createElement("div", { className: "spacer" }),
                React.createElement("div", { className: "who" },
                    React.createElement("b", null,
                        user.name,
                        user.title && " " + user.title),
                    React.createElement("span", null,
                        data.meta.roles[user.role].label,
                        " \u00B7 ",
                        user.username)),
                React.createElement("button", { className: "btn btn--sm", onClick: signOut }, "\uB85C\uADF8\uC544\uC6C3")),
            React.createElement("div", { className: "page" },
                screen === "dashboard" && React.createElement(Dashboard, { data: data, setScreen: setScreen, setPreset: setPreset }),
                screen === "customers" && React.createElement(Customers, { data: data, can: can, preset: preset, notify: notify, patchCustomer: patchCustomer }),
                screen === "owners" && React.createElement(Owners, { data: data }),
                screen === "collections" && React.createElement(Collections, { data: data, can: can, notify: notify, refresh: load }),
                screen === "targets" && React.createElement(Targets, { data: data, notify: notify, refresh: load }),
                screen === "upload" && React.createElement(Upload, { data: data, can: can, notify: notify, applyUpload: applyUpload, refresh: load }),
                screen === "users" && React.createElement(Users, { data: data, notify: notify, refresh: load }))),
        toast && React.createElement("div", { className: "toast" + (toast.bad ? " toast--bad" : "") }, toast.message)));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
