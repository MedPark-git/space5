const { useState, useEffect, useMemo, useRef, useCallback } = React;
/* ══════════════════ 유틸 ══════════════════ */
const won = (n) => (Number(n) || 0).toLocaleString("ko-KR");
const amountNumber = (value) => Number(String(value || "").replace(/[^0-9]/g, "")) || 0;
const formatAmountInput = (value) => {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    return digits ? Number(digits).toLocaleString("ko-KR") : "";
};
function koreanAmountUnit(value) {
    let amount = amountNumber(value);
    if (!amount)
        return "";
    const parts = [];
    const eok = Math.floor(amount / 100000000);
    if (eok) {
        parts.push(won(eok) + "억");
        amount %= 100000000;
    }
    const man = Math.floor(amount / 10000);
    if (man) {
        parts.push(won(man) + "만");
        amount %= 10000;
    }
    if (amount)
        parts.push(won(amount));
    return parts.join(" ") + "원";
}
function short(n) {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1e8)
        return { value: (v / 1e8).toFixed(1), unit: "억" };
    if (Math.abs(v) >= 1e4)
        return { value: Math.round(v / 1e4).toLocaleString("ko-KR"), unit: "만" };
    return { value: v.toLocaleString("ko-KR"), unit: "원" };
}
const STATUS_STYLE = { 정상: "ok", 연체: "warn", 부실: "bad", 선수금: "brand" };
const STATUS_LABEL = { 정상: "정상채권", 연체: "미수채권", 부실: "부실채권", 선수금: "선수금" };
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const sum = (list, key) => list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
function customerForUnit(customer, unit) {
    if (unit === "전체")
        return customer;
    const part = customer.unit_breakdown && customer.unit_breakdown[unit];
    if (!part)
        return customer.biz_unit === unit && Number(customer.advance) > 0 ? customer : null;
    return {
        ...customer, ...part, biz_unit: unit,
        status: Number(part.bad_balance) ? "부실" : Number(part.overdue_balance) ? "연체" : "정상",
    };
}
function customersForUnit(customers, unit) {
    return unit === "전체" ? customers : customers.map((c) => customerForUnit(c, unit)).filter(Boolean);
}
const code5 = (code) => String(code || "").padStart(5, "0");
const normalizeSearch = (value) => String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "");
const overdueMonths = (days) => Math.ceil(Math.max(0, Number(days) || 0) / 30);
function normalizeShipmentDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime()))
        return value.toISOString().slice(0, 10);
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed)
            return [parsed.y, String(parsed.m).padStart(2, "0"), String(parsed.d).padStart(2, "0")].join("-");
    }
    const text = String(value || "").trim();
    if (!text)
        return "";
    const digits = text.replace(/[^0-9]/g, "");
    if (digits.length === 8)
        return digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6, 8);
    const match = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    return match ? match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0") : "";
}
function parseUploadAmount(value) {
    const text = String(value !== null && value !== void 0 ? value : "").trim();
    if (!text || text === "-" || text === "—")
        return 0;
    const wrappedNegative = /^\(.*\)$/.test(text);
    const normalized = text.replace(/[,\s원₩()]/g, "");
    const amount = Number(normalized);
    if (!Number.isFinite(amount))
        return 0;
    return wrappedNegative ? -amount : amount;
}
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
    return React.createElement("span", { className: "badge badge--" + (STATUS_STYLE[status] || "mute") }, STATUS_LABEL[status] || status);
}
function Field({ label, children }) {
    return React.createElement("div", { className: "field" },
        React.createElement("label", null, label),
        children);
}
function ChangePassword({ user, onClose, notify }) {
    const [form, setForm] = useState({ current: "", password: "", confirm: "" });
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
    async function submit(e) {
        e.preventDefault();
        if (!form.current) {
            notify("현재 비밀번호를 입력하세요.", true);
            return;
        }
        if (form.password.length < 8) {
            notify("새 비밀번호는 8자 이상이어야 합니다.", true);
            return;
        }
        if (form.password !== form.confirm) {
            notify("새 비밀번호 확인이 일치하지 않습니다.", true);
            return;
        }
        if (form.current === form.password) {
            notify("현재 비밀번호와 다른 비밀번호를 입력하세요.", true);
            return;
        }
        setBusy(true);
        try {
            await api("/api/password", { method: "POST", body: { current: form.current, password: form.password } });
            notify("비밀번호를 변경했습니다.");
            onClose();
        }
        catch (e) {
            notify(e.message, true);
        }
        setBusy(false);
    }
    return React.createElement("div", { className: "modal-backdrop", onMouseDown: onClose },
        React.createElement("section", { className: "modal-card password-modal", onMouseDown: (e) => e.stopPropagation() },
            React.createElement("header", { className: "card__head" },
                React.createElement("h3", null, "\uB0B4 \uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD"),
                React.createElement("div", { className: "spacer" }),
                React.createElement("button", { className: "btn btn--sm", onClick: onClose }, "\uB2EB\uAE30")),
            React.createElement("form", { className: "card__body", onSubmit: submit },
                React.createElement(Field, { label: "\uC544\uC774\uB514" },
                    React.createElement("input", { className: "input", value: user.username, readOnly: true, disabled: true })),
                React.createElement(Field, { label: "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638" },
                    React.createElement("input", { className: "input", type: "password", autoComplete: "current-password", value: form.current, onChange: set("current"), autoFocus: true })),
                React.createElement(Field, { label: "\uC0C8 \uBE44\uBC00\uBC88\uD638" },
                    React.createElement("input", { className: "input", type: "password", autoComplete: "new-password", value: form.password, onChange: set("password"), placeholder: "8\uC790 \uC774\uC0C1" })),
                React.createElement(Field, { label: "\uC0C8 \uBE44\uBC00\uBC88\uD638 \uD655\uC778" },
                    React.createElement("input", { className: "input", type: "password", autoComplete: "new-password", value: form.confirm, onChange: set("confirm") })),
                React.createElement("button", { className: "btn btn--primary", type: "submit", disabled: busy }, busy ? "변경 중" : "비밀번호 변경"))));
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
        var _a, _b;
        const loginUsername = (((_a = usernameRef.current) === null || _a === void 0 ? void 0 : _a.value) || username).trim();
        const loginPassword = ((_b = passwordRef.current) === null || _b === void 0 ? void 0 : _b.value) || password;
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
    const { collections, targets } = data;
    const customers = data.customers;
    const [unit, setUnit] = useState("전체");
    const [normalTopUnit, setNormalTopUnit] = useState("전체");
    const [overdueTopUnit, setOverdueTopUnit] = useState("전체");
    const scoped = useMemo(() => customersForUnit(customers, unit), [customers, unit]);
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
        const rows = customersForUnit(customers, u);
        const g = { unit: u, 정상: 0, 연체: 0, 부실: 0, count: rows.length };
        rows.forEach((c) => {
            g.정상 += Number(c.normal_balance) || 0;
            g.연체 += Number(c.overdue_balance) || 0;
            g.부실 += Number(c.bad_balance) || 0;
        });
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
    const normalTop5 = customersForUnit(customers, normalTopUnit)
        .filter((c) => c.normal_balance > 0)
        .sort((a, b) => b.normal_balance - a.normal_balance).slice(0, 5);
    const overdueTop5 = customersForUnit(customers, overdueTopUnit)
        .filter((c) => c.overdue_balance > 0)
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
    // 정오 UTC를 기준으로 계산하면 한국 브라우저에서도 날짜가 하루 더 밀리지 않는다.
    const yesterdayDate = new Date(data.meta.today + "T12:00:00Z");
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);
    const customerUnit = Object.fromEntries(customers.map((c) => [c.code, c.biz_unit]));
    const yesterdayCollections = approved.filter((c) => c.paid_at === yesterday);
    const yesterdayCustomers = Object.values(yesterdayCollections.reduce((map, c) => {
        const key = c.customer_code || c.customer_name;
        if (!map[key])
            map[key] = { name: c.customer_name || key, amount: 0 };
        map[key].amount += Number(c.amount) || 0;
        return map;
    }, {})).sort((a, b) => b.amount - a.amount);
    const yesterdayByUnit = data.meta.units.map((u) => ({
        unit: u,
        amount: sum(yesterdayCollections.filter((c) => customerUnit[c.customer_code] === u), "amount"),
    }));
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
        React.createElement(Card, { title: "전일 수금현황 요약 · " + yesterday },
            React.createElement("div", { className: "grid grid--3" },
                React.createElement("div", null,
                    React.createElement("div", { className: "kpi__label" }, "\uC2B9\uC778 \uC218\uAE08 \uD569\uACC4"),
                    React.createElement("div", { className: "kpi__value num" },
                        won(sum(yesterdayCollections, "amount")),
                        React.createElement("em", null, "\uC6D0"))),
                React.createElement("div", null,
                    React.createElement("div", { className: "kpi__label" }, "\uC2B9\uC778 \uAC74\uC218"),
                    React.createElement("div", { className: "kpi__value num" },
                        yesterdayCollections.length,
                        React.createElement("em", null, "\uAC74")),
                    React.createElement("div", { className: "t-sm t-muted", style: { marginTop: 4 } }, yesterdayCustomers.length ? React.createElement(React.Fragment, null,
                        yesterdayCustomers.slice(0, 3).map((c) => c.name).join(" · "),
                        yesterdayCustomers.length > 3 ? " 외 " + (yesterdayCustomers.length - 3) + "개처" : "") : "수금 내역 없음")),
                React.createElement("div", null,
                    React.createElement("div", { className: "kpi__label" }, "\uC0AC\uC5C5\uBD80\uBCC4 \uC218\uAE08"),
                    React.createElement("div", { className: "t-sm" }, yesterdayByUnit.map((r) => React.createElement("span", { key: r.unit, style: { display: "block", marginTop: 3 } },
                        r.unit,
                        " \u00B7 ",
                        React.createElement("b", { className: "num" },
                            won(r.amount),
                            "\uC6D0"))))))),
        React.createElement("div", { className: "grid grid--2" },
            React.createElement(Card, { title: "\uC0AC\uC5C5\uBD80\uBCC4 \uCC44\uAD8C \uBD84\uB958 \uD604\uD669", actions: React.createElement("div", { className: "legend" },
                    React.createElement("span", null,
                        React.createElement("i", { style: { background: "var(--ok)" } }),
                        "\uC815\uC0C1\uCC44\uAD8C"),
                    React.createElement("span", null,
                        React.createElement("i", { style: { background: "var(--warn)" } }),
                        "\uBBF8\uC218\uCC44\uAD8C"),
                    React.createElement("span", null,
                        React.createElement("i", { style: { background: "var(--bad)" } }),
                        "\uBD80\uC2E4\uCC44\uAD8C")) },
                React.createElement("div", { className: "signal" }, byUnit.map((g) => (React.createElement("div", { className: "signal__row", key: g.unit },
                    React.createElement("div", { className: "signal__unit" }, g.unit),
                    React.createElement("div", { className: "signal__bar", style: { width: (Math.max(8, (g.total / maxUnit) * 100)) + "%" } }, ["정상", "연체", "부실"].map((s) => g[s] > 0 && (React.createElement("button", { key: s, className: "signal__seg signal__seg--" + STATUS_STYLE[s], style: { width: (g[s] / g.total) * 100 + "%" }, title: g.unit + " " + STATUS_LABEL[s] + " " + won(g[s]) + "원", onClick: () => { setPreset({ status: s, unit: g.unit }); setScreen("customers"); } })))),
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
            React.createElement(Card, { title: "\uC815\uC0C1\uCC44\uAD8C TOP 5", actions: topUnitSelect(normalTopUnit, setNormalTopUnit, "정상채권 사업부 선택"), flush: true },
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", null,
                        React.createElement("tbody", null,
                            normalTop5.map((c, i) => (React.createElement("tr", { key: c.code },
                                React.createElement("td", { className: "t-muted num", style: { width: 26 } }, i + 1),
                                React.createElement("td", { className: "t-strong" }, c.name),
                                React.createElement("td", null,
                                    React.createElement(Badge, { status: "\uC815\uC0C1" })),
                                React.createElement("td", { className: "r num" }, won(c.normal_balance))))),
                            normalTop5.length === 0 && React.createElement("tr", null,
                                React.createElement("td", { className: "t-muted" }, "\uC815\uC0C1\uCC44\uAD8C \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")))))),
            React.createElement(Card, { title: "\uBBF8\uC218\uCC44\uAD8C TOP 5", actions: topUnitSelect(overdueTopUnit, setOverdueTopUnit, "미수채권 사업부 선택"), flush: true },
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", null,
                        React.createElement("tbody", null,
                            overdueTop5.map((c, i) => (React.createElement("tr", { key: c.code },
                                React.createElement("td", { className: "t-muted num", style: { width: 26 } }, i + 1),
                                React.createElement("td", { className: "t-strong" }, c.name),
                                React.createElement("td", { className: "num t-sm t-muted" },
                                    overdueMonths(c.overdue_days),
                                    "\uAC1C\uC6D4"),
                                React.createElement("td", { className: "r num" }, won(c.overdue_balance))))),
                            overdueTop5.length === 0 && (React.createElement("tr", null,
                                React.createElement("td", { className: "t-muted" }, "\uBBF8\uC218\uCC44\uAD8C \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")))))))),
        React.createElement(Card, { title: "\uB2F4\uB2F9\uC790\uBCC4 \uCC44\uAD8C \uD604\uD669", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uB2F4\uB2F9\uC790"),
                            React.createElement("th", { className: "r" }, "\uAC70\uB798\uCC98"),
                            React.createElement("th", { className: "r" }, "\uC815\uC0C1\uCC44\uAD8C"),
                            React.createElement("th", { className: "r" }, "\uBBF8\uC218\uCC44\uAD8C"),
                            React.createElement("th", { className: "r" }, "\uBD80\uC2E4\uCC44\uAD8C"),
                            React.createElement("th", { className: "r" }, "\uD569\uACC4"),
                            React.createElement("th", { style: { width: 150 } }, "\uBBF8\uC218\u00B7\uBD80\uC2E4\uCC44\uAD8C \uBE44\uC911"))),
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
/* ══════════════════ 채권요약현황 ══════════════════ */
function BondSummary({ data, notify }) {
    const reportRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const unitNames = { 덴탈: "국내덴탈", 메디컬: "국내메디컬", 에스테틱: "국내에스테틱" };
    const units = data.meta.units;
    function liveNormal(c) {
        const source = {
            later: Number(c.normal_later_balance) || 0,
            next: Number(c.normal_next_balance) || 0,
            current: Number(c.normal_current_balance) || 0,
        };
        let paid = Math.max(0, source.later + source.next + source.current - (Number(c.normal_balance) || 0));
        const current = Math.max(0, source.current - paid);
        paid = Math.max(0, paid - source.current);
        const next = Math.max(0, source.next - paid);
        paid = Math.max(0, paid - source.next);
        const later = Math.max(0, source.later - paid);
        return { later, next, current };
    }
    const summary = useMemo(() => units.map((unit) => {
        const customers = customersForUnit(data.customers, unit);
        const row = { unit, later: 0, next: 0, current: 0, overdue: 0, bad: 0,
            normalCollected: 0, overdueCollected: 0 };
        customers.forEach((c) => {
            const live = liveNormal(c);
            row.later += live.later;
            row.next += live.next;
            row.current += live.current;
            row.overdue += Number(c.overdue_balance) || 0;
            row.bad += Number(c.bad_balance) || 0;
            const normalSource = (Number(c.normal_later_balance) || 0)
                + (Number(c.normal_next_balance) || 0) + (Number(c.normal_current_balance) || 0);
            row.normalCollected += (Number(c.normal_collected) || 0)
                + Math.max(0, normalSource - (Number(c.normal_balance) || 0));
            row.overdueCollected += (Number(c.overdue_collected) || 0)
                + Math.max(0, (Number(c.overdue_source_balance) || 0) - (Number(c.overdue_balance) || 0));
        });
        row.normal = row.later + row.next + row.current;
        row.total = row.normal + row.overdue + row.bad;
        return row;
    }), [data.customers, units]);
    const total = (key) => sum(summary, key);
    const rate = (value, base) => base ? (value / base * 100).toFixed(1) + "%" : "0.0%";
    const sourceMonth = (data.uploads[0] && data.uploads[0].month) || thisMonth();
    const reportDate = data.meta.today || today();
    const reportMonth = Number(reportDate.slice(5, 7));
    const reportDay = Number(reportDate.slice(8, 10));
    async function exportReport(kind) {
        setExporting(true);
        try {
            if (!window.html2canvas)
                throw new Error("이미지 변환 모듈을 불러오지 못했습니다.");
            const canvas = await window.html2canvas(reportRef.current, {
                scale: 2, backgroundColor: "#eef1f6", useCORS: true,
            });
            const base = "채권요약현황_" + data.meta.today;
            if (kind === "png") {
                const link = document.createElement("a");
                link.download = base + ".png";
                link.href = canvas.toDataURL("image/png");
                link.click();
            }
            else {
                if (!window.PptxGenJS)
                    throw new Error("PPT 변환 모듈을 불러오지 못했습니다.");
                const pptx = new window.PptxGenJS();
                pptx.layout = "LAYOUT_WIDE";
                pptx.author = "MEDPARK";
                const slide = pptx.addSlide();
                slide.background = { color: "EEF1F6" };
                slide.addText("㈜메드파크 채권요약현황", { x: .35, y: .12, w: 8, h: .34,
                    fontFace: "Pretendard", fontSize: 17, bold: true, color: "16202E" });
                slide.addText("기준일 " + data.meta.today, { x: 10.2, y: .18, w: 2.75, h: .22,
                    align: "right", fontFace: "Pretendard", fontSize: 9, color: "5C6B80" });
                const ratio = Math.min(12.65 / canvas.width, 6.8 / canvas.height);
                slide.addImage({ data: canvas.toDataURL("image/png"), x: .34, y: .52,
                    w: canvas.width * ratio, h: canvas.height * ratio });
                await pptx.writeFile({ fileName: base + ".pptx" });
            }
            notify((kind === "png" ? "그림파일" : "PPT") + " 다운로드를 시작했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
        finally {
            setExporting(false);
        }
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "export-actions" },
            React.createElement("span", { className: "t-muted t-sm" }, "\uACB0\uC0B0\uD68C\uC758\uC6A9 \uB2E4\uC6B4\uB85C\uB4DC"),
            React.createElement("button", { className: "btn btn--sm", disabled: exporting, onClick: () => exportReport("png") }, "\uADF8\uB9BC\uD30C\uC77C(PNG)"),
            React.createElement("button", { className: "btn btn--sm btn--primary", disabled: exporting, onClick: () => exportReport("pptx") }, "PPT")),
        React.createElement("div", { ref: reportRef, className: "summary-export" },
            React.createElement(Card, { title: "1. 사업부별 채권 분류 현황 (" + reportDate + " 기준)", flush: true },
                React.createElement("div", { className: "tablewrap summary-table" },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", { rowSpan: "2" }, "\uC0AC\uC5C5\uBD80"),
                                React.createElement("th", { colSpan: "4", className: "summary-head summary-head--normal" }, "\uC815\uC0C1\uCC44\uAD8C"),
                                React.createElement("th", { rowSpan: "2", className: "summary-head summary-head--overdue" }, "\uBBF8\uC218\uCC44\uAD8C"),
                                React.createElement("th", { rowSpan: "2", className: "summary-head summary-head--bad" }, "\uBD80\uC2E4\uCC44\uAD8C"),
                                React.createElement("th", { rowSpan: "2", className: "summary-head summary-head--total" }, "\uD569\uACC4"),
                                React.createElement("th", { rowSpan: "2", className: "summary-head summary-head--total" }, "\uBBF8\uC218\uCC44\uAD8C \uBE44\uC911")),
                            React.createElement("tr", null,
                                React.createElement("th", null, "10\uC6D4 \uC774\uD6C4"),
                                React.createElement("th", null, "9\uC6D4 \uBD84"),
                                React.createElement("th", null, "8\uC6D4 \uBD84(\uB2F9\uC6D4)"),
                                React.createElement("th", null, "[\uC18C\uACC4]"))),
                        React.createElement("tbody", null, summary.map((r) => (React.createElement("tr", { key: r.unit },
                            React.createElement("td", { className: "t-strong" }, unitNames[r.unit]),
                            React.createElement("td", { className: "r num summary-normal" }, won(r.later)),
                            React.createElement("td", { className: "r num summary-normal" }, won(r.next)),
                            React.createElement("td", { className: "r num summary-normal" }, won(r.current)),
                            React.createElement("td", { className: "r num summary-subtotal" }, won(r.normal)),
                            React.createElement("td", { className: "r num summary-overdue" }, won(r.overdue)),
                            React.createElement("td", { className: "r num summary-bad" }, won(r.bad)),
                            React.createElement("td", { className: "r num t-strong" }, won(r.total)),
                            React.createElement("td", { className: "r num t-strong" }, rate(r.overdue, r.total)))))),
                        React.createElement("tfoot", null,
                            React.createElement("tr", null,
                                React.createElement("td", null, "\uD569\uACC4"),
                                React.createElement("td", { className: "r num" }, won(total("later"))),
                                React.createElement("td", { className: "r num" }, won(total("next"))),
                                React.createElement("td", { className: "r num" }, won(total("current"))),
                                React.createElement("td", { className: "r num summary-subtotal" }, won(total("normal"))),
                                React.createElement("td", { className: "r num summary-overdue" }, won(total("overdue"))),
                                React.createElement("td", { className: "r num" }, won(total("bad"))),
                                React.createElement("td", { className: "r num" }, won(total("total"))),
                                React.createElement("td", { className: "r num" }, rate(total("overdue"), total("total"))))))),
                React.createElement("div", { className: "summary-note", "data-html2canvas-ignore": "true" },
                    "\uD604\uC7AC \uC6B4\uC601 \uAE30\uCD08\uC790\uB8CC ",
                    data.customers.length,
                    "\uAC1C \uAC70\uB798\uCC98 \uAE30\uC900 \u00B7 \uAE08\uC561 \uB2E8\uC704: \uC6D0")),
            React.createElement(Card, { title: "2. " + reportMonth + "월 수금실적 (" + reportMonth + "월 1일 기초 대비, "
                    + reportMonth + "월 " + reportDay + "일 누계)", flush: true },
                React.createElement("div", { className: "tablewrap summary-table" },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", { rowSpan: "2" }, "\uC0AC\uC5C5\uBD80"),
                                React.createElement("th", { colSpan: "4", className: "summary-head summary-head--normal" }, "\uC815\uC0C1\uCC44\uAD8C (\uB2F9\uC6D4\uBD84)"),
                                React.createElement("th", { colSpan: "4", className: "summary-head summary-head--overdue" }, "\uBBF8\uC218\uCC44\uAD8C (\uBD80\uC2E4\uCC44\uAD8C \uC81C\uC678)")),
                            React.createElement("tr", null,
                                React.createElement("th", null, "\uAE30\uCD08"),
                                React.createElement("th", null, "\uC218\uAE08\uC561"),
                                React.createElement("th", null, "\uC794\uC561"),
                                React.createElement("th", null, "\uD68C\uC218\uC728"),
                                React.createElement("th", null, "\uAE30\uCD08"),
                                React.createElement("th", null, "\uC218\uAE08\uC561"),
                                React.createElement("th", null, "\uC794\uC561"),
                                React.createElement("th", null, "\uD68C\uC218\uC728"))),
                        React.createElement("tbody", null, summary.map((r) => {
                            const normalOpening = r.current + r.normalCollected;
                            const overdueOpening = r.overdue + r.overdueCollected;
                            return React.createElement("tr", { key: r.unit },
                                React.createElement("td", { className: "t-strong" }, unitNames[r.unit]),
                                React.createElement("td", { className: "r num" }, won(normalOpening)),
                                React.createElement("td", { className: "r num summary-normal" }, won(r.normalCollected)),
                                React.createElement("td", { className: "r num summary-subtotal" }, won(r.current)),
                                React.createElement("td", { className: "r num t-strong" }, rate(r.normalCollected, normalOpening)),
                                React.createElement("td", { className: "r num" }, won(overdueOpening)),
                                React.createElement("td", { className: "r num summary-overdue" }, won(r.overdueCollected)),
                                React.createElement("td", { className: "r num summary-subtotal" }, won(r.overdue)),
                                React.createElement("td", { className: "r num t-strong" }, rate(r.overdueCollected, overdueOpening)));
                        })),
                        React.createElement("tfoot", null,
                            React.createElement("tr", null,
                                React.createElement("td", null, "\uD569\uACC4"),
                                React.createElement("td", { className: "r num" }, won(total("current") + total("normalCollected"))),
                                React.createElement("td", { className: "r num" }, won(total("normalCollected"))),
                                React.createElement("td", { className: "r num" }, won(total("current"))),
                                React.createElement("td", { className: "r num" }, rate(total("normalCollected"), total("current") + total("normalCollected"))),
                                React.createElement("td", { className: "r num" }, won(total("overdue") + total("overdueCollected"))),
                                React.createElement("td", { className: "r num" }, won(total("overdueCollected"))),
                                React.createElement("td", { className: "r num" }, won(total("overdue"))),
                                React.createElement("td", { className: "r num" }, rate(total("overdueCollected"), total("overdue") + total("overdueCollected")))))))))));
}
/* ═══════════════ 결산회의용 부서별 미수채권현황 ═══════════════ */
function ClosingReceivables({ data, notify }) {
    const [unit, setUnit] = useState("전체");
    const reportRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const unitNames = { 덴탈: "국내덴탈", 메디컬: "국내메디컬", 에스테틱: "국내에스테틱" };
    const units = unit === "전체" ? data.meta.units : [unit];
    const reports = useMemo(() => units.map((bizUnit) => {
        const customers = customersForUnit(data.customers, bizUnit);
        const rawDetail = customers.flatMap((c) => {
            const notes = [c.note, ...(c.detail_notes || [])].filter(Boolean);
            return [{ ...c, category: "미수채권", amount: Number(c.overdue_balance) || 0,
                    months: overdueMonths(c.overdue_days), notes }].filter((row) => row.amount > 0);
        }).sort((a, b) => b.amount - a.amount);
        let detail = rawDetail;
        if (bizUnit === "에스테틱") {
            const small = rawDetail.filter((row) => row.amount <= 110000);
            const regular = rawDetail.filter((row) => row.amount > 110000);
            if (small.length) {
                const representative = small[0];
                detail = [...regular, {
                        ...representative,
                        code: "esthetic-small-group",
                        name: representative.name + (small.length > 1 ? " 외 " + (small.length - 1) + "개처" : ""),
                        amount: sum(small, "amount"),
                        period: null,
                        months: Math.max(...small.map((row) => row.months)),
                        notes: [...new Set(small.flatMap((row) => row.notes))],
                        grouped: true,
                    }];
            }
        }
        const overdueBalance = sum(customers, "overdue_balance");
        const overdueCollected = sum(customers, "overdue_collected");
        const overdueOpening = overdueBalance + overdueCollected;
        const normalBalance = sum(customers, "normal_balance");
        const normalCollected = sum(customers, "normal_collected");
        return { unit: bizUnit, customers, detail, overdueBalance, overdueCollected,
            overdueOpening, normalBalance, normalCollected, normalOpening: normalBalance + normalCollected };
    }).filter((report) => report.overdueBalance > 0), [data.customers, units.join("|")]);
    const rate = (paid, opening) => opening ? (paid / opening * 100).toFixed(1) + "%" : "0.0%";
    async function exportReport(kind) {
        setExporting(true);
        try {
            if (!window.html2canvas)
                throw new Error("이미지 변환 모듈을 불러오지 못했습니다.");
            const canvas = await window.html2canvas(reportRef.current, { scale: 2, backgroundColor: "#eef1f6", useCORS: true });
            const base = "결산회의_부서별_미수채권현황_" + data.meta.today;
            if (kind === "png") {
                const link = document.createElement("a");
                link.download = base + ".png";
                link.href = canvas.toDataURL("image/png");
                link.click();
            }
            else {
                if (!window.PptxGenJS)
                    throw new Error("PPT 변환 모듈을 불러오지 못했습니다.");
                const pptx = new window.PptxGenJS();
                pptx.layout = "LAYOUT_WIDE";
                pptx.author = "MEDPARK";
                const pageHeight = Math.floor(canvas.width * 6.75 / 12.65);
                const reportBox = reportRef.current.getBoundingClientRect();
                const scaleY = canvas.height / reportBox.height;
                const rowCuts = [...reportRef.current.querySelectorAll(".closing-detail tbody tr, .closing-detail tfoot tr")].map((row) => Math.min(canvas.height, Math.round((row.getBoundingClientRect().bottom - reportBox.top) * scaleY) + 2)).sort((a, b) => a - b);
                let top = 0;
                while (top < canvas.height) {
                    const desiredBottom = Math.min(canvas.height, top + pageHeight);
                    const safeCuts = rowCuts.filter((cut) => cut > top + 80 && cut <= desiredBottom);
                    const bottom = desiredBottom === canvas.height ? canvas.height
                        : (safeCuts.length ? safeCuts[safeCuts.length - 1] : desiredBottom);
                    const slice = document.createElement("canvas");
                    slice.width = canvas.width;
                    slice.height = bottom - top;
                    slice.getContext("2d").drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
                    const slide = pptx.addSlide();
                    slide.background = { color: "EEF1F6" };
                    slide.addText("㈜메드파크 결산회의용 부서별 미수채권현황", { x: .35, y: .1, w: 9, h: .3,
                        fontFace: "Pretendard", fontSize: 16, bold: true, color: "16202E" });
                    slide.addText("기준일 " + data.meta.today, { x: 10.2, y: .15, w: 2.75, h: .2, align: "right", fontSize: 9, color: "5C6B80" });
                    slide.addImage({ data: slice.toDataURL("image/png"), x: .34, y: .48, w: 12.65,
                        h: 12.65 * slice.height / slice.width });
                    top = bottom;
                }
                await pptx.writeFile({ fileName: base + ".pptx" });
            }
            notify((kind === "png" ? "그림파일" : "PPT") + " 다운로드를 시작했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
        finally {
            setExporting(false);
        }
    }
    return React.createElement(React.Fragment, null,
        React.createElement("div", { className: "closing-toolbar" },
            React.createElement(Field, { label: "\uC0AC\uC5C5\uBD80" },
                React.createElement("select", { className: "select", value: unit, onChange: (e) => setUnit(e.target.value) },
                    React.createElement("option", null, "\uC804\uCCB4"),
                    data.meta.units.map((u) => React.createElement("option", { key: u }, u)))),
            React.createElement("div", { className: "spacer" }),
            React.createElement("span", { className: "t-muted t-sm" }, "\uACB0\uC0B0\uD68C\uC758\uC6A9 \uB2E4\uC6B4\uB85C\uB4DC"),
            React.createElement("button", { className: "btn btn--sm", disabled: exporting, onClick: () => exportReport("png") }, "\uADF8\uB9BC\uD30C\uC77C(PNG)"),
            React.createElement("button", { className: "btn btn--sm btn--primary", disabled: exporting, onClick: () => exportReport("pptx") }, "PPT")),
        React.createElement("div", { ref: reportRef, className: "closing-report" },
            reports.length === 0 && React.createElement(Card, null,
                React.createElement("div", { className: "zero-result" }, "\uC870\uD68C \uB300\uC0C1 \uCC44\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.")),
            reports.map((report) => React.createElement(Card, { key: report.unit, title: (unitNames[report.unit] || report.unit) + " · 미수채권현황", flush: true },
                React.createElement("div", { className: "closing-meta" },
                    "\uAE30\uC900\uC77C ",
                    data.meta.today,
                    " \u00B7 \uC794\uC561\uC774 \uC788\uB294 \uCC44\uAD8C\uB9CC \uD45C\uC2DC"),
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", { className: "closing-summary" },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "\uAD6C\uBD84"),
                                React.createElement("th", { className: "r" }, "\uAE30\uCD08"),
                                React.createElement("th", { className: "r" }, "\uC218\uAE08\uC561"),
                                React.createElement("th", { className: "r" }, "\uC794\uC561"),
                                React.createElement("th", { className: "r" }, "\uD68C\uC218\uC728"),
                                React.createElement("th", null, "\uC8FC\uC694\uC0AC\uD56D"))),
                        React.createElement("tbody", null,
                            React.createElement("tr", { className: "closing-summary--overdue" },
                                React.createElement("td", null, "\uBBF8\uC218\uCC44\uAD8C"),
                                React.createElement("td", { className: "r num" }, won(report.overdueOpening)),
                                React.createElement("td", { className: "r num" }, won(report.overdueCollected)),
                                React.createElement("td", { className: "r num t-strong" }, won(report.overdueBalance)),
                                React.createElement("td", { className: "r num" }, rate(report.overdueCollected, report.overdueOpening)),
                                React.createElement("td", null,
                                    report.detail.filter((x) => x.notes.length).length,
                                    "\uAC1C \uAC70\uB798\uCC98 \uD2B9\uC774\uC0AC\uD56D \uB4F1\uB85D")),
                            report.normalOpening > 0 && React.createElement("tr", null,
                                React.createElement("td", null, "\uC815\uC0C1\uCC44\uAD8C (\uC218\uAE08 \uB300\uC0C1)"),
                                React.createElement("td", { className: "r num" }, won(report.normalOpening)),
                                React.createElement("td", { className: "r num" }, won(report.normalCollected)),
                                React.createElement("td", { className: "r num t-strong" }, won(report.normalBalance)),
                                React.createElement("td", { className: "r num" }, rate(report.normalCollected, report.normalOpening)),
                                React.createElement("td", null))))),
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", { className: "closing-detail" },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                                React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                                React.createElement("th", { className: "r" }, "\uD68C\uC218\uAE30\uAC04"),
                                React.createElement("th", { className: "r" }, "\uC5F0\uCCB4\uAE30\uAC04"),
                                React.createElement("th", null, "\uCC44\uAD8C\uAD6C\uBD84"),
                                React.createElement("th", { className: "r" }, "\uCC44\uAD8C\uC794\uC561"),
                                React.createElement("th", null, "\uD2B9\uC774\uC0AC\uD56D"))),
                        React.createElement("tbody", null, report.detail.map((row) => React.createElement("tr", { key: row.code + row.category },
                            React.createElement("td", { className: "t-strong" }, row.name),
                            React.createElement("td", null, report.unit),
                            React.createElement("td", { className: !row.grouped && !Number(row.period_confirmed) ? "customer-period--missing" : "r num" }, row.grouped ? "합산" : !Number(row.period_confirmed)
                                ? "임시 1개월 · 입력 필요" : Number(row.period) + "개월"),
                            React.createElement("td", { className: "r num" },
                                row.months,
                                "\uAC1C\uC6D4"),
                            React.createElement("td", null,
                                React.createElement(Badge, { status: "\uC5F0\uCCB4" })),
                            React.createElement("td", { className: "r num closing-amount" }, won(row.amount)),
                            React.createElement("td", { className: "closing-notes" }, row.notes.join(" · ") || "–")))),
                        React.createElement("tfoot", null,
                            React.createElement("tr", null,
                                React.createElement("td", { colSpan: 5 },
                                    "\uD569\uACC4 \u00B7 ",
                                    report.detail.length,
                                    "\uAC74"),
                                React.createElement("td", { className: "r num" }, won(sum(report.detail, "amount"))),
                                React.createElement("td", null)))))))));
}
/* ══════════════════ 거래처별 현황 ══════════════════ */
function InlineEdit({ value, type = "text", placeholder, canEdit, onSave, formatValue }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || "");
    useEffect(() => { if (!editing)
        setDraft(value || ""); }, [value, editing]);
    async function commit() {
        setEditing(false);
        if (draft === (value || ""))
            return;
        await onSave(draft);
    }
    if (!editing)
        return (React.createElement("button", { type: "button", className: "inline-edit", disabled: !canEdit, onClick: () => canEdit && setEditing(true) }, value !== "" && value != null ? (formatValue ? formatValue(value) : value) :
            React.createElement("span", { className: "t-muted" }, placeholder)));
    return React.createElement("input", { className: "input input--compact", type: type, value: draft, autoFocus: true, onChange: (e) => setDraft(e.target.value), onBlur: commit, onKeyDown: (e) => { if (e.key === "Enter")
            e.currentTarget.blur(); if (e.key === "Escape")
            setEditing(false); } });
}
function Customers({ data, can, preset, notify, patchCustomer }) {
    const [unit, setUnit] = useState((preset && preset.unit) || "전체");
    const [type, setType] = useState((preset && preset.status) || "전체");
    const [q, setQ] = useState("");
    const [periodFilter, setPeriodFilter] = useState("전체");
    const [ownerFilter, setOwnerFilter] = useState("전체");
    const [ageFilter, setAgeFilter] = useState("전체");
    const [editingNote, setEditingNote] = useState(null);
    const [draftNote, setDraftNote] = useState("");
    const [receivableDetail, setReceivableDetail] = useState(null);
    const [unitChange, setUnitChange] = useState(null);
    useEffect(() => { if (preset) {
        setUnit(preset.unit);
        setType(preset.status);
    } }, [preset]);
    const rows = useMemo(() => customersForUnit(data.customers, unit).flatMap((c) => {
        const advance = Number(c.advance) || 0;
        const parts = [
            { status: "정상", balance: Number(c.normal_balance) || 0, months: 0 },
            { status: "연체", balance: Number(c.overdue_balance) || 0, months: overdueMonths(c.overdue_days) },
            { status: "부실", balance: Number(c.bad_balance) || 0, months: overdueMonths(c.overdue_days) },
        ].filter((part) => part.balance !== 0);
        if (parts.length === 0 && advance > 0)
            parts.push({ status: "선수금", balance: -advance, months: 0 });
        return parts.map((part, index) => ({ ...c, ...part,
            advance: part.status === "선수금" || index === 0 ? advance : 0,
            rowKey: c.code + "-" + c.biz_unit + "-" + part.status }));
    }).filter((c) => {
        if (type !== "전체" && c.status !== type)
            return false;
        const missingPeriod = !Number(c.period_confirmed);
        if (periodFilter === "미입력" && !missingPeriod)
            return false;
        if (periodFilter === "입력" && missingPeriod)
            return false;
        if (ownerFilter === "미배정" && c.owner)
            return false;
        if (ownerFilter !== "전체" && ownerFilter !== "미배정" && c.owner !== ownerFilter)
            return false;
        if (ageFilter === "0" && c.months !== 0)
            return false;
        if (ageFilter === "1-3" && (c.months < 1 || c.months > 3))
            return false;
        if (ageFilter === "4-11" && (c.months < 4 || c.months > 11))
            return false;
        if (ageFilter === "12+" && c.months < 12)
            return false;
        const query = normalizeSearch(q);
        if (query && ![c.name, c.code, code5(c.code), c.owner]
            .some((value) => normalizeSearch(value).includes(query)))
            return false;
        return true;
    }), [data.customers, unit, type, q, periodFilter, ownerFilter, ageFilter]);
    const owners = useMemo(() => [...new Set(data.customers.map((c) => c.owner).filter(Boolean))].sort(), [data.customers]);
    async function updateCustomer(code, body, message) {
        try {
            const { customer } = await api("/api/customers/" + encodeURIComponent(code), { method: "PATCH", body });
            patchCustomer(customer);
            notify(message);
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function saveNote(code) {
        await updateCustomer(code, { note: draftNote }, "비고를 저장했습니다.");
        setEditingNote(null);
    }
    async function openReceivables(c) {
        try {
            const result = await api("/api/customers/" + encodeURIComponent(c.code) + "/receivables");
            setReceivableDetail({ ...result, name: c.name });
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function saveItemTarget(itemId, target_date) {
        try {
            const result = await api("/api/receivables/" + itemId, { method: "PATCH", body: { target_date } });
            setReceivableDetail((d) => ({ ...d, items: d.items.map((x) => x.id === itemId ? result.item : x) }));
            notify("채권별 수금목표일을 저장했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function saveItemNote(itemId, note) {
        try {
            const result = await api("/api/receivables/" + itemId, { method: "PATCH", body: { note } });
            const items = receivableDetail.items.map((x) => x.id === itemId ? result.item : x);
            setReceivableDetail((d) => ({ ...d, items }));
            patchCustomer({ ...receivableDetail.customer,
                detail_notes: [...new Set(items.map((x) => x.note).filter(Boolean))] });
            notify("채권 비고를 저장하고 거래처 현황에 취합 반영했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function saveItemUnit() {
        if (!unitChange || !unitChange.target || unitChange.target === unitChange.item.biz_unit) {
            notify("현재 사업부와 다른 사업부를 선택하세요.", true);
            return;
        }
        if (!unitChange.reason.trim()) {
            notify("사업부 변경 사유를 입력하세요.", true);
            return;
        }
        try {
            const result = await api("/api/receivables/" + unitChange.item.id, {
                method: "PATCH", body: { biz_unit: unitChange.target, unit_change_reason: unitChange.reason.trim() },
            });
            setReceivableDetail((d) => ({ ...d, customer: result.customer,
                items: d.items.map((x) => x.id === result.item.id ? { ...x, ...result.item } : x) }));
            patchCustomer(result.customer);
            setUnitChange(null);
            notify("채권 사업부를 변경하고 사업부별 합계를 다시 계산했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function reclassifyAsOverdue(item) {
        if (!window.confirm(won(item.balance) + "원을 정상채권에서 미수채권으로 전환할까요?"))
            return;
        try {
            const result = await api("/api/receivables/" + item.id, {
                method: "PATCH", body: { category: "연체" },
            });
            setReceivableDetail((d) => ({ ...d, customer: result.customer,
                items: d.items.map((x) => x.id === item.id ? { ...result.item, as_of_status: "연체" } : x) }));
            patchCustomer(result.customer);
            notify("정상채권을 미수채권으로 전환했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    const distinctCustomers = new Set(rows.map((r) => r.code)).size;
    return (React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\uC870\uD68C \uC870\uAC74" },
            React.createElement("div", { className: "customer-filters" },
                React.createElement(Field, { label: "\uC0AC\uC5C5\uBD80\uBCC4 \uD544\uD130" },
                    React.createElement("select", { className: "select", value: unit, onChange: (e) => setUnit(e.target.value) },
                        React.createElement("option", null, "\uC804\uCCB4"),
                        data.meta.units.map((u) => React.createElement("option", { key: u }, u)))),
                React.createElement(Field, { label: "\uCC44\uAD8C\uC720\uD615\uBCC4 \uD544\uD130" },
                    React.createElement("select", { className: "select", value: type, onChange: (e) => setType(e.target.value) },
                        React.createElement("option", null, "\uC804\uCCB4"),
                        data.meta.statuses.map((s) => React.createElement("option", { key: s, value: s }, STATUS_LABEL[s])),
                        React.createElement("option", { value: "\uC120\uC218\uAE08" }, "\uC120\uC218\uAE08"))),
                React.createElement(Field, { label: "\uD68C\uC218\uAE30\uAC04" },
                    React.createElement("select", { className: "select", value: periodFilter, onChange: (e) => setPeriodFilter(e.target.value) },
                        React.createElement("option", null, "\uC804\uCCB4"),
                        React.createElement("option", null, "\uBBF8\uC785\uB825"),
                        React.createElement("option", null, "\uC785\uB825"))),
                React.createElement(Field, { label: "\uB2F4\uB2F9\uC790" },
                    React.createElement("select", { className: "select", value: ownerFilter, onChange: (e) => setOwnerFilter(e.target.value) },
                        React.createElement("option", null, "\uC804\uCCB4"),
                        React.createElement("option", null, "\uBBF8\uBC30\uC815"),
                        owners.map((o) => React.createElement("option", { key: o }, o)))),
                React.createElement(Field, { label: "\uC5F0\uCCB4\uAE30\uAC04" },
                    React.createElement("select", { className: "select", value: ageFilter, onChange: (e) => setAgeFilter(e.target.value) },
                        React.createElement("option", { value: "\uC804\uCCB4" }, "\uC804\uCCB4"),
                        React.createElement("option", { value: "0" }, "0\uAC1C\uC6D4"),
                        React.createElement("option", { value: "1-3" }, "1~3\uAC1C\uC6D4"),
                        React.createElement("option", { value: "4-11" }, "4~11\uAC1C\uC6D4"),
                        React.createElement("option", { value: "12+" }, "12\uAC1C\uC6D4 \uC774\uC0C1"))),
                React.createElement(Field, { label: "\uAC70\uB798\uCC98 \uAC80\uC0C9" },
                    React.createElement("input", { className: "input", lang: "ko", inputMode: "text", value: q, placeholder: "\uAC70\uB798\uCC98\uBA85\u00B7\uCF54\uB4DC\u00B7\uB2F4\uB2F9\uC790", onChange: (e) => setQ(e.target.value), onCompositionEnd: (e) => setQ(e.currentTarget.value) })),
                React.createElement("button", { className: "btn btn--sm", onClick: () => { setUnit("전체"); setType("전체"); setPeriodFilter("전체"); setOwnerFilter("전체"); setAgeFilter("전체"); setQ(""); } }, "\uCD08\uAE30\uD654"))),
        React.createElement(Card, { title: (STATUS_LABEL[type] || type) + " · 거래처 " + distinctCustomers + "곳 / 채권 " + rows.length + "건", flush: true },
            React.createElement("div", { className: "tablewrap customer-table" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uCF54\uB4DC"),
                            React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                            React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                            React.createElement("th", null, "\uCC44\uAD8C\uC720\uD615"),
                            React.createElement("th", null, "\uD68C\uC218\uAE30\uAC04"),
                            React.createElement("th", null, "\uB2F4\uB2F9\uC790"),
                            React.createElement("th", null, "\uC218\uAE08\uBAA9\uD45C\uC77C"),
                            React.createElement("th", { className: "r" }, "\uCC44\uAD8C\uC794\uC561"),
                            React.createElement("th", { className: "r" }, "\uC120\uC218\uAE08"),
                            React.createElement("th", { className: "r" }, "\uC5F0\uCCB4\uAE30\uAC04(\uAC1C\uC6D4)"),
                            React.createElement("th", null, "\uCD5C\uC885\uC218\uAE08\uC77C"),
                            React.createElement("th", { style: { minWidth: 180 } }, "\uBE44\uACE0"))),
                    React.createElement("tbody", null, rows.map((c) => React.createElement("tr", { key: c.rowKey },
                        React.createElement("td", { className: "num t-muted" }, code5(c.code)),
                        React.createElement("td", { className: "t-strong" }, c.name),
                        React.createElement("td", null, c.biz_unit),
                        React.createElement("td", null,
                            React.createElement(Badge, { status: c.status })),
                        React.createElement("td", { className: "num" + (!Number(c.period_confirmed) ? " customer-period--missing" : "") },
                            React.createElement(InlineEdit, { value: !Number(c.period_confirmed) ? "" : String(c.period), placeholder: "\uC784\uC2DC 1\uAC1C\uC6D4 \u00B7 \uC785\uB825 \uD544\uC694", type: "number", canEdit: can("customer_info_edit"), formatValue: (value) => Number(value) === 0 ? "0개월 (당월)" :
                                    Number(value) === 1 ? "1개월 (익월)" : value + "개월", onSave: (period) => updateCustomer(c.code, { period }, "회수기간을 저장했습니다.") })),
                        React.createElement("td", null,
                            React.createElement(InlineEdit, { value: c.owner, placeholder: "\uD074\uB9AD\uD574 \uC785\uB825", canEdit: can("note_edit"), onSave: (owner) => updateCustomer(c.code, { owner }, "담당자를 저장했습니다.") })),
                        React.createElement("td", null, c.status === "선수금" ? "–" : React.createElement("button", { type: "button", className: "inline-edit", onClick: () => openReceivables(c) }, "\uCC44\uAD8C\uBCC4 \uBAA9\uD45C \uC124\uC815")),
                        React.createElement("td", { className: "r num t-strong" }, won(c.balance)),
                        React.createElement("td", { className: "r num" }, c.advance ? won(c.advance) : "–"),
                        React.createElement("td", { className: "r num" },
                            c.months,
                            "\uAC1C\uC6D4"),
                        React.createElement("td", { className: "num t-muted t-sm" }, c.last_paid_at || "–"),
                        React.createElement("td", { style: { whiteSpace: "normal" } }, editingNote === c.rowKey ? React.createElement("div", { className: "inline-note" },
                            React.createElement("input", { className: "input", value: draftNote, autoFocus: true, onChange: (e) => setDraftNote(e.target.value), onKeyDown: (e) => e.key === "Enter" && saveNote(c.code) }),
                            React.createElement("button", { className: "btn btn--sm btn--primary", onClick: () => saveNote(c.code) }, "\uC800\uC7A5"),
                            React.createElement("button", { className: "btn btn--sm", onClick: () => setEditingNote(null) }, "\uCDE8\uC18C")) : React.createElement("button", { type: "button", className: "inline-edit", disabled: !can("note_edit"), onClick: () => { setEditingNote(c.rowKey); setDraftNote(c.note || ""); } }, [c.note, ...(c.detail_notes || [])].filter(Boolean).join(" · ") || React.createElement("span", { className: "t-muted" }, "\uD074\uB9AD\uD574 \uC785\uB825")))))),
                    rows.length === 0 && React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("td", { colSpan: 12, className: "zero-result" },
                                "\uC870\uD68C \uACB0\uACFC ",
                                React.createElement("b", null, "0\uC6D0")))),
                    React.createElement("tfoot", null,
                        React.createElement("tr", null,
                            React.createElement("td", { colSpan: 7 },
                                "\uD569\uACC4 \u00B7 \uAC70\uB798\uCC98 ",
                                distinctCustomers,
                                "\uACF3 / \uCC44\uAD8C ",
                                rows.length,
                                "\uAC74"),
                            React.createElement("td", { className: "r num" }, won(sum(rows, "balance"))),
                            React.createElement("td", { className: "r num" }, won(sum(rows, "advance"))),
                            React.createElement("td", { colSpan: 3 })))))),
        receivableDetail && React.createElement("div", { className: "modal-backdrop", onMouseDown: () => setReceivableDetail(null) },
            React.createElement("section", { className: "modal-card modal-card--wide", onMouseDown: (e) => e.stopPropagation() },
                React.createElement("header", { className: "card__head" },
                    React.createElement("h3", null,
                        receivableDetail.name,
                        " \u00B7 \uBC1C\uC0DD\uC6D4\uBCC4 \uCC44\uAD8C \uC0C1\uC138"),
                    React.createElement("div", { className: "spacer" }),
                    React.createElement("button", { className: "btn btn--sm", onClick: () => setReceivableDetail(null) }, "\uB2EB\uAE30")),
                React.createElement("div", { className: "alert alert--info", style: { margin: 14 } },
                    "\uC870\uD68C\uAE30\uC900\uC77C ",
                    receivableDetail.as_of,
                    " \u00B7 \uBC1C\uC0DD\uC6D4\uBCC4 \uC794\uC561\uACFC \uC815\uC0C1\uD68C\uC218\uC6D4\uC744 \uD655\uC778\uD558\uACE0 \uCC44\uAD8C\uBCC4 \uBAA9\uD45C\uC77C\uC744 \uC785\uB825\uD569\uB2C8\uB2E4."),
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                                React.createElement("th", null, "\uCC44\uAD8C\uBC1C\uC0DD\uC6D4"),
                                React.createElement("th", null, "\uC815\uC0C1\uD68C\uC218\uC6D4"),
                                React.createElement("th", null, "\uD604\uC7AC \uAD6C\uBD84"),
                                React.createElement("th", { className: "r" }, "\uCD5C\uCD08\uAE08\uC561"),
                                React.createElement("th", { className: "r" }, "\uD604\uC7AC\uC794\uC561"),
                                React.createElement("th", null, "\uC218\uAE08\uBAA9\uD45C\uC77C"),
                                React.createElement("th", null, "\uBE44\uACE0"),
                                React.createElement("th", null, "\uAD00\uB9AC"))),
                        React.createElement("tbody", null, receivableDetail.items.map((item) => React.createElement("tr", { key: item.id },
                            React.createElement("td", null,
                                React.createElement("button", { type: "button", className: "inline-edit t-strong", disabled: !can("customer_info_edit"), onClick: () => setUnitChange({ item, target: item.biz_unit || receivableDetail.customer.biz_unit, reason: "" }) },
                                    item.biz_unit || receivableDetail.customer.biz_unit,
                                    " \u00B7 \uBCC0\uACBD")),
                            React.createElement("td", { className: "num t-strong" }, item.issue_month || "미확인"),
                            React.createElement("td", { className: "num" }, item.target_month || "미입력"),
                            React.createElement("td", null,
                                React.createElement(Badge, { status: item.as_of_status || item.category })),
                            React.createElement("td", { className: "r num" }, won(item.original_amount)),
                            React.createElement("td", { className: "r num t-strong" }, won(item.balance)),
                            React.createElement("td", null,
                                React.createElement(InlineEdit, { value: item.target_date, placeholder: "\uBAA9\uD45C\uC77C \uC785\uB825", type: "date", canEdit: can("customer_info_edit"), onSave: (value) => saveItemTarget(item.id, value) })),
                            React.createElement("td", null,
                                React.createElement(InlineEdit, { value: item.note, placeholder: "\uBE44\uACE0 \uC785\uB825", canEdit: can("note_edit"), onSave: (value) => saveItemNote(item.id, value) })),
                            React.createElement("td", null, item.category === "정상" && Number(item.balance) > 0 ?
                                React.createElement("button", { className: "btn btn--sm btn--warn", disabled: !can("customer_info_edit"), onClick: () => reclassifyAsOverdue(item) }, "\uBBF8\uC218 \uC804\uD658") : "–")))))))),
        unitChange && React.createElement("div", { className: "modal-backdrop", onMouseDown: () => setUnitChange(null) },
            React.createElement("section", { className: "modal-card", onMouseDown: (e) => e.stopPropagation() },
                React.createElement("header", { className: "card__head" },
                    React.createElement("h3", null, "\uCC44\uAD8C \uC0AC\uC5C5\uBD80 \uBCC0\uACBD"),
                    React.createElement("div", { className: "spacer" }),
                    React.createElement("button", { className: "btn btn--sm", onClick: () => setUnitChange(null) }, "\uB2EB\uAE30")),
                React.createElement("div", { className: "card__body" },
                    React.createElement("div", { className: "alert alert--warn" },
                        React.createElement("b", null, "\uC8FC\uC758\uC0AC\uD56D"),
                        React.createElement("br", null),
                        "\uC120\uD0DD\uD55C \uCC44\uAD8C \uAC74\uC758 \uC0AC\uC5C5\uBD80\uBCC4 \uD569\uACC4\u00B7\uB300\uC2DC\uBCF4\uB4DC\u00B7\uBCF4\uACE0\uC11C\uAC00 \uC989\uC2DC \uBCC0\uACBD\uB429\uB2C8\uB2E4.",
                        React.createElement("br", null),
                        "\uAC70\uB798\uCC98\uC758 \uB2E4\uB978 \uCC44\uAD8C\uC5D0\uB294 \uC601\uD5A5\uC744 \uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
                        React.createElement("br", null),
                        "\uAC19\uC740 \uCD9C\uACE0\uD30C\uC77C\uC744 \uB2E4\uC2DC \uC62C\uB824\uB3C4 \uC774 \uC9C1\uC811 \uC218\uC815\uAC12\uC774 \uC720\uC9C0\uB418\uC9C0\uB9CC, \uC6D0\uBCF8 \uCD9C\uACE0\uC790\uB8CC\uB3C4 \uD568\uAED8 \uC815\uC815\uD574 \uC8FC\uC138\uC694."),
                    React.createElement("div", { className: "form-grid", style: { marginTop: 14 } },
                        React.createElement(Field, { label: "\uD604\uC7AC \uC0AC\uC5C5\uBD80" },
                            React.createElement("input", { className: "input", value: unitChange.item.biz_unit || "", readOnly: true, disabled: true })),
                        React.createElement(Field, { label: "\uBCC0\uACBD \uC0AC\uC5C5\uBD80" },
                            React.createElement("select", { className: "select", value: unitChange.target, onChange: (e) => setUnitChange({ ...unitChange, target: e.target.value }) }, data.meta.units.map((u) => React.createElement("option", { key: u }, u))))),
                    React.createElement(Field, { label: "\uBCC0\uACBD \uC0AC\uC720 (\uD544\uC218)" },
                        React.createElement("textarea", { className: "textarea", rows: "3", value: unitChange.reason, onChange: (e) => setUnitChange({ ...unitChange, reason: e.target.value }), placeholder: "\uC608: \uAE30\uCD08\uC790\uB8CC \uC0AC\uC5C5\uBD80 \uC624\uBD84\uB958 \uC815\uC815" })),
                    React.createElement("button", { className: "btn btn--primary", disabled: !unitChange.reason.trim() || unitChange.target === unitChange.item.biz_unit, onClick: saveItemUnit }, "\uC8FC\uC758\uC0AC\uD56D \uD655\uC778 \uD6C4 \uBCC0\uACBD"))))));
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
            React.createElement("div", { className: "signal__bar" }, ["정상", "연체", "부실"].map((s) => o[s] > 0 && (React.createElement("div", { key: s, className: "signal__seg signal__seg--" + STATUS_STYLE[s], style: { width: (o[s] / o.total) * 100 + "%" }, title: STATUS_LABEL[s] + " " + won(o[s]) })))))))),
        active && (React.createElement(Card, { title: active.owner + " 담당 거래처", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uCF54\uB4DC"),
                            React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                            React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                            React.createElement("th", null, "\uBD84\uB958"),
                            React.createElement("th", { className: "r" }, "\uCC44\uAD8C\uC794\uC561"),
                            React.createElement("th", { className: "r" }, "\uC5F0\uCCB4\uAE30\uAC04(\uAC1C\uC6D4)"),
                            React.createElement("th", null, "\uBE44\uACE0"))),
                    React.createElement("tbody", null, [...active.rows].sort((a, b) => b.balance - a.balance).map((c) => (React.createElement("tr", { key: c.code },
                        React.createElement("td", { className: "num t-muted" }, code5(c.code)),
                        React.createElement("td", { className: "t-strong" }, c.name),
                        React.createElement("td", null, c.biz_unit),
                        React.createElement("td", null,
                            React.createElement(Badge, { status: c.status })),
                        React.createElement("td", { className: "r num t-strong" }, won(c.balance)),
                        React.createElement("td", { className: "r num" },
                            overdueMonths(c.overdue_days),
                            "\uAC1C\uC6D4"),
                        React.createElement("td", { className: "t-sm t-muted", style: { whiteSpace: "normal" } }, c.note || "–"))))),
                    React.createElement("tfoot", null,
                        React.createElement("tr", null,
                            React.createElement("td", { colSpan: 4 }, "\uD569\uACC4"),
                            React.createElement("td", { className: "r num" }, won(active.total)),
                            React.createElement("td", { colSpan: 2 })))))))));
}
/* ══════════════════ 수금 등록 ══════════════════ */
function CustomerSearch({ customers, value, onChange }) {
    const selected = customers.find((c) => c.code === value);
    const [query, setQuery] = useState(selected ? selected.name : "");
    const [open, setOpen] = useState(false);
    const matches = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return customers.filter((c) => !keyword
            || c.name.toLowerCase().includes(keyword)
            || String(c.code).toLowerCase().includes(keyword)
            || code5(c.code).includes(keyword)).slice(0, 12);
    }, [customers, query]);
    useEffect(() => {
        const current = customers.find((c) => c.code === value);
        setQuery(current ? current.name : "");
    }, [customers, value]);
    function choose(customer) {
        onChange(customer.code);
        setQuery(customer.name);
        setOpen(false);
    }
    return (React.createElement("div", { className: "customer-search" },
        React.createElement("input", { className: "input", lang: "ko", inputMode: "text", value: query, placeholder: "\uAC70\uB798\uCC98\uBA85 \uB610\uB294 \uCF54\uB4DC \uAC80\uC0C9", role: "combobox", "aria-expanded": open, "aria-autocomplete": "list", onFocus: () => setOpen(true), onBlur: () => setTimeout(() => setOpen(false), 150), onChange: (e) => { setQuery(e.target.value); onChange(""); setOpen(true); } }),
        open && (React.createElement("div", { className: "customer-search__menu", role: "listbox" },
            matches.map((c) => (React.createElement("button", { type: "button", role: "option", key: c.code, className: "customer-search__option", onMouseDown: (e) => e.preventDefault(), onClick: () => choose(c) },
                React.createElement("span", null,
                    React.createElement("b", null, c.name),
                    React.createElement("small", null,
                        code5(c.code),
                        " \u00B7 ",
                        c.biz_unit)),
                React.createElement("strong", { className: "num" },
                    won(c.balance),
                    "\uC6D0")))),
            matches.length === 0 && React.createElement("div", { className: "customer-search__empty" }, "\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")))));
}
function QuickCustomerModal({ units, onClose, onCreated }) {
    const [form, setForm] = useState({ code: "", name: "", biz_unit: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            const result = await api("/api/customers/quick", { method: "POST", body: form });
            await onCreated(result.customer);
        }
        catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }
    return React.createElement("div", { className: "modal-backdrop", onMouseDown: onClose },
        React.createElement("section", { className: "modal-card quick-customer-modal", onMouseDown: (e) => e.stopPropagation() },
            React.createElement("header", { className: "card__head" },
                React.createElement("h3", null, "\uC2E0\uADDC \uAC70\uB798\uCC98 \uAC04\uD3B8\uB4F1\uB85D"),
                React.createElement("div", { className: "spacer" }),
                React.createElement("button", { className: "btn btn--sm", type: "button", onClick: onClose }, "\uB2EB\uAE30")),
            React.createElement("form", { className: "card__body", onSubmit: submit },
                React.createElement("div", { className: "alert alert--info" }, "\uC120\uC218\uAE08 \uB4F1\uB85D\uC744 \uC704\uD574 \uACE0\uAC1D\uCF54\uB4DC\u00B7\uACE0\uAC1D\uBA85\u00B7\uC0AC\uC5C5\uBD80\uB97C \uBA3C\uC800 \uB4F1\uB85D\uD569\uB2C8\uB2E4. \uCC44\uAD8C\uC794\uC561\uC740 0\uC6D0\uC73C\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4."),
                error && React.createElement("div", { className: "alert alert--bad" }, error),
                React.createElement(Field, { label: "\uACE0\uAC1D\uCF54\uB4DC" },
                    React.createElement("input", { className: "input", value: form.code, autoFocus: true, onChange: (e) => setForm({ ...form, code: e.target.value }), placeholder: "\uC608: 00123" })),
                React.createElement(Field, { label: "\uACE0\uAC1D\uBA85" },
                    React.createElement("input", { className: "input", lang: "ko", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "\uAC70\uB798\uCC98\uBA85 \uC785\uB825" })),
                React.createElement(Field, { label: "\uC0AC\uC5C5\uBD80" },
                    React.createElement("select", { className: "select", value: form.biz_unit, onChange: (e) => setForm({ ...form, biz_unit: e.target.value }) },
                        React.createElement("option", { value: "" }, "\uC0AC\uC5C5\uBD80 \uC120\uD0DD"),
                        units.map((unit) => React.createElement("option", { key: unit }, unit)))),
                React.createElement("button", { className: "btn btn--primary", type: "submit", disabled: busy || !form.code.trim() || !form.name.trim() || !form.biz_unit }, busy ? "등록 중" : "등록 후 선택"))));
}
function collectionSelectionNote(items) {
    const normalByMonth = new Map();
    let overdue = 0, bad = 0;
    items.forEach((item) => {
        const amount = Number(item.balance) || 0;
        const status = item.as_of_status || item.category;
        if (status === "정상") {
            const month = item.issue_month ? item.issue_month.slice(5, 7) + "월" : "발생월 미확인";
            normalByMonth.set(month, (normalByMonth.get(month) || 0) + amount);
        }
        else if (status === "부실")
            bad += amount;
        else
            overdue += amount;
    });
    const notes = [...normalByMonth.entries()].map(([month, amount]) => month + " 매출채권 " + won(amount) + "원 수금");
    if (overdue)
        notes.push("미수채권 " + won(overdue) + "원 수금");
    if (bad)
        notes.push("부실채권 " + won(bad) + "원 수금");
    return notes.join(" / ");
}
function Collections({ data, can, notify, refresh }) {
    const [form, setForm] = useState({
        customer_code: "", amount: "", method: "계좌수금", paid_at: today(), note: "",
    });
    const [busy, setBusy] = useState(false);
    const [receivables, setReceivables] = useState(null);
    const [receivablesBusy, setReceivablesBusy] = useState(false);
    const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
    const [selectedReceivableIds, setSelectedReceivableIds] = useState([]);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const setAmount = (e) => setForm({ ...form, amount: formatAmountInput(e.target.value) });
    const pending = data.collections.filter((c) => c.state === "pending");
    const decided = data.collections.filter((c) => c.state !== "pending").slice(0, 40);
    const target = data.customers.find((c) => c.code === form.customer_code);
    useEffect(() => {
        let active = true;
        setSelectedReceivableIds([]);
        if (!form.customer_code) {
            setReceivables(null);
            setReceivablesBusy(false);
            return () => { active = false; };
        }
        setReceivables(null);
        setReceivablesBusy(true);
        api("/api/customers/" + encodeURIComponent(form.customer_code) + "/receivables")
            .then((result) => { if (active)
            setReceivables(result); })
            .catch((e) => { if (active)
            notify(e.message, true); })
            .finally(() => { if (active)
            setReceivablesBusy(false); });
        return () => { active = false; };
    }, [form.customer_code, notify]);
    function toggleReceivable(item) {
        const selected = selectedReceivableIds.includes(item.id);
        const nextIds = selected ? selectedReceivableIds.filter((id) => id !== item.id)
            : [...selectedReceivableIds, item.id];
        const nextItems = ((receivables === null || receivables === void 0 ? void 0 : receivables.items) || []).filter((row) => nextIds.includes(row.id));
        setSelectedReceivableIds(nextIds);
        setForm((current) => ({ ...current,
            amount: nextItems.length ? formatAmountInput(sum(nextItems, "balance")) : "",
            note: collectionSelectionNote(nextItems),
        }));
    }
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
                    React.createElement("div", { className: "customer-pick" },
                        React.createElement(CustomerSearch, { customers: data.customers, value: form.customer_code, onChange: (code) => setForm({ ...form, customer_code: code }) }),
                        React.createElement("button", { className: "btn btn--sm", type: "button", onClick: () => setQuickCustomerOpen(true) }, "\uC2E0\uADDC"))),
                React.createElement(Field, { label: "\uC218\uAE08\uC561 (\uC6D0)" },
                    React.createElement("input", { className: "input num", inputMode: "numeric", value: form.amount, onChange: setAmount, placeholder: "0", "aria-describedby": "collection-amount-unit" }),
                    React.createElement("small", { id: "collection-amount-unit", className: "amount-unit-check" }, form.amount ? "입력금액 · " + koreanAmountUnit(form.amount) : "숫자를 입력하면 금액 단위가 표시됩니다.")),
                React.createElement(Field, { label: "\uC218\uAE08\uBC29\uBC95" },
                    React.createElement("select", { className: "select", value: form.method, onChange: set("method") }, data.meta.methods.map((m) => React.createElement("option", { key: m }, m)))),
                React.createElement(Field, { label: "\uC218\uAE08\uC77C" },
                    React.createElement("input", { className: "input", type: "date", value: form.paid_at, onChange: set("paid_at") }))),
            React.createElement(Field, { label: "\uBE44\uACE0" },
                React.createElement("input", { className: "input", value: form.note, onChange: set("note"), placeholder: "\uC785\uAE08\uC790\uBA85, \uBD84\uD560 \uD68C\uCC28 \uB4F1" })),
            target && amountNumber(form.amount) > target.balance && (React.createElement("div", { className: "alert alert--warn" },
                "\uC785\uB825\uD55C \uC218\uAE08\uC561\uC774 \uD604\uC7AC \uBBF8\uC218\uC794\uC561(",
                won(target.balance),
                "\uC6D0)\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4. \uAE08\uC561\uC744 \uD655\uC778\uD558\uC138\uC694.")),
            target && React.createElement("div", { className: "collection-receivables" },
                React.createElement("div", { className: "collection-receivables__head" },
                    React.createElement("b", null,
                        target.name,
                        " \u00B7 \uCC44\uAD8C \uC0C1\uC138\uD604\uD669"),
                    React.createElement("span", null,
                        "\uC815\uC0C1 ",
                        won(target.normal_balance),
                        "\uC6D0 \u00B7 \uBBF8\uC218 ",
                        won(target.overdue_balance),
                        "\uC6D0 \u00B7 \uBD80\uC2E4 ",
                        won(target.bad_balance),
                        "\uC6D0 \u00B7 \uD569\uACC4 ",
                        won(target.balance),
                        "\uC6D0")),
                receivablesBusy ? React.createElement("div", { className: "empty" },
                    React.createElement("b", null, "\uCC44\uAD8C \uC0C1\uC138\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.")) :
                    receivables && receivables.items.length ? React.createElement("div", { className: "tablewrap" },
                        React.createElement("table", null,
                            React.createElement("thead", null,
                                React.createElement("tr", null,
                                    React.createElement("th", null, "\uC120\uD0DD"),
                                    React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                                    React.createElement("th", null, "\uBC1C\uC0DD\uC6D4"),
                                    React.createElement("th", null, "\uC815\uC0C1\uD68C\uC218\uC6D4"),
                                    React.createElement("th", null, "\uD604\uC7AC \uAD6C\uBD84"),
                                    React.createElement("th", { className: "r" }, "\uCD5C\uCD08\uAE08\uC561"),
                                    React.createElement("th", { className: "r" }, "\uD604\uC7AC\uC794\uC561"),
                                    React.createElement("th", null, "\uC218\uAE08\uBAA9\uD45C\uC77C"),
                                    React.createElement("th", null, "\uBE44\uACE0"))),
                            React.createElement("tbody", null, receivables.items.map((item) => React.createElement("tr", { key: item.id, className: selectedReceivableIds.includes(item.id) ? "is-selected" : "" },
                                React.createElement("td", null,
                                    React.createElement("input", { type: "checkbox", checked: selectedReceivableIds.includes(item.id), disabled: Number(item.balance) <= 0, onChange: () => toggleReceivable(item), "aria-label": (item.issue_month || "채권") + " " + won(item.balance) + "원 선택" })),
                                React.createElement("td", null, item.biz_unit || target.biz_unit),
                                React.createElement("td", { className: "num" }, item.issue_month || "미확인"),
                                React.createElement("td", { className: "num" }, item.target_month || "미입력"),
                                React.createElement("td", null,
                                    React.createElement(Badge, { status: item.as_of_status || item.category })),
                                React.createElement("td", { className: "r num" }, won(item.original_amount)),
                                React.createElement("td", { className: "r num t-strong" }, won(item.balance)),
                                React.createElement("td", { className: "num" }, item.target_date || "–"),
                                React.createElement("td", { style: { whiteSpace: "normal" } }, item.note || "–")))),
                            React.createElement("tfoot", null,
                                React.createElement("tr", null,
                                    React.createElement("td", { colSpan: 6 },
                                        "\uCC44\uAD8C ",
                                        receivables.items.length,
                                        "\uAC74 \uD569\uACC4"),
                                    React.createElement("td", { className: "r num" }, won(sum(receivables.items, "balance"))),
                                    React.createElement("td", { colSpan: 2 }))))) : React.createElement("div", { className: "zero-result" },
                        "\uD604\uC7AC \uB0A8\uC544 \uC788\uB294 \uCC44\uAD8C ",
                        React.createElement("b", null, "0\uC6D0"))),
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
                    React.createElement("td", { className: "t-sm t-muted", style: { whiteSpace: "normal" } }, c.reject_reason || c.note || "–"))))))))),
        quickCustomerOpen && React.createElement(QuickCustomerModal, { units: data.meta.units, onClose: () => setQuickCustomerOpen(false), onCreated: async (customer) => {
                await refresh();
                setForm((current) => ({ ...current, customer_code: customer.code }));
                setQuickCustomerOpen(false);
                notify(customer.name + " 거래처를 등록하고 선택했습니다.");
            } })));
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
                    React.createElement(CustomerSearch, { customers: data.customers, value: form.customer_code, onChange: (code) => setForm({ ...form, customer_code: code }) })),
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
/* ══════════════════ 수금등록 데이터 업로드 ══════════════════ */
const COLLECTION_COLUMNS = {
    receipt_month: ["수금년월"], paid_at: ["수금일자", "수금일"], receipt_no: ["수금번호"],
    customer_code: ["고객코드", "거래처코드"], customer_name: ["고객", "고객명", "거래처명"],
    sequence: ["순번"], receipt_kind_code: ["수금구분코드"], receipt_kind: ["수금구분"],
    receipt_type: ["수금구분유형"], normal_amount: ["정상수금"], advance_amount: ["선수금"],
    note: ["비고(건)"], detail_note: ["비고(내역)"],
};
const COLLECTION_REQUIRED = ["paid_at", "receipt_no", "customer_code", "sequence", "receipt_kind",
    "receipt_type", "normal_amount", "advance_amount"];
function parseCollectionWorkbook(bytes) {
    var _a, _b;
    const signature = Array.from(new Uint8Array(bytes).slice(0, 11), (c) => String.fromCharCode(c)).join("");
    if (signature === "BMS DocuRay")
        throw new Error("보안 처리된 엑셀입니다. 사내 절차에 따라 반출용 일반 엑셀로 내보내 주세요.");
    const wb = XLSX.read(bytes, { type: "array", cellDates: false });
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true, blankrows: true });
    const clean = (v) => String(v !== null && v !== void 0 ? v : "").replace(/\s/g, "");
    const headerIndex = grid.slice(0, 25).findIndex((row) => row.some((h) => ["고객코드", "거래처코드"].includes(clean(h))) && row.some((h) => clean(h) === "수금번호"));
    if (headerIndex < 0)
        throw new Error("첫 번째 시트의 앞 25행 안에 고객코드와 수금번호 머리글이 필요합니다.");
    const headers = grid[headerIndex].map(clean), mapping = {};
    for (const [key, names] of Object.entries(COLLECTION_COLUMNS)) {
        const matches = headers.map((h, i) => names.includes(h) ? i : -1).filter((i) => i >= 0);
        if (matches.length > 1)
            throw new Error(names[0] + " 머리글이 중복되었습니다.");
        if (matches.length)
            mapping[key] = matches[0];
    }
    const missing = COLLECTION_REQUIRED.filter((key) => mapping[key] === undefined);
    if (missing.length)
        throw new Error("필수 열 누락: " + missing.map((key) => COLLECTION_COLUMNS[key][0]).join(", "));
    const rows = [], totals = [];
    for (let i = headerIndex + 1; i < grid.length; i++) {
        const row = grid[i];
        if (row.every((v) => clean(v) === ""))
            continue;
        const values = Object.fromEntries(Object.entries(mapping).map(([key, column]) => { var _a; return [key, (_a = row[column]) !== null && _a !== void 0 ? _a : ""]; }));
        if (!clean(values.customer_code) && !clean(values.receipt_no) && !clean(values.sequence)
            && [values.paid_at, values.customer_name].some((v) => ["합계", "총합계"].includes(clean(v)))) {
            totals.push(values);
            continue;
        }
        if (typeof values.paid_at === "number") {
            const d = XLSX.SSF.parse_date_code(values.paid_at, { date1904: !!((_b = (_a = wb.Workbook) === null || _a === void 0 ? void 0 : _a.WBProps) === null || _b === void 0 ? void 0 : _b.date1904) });
            if (d)
                values.paid_at = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        }
        else {
            const date = String(values.paid_at).trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
            if (date)
                values.paid_at = date[1] + "-" + date[2].padStart(2, "0") + "-" + date[3].padStart(2, "0");
        }
        // Preserve leading zeros and raw amount text; the server validates money.
        rows.push({ ...values, customer_code: String(values.customer_code).trim(), row_number: i + 1 });
    }
    if (!rows.length || rows.length > 5000)
        throw new Error("수금 내역은 1~5,000행까지 업로드할 수 있습니다.");
    if (totals.length > 1)
        throw new Error("합계행은 한 개만 포함해 주세요. 시트 구성을 확인하세요.");
    if (totals.length) {
        for (const key of ["normal_amount", "advance_amount"]) {
            const number = (v) => Number(String(v).replace(/,/g, "").trim());
            const expected = number(totals[0][key]), actual = rows.reduce((s, r) => s + number(r[key]), 0);
            if (!Number.isSafeInteger(expected) || !Number.isSafeInteger(actual) || expected !== actual)
                throw new Error(COLLECTION_COLUMNS[key][0] + " 합계행과 실제 내역 합계가 다릅니다. 파일을 확인하세요.");
        }
    }
    return { rows, sheet: wb.SheetNames[0], skippedTotals: totals.length };
}
function CollectionUpload({ can, notify, refresh }) {
    const [source, setSource] = useState(null), [preview, setPreview] = useState(null);
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const [approve, setApprove] = useState(false), [history, setHistory] = useState([]);
    const [historyError, setHistoryError] = useState("");
    const [page, setPage] = useState(0), [result, setResult] = useState(null);
    const [reviewOpen, setReviewOpen] = useState(false), [decisions, setDecisions] = useState({});
    const [reviewHistory, setReviewHistory] = useState(null);
    const [customerOpen, setCustomerOpen] = useState(false), [customerDecisions, setCustomerDecisions] = useState({});
    const [customerApplied, setCustomerApplied] = useState([]), [errorsOnly, setErrorsOnly] = useState(false);
    const reading = useRef(0), submitting = useRef(false);
    function applyChecked(checked, selected = []) {
        setPreview(checked);
        setPage(0);
        const choices = Object.fromEntries(selected.map((d) => [d.issue_key, d]));
        setCustomerApplied(selected);
        setCustomerDecisions(Object.fromEntries((checked.customer_issues || []).map((i) => [i.issue_key,
            i.resolved && choices[i.issue_key] ? choices[i.issue_key] : {
                issue_key: i.issue_key, resolution_token: i.resolution_token, action: "", target_code: "",
                name: i.source_names[0] || "", biz_unit: "", reason: "", confirmed: false,
            }])));
        setDecisions(Object.fromEntries(checked.rows.filter((r) => r.status === "review")
            .map((r) => [r.row_key, { action: "exclude", confirmed: false, reason: "" }])));
        setCustomerOpen((checked.customer_issue_count || 0) > 0);
        setReviewOpen(!checked.error_count && checked.review_count > 0);
    }
    function changeCustomer(key, changes) {
        setCustomerDecisions((current) => ({ ...current, [key]: { ...current[key], confirmed: false, ...changes } }));
    }
    async function recheckCustomers() {
        if (busy || !source || !customersComplete)
            return;
        setBusy(true);
        setError("");
        const selected = customerIssues.map((i) => ({ ...customerDecisions[i.issue_key],
            issue_key: i.issue_key, resolution_token: i.resolution_token }));
        try {
            const checked = await api("/api/collection-uploads/preview", { method: "POST",
                body: { rows: source.rows, customer_resolutions: selected } });
            applyChecked(checked, selected);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    function changeDecision(key, changes) {
        setDecisions((current) => ({ ...current, [key]: { ...current[key], ...changes } }));
    }
    async function openReviewHistory(batch) {
        try {
            const r = await api(`/api/collection-uploads/${batch.id}/reviews`);
            setReviewHistory({ batch, rows: r.reviews });
        }
        catch (e) {
            notify(e.message, true);
        }
    }
    async function loadHistory() {
        try {
            const r = await api("/api/collection-uploads");
            setHistory(r.batches);
            setHistoryError("");
        }
        catch (e) {
            setHistoryError(e.message);
        }
    }
    useEffect(() => { loadHistory(); return () => { reading.current++; }; }, []);
    async function readFile(file) {
        if (!file || submitting.current)
            return;
        const version = ++reading.current;
        setBusy(true);
        setError("");
        setSource(null);
        setPreview(null);
        setPage(0);
        setResult(null);
        setApprove(false);
        setReviewOpen(false);
        setDecisions({});
        setCustomerOpen(false);
        setCustomerDecisions({});
        setCustomerApplied([]);
        setErrorsOnly(false);
        try {
            if (!/\.(xlsx|xls|csv)$/i.test(file.name))
                throw new Error(".xlsx, .xls, .csv 파일을 선택하세요.");
            if (file.size > 10 * 1024 * 1024)
                throw new Error("파일 크기는 10MB 이하여야 합니다.");
            const parsed = parseCollectionWorkbook(await file.arrayBuffer());
            const checked = await api("/api/collection-uploads/preview", { method: "POST", body: { rows: parsed.rows } });
            if (version !== reading.current)
                return;
            setSource({ ...parsed, filename: file.name });
            applyChecked(checked);
        }
        catch (e) {
            if (version === reading.current)
                setError(e.message || "엑셀 파일을 읽지 못했습니다.");
        }
        finally {
            if (version === reading.current)
                setBusy(false);
        }
    }
    async function submit() {
        if (submitting.current || busy || !source || !preview || preview.error_count || !(preview.ready_count + (preview.review_count || 0) + (preview.customer_excluded_count || 0)))
            return;
        if (!reviewsComplete) {
            setReviewOpen(true);
            return;
        }
        submitting.current = true;
        setBusy(true);
        setError("");
        try {
            const response = await api("/api/collection-uploads", { method: "POST", body: {
                    filename: source.filename, rows: source.rows, approve_immediately: approve && can("collection_approve"),
                    customer_resolutions: customerApplied,
                    reviews: reviewRows.map((r) => ({ row_key: r.row_key, review_token: r.review_token, ...decisions[r.row_key] })),
                } });
            setResult(response);
            setPreview(null);
            setSource(null);
            setApprove(false);
            setReviewOpen(false);
            setDecisions({});
            setCustomerOpen(false);
            setCustomerApplied([]);
            setCustomerDecisions({});
            notify(response.inserted ? `${response.inserted}건을 ${response.approved ? "승인·상계" : "승인 대기로 등록"}했습니다.` : response.message);
            await loadHistory();
            try {
                await refresh();
            }
            catch (_) {
                setError("등록은 완료됐습니다. 현황을 다시 불러오려면 새로고침해 주세요.");
            }
        }
        catch (e) {
            setError(e.message);
            // Keep raw input for a fresh server check after a conflict or lost response.
            try {
                const checked = await api("/api/collection-uploads/preview", { method: "POST", body: { rows: source.rows, customer_resolutions: customerApplied } });
                applyChecked(checked, customerApplied);
            }
            catch (_) {
                setPreview(null);
                setReviewOpen(false);
                setCustomerOpen(false);
            }
        }
        finally {
            submitting.current = false;
            setBusy(false);
        }
    }
    const errorRows = preview ? preview.rows.filter((r) => r.status === "error") : [];
    const visibleRows = preview ? (errorsOnly ? errorRows : preview.rows) : [];
    const pageRows = visibleRows.slice(page * 50, (page + 1) * 50);
    const customerIssues = (preview === null || preview === void 0 ? void 0 : preview.customer_issues) || [];
    const customersComplete = customerIssues.every((i) => {
        const d = customerDecisions[i.issue_key];
        return (d === null || d === void 0 ? void 0 : d.confirmed) && i.allowed_actions.includes(d.action) && (d.reason || "").trim().length <= 500
            && (d.action !== "link" || (i.candidates.some((c) => c.code === d.target_code) && d.reason.trim().length >= 5))
            && (d.action !== "create" || (d.name.trim() && ["덴탈", "메디컬", "에스테틱"].includes(d.biz_unit)));
    });
    const errorDetails = React.createElement("div", { className: "alert alert--bad collection-error-details", role: "alert" },
        React.createElement("b", null,
            "\uC785\uB825 \uC624\uB958 ",
            (preview === null || preview === void 0 ? void 0 : preview.error_count) || 0,
            "\uAC74 \u00B7 \uD589\uACFC \uC0AC\uC720\uB97C \uD655\uC778\uD558\uC138\uC694."),
        React.createElement("ul", null, errorRows.map((r) => {
            var _a;
            return React.createElement("li", { key: r.row_key },
                React.createElement("b", null,
                    "\uC5D1\uC140 ",
                    r.row_number,
                    "\uD589 \u00B7 ",
                    r.source_customer_name || r.customer_name || "거래처명 없음",
                    " (",
                    r.source_customer_code || r.customer_code || "코드 없음",
                    ")"),
                React.createElement("span", null,
                    r.receipt_no || "수금번호 없음",
                    " / ", (_a = r.sequence) !== null && _a !== void 0 ? _a : "–",
                    " \u00B7 ",
                    r.errors.join(" / ")));
        })),
        !!(preview === null || preview === void 0 ? void 0 : preview.customer_issue_count) && React.createElement("button", { className: "btn btn--sm", disabled: busy, onClick: () => { setReviewOpen(false); setCustomerOpen(true); } }, "\uAC70\uB798\uCC98 \uC120\uD0DD\uC73C\uB85C \uD574\uACB0"),
        React.createElement("p", null, "\uAC70\uB798\uCC98 \uBB38\uC81C\uB294 \uC5F0\uACB0\u00B7\uC2E0\uADDC \uB4F1\uB85D\u00B7\uC774\uBC88 \uC5C5\uB85C\uB4DC \uC81C\uC678\uB97C \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB0A0\uC9DC\u00B7\uAE08\uC561 \uB4F1 \uB098\uBA38\uC9C0 \uC785\uB825 \uC624\uB958\uB294 \uC6D0\uBCF8 \uD30C\uC77C\uC744 \uC218\uC815\uD574 \uB2E4\uC2DC \uC120\uD0DD\uD558\uC138\uC694."));
    const reviewRows = preview ? preview.rows.filter((r) => r.status === "review") : [];
    const identicalRows = reviewRows.filter((r) => r.review_kind === "same_key");
    const reviewsComplete = reviewRows.every((r) => {
        const d = decisions[r.row_key];
        return (d === null || d === void 0 ? void 0 : d.confirmed) && r.allowed_actions.includes(d.action)
            && (d.action !== "separate" || (d.reason.trim().length >= 5 && d.reason.trim().length <= 500));
    });
    const separateRows = reviewRows.filter((r) => { var _a; return ((_a = decisions[r.row_key]) === null || _a === void 0 ? void 0 : _a.action) === "separate"; });
    const finalCount = ((preview === null || preview === void 0 ? void 0 : preview.ready_count) || 0) + separateRows.length;
    const finalAmount = ((preview === null || preview === void 0 ? void 0 : preview.total_amount) || 0) + separateRows.reduce((n, r) => n + r.amount, 0);
    const closeReview = () => { if (!busy)
        setReviewOpen(false); };
    const stateLabel = { pending: "승인 대기", approved: "승인 완료", rejected: "반려", in_file: "이번 파일" };
    return React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\uC218\uAE08\uB4F1\uB85D \uB370\uC774\uD130 \uC5C5\uB85C\uB4DC" },
            React.createElement("p", null, "\uC544\uB9C8\uB780\uC2A410 \uC218\uAE08\uC790\uB8CC\uB97C \uACE0\uAC1D\uCF54\uB4DC\uB85C \uC5F0\uACB0\uD569\uB2C8\uB2E4. \uD30C\uC77C \uC120\uD0DD \uD6C4 \uAC80\uC99D \uACB0\uACFC\uC640 \uAE08\uC561\uC744 \uD655\uC778\uD558\uACE0 \uB4F1\uB85D\uD558\uC138\uC694."),
            React.createElement("div", { className: "alert alert--info" },
                "\uC81C\uC608\uAE08 \u2192 \uACC4\uC88C\uC218\uAE08 \u00B7 \uCE74\uB4DC \u2192 \uCE74\uB4DC\uC218\uAE08 \u00B7 \uC5B4\uC74C \u2192 \uC5B4\uC74C\uC218\uAE08",
                React.createElement("br", null),
                "\uC218\uAE08\uC561 = \uC815\uC0C1\uC218\uAE08 + \uC120\uC218\uAE08. \uC2B9\uC778 \uC2DC \uAE30\uC874 \uCC44\uAD8C\uC5D0 \uC0C1\uACC4\uD558\uACE0 \uCD08\uACFC\uBD84\uC740 \uC120\uC218\uAE08\uC73C\uB85C \uBCF4\uAD00\uD569\uB2C8\uB2E4."),
            React.createElement("div", { className: "dropzone", style: { marginTop: 16 }, onDragOver: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); if (!busy)
                    readFile(e.dataTransfer.files[0]); } },
                React.createElement("p", null, "\uC218\uAE08 \uC5D1\uC140\uC744 \uB04C\uC5B4\uB2E4 \uB193\uAC70\uB098 \uD30C\uC77C\uC744 \uC120\uD0DD\uD558\uC138\uC694."),
                React.createElement("input", { type: "file", "aria-label": "\uC218\uAE08 \uC5D1\uC140 \uD30C\uC77C", accept: ".xlsx,.xls,.csv", disabled: busy, onChange: (e) => { const file = e.target.files[0]; e.target.value = ""; readFile(file); } }),
                React.createElement("p", { className: "t-sm t-muted" }, "\uCCAB \uBC88\uC9F8 \uC2DC\uD2B8 \u00B7 \uCD5C\uB300 5,000\uD589 / 10MB \u00B7 \uD569\uACC4\uD589 \uC790\uB3D9 \uC81C\uC678")),
            busy && React.createElement("p", { role: "status" }, "\uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694."),
            error && React.createElement("div", { className: "alert alert--bad", role: "alert", style: { marginTop: 12 } }, error),
            result && React.createElement("div", { className: "alert alert--info", role: "status", style: { marginTop: 12 } },
                "\uB4F1\uB85D ",
                result.inserted,
                "\uAC74 \u00B7 \uC989\uC2DC \uC2B9\uC778 ",
                result.approved,
                "\uAC74 \u00B7 \uC911\uBCF5 \uD655\uC778 \uC81C\uC678 ",
                result.skipped,
                "\uAC74 \u00B7 \uAC70\uB798\uCC98 \uD655\uC778 \uC81C\uC678 ",
                result.customer_excluded || 0,
                "\uAC74 \u00B7 ",
                won(result.total_amount),
                "\uC6D0",
                !!result.customers_created && React.createElement("div", null,
                    "\uC2E0\uADDC \uAC70\uB798\uCC98 ",
                    result.customers_created,
                    "\uACF3 \uB4F1\uB85D"),
                result.inserted > result.approved && React.createElement("div", null, "\uC218\uAE08 \uB4F1\uB85D \uBA54\uB274\uC5D0\uC11C \uC2B9\uC778\uD558\uBA74 \uCC44\uAD8C\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4."))),
        source && preview && React.createElement(Card, { title: "검증 결과 · " + source.filename },
            React.createElement("p", null,
                source.sheet,
                " \u00B7 \uC218\uAE08 \uB0B4\uC5ED ",
                preview.row_count,
                "\uD589 \u00B7 \uD569\uACC4\uD589 ",
                source.skippedTotals,
                "\uD589 \uC81C\uC678"),
            React.createElement("div", { className: "collection-upload-summary" },
                React.createElement("div", null,
                    React.createElement("span", null, "\uC2E0\uADDC \uB4F1\uB85D"),
                    React.createElement("b", null,
                        preview.ready_count,
                        "\uAC74")),
                React.createElement("div", null,
                    React.createElement("span", null, "\uC911\uBCF5 \uD655\uC778 \uD544\uC694"),
                    React.createElement("b", null,
                        preview.review_count || 0,
                        "\uAC74")),
                React.createElement("div", null,
                    React.createElement("span", null, "\uC624\uB958"),
                    React.createElement("b", null,
                        preview.error_count,
                        "\uAC74")),
                React.createElement("div", null,
                    React.createElement("span", null, "\uC2E0\uADDC \uC218\uAE08\uC561"),
                    React.createElement("b", null,
                        won(preview.total_amount),
                        "\uC6D0"))),
            React.createElement("p", null,
                "\uC2B9\uC778 \uC2DC \uC0C1\uACC4 \uC608\uC0C1 ",
                won(preview.offset_amount),
                "\uC6D0 \u00B7 \uC120\uC218\uAE08 \uC794\uC5EC \uC608\uC0C1 ",
                won(preview.advance_remaining),
                "\uC6D0"),
            React.createElement("p", { className: "t-sm t-muted" }, "\uC608\uC0C1\uC561\uC740 \uC911\uBCF5 \uD6C4\uBCF4\uB97C \uC81C\uC678\uD55C \uC2E0\uADDC \uAC74\uC758 \uD604\uC7AC \uC6D0\uC7A5 \uAE30\uC900\uC785\uB2C8\uB2E4. \uC911\uBCF5 \uD655\uC778 \uD6C4 \uB4F1\uB85D\u00B7\uC2B9\uC778 \uC2DC \uCD5C\uC2E0 \uC794\uC561\uC744 \uB2E4\uC2DC \uD655\uC778\uD569\uB2C8\uB2E4."),
            !!preview.error_count && errorDetails,
            React.createElement("div", { className: "btnrow", style: { marginTop: 12 } },
                React.createElement("button", { className: "btn btn--sm", "aria-pressed": errorsOnly, onClick: () => { setErrorsOnly(!errorsOnly); setPage(0); } }, errorsOnly ? "전체 내역 보기" : `오류 ${preview.error_count}건만 보기`),
                !!customerIssues.length && React.createElement("button", { className: "btn btn--sm", disabled: busy, onClick: () => { setReviewOpen(false); setCustomerOpen(true); } }, "\uAC70\uB798\uCC98 \uC5F0\uACB0\u00B7\uC2E0\uADDC \uB4F1\uB85D \uD655\uC778")),
            React.createElement("div", { className: "tablewrap", style: { marginTop: 12 } },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uD589"),
                            React.createElement("th", null, "\uAC80\uC99D"),
                            React.createElement("th", null, "\uC218\uAE08\uBC88\uD638 / \uC21C\uBC88"),
                            React.createElement("th", null, "\uACE0\uAC1D\uCF54\uB4DC"),
                            React.createElement("th", null, "\uAC70\uB798\uCC98"),
                            React.createElement("th", null, "\uC218\uAE08\uC77C"),
                            React.createElement("th", null, "\uC218\uAE08\uBC29\uBC95"),
                            React.createElement("th", { className: "r" }, "\uC815\uC0C1\uC218\uAE08"),
                            React.createElement("th", { className: "r" }, "\uC120\uC218\uAE08"),
                            React.createElement("th", { className: "r" }, "\uC218\uAE08\uC561"),
                            React.createElement("th", null, "\uAC80\uC99D \uB0B4\uC6A9"))),
                    React.createElement("tbody", null, pageRows.map((row) => {
                        var _a;
                        return React.createElement("tr", { key: row.row_key || row.row_number },
                            React.createElement("td", null, row.row_number),
                            React.createElement("td", null,
                                React.createElement("span", { className: "badge badge--" + ({ ready: "ok", error: "bad", review: "warn", excluded: "warn" }[row.status]) }, { ready: "신규", error: "오류", review: "중복 확인", excluded: "확인 후 제외" }[row.status])),
                            React.createElement("td", null,
                                row.receipt_no || "–",
                                " / ", (_a = row.sequence) !== null && _a !== void 0 ? _a : "–"),
                            React.createElement("td", null, row.source_customer_code && row.source_customer_code !== row.customer_code
                                ? `${row.source_customer_code} → ${row.customer_code}` : row.customer_code || "–"),
                            React.createElement("td", null, row.customer_name || row.source_customer_name || "–"),
                            React.createElement("td", null, row.paid_at || "–"),
                            React.createElement("td", null, row.method || "–"),
                            React.createElement("td", { className: "r" }, row.normal_amount === undefined ? "–" : won(row.normal_amount)),
                            React.createElement("td", { className: "r" }, row.advance_amount === undefined ? "–" : won(row.advance_amount)),
                            React.createElement("td", { className: "r" }, row.amount === undefined ? "–" : won(row.amount)),
                            React.createElement("td", { style: { minWidth: 220, whiteSpace: "normal" } }, [...row.errors, ...row.warnings].join(" / ") || "정상"));
                    })))),
            visibleRows.length > 50 && React.createElement("div", { className: "btnrow", style: { marginTop: 12 } },
                React.createElement("button", { className: "btn btn--sm", disabled: !page, onClick: () => setPage(page - 1) }, "\uC774\uC804"),
                React.createElement("span", null,
                    page + 1,
                    " / ",
                    Math.ceil(visibleRows.length / 50)),
                React.createElement("button", { className: "btn btn--sm", disabled: (page + 1) * 50 >= visibleRows.length, onClick: () => setPage(page + 1) }, "\uB2E4\uC74C")),
            can("collection_approve") && React.createElement("label", { className: "collection-upload-approve" },
                React.createElement("input", { type: "checkbox", checked: approve, disabled: busy, onChange: (e) => setApprove(e.target.checked) }),
                "\uB4F1\uB85D\uACFC \uB3D9\uC2DC\uC5D0 \uC2B9\uC778\u00B7\uC0C1\uACC4 (\uCC44\uAD8C\uC794\uC561\uC5D0 \uC989\uC2DC \uBC18\uC601)"),
            React.createElement("div", { className: "btnrow", style: { marginTop: 16 } },
                React.createElement("button", { className: "btn btn--primary", disabled: busy || !!preview.error_count || !(preview.ready_count + (preview.review_count || 0) + (preview.customer_excluded_count || 0)), onClick: () => preview.review_count ? setReviewOpen(true) : submit() }, busy ? "처리 중" : preview.review_count ? `중복 ${preview.review_count}건 확인 후 업로드`
                    : preview.ready_count ? `${preview.ready_count}건 ${approve ? "승인·상계" : "승인 대기로 등록"}` : "제외 확인 이력 저장"))),
        React.createElement(Card, { title: "\uC218\uAE08 \uC5C5\uB85C\uB4DC \uC774\uB825", flush: true },
            historyError && React.createElement("div", { className: "alert alert--bad" }, historyError),
            !history.length ? React.createElement(Empty, { title: "\uC218\uAE08 \uC5C5\uB85C\uB4DC \uC774\uB825\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }) : React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uB4F1\uB85D\uC77C\uC2DC"),
                            React.createElement("th", null, "\uD30C\uC77C\uBA85"),
                            React.createElement("th", { className: "r" }, "\uB4F1\uB85D \uAC74\uC218"),
                            React.createElement("th", { className: "r" }, "\uC218\uAE08\uC561"),
                            React.createElement("th", { className: "r" }, "\uB4F1\uB85D \uC2DC \uC989\uC2DC \uC2B9\uC778"),
                            React.createElement("th", null, "\uB4F1\uB85D\uC790"),
                            React.createElement("th", null, "\uC911\uBCF5\u00B7\uAC70\uB798\uCC98 \uD655\uC778"))),
                    React.createElement("tbody", null, history.map((row) => React.createElement("tr", { key: row.id },
                        React.createElement("td", null, row.created_at),
                        React.createElement("td", null, row.filename),
                        React.createElement("td", { className: "r" }, row.row_count),
                        React.createElement("td", { className: "r" }, won(row.total_amount)),
                        React.createElement("td", { className: "r" }, row.approved_count),
                        React.createElement("td", null, row.uploaded_by),
                        React.createElement("td", null, row.reviewed_count ? React.createElement("button", { className: "btn btn--sm", onClick: () => openReviewHistory(row) },
                            row.reviewed_count,
                            "\uAC74 \uD655\uC778 \u00B7 ",
                            row.excluded_count,
                            "\uAC74 \uC81C\uC678") : "–"))))))),
        customerOpen && preview && React.createElement("div", { className: "modal-backdrop", onMouseDown: () => { if (!busy)
                setCustomerOpen(false); } },
            React.createElement("section", { className: "modal-card modal-card--wide collection-review-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "collection-customer-title", onMouseDown: (e) => e.stopPropagation() },
                React.createElement("h2", { id: "collection-customer-title" }, "\uC785\uB825 \uC624\uB958 \u00B7 \uAC70\uB798\uCC98 \uD655\uC778"),
                React.createElement("p", null, "\uAC19\uC740 \uACE0\uAC1D\uCF54\uB4DC\uC758 \uD589\uC740 \uD568\uAED8 \uCC98\uB9AC\uD569\uB2C8\uB2E4. \uC120\uD0DD \uB0B4\uC6A9\uC744 \uC7AC\uAC80\uC99D\uD55C \uB4A4 \uCD5C\uC885 \uB4F1\uB85D\uD560 \uB54C \uAC70\uB798\uCC98\uC640 \uC218\uAE08\uC744 \uC800\uC7A5\uD569\uB2C8\uB2E4."),
                error && React.createElement("div", { className: "alert alert--bad", role: "alert" }, error),
                !!preview.error_count && errorDetails,
                React.createElement("div", { className: "collection-review-list" }, customerIssues.map((issue) => {
                    const d = customerDecisions[issue.issue_key] || {};
                    const selected = issue.candidates.find((c) => c.code === d.target_code);
                    return React.createElement("div", { className: "collection-review-item", key: issue.issue_key },
                        React.createElement("h3", null,
                            issue.source_names.join(" / ") || "거래처명 없음",
                            " \u00B7 \uC5D1\uC140 \uACE0\uAC1D\uCF54\uB4DC ",
                            issue.source_code),
                        React.createElement("p", null,
                            "\uC5D1\uC140 ",
                            issue.row_numbers.join(", "),
                            "\uD589 \u00B7 ",
                            issue.message),
                        !!issue.error && React.createElement("div", { className: "alert alert--bad" }, issue.error),
                        !!issue.candidates.length && React.createElement("div", { className: "tablewrap" },
                            React.createElement("table", null,
                                React.createElement("thead", null,
                                    React.createElement("tr", null,
                                        React.createElement("th", null, "\uAE30\uC874 \uACE0\uAC1D\uCF54\uB4DC"),
                                        React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                                        React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                                        React.createElement("th", { className: "r" }, "\uCC44\uAD8C\uC794\uC561"))),
                                React.createElement("tbody", null, issue.candidates.map((c) => React.createElement("tr", { key: c.code },
                                    React.createElement("td", null, c.code),
                                    React.createElement("td", null, c.name),
                                    React.createElement("td", null, c.biz_unit),
                                    React.createElement("td", { className: "r" },
                                        won(c.balance),
                                        "\uC6D0",
                                        c.balance !== c.ledger_balance && React.createElement("div", { className: "t-sm" }, "\uC0C1\uC138 \uC6D0\uC7A5 \uBD88\uC77C\uCE58 \u00B7 \uD655\uC778 \uD544\uC694"))))))),
                        React.createElement(Field, { label: "\uCC98\uB9AC \uBC29\uBC95" },
                            React.createElement("select", { className: "select", "aria-label": `${issue.source_code} 거래처 처리 방법`, disabled: busy, value: d.action || "", onChange: (e) => changeCustomer(issue.issue_key, { action: e.target.value, target_code: "" }) },
                                React.createElement("option", { value: "" }, "\uCC98\uB9AC \uBC29\uBC95 \uC120\uD0DD"),
                                issue.allowed_actions.includes("link") && React.createElement("option", { value: "link" }, "\uAE30\uC874 \uAC70\uB798\uCC98\uC5D0 \uC5F0\uACB0 \u00B7 \uC2B9\uC778 \uC2DC \uD574\uB2F9 \uCC44\uAD8C \uCC98\uB9AC"),
                                issue.allowed_actions.includes("create") && React.createElement("option", { value: "create" }, "\uC5D1\uC140 \uACE0\uAC1D\uCF54\uB4DC\uB85C \uC2E0\uADDC \uAC70\uB798\uCC98 \uB4F1\uB85D"),
                                React.createElement("option", { value: "exclude" }, "\uC774\uBC88 \uC5C5\uB85C\uB4DC\uC5D0\uC11C \uC81C\uC678"))),
                        !issue.allowed_actions.includes("create") && !issue.candidates.length && React.createElement("p", { className: "t-sm" }, "\uC2E0\uADDC \uAC70\uB798\uCC98 \uB4F1\uB85D\uC5D0\uB294 \uC218\uAE08 \uB4F1\uB85D \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4."),
                        d.action === "link" && React.createElement(React.Fragment, null,
                            React.createElement(Field, { label: "\uC5F0\uACB0\uD560 \uAE30\uC874 \uAC70\uB798\uCC98" },
                                React.createElement("select", { className: "select", "aria-label": `${issue.source_code} 연결 거래처`, disabled: busy, value: d.target_code || "", onChange: (e) => changeCustomer(issue.issue_key, { target_code: e.target.value }) },
                                    React.createElement("option", { value: "" }, "\uAE30\uC874 \uAC70\uB798\uCC98 \uC120\uD0DD"),
                                    issue.candidates.map((c) => React.createElement("option", { key: c.code, value: c.code },
                                        c.code,
                                        " \u00B7 ",
                                        c.name,
                                        " \u00B7 ",
                                        c.biz_unit,
                                        " \u00B7 \uCC44\uAD8C\uC794\uC561 ",
                                        won(c.balance),
                                        "\uC6D0")))),
                            React.createElement("div", { className: "alert alert--info" },
                                "\uC774\uBC88 \uC218\uAE08\uC740 \uC120\uD0DD\uD55C \uAC70\uB798\uCC98\uC5D0 \uC5F0\uACB0\uB429\uB2C8\uB2E4. \uC2B9\uC778 \uC2DC \uD574\uB2F9 \uCC44\uAD8C\uC744 \uC0C1\uACC4\uD558\uACE0 \uC794\uC561 \uCD08\uACFC\uBD84\uC740 \uC120\uC218\uAE08\uC73C\uB85C \uCC98\uB9AC\uD569\uB2C8\uB2E4.",
                                selected && React.createElement("div", null,
                                    "\uC5F0\uACB0 \uB300\uC0C1: ",
                                    selected.code,
                                    " \u00B7 ",
                                    selected.name,
                                    " / \uCC44\uAD8C\uC794\uC561 ",
                                    won(selected.balance),
                                    "\uC6D0"),
                                "\uAE30\uC874 \uACE0\uAC1D\uCF54\uB4DC\uC640 \uC6D0\uBCF8 \uC5D1\uC140\uC740 \uC720\uC9C0\uD558\uBA70, \uB2E4\uC74C \uD30C\uC77C\uC758 \uACE0\uAC1D\uCF54\uB4DC\uB97C \uC790\uB3D9 \uBCC0\uD658\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")),
                        d.action === "create" && React.createElement(React.Fragment, null,
                            React.createElement("div", { className: "formrow" },
                                React.createElement(Field, { label: "\uC2E0\uADDC \uAC70\uB798\uCC98\uBA85" },
                                    React.createElement("input", { className: "input", "aria-label": `${issue.source_code} 신규 거래처명`, value: d.name || "", disabled: busy, maxLength: 200, onChange: (e) => changeCustomer(issue.issue_key, { name: e.target.value }) })),
                                React.createElement(Field, { label: "\uC0AC\uC5C5\uBD80" },
                                    React.createElement("select", { className: "select", "aria-label": `${issue.source_code} 신규 사업부`, disabled: busy, value: d.biz_unit || "", onChange: (e) => changeCustomer(issue.issue_key, { biz_unit: e.target.value }) },
                                        React.createElement("option", { value: "" }, "\uC0AC\uC5C5\uBD80 \uC120\uD0DD"),
                                        ["덴탈", "메디컬", "에스테틱"].map((u) => React.createElement("option", { key: u }, u))))),
                            React.createElement("div", { className: "alert alert--info" },
                                "\uACE0\uAC1D\uCF54\uB4DC ",
                                issue.source_code,
                                "\uB85C \uCC44\uAD8C\uC794\uC561 0\uC6D0\u00B7\uD68C\uC218\uAE30\uAC04 \uBBF8\uC785\uB825 \uC0C1\uD0DC\uB85C \uB4F1\uB85D\uD569\uB2C8\uB2E4. \uC774\uBC88 \uC218\uAE08\uC740 \uC2B9\uC778 \uC2DC \uC120\uC218\uAE08\uC774 \uB429\uB2C8\uB2E4.",
                                !!issue.candidates.length && React.createElement("div", null, "\uAC19\uC740 \uC774\uB984\uC758 \uAE30\uC874 \uAC70\uB798\uCC98\uC640 \uBCC4\uB3C4\uB85C \uC0DD\uC131\uB418\uBA70, \uAE30\uC874 \uAC70\uB798\uCC98\uC758 \uCC44\uAD8C\uC5D0\uB294 \uC0C1\uACC4\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."))),
                        d.action === "exclude" && React.createElement("p", null,
                            "\uC774 \uACE0\uAC1D\uCF54\uB4DC\uC758 ",
                            issue.row_numbers.length,
                            "\uAC1C \uD589\uC744 \uC774\uBC88 \uC5C5\uB85C\uB4DC\uC5D0\uC11C \uC81C\uC678\uD558\uACE0 \uB2E4\uB978 \uB0B4\uC5ED\uC744 \uC9C4\uD589\uD569\uB2C8\uB2E4."),
                        !!d.action && React.createElement(Field, { label: d.action === "link" ? "연결 사유 (필수, 5~500자)" : "확인 사유 (선택, 500자 이내)" },
                            React.createElement("input", { className: "input", "aria-label": `${issue.source_code} 거래처 확인 사유`, value: d.reason || "", maxLength: 500, disabled: busy, onChange: (e) => changeCustomer(issue.issue_key, { reason: e.target.value }) })),
                        React.createElement("label", { className: "collection-review-check" },
                            React.createElement("input", { type: "checkbox", "aria-label": `${issue.source_code} 거래처 확인 완료`, disabled: busy || !d.action, checked: !!d.confirmed, onChange: (e) => changeCustomer(issue.issue_key, { confirmed: e.target.checked }) }),
                            "\uAC70\uB798\uCC98\uC640 \uCC44\uAD8C \uCC98\uB9AC \uB0B4\uC6A9\uC744 \uD655\uC778\uD588\uC73C\uBA70 \uC120\uD0DD\uD55C \uBC29\uBC95\uC73C\uB85C \uC9C4\uD589\uD569\uB2C8\uB2E4."));
                })),
                React.createElement("div", { className: "collection-review-footer" },
                    React.createElement("p", null, "\uB2E4\uC74C \uB2E8\uACC4\uC5D0\uC11C \uC911\uBCF5 \uC218\uAE08\uC744 \uB2E4\uC2DC \uD655\uC778\uD569\uB2C8\uB2E4. \uC2B9\uC778 \uB300\uAE30\uB85C \uB4F1\uB85D\uD55C \uC218\uAE08\uC740 \uC2B9\uC778 \uD6C4 \uCC44\uAD8C\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4."),
                    React.createElement("div", { className: "btnrow" },
                        React.createElement("button", { className: "btn", disabled: busy, onClick: () => setCustomerOpen(false) }, "\uB3CC\uC544\uAC00\uAE30"),
                        React.createElement("button", { className: "btn btn--primary", disabled: busy || !customersComplete, onClick: recheckCustomers }, busy ? "재검증 중" : "선택 반영 · 중복 재검증"))))),
        reviewOpen && preview && React.createElement("div", { className: "modal-backdrop", onMouseDown: closeReview },
            React.createElement("section", { className: "modal-card modal-card--wide collection-review-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "collection-review-title", onMouseDown: (e) => e.stopPropagation() },
                React.createElement("h2", { id: "collection-review-title" },
                    "\uC911\uBCF5 \uC218\uAE08 \uD655\uC778 \u00B7 ",
                    reviewRows.length,
                    "\uAC74"),
                React.createElement("p", null, "\uAE30\uC874 \uB0B4\uC5ED\uACFC \uBE44\uAD50\uD55C \uB4A4 \uAC01 \uAC74\uC758 \uD655\uC778\uB780\uC744 \uCCB4\uD06C\uD558\uC138\uC694. \uC911\uBCF5\uC73C\uB85C \uD655\uC778\uD55C \uD589\uC740 \uC81C\uC678\uD558\uACE0 \uC2E0\uADDC \uB0B4\uC5ED\uC740 \uACC4\uC18D \uB4F1\uB85D\uD569\uB2C8\uB2E4."),
                React.createElement("p", { className: "t-sm t-muted" }, "\uC218\uAE08\uBC88\uD638\u00B7\uC21C\uBC88\uC774 \uAC19\uC740 \uB0B4\uC5ED\uC740 \uCD94\uAC00 \uC0DD\uC131\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB0B4\uC6A9 \uC815\uC815\uC774 \uD544\uC694\uD558\uBA74 \uD30C\uC77C \uB610\uB294 \uAE30\uC874 \uC218\uAE08 \uB0B4\uC5ED\uC744 \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694."),
                error && React.createElement("div", { className: "alert alert--bad", role: "alert" }, error),
                !!preview.error_count && errorDetails,
                !!identicalRows.length && React.createElement("label", { className: "collection-review-check" },
                    React.createElement("input", { type: "checkbox", disabled: busy, checked: identicalRows.every((r) => { var _a, _b; return ((_a = decisions[r.row_key]) === null || _a === void 0 ? void 0 : _a.confirmed) && ((_b = decisions[r.row_key]) === null || _b === void 0 ? void 0 : _b.action) === "exclude"; }), onChange: (e) => {
                            const checked = e.target.checked;
                            setDecisions((current) => ({ ...current,
                                ...Object.fromEntries(identicalRows.map((r) => [r.row_key, { action: "exclude", reason: "", confirmed: checked }])) }));
                        } }),
                    "\uB0B4\uC6A9\uC774 \uB3D9\uC77C\uD55C \uAE30\uB4F1\uB85D ",
                    identicalRows.length,
                    "\uAC74\uC744 \uBAA8\uB450 \uC911\uBCF5\uC73C\uB85C \uD655\uC778"),
                React.createElement("div", { className: "collection-review-list" }, reviewRows.map((row) => {
                    var _a, _b, _c, _d, _e;
                    return React.createElement("div", { className: "collection-review-item", key: row.row_key },
                        React.createElement("b", null,
                            "\uC5D1\uC140 ",
                            row.row_number,
                            "\uD589 \u00B7 ",
                            row.receipt_no,
                            " / ",
                            row.sequence),
                        React.createElement("p", null, row.warnings[row.warnings.length - 1]),
                        React.createElement("div", { className: "tablewrap" },
                            React.createElement("table", null,
                                React.createElement("thead", null,
                                    React.createElement("tr", null,
                                        React.createElement("th", null, "\uAD6C\uBD84"),
                                        React.createElement("th", null, "\uAC70\uB798\uCC98 / \uCF54\uB4DC"),
                                        React.createElement("th", null, "\uC218\uAE08\uC77C"),
                                        React.createElement("th", null, "\uBC29\uBC95"),
                                        React.createElement("th", { className: "r" }, "\uC218\uAE08\uC561"),
                                        React.createElement("th", null, "\uC815\uC0C1\uC218\uAE08 / \uC120\uC218\uAE08"),
                                        React.createElement("th", null, "\uC0C1\uD0DC\u00B7\uB4F1\uB85D\uC790"))),
                                React.createElement("tbody", null,
                                    React.createElement("tr", null,
                                        React.createElement("td", null, "\uC774\uBC88 \uC5C5\uB85C\uB4DC"),
                                        React.createElement("td", null,
                                            row.customer_name,
                                            React.createElement("br", null),
                                            row.customer_code),
                                        React.createElement("td", null, row.paid_at),
                                        React.createElement("td", null, row.method),
                                        React.createElement("td", { className: "r" }, won(row.amount)),
                                        React.createElement("td", null,
                                            won(row.normal_amount),
                                            " / ",
                                            won(row.advance_amount)),
                                        React.createElement("td", null, "\uB4F1\uB85D \uC804")),
                                    row.candidates.map((c, i) => React.createElement("tr", { key: i },
                                        React.createElement("td", null,
                                            c.id ? `기존 #${c.id}` : `파일 ${c.row_number}행`,
                                            React.createElement("br", null),
                                            c.receipt_no ? `${c.receipt_no} / ${c.sequence}` : "수기등록"),
                                        React.createElement("td", null,
                                            c.customer_name,
                                            React.createElement("br", null),
                                            c.customer_code),
                                        React.createElement("td", null, c.paid_at),
                                        React.createElement("td", null, c.method),
                                        React.createElement("td", { className: "r" }, won(c.amount)),
                                        React.createElement("td", null,
                                            c.normal_amount == null ? "–" : won(c.normal_amount),
                                            " / ",
                                            c.advance_amount == null ? "–" : won(c.advance_amount)),
                                        React.createElement("td", null,
                                            stateLabel[c.state] || c.state,
                                            React.createElement("br", null),
                                            c.registered_by || "")))))),
                        row.allowed_actions.includes("separate") && React.createElement("div", { className: "formrow", style: { marginTop: 12 } },
                            React.createElement(Field, { label: "\uD655\uC778 \uACB0\uACFC" },
                                React.createElement("select", { className: "select", "aria-label": `엑셀 ${row.row_number}행 처리 방법`, disabled: busy, value: ((_a = decisions[row.row_key]) === null || _a === void 0 ? void 0 : _a.action) || "exclude", onChange: (e) => changeDecision(row.row_key, { action: e.target.value, confirmed: false }) },
                                    React.createElement("option", { value: "exclude" }, "\uC911\uBCF5 \uC218\uAE08 \u00B7 \uC774\uBC88 \uD589 \uC81C\uC678"),
                                    React.createElement("option", { value: "separate" }, "\uC911\uBCF5 \uC544\uB2D8 \u00B7 \uBCC4\uB3C4 \uC218\uAE08 \uB4F1\uB85D"))),
                            ((_b = decisions[row.row_key]) === null || _b === void 0 ? void 0 : _b.action) === "separate" && React.createElement(Field, { label: "\uBCC4\uB3C4 \uC218\uAE08 \uB4F1\uB85D \uC0AC\uC720 (5~500\uC790)" },
                                React.createElement("input", { className: "input", "aria-label": `엑셀 ${row.row_number}행 별도 등록 사유`, maxLength: 500, disabled: busy, value: ((_c = decisions[row.row_key]) === null || _c === void 0 ? void 0 : _c.reason) || "", onChange: (e) => changeDecision(row.row_key, { reason: e.target.value, confirmed: false }) }))),
                        React.createElement("label", { className: "collection-review-check" },
                            React.createElement("input", { type: "checkbox", disabled: busy, "aria-label": `엑셀 ${row.row_number}행 중복 여부 확인`, checked: !!((_d = decisions[row.row_key]) === null || _d === void 0 ? void 0 : _d.confirmed), onChange: (e) => changeDecision(row.row_key, { confirmed: e.target.checked }) }),
                            ((_e = decisions[row.row_key]) === null || _e === void 0 ? void 0 : _e.action) === "separate" ? "별도 수금임을 확인하고 등록합니다." : "중복 여부를 확인했으며 이번 업로드에서 이 행을 제외합니다."));
                })),
                React.createElement("div", { className: "collection-review-footer" },
                    React.createElement("b", null,
                        "\uB4F1\uB85D \uC608\uC815 ",
                        finalCount,
                        "\uAC74 \u00B7 ",
                        won(finalAmount),
                        "\uC6D0 / \uC911\uBCF5 \uC81C\uC678 \uC608\uC815 ",
                        reviewRows.length - separateRows.length,
                        "\uAC74 / \uAC70\uB798\uCC98 \uD655\uC778 \uC81C\uC678 ",
                        preview.customer_excluded_count || 0,
                        "\uAC74"),
                    can("collection_approve") && React.createElement("label", { className: "collection-review-check" },
                        React.createElement("input", { type: "checkbox", checked: approve, disabled: busy, onChange: (e) => setApprove(e.target.checked) }),
                        "\uB4F1\uB85D\uACFC \uB3D9\uC2DC\uC5D0 \uC2B9\uC778\u00B7\uC0C1\uACC4 (\uCC44\uAD8C\uC794\uC561\uC5D0 \uC989\uC2DC \uBC18\uC601)"),
                    React.createElement("div", { className: "btnrow" },
                        React.createElement("button", { className: "btn", disabled: busy, onClick: closeReview }, "\uB3CC\uC544\uAC00\uAE30"),
                        React.createElement("button", { className: "btn btn--primary", disabled: busy || !reviewsComplete || !!preview.error_count, onClick: submit }, busy ? "처리 중" : finalCount ? `확인 완료 · ${finalCount}건 ${approve ? "승인·상계" : "등록"}` : "중복 확인 완료 · 제외 이력 저장"))))),
        reviewHistory && React.createElement("div", { className: "modal-backdrop", onMouseDown: () => setReviewHistory(null) },
            React.createElement("section", { className: "modal-card modal-card--wide collection-review-history", role: "dialog", "aria-modal": "true", "aria-labelledby": "collection-review-history-title", onMouseDown: (e) => e.stopPropagation() },
                React.createElement("h2", { id: "collection-review-history-title" }, "\uC911\uBCF5\u00B7\uAC70\uB798\uCC98 \uD655\uC778 \uC774\uB825"),
                React.createElement("p", null, reviewHistory.batch.filename),
                React.createElement("div", { className: "tablewrap" },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "\uC5D1\uC140 \uD589 / \uC218\uAE08\uBC88\uD638"),
                                React.createElement("th", null, "\uCC98\uB9AC"),
                                React.createElement("th", null, "\uC0AC\uC720"),
                                React.createElement("th", null, "\uD655\uC778\uC790"),
                                React.createElement("th", null, "\uD655\uC778\uC77C\uC2DC"))),
                        React.createElement("tbody", null, reviewHistory.rows.map((r) => {
                            var _a, _b, _c, _d;
                            return React.createElement("tr", { key: r.id },
                                React.createElement("td", null,
                                    r.row_number,
                                    "\uD589 \u00B7 ",
                                    r.receipt_no,
                                    " / ",
                                    r.sequence),
                                React.createElement("td", null,
                                    { exclude: "중복 확인·제외", separate: "별도 수금 등록", customer_link: "기존 거래처 연결",
                                        customer_create: ((_a = r.details) === null || _a === void 0 ? void 0 : _a.created) ? "신규 거래처 등록" : "신규 선택 · 수금 제외로 생성 안함", customer_exclude: "거래처 확인·이번 업로드 제외" }[r.action] || r.action,
                                    ((_b = r.details) === null || _b === void 0 ? void 0 : _b.selection) && React.createElement("div", { className: "t-sm" },
                                        "\uC5D1\uC140 ", (_c = r.details.source) === null || _c === void 0 ? void 0 :
                                        _c.customer_code,
                                        " \u00B7 ", (_d = r.details.source) === null || _d === void 0 ? void 0 :
                                        _d.customer_name,
                                        r.details.selection.customer && React.createElement("div", null,
                                            "\u2192 ",
                                            r.details.selection.customer.code,
                                            " \u00B7 ",
                                            r.details.selection.customer.name,
                                            " \u00B7 ",
                                            r.details.selection.customer.biz_unit))),
                                React.createElement("td", null, r.reason || "확인란 체크 후 처리"),
                                React.createElement("td", null, r.reviewed_by),
                                React.createElement("td", null, r.created_at));
                        })))),
                React.createElement("button", { className: "btn", onClick: () => setReviewHistory(null) }, "\uB2EB\uAE30"))));
}
/* ══════════════════ 출고 데이터 업로드 ══════════════════ */
const COLUMN_ALIASES = {
    code: ["거래처코드", "코드", "거래처 코드", "고객코드", "code"],
    name: ["거래처명", "거래처", "업체명", "고객명", "고객", "name"],
    biz_unit: ["사업부", "사업부문", "부문", "대분류", "unit"],
    status: ["채권분류", "분류", "채권상태", "상태", "status"],
    collection_period: ["회수기간(개월)", "회수기간", "collection_period"],
    total_amount: ["합계액", "합계금액", "총금액", "total_amount"],
    shipment_amount: ["출고금액", "출고액", "shipment_amount"],
    shipment_date: ["출고일자", "출고일", "처리일자", "처리일", "출하일자", "출하일", "거래일자", "shipment_date"],
    balance: ["미수잔액", "미수금액", "채권잔액", "잔액", "미수금", "balance"],
    normal_balance: ["정상채권잔액", "정상채권", "normal_balance"],
    normal_later_balance: ["차차월이후정상채권", "차차월이후", "10월이후수금대상", "정상채권10월이후", "normal_later_balance"],
    normal_next_balance: ["익월정상채권", "익월", "9월수금대상", "정상채권9월분", "normal_next_balance"],
    normal_current_balance: ["당월정상채권", "당월", "8월수금대상", "정상채권8월분", "normal_current_balance"],
    normal_collected: ["정상채권수금현황", "정상채권수금액", "normal_collected"],
    overdue_balance: ["미수채권(11개월내)", "11개월내", "overdue_balance"],
    overdue_source_balance: ["미수채권기초잔액", "overdue_source_balance"],
    overdue_collected: ["미수채권수금현황", "미수채권수금액", "overdue_collected"],
    bad_balance: ["부실채권(12개월이상)", "12개월이상", "bad_balance"],
    advance: ["선수금", "선수금액", "advance"],
    overdue_months: ["연체기간(개월)", "연체개월", "연체기간개월"],
    overdue_days: ["경과일", "연체일", "경과일수", "연체일수"],
    last_paid_at: ["최종수금일", "최근수금일", "최종입금일"],
    note: ["비고", "특이사항", "메모"],
};
const AMARANTH_UNIT_MAP = {
    "제품_덴탈_국내": "덴탈",
    "제품_메디컬_국내": "메디컬",
    "제품_에스테틱_국내": "에스테틱",
    "반제품_덴탈_국내": "덴탈",
    "반제품_메디컬_국내": "메디컬",
    "반제품_에스테틱_국내": "에스테틱",
};
function mapHeaders(headers) {
    const map = {};
    const cleaned = headers.map((h) => String(h || "").replace(/\s/g, ""));
    // '고객'이 '고객코드'에 먼저 걸리는 일을 막기 위해 정확히 같은 머리글을 최우선으로 찾는다.
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        const normalized = aliases.map((a) => a.replace(/\s/g, ""));
        const exact = cleaned.findIndex((header) => normalized.includes(header));
        if (exact >= 0)
            map[field] = exact;
    }
    // 과거 서식의 부가 문구가 붙은 머리글만 부분 일치로 보완한다.
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (map[field] !== undefined)
            continue;
        const normalized = aliases.map((a) => a.replace(/\s/g, ""));
        const fuzzy = cleaned.findIndex((header) => normalized.some((a) => a && header.includes(a)));
        if (fuzzy >= 0)
            map[field] = fuzzy;
    }
    return map;
}
function Upload({ data, can, notify, applyUpload, refresh }) {
    const [month, setMonth] = useState(thisMonth());
    const [shipmentDate, setShipmentDate] = useState(data.meta.today);
    const [parsed, setParsed] = useState(null);
    const [error, setError] = useState("");
    const [over, setOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const lockOf = (m) => data.locks.find((l) => l.month === m);
    const locked = !!(lockOf(month) && lockOf(month).locked);
    const unassignedUnits = parsed ? parsed.rows.filter((r) => r.requires_unit_selection && !data.meta.units.includes(r.biz_unit)).length : 0;
    function selectRowUnit(index, unit) {
        setParsed((current) => ({ ...current, rows: current.rows.map((row, i) => i === index ? { ...row, biz_unit: unit } : row) }));
    }
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
                const shipmentMode = map.total_amount !== undefined || map.shipment_amount !== undefined;
                const cleanHeaders = (grid[headerRow] || []).map((h) => String(h || "").replace(/\s/g, ""));
                const amaranthMode = ["고객코드", "고객", "대분류", "합계액"]
                    .every((header) => cleanHeaders.includes(header));
                const required = shipmentMode
                    ? ["code", "name", "biz_unit"]
                    : ["code", "name", "biz_unit", "normal_balance", "overdue_balance", "bad_balance"];
                const missing = required.filter((field) => map[field] === undefined);
                if (missing.length) {
                    setError("필수 열이 없습니다: " + missing.map((field) => ({
                        code: "거래처코드", name: "거래처명", biz_unit: "사업부", normal_balance: "정상채권잔액",
                        overdue_balance: "미수채권(11개월 내)", bad_balance: "부실채권(12개월 이상)",
                        collection_period: "회수기간(개월)", shipment_amount: "출고금액",
                    })[field]).join(", "));
                    return;
                }
                const rows = [], issues = [];
                for (let i = headerRow + 1; i < grid.length; i++) {
                    const raw = grid[i] || [];
                    const pick = (f) => (map[f] === undefined ? "" : raw[map[f]]);
                    const code = String(pick("code") || "").trim();
                    if (!code || /^#REF|^#N\/A/.test(code))
                        continue;
                    const normalizedCode = /^\d+$/.test(code) ? code.padStart(5, "0") : code;
                    const name = String(pick("name") || "").trim();
                    const rawBizUnit = String(pick("biz_unit") || "").trim();
                    const category = rawBizUnit.replace(/\s/g, "");
                    const requiresUnitSelection = shipmentMode && category === "반제품";
                    const bizUnit = amaranthMode ? (AMARANTH_UNIT_MAP[category] || "")
                        : (requiresUnitSelection ? "" : rawBizUnit);
                    if (!name)
                        issues.push((i + 1) + "행: 거래처명 누락");
                    if (!data.meta.units.includes(bizUnit) && !requiresUnitSelection) {
                        issues.push((i + 1) + "행: 사업부 오류 (" + (rawBizUnit || "미입력") + ")");
                    }
                    const rawPeriod = pick("collection_period");
                    const period = rawPeriod === "" || rawPeriod == null ? 1 : rawPeriod;
                    if (shipmentMode && (Number(period) < 0 || !Number.isFinite(Number(period)))) {
                        issues.push((i + 1) + "행: 회수기간 오류");
                    }
                    const rawShipmentDate = pick("shipment_date");
                    const rowShipmentDate = normalizeShipmentDate(rawShipmentDate);
                    if (shipmentMode && map.shipment_date !== undefined && !rowShipmentDate) {
                        issues.push((i + 1) + "행: 출고일 오류");
                    }
                    rows.push({
                        code: normalizedCode,
                        name,
                        biz_unit: bizUnit,
                        requires_unit_selection: requiresUnitSelection,
                        status: String(pick("status") || "").trim(),
                        owner: "",
                        collection_period: period,
                        collection_period_confirmed: !(rawPeriod === "" || rawPeriod == null),
                        // 아마란스 유상·무상·견본 값과 무관하게 합계액을 출고채권 원금으로 사용한다.
                        // 합계액이 없는 과거 서식만 기존 출고금액 열을 사용하며 공란과 0은 모두 0으로 처리한다.
                        total_amount: map.total_amount !== undefined ? parseUploadAmount(pick("total_amount")) : null,
                        shipment_amount: parseUploadAmount(map.total_amount !== undefined ? pick("total_amount") : pick("shipment_amount")),
                        shipment_date: rowShipmentDate,
                        shipment_month: rowShipmentDate ? rowShipmentDate.slice(0, 7) : "",
                        balance: pick("balance"),
                        normal_balance: pick("normal_balance"),
                        normal_later_balance: pick("normal_later_balance"),
                        normal_next_balance: pick("normal_next_balance"),
                        normal_current_balance: pick("normal_current_balance"),
                        normal_collected: pick("normal_collected"),
                        overdue_balance: pick("overdue_balance"),
                        overdue_source_balance: pick("overdue_source_balance") || pick("overdue_balance"),
                        overdue_collected: pick("overdue_collected"),
                        bad_balance: pick("bad_balance"),
                        advance: pick("advance"),
                        overdue_days: map.overdue_months !== undefined
                            ? (Number(pick("overdue_months")) || 0) * 30 : pick("overdue_days"),
                        last_paid_at: String(pick("last_paid_at") || "").trim(),
                        note: String(pick("note") || "").trim(),
                    });
                }
                let preparedRows = rows;
                let multiUnitCodes = [];
                if (amaranthMode) {
                    const grouped = new Map();
                    rows.forEach((r, index) => {
                        // 사업부가 없는 반제품은 선택 전에 합치지 않는다. 같은 거래처라도 사업부가 다를 수 있다.
                        const key = (r.shipment_month || month) + "|" + r.code + "|" + r.biz_unit
                            + (r.requires_unit_selection ? "|unassigned:" + index : "");
                        const current = grouped.get(key);
                        if (current) {
                            current.shipment_amount = parseUploadAmount(current.shipment_amount) + parseUploadAmount(r.shipment_amount);
                            current.total_amount = current.shipment_amount;
                            if (r.shipment_date > current.shipment_date)
                                current.shipment_date = r.shipment_date;
                        }
                        else {
                            const amount = parseUploadAmount(r.shipment_amount);
                            grouped.set(key, { ...r, shipment_amount: amount, total_amount: amount });
                        }
                    });
                    preparedRows = Array.from(grouped.values());
                    const unitsByCode = new Map();
                    preparedRows.forEach((r) => {
                        if (!unitsByCode.has(r.code))
                            unitsByCode.set(r.code, new Set());
                        unitsByCode.get(r.code).add(r.biz_unit);
                    });
                    multiUnitCodes = Array.from(unitsByCode.entries())
                        .filter(([, units]) => units.size > 1).map(([code]) => code);
                }
                const seen = new Set(), dupes = [];
                preparedRows.forEach((r) => {
                    if (!amaranthMode && seen.has(r.code))
                        dupes.push(r.code);
                    seen.add(r.code);
                });
                const fileDated = shipmentMode && map.shipment_date !== undefined;
                const shipmentMonths = [...new Set(preparedRows.map((r) => r.shipment_month).filter(Boolean))].sort();
                setParsed({ filename: file.name, rows: preparedRows, dupes, issues,
                    mapped: Object.keys(map), amaranthMode, multiUnitCodes,
                    fileDated, shipmentMonths,
                    mode: shipmentMode ? "shipment" : "snapshot" });
            }
            catch (err) {
                setError("파일을 읽지 못했습니다: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
    async function send() {
        if (!parsed || unassignedUnits > 0) {
            notify("반제품의 사업부를 모두 선택한 뒤 반영하세요.", true);
            return;
        }
        setBusy(true);
        try {
            let res;
            if (parsed.mode === "shipment" && parsed.fileDated) {
                const groups = parsed.rows.reduce((result, row) => {
                    var _a;
                    (result[_a = row.shipment_month] || (result[_a] = [])).push(row);
                    return result;
                }, {});
                const skipped = [], applied = [];
                for (const targetMonth of Object.keys(groups).sort()) {
                    const lock = lockOf(targetMonth);
                    if (lock && lock.locked) {
                        skipped.push(targetMonth);
                        continue;
                    }
                    const groupRows = groups[targetMonth];
                    const reflectedDate = groupRows.map((r) => r.shipment_date).sort().at(-1);
                    res = await api("/api/uploads", { method: "POST", body: {
                            month: targetMonth, shipment_date: reflectedDate, filename: parsed.filename,
                            rows: groupRows, mode: "shipment",
                        } });
                    applied.push(targetMonth + " " + res.inserted + "행");
                }
                if (!res)
                    throw new Error("파일에 포함된 출고월이 모두 마감되어 반영할 데이터가 없습니다.");
                applyUpload(res);
                notify("반영: " + applied.join(" · ") + (skipped.length ? " · 마감월 제외: " + skipped.join(", ") : ""));
            }
            else {
                res = await api("/api/uploads", {
                    method: "POST",
                    body: { month, shipment_date: shipmentDate, filename: parsed.filename,
                        rows: parsed.rows, mode: parsed.mode },
                });
                applyUpload(res);
                notify(res.inserted + "행을 반영했습니다. 기존 " + res.replaced + "행은 교체되었습니다.");
            }
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
    async function rollbackUpload(upload) {
        const restored = upload.restore_filename || "직전 상태";
        if (!window.confirm(`최근 업로드 '${upload.filename}'을 삭제하고 '${restored}' 상태로 복원할까요?\n복원 후에는 되돌릴 수 없습니다.`))
            return;
        setBusy(true);
        try {
            const res = await api("/api/uploads/" + upload.id, { method: "DELETE" });
            applyUpload(res);
            notify(`'${res.removed_filename}'을 삭제하고 '${res.restored_filename}' 상태로 복원했습니다.`);
        }
        catch (e) {
            notify(e.message, true);
        }
        setBusy(false);
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\uCD9C\uACE0 \uB370\uC774\uD130 \uC5C5\uB85C\uB4DC" },
            React.createElement("div", { className: "formrow" },
                React.createElement(Field, { label: "\uAE30\uC900\uC6D4" },
                    React.createElement("input", { className: "input", type: "month", value: month, onChange: (e) => setMonth(e.target.value) })),
                React.createElement(Field, { label: "\uCD9C\uACE0\uAE30\uC900\uC77C" },
                    React.createElement("input", { className: "input", type: "date", value: shipmentDate, onChange: (e) => setShipmentDate(e.target.value) })),
                React.createElement(Field, { label: "\uB9C8\uAC10 \uC0C1\uD0DC" },
                    React.createElement("div", { className: "btnrow", style: { alignItems: "center", minHeight: 38 } },
                        React.createElement("span", { className: "badge badge--" + (locked ? "bad" : "ok") }, locked ? "잠김" : "열림"),
                        can("month_lock") && (React.createElement("button", { className: "btn btn--sm", onClick: toggleLock }, locked ? "잠금 해제" : "마감 잠금"))))),
            React.createElement("div", { className: "dropzone" + (over ? " is-over" : ""), onDragOver: (e) => { e.preventDefault(); setOver(true); }, onDragLeave: () => setOver(false), onDrop: (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0])
                    readFile(e.dataTransfer.files[0]); } },
                React.createElement("p", { style: { margin: "0 0 10px" } }, "\uC5D1\uC140 \uD30C\uC77C\uC744 \uB04C\uC5B4\uB2E4 \uB193\uAC70\uB098 \uC544\uB798\uC5D0\uC11C \uC120\uD0DD\uD558\uC138\uC694."),
                React.createElement("input", { ref: fileRef, type: "file", accept: ".xlsx,.xls,.csv", onChange: (e) => e.target.files[0] && readFile(e.target.files[0]) }),
                React.createElement("p", { className: "t-sm t-muted", style: { margin: "12px 0 0" } },
                    "\uC544\uB9C8\uB780\uC2A410 \uCD9C\uACE0\uD604\uD669 \uC6D0\uBCF8: E\uC5F4 \uACE0\uAC1D\uCF54\uB4DC \u00B7 F\uC5F4 \uACE0\uAC1D \u00B7 AK\uC5F4 \uB300\uBD84\uB958 \u00B7 AB\uC5F4 \uD569\uACC4\uC561\uC744 \uC790\uB3D9 \uC778\uC2DD\uD569\uB2C8\uB2E4.",
                    React.createElement("br", null),
                    "\uC81C\uD488\u00B7\uBC18\uC81C\uD488 \uBAA8\uB450 \uCC44\uAD8C\uC73C\uB85C \uBC18\uC601\uD569\uB2C8\uB2E4. \uB300\uBD84\uB958\uAC00 '\uBC18\uC81C\uD488'\uB9CC \uC788\uB294 \uACBD\uC6B0 \uC544\uB798\uC5D0\uC11C \uC0AC\uC5C5\uBD80\uB97C \uC120\uD0DD\uD558\uC138\uC694.")),
            error && React.createElement("div", { className: "alert alert--bad", style: { marginTop: 12 } }, error),
            locked && (!parsed || !parsed.fileDated) && (React.createElement("div", { className: "alert alert--warn", style: { marginTop: 12 } },
                month,
                " \uC740 \uB9C8\uAC10 \uC7A0\uAE08 \uC0C1\uD0DC\uB77C \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uAE08\uC744 \uD574\uC81C\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.")),
            parsed && (React.createElement("div", { style: { marginTop: 16 } },
                React.createElement("div", { className: "alert alert--info" },
                    React.createElement("b", null, parsed.filename),
                    " \u2014 \uC720\uD6A8\uD55C ",
                    parsed.rows.length,
                    "\uD589\uC744 \uC77D\uC5C8\uC2B5\uB2C8\uB2E4.",
                    parsed.amaranthMode && " 아마란스10 원본 서식으로 인식했습니다.",
                    parsed.fileDated && " 출고일 기준으로 " + parsed.shipmentMonths.join(", ") + " 월을 자동 분리합니다.",
                    "\uC778\uC2DD\uD55C \uC5F4: ",
                    parsed.mapped.length,
                    "\uAC1C.",
                    parsed.dupes.length > 0 && (parsed.amaranthMode
                        ? " 복수 사업부 코드 " + parsed.dupes.length + "건을 사업부별로 분리합니다."
                        : " 중복 코드 " + parsed.dupes.length + "건이 있습니다.")),
                (parsed.dupes.length > 0 || parsed.issues.length > 0) && (React.createElement("div", { className: "alert alert--bad", style: { marginTop: 10 } },
                    "\uC5C5\uB85C\uB4DC \uC804 \uC218\uC815 \uD544\uC694: ",
                    parsed.dupes.length > 0 && "중복 코드 " + parsed.dupes.join(", "),
                    parsed.dupes.length > 0 && parsed.issues.length > 0 && " · ",
                    parsed.issues.slice(0, 8).join(" · "),
                    parsed.issues.length > 8 && " 외 " + (parsed.issues.length - 8) + "건")),
                unassignedUnits > 0 && (React.createElement("div", { className: "alert alert--warn", style: { marginTop: 10 } },
                    "\uBC18\uC81C\uD488 ",
                    unassignedUnits,
                    "\uAC74\uC758 \uC0AC\uC5C5\uBD80\uB97C \uC120\uD0DD\uD558\uC138\uC694. \uC544\uB798 \uD45C\uC5D0\uC11C \uB374\uD0C8\u00B7\uBA54\uB514\uCEEC\u00B7\uC5D0\uC2A4\uD14C\uD2F1 \uC911 \uC120\uD0DD\uD558\uBA74 \uBC18\uC601\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.")),
                React.createElement("p", { className: "t-sm t-muted" },
                    parsed.mode === "shipment"
                        ? (parsed.fileDated ? "각 행의 출고월별로 재설정하며 마감된 월은 자동 제외합니다."
                            : month + " 출고분만 재설정하며 회수기간에 따라 수금대상월을 자동 산출합니다.")
                        : month + " 의 기존 확정 채권 데이터를 교체합니다.",
                    " \uB2E4\uB978 \uC6D4 \uB370\uC774\uD130\uB294 \uADF8\uB300\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4."),
                React.createElement("div", { className: "tablewrap", style: { maxHeight: 260, overflowY: "auto", marginBottom: 12 } },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                parsed.fileDated && React.createElement("th", null, "\uCD9C\uACE0\uC77C"),
                                React.createElement("th", null, "\uCF54\uB4DC"),
                                React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"),
                                React.createElement("th", null, "\uC0AC\uC5C5\uBD80"),
                                React.createElement("th", null, parsed.mode === "shipment" ? "회수기간" : "분류"),
                                React.createElement("th", { className: "r" }, parsed.mode === "shipment" ? "출고금액" : "채권잔액"))),
                        React.createElement("tbody", null, parsed.rows.map((r, i) => (React.createElement("tr", { key: i },
                            parsed.fileDated && React.createElement("td", { className: "num" }, r.shipment_date),
                            React.createElement("td", { className: "num" }, r.code),
                            React.createElement("td", null, r.name),
                            React.createElement("td", null, r.requires_unit_selection ? (React.createElement("select", { className: "input", value: r.biz_unit, disabled: busy, "aria-label": r.code + " " + r.name + " 반제품 사업부", onChange: (e) => selectRowUnit(i, e.target.value) },
                                React.createElement("option", { value: "" }, "\uBC18\uC81C\uD488 \uC0AC\uC5C5\uBD80 \uC120\uD0DD"),
                                data.meta.units.map((unit) => React.createElement("option", { key: unit, value: unit }, unit)))) : (r.biz_unit || "–")),
                            React.createElement("td", null, parsed.mode === "shipment" ? r.collection_period + "개월" : (r.status || "자동판정")),
                            React.createElement("td", { className: "r num" }, won(parsed.mode === "shipment" ? r.shipment_amount : r.balance)))))))),
                React.createElement("div", { className: "btnrow" },
                    React.createElement("button", { className: "btn btn--primary", onClick: send, disabled: busy || unassignedUnits > 0 || (!parsed.fileDated && locked) || (!parsed.fileDated && !shipmentDate) || parsed.dupes.length > 0 || parsed.issues.length > 0 }, parsed.fileDated ? "출고월별 데이터 반영" : month + " 데이터로 반영"),
                    React.createElement("button", { className: "btn", onClick: () => setParsed(null) }, "\uCDE8\uC18C"))))),
        React.createElement(Card, { title: "\uC5C5\uB85C\uB4DC \uC774\uB825", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", null,
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uC5C5\uB85C\uB4DC \uC77C\uC2DC"),
                            React.createElement("th", null, "\uCD9C\uACE0\uAE30\uC900\uC77C"),
                            React.createElement("th", null, "\uAE30\uC900\uC6D4"),
                            React.createElement("th", null, "\uD30C\uC77C\uBA85"),
                            React.createElement("th", { className: "r" }, "\uBC18\uC601 \uD589"),
                            React.createElement("th", { className: "r" }, "\uAD50\uCCB4\uB41C \uD589"),
                            React.createElement("th", null, "\uC5C5\uB85C\uB354"),
                            React.createElement("th", null, "\uB9C8\uAC10"),
                            React.createElement("th", null, "\uAD00\uB9AC"))),
                    React.createElement("tbody", null, data.uploads.map((u) => {
                        const l = lockOf(u.month);
                        return (React.createElement("tr", { key: u.id },
                            React.createElement("td", { className: "num t-sm" }, u.uploaded_at),
                            React.createElement("td", { className: "num t-sm" }, u.shipment_date || "–"),
                            React.createElement("td", { className: "num t-strong" }, u.month),
                            React.createElement("td", null, u.filename),
                            React.createElement("td", { className: "r num" }, u.row_count),
                            React.createElement("td", { className: "r num t-muted" }, u.replaced),
                            React.createElement("td", null, u.uploaded_by),
                            React.createElement("td", null,
                                React.createElement("span", { className: "badge badge--" + (l && l.locked ? "bad" : "mute") }, l && l.locked ? "잠김" : "열림")),
                            React.createElement("td", null, u.can_restore ? (React.createElement("button", { className: "btn btn--sm btn--danger", disabled: busy || (l && l.locked), onClick: () => rollbackUpload(u), title: l && l.locked ? "마감 잠금을 먼저 해제하세요." : "최근 업로드 삭제 및 직전 파일 복원" }, "\uC0AD\uC81C\u00B7\uBCF5\uC6D0")) : React.createElement("span", { className: "t-muted" }, "\u2013"))));
                    })))))));
}
/* ══════════════════ 수금계획 다운로드 ══════════════════ */
function CashPlan({ data, dataView, notify }) {
    const planMonths = data.meta.cash_plan_months || [thisMonth()];
    const [month, setMonth] = useState(planMonths[0]);
    const [asOfDate, setAsOfDate] = useState(data.meta.today);
    const [includeOverdue, setIncludeOverdue] = useState(false);
    const [includeBad, setIncludeBad] = useState(false);
    const [busy, setBusy] = useState(false);
    async function download() {
        setBusy(true);
        try {
            const res = await fetch("/api/cash-plan/export", {
                method: "POST", credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, as_of_date: asOfDate, data_view: dataView,
                    include_overdue: includeOverdue, include_bad: includeBad }),
            });
            if (!res.ok) {
                let message = "수금계획을 생성하지 못했습니다.";
                try {
                    message = (await res.json()).error || message;
                }
                catch (e) { /* ignore */ }
                throw new Error(message);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "MedPark_" + Number(month.slice(5, 7)) + "월_수금계획" +
                (includeOverdue ? "_미수포함" : "") + (includeBad ? "_부실포함" : "") + ".xlsx";
            link.click();
            URL.revokeObjectURL(url);
            notify(Number(month.slice(5, 7)) + "월 수금계획을 생성했습니다.");
        }
        catch (e) {
            notify(e.message, true);
        }
        setBusy(false);
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\u321C\uBA54\uB4DC\uD30C\uD06C \uC790\uAE08\uC218\uC9C0\uAD00\uB9AC \uC218\uAE08\uACC4\uD68D" },
            React.createElement("div", { className: "formrow" },
                React.createElement(Field, { label: "\uC218\uAE08\uACC4\uD68D \uAE30\uC900\uC6D4" },
                    React.createElement("select", { className: "select", value: month, onChange: (e) => setMonth(e.target.value) }, planMonths.map((m) => React.createElement("option", { key: m, value: m },
                        Number(m.slice(5, 7)),
                        "\uC6D4 \uC218\uAE08\uACC4\uD68D")))),
                React.createElement(Field, { label: "\uBBF8\uC218\uCC44\uAD8C \uC870\uD68C\uAE30\uC900\uC77C" },
                    React.createElement("input", { className: "input", type: "date", value: asOfDate, onChange: (e) => setAsOfDate(e.target.value) }))),
            React.createElement("div", { className: "chiprow", style: { marginTop: 12 } },
                React.createElement("label", { className: "chip", "aria-pressed": includeOverdue },
                    React.createElement("input", { type: "checkbox", checked: includeOverdue, onChange: (e) => setIncludeOverdue(e.target.checked) }),
                    " \uBBF8\uC218\uCC44\uAD8C \uD3EC\uD568"),
                React.createElement("label", { className: "chip", "aria-pressed": includeBad },
                    React.createElement("input", { type: "checkbox", checked: includeBad, onChange: (e) => setIncludeBad(e.target.checked) }),
                    " \uBD80\uC2E4\uCC44\uAD8C \uD3EC\uD568")),
            React.createElement("div", { className: "alert alert--info", style: { margin: "12px 0" } }, "\uC815\uC0C1\uCC44\uAD8C\uC740 \uC120\uD0DD\uD55C \uC6D4\uC758 \uC218\uAE08\uB300\uC0C1 \uAE08\uC561\uB9CC \uBC18\uC601\uD569\uB2C8\uB2E4. \uBBF8\uC218\uCC44\uAD8C\uC740 \uC785\uB825\uD55C \uC870\uD68C\uAE30\uC900\uC77C \uD604\uC7AC \uC0C1\uD0DC\uB85C \uC0B0\uC815\uD569\uB2C8\uB2E4."),
            React.createElement("button", { className: "btn btn--primary", onClick: download, disabled: busy || !month || !asOfDate }, busy ? "엑셀 생성 중" : Number(month.slice(5, 7)) + "월 수금계획 다운로드")),
        React.createElement(Card, { title: "\uC801\uC6A9 \uAE30\uC900" },
            React.createElement("ul", { className: "template-steps" },
                React.createElement("li", null,
                    "\uBCF8\uBD80\uB294 ",
                    React.createElement("b", null, "\uC0AC\uC5C5\uBD80"),
                    ", \uC218\uAE08/\uC9C0\uCD9C\uC740 ",
                    React.createElement("b", null, "\uC218\uAE08"),
                    "\uC73C\uB85C \uACE0\uC815\uD569\uB2C8\uB2E4."),
                React.createElement("li", null, "\uBD80\uC11C/\uD300\uACFC \uC9D1\uD589\uD56D\uBAA9\uC740 \uB374\uD0C8\u00B7\uBA54\uB514\uCEEC\u00B7\uC5D0\uC2A4\uD14C\uD2F1 \uC0AC\uC5C5\uBD80\uC5D0 \uB9DE\uCDB0 \uC790\uB3D9 \uBCC0\uD658\uD569\uB2C8\uB2E4."),
                React.createElement("li", null, "\uC790\uAE08\uACC4\uD68D\uC77C\u00B7\uC790\uAE08\uC2E4\uD589\uC77C\uC740 \uD574\uB2F9 \uC6D4 \uB9D0\uC77C\uC774\uBA70, \uC218\uAE08\uBAA9\uD45C\uC77C\uC774 \uC788\uC73C\uBA74 \uADF8 \uB0A0\uC9DC\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4."),
                React.createElement("li", null, "\uC815\uC0C1\uCC44\uAD8C\u00B7\uBBF8\uC218\uCC44\uAD8C\u00B7\uBD80\uC2E4\uCC44\uAD8C\uC744 \uAC70\uB798\uCC98\uBCC4 \uBCC4\uB3C4 \uD589\uC73C\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4.")))));
}
/* ══════════════════ 계정·권한 관리 ══════════════════ */
function Users({ data, notify, refresh }) {
    const [sel, setSel] = useState(null);
    const [perms, setPerms] = useState([]);
    const [role, setRole] = useState("sales");
    const [newUser, setNewUser] = useState({
        username: "", name: "", title: "", role: "sales", biz_unit: "", password: "",
    });
    const setNew = (key) => (e) => setNewUser((v) => ({ ...v, [key]: e.target.value }));
    async function createAccount(e) {
        e.preventDefault();
        if (!newUser.username.trim() || !newUser.name.trim()) {
            notify("아이디와 이름을 입력하세요.", true);
            return;
        }
        if (newUser.password.length < 8) {
            notify("초기 비밀번호는 8자 이상으로 입력하세요.", true);
            return;
        }
        try {
            await api("/api/users", { method: "POST", body: newUser });
            notify(newUser.username + " 계정을 등록했습니다.");
            setNewUser({ username: "", name: "", title: "", role: "sales", biz_unit: "", password: "" });
            await refresh();
        }
        catch (e) {
            notify(e.message, true);
        }
    }
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
        React.createElement(Card, { title: "\uC2E0\uADDC \uACC4\uC815 \uB4F1\uB85D" },
            React.createElement("form", { onSubmit: createAccount },
                React.createElement("div", { className: "formrow" },
                    React.createElement(Field, { label: "\uC544\uC774\uB514*" },
                        React.createElement("input", { className: "input", value: newUser.username, onChange: setNew("username") })),
                    React.createElement(Field, { label: "\uC774\uB984*" },
                        React.createElement("input", { className: "input", value: newUser.name, onChange: setNew("name") })),
                    React.createElement(Field, { label: "\uC9C1\uC704" },
                        React.createElement("input", { className: "input", value: newUser.title, onChange: setNew("title") })),
                    React.createElement(Field, { label: "\uC5ED\uD560" },
                        React.createElement("select", { className: "select", value: newUser.role, onChange: setNew("role") }, Object.entries(data.meta.roles).map(([key, r]) => React.createElement("option", { key: key, value: key }, r.label)))),
                    React.createElement(Field, { label: "\uC0AC\uC5C5\uBD80" },
                        React.createElement("select", { className: "select", value: newUser.biz_unit, onChange: setNew("biz_unit") },
                            React.createElement("option", { value: "" }, "\uC804\uCCB4/\uBBF8\uC9C0\uC815"),
                            data.meta.units.map((u) => React.createElement("option", { key: u }, u)))),
                    React.createElement(Field, { label: "\uCD08\uAE30 \uBE44\uBC00\uBC88\uD638*" },
                        React.createElement("input", { className: "input", type: "password", minLength: "8", value: newUser.password, onChange: setNew("password") }))),
                React.createElement("button", { className: "btn btn--primary", type: "submit" }, "\uACC4\uC815 \uB4F1\uB85D"))),
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
                            " / ",
                            data.meta.permissions.length),
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
/* ══════════════════ 사용 매뉴얼 ══════════════════ */
function CollectionUploadGuide() {
    const columns = [
        ["고객코드", "필수", "숫자 코드는 앞자리 0을 보정합니다. 미등록·모호한 코드는 거래처 확인 창에서 해결합니다. 같은 이름은 연결 후보로만 표시하며 사용자가 선택해야 연결됩니다. 관리고객코드는 사용하지 않습니다."],
        ["수금일자", "필수", "실제 수금일. YYYY-MM-DD 또는 Excel 날짜. 미래 날짜·존재하지 않는 날짜·마감월은 오류입니다."],
        ["수금번호 / 순번", "각각 필수", "수금번호와 순번을 묶어 중복 판정합니다. 같은 번호라도 순번이 다르면 각각 등록합니다."],
        ["수금구분 / 수금구분유형", "각각 필수", "공백을 제거해 제 예 금·카    드도 인식합니다. 명칭과 확인된 유형코드가 충돌하면 오류입니다."],
        ["정상수금 / 선수금", "각각 필수", "원 단위 0 이상 정수. 미발생 금액도 공란 대신 0 입력. 두 금액의 합이 실제 수금등록액이며 0원 이하는 오류입니다."],
        ["수금년월", "선택", "입력된 경우 YYYY-MM 형식이며 수금일자의 월과 일치해야 합니다."],
        ["고객", "선택", "같은 이름의 거래처 후보를 찾는 데 사용합니다. 코드가 등록되어 있으면 코드 기준으로 연결합니다. 신규 등록을 선택할 때는 거래처명을 반드시 입력해야 합니다."],
        ["비고(건) / 비고(내역)", "선택", "수금 적요에 함께 저장합니다. 수금번호·순번과 원본 정상수금·선수금도 추적할 수 있습니다."],
    ];
    return React.createElement(Card, { title: "\uC218\uAE08\uB4F1\uB85D \uB370\uC774\uD130 \uC5C5\uB85C\uB4DC \u00B7 \uC0AC\uC6A9\uBC95\uACFC \uAC80\uC99D \uAE30\uC900" },
        React.createElement("ol", null,
            React.createElement("li", null, "\uC218\uAE08 \u2192 \uC218\uAE08\uB4F1\uB85D \uB370\uC774\uD130 \uC5C5\uB85C\uB4DC\uC5D0\uC11C \uC544\uB9C8\uB780\uC2A410 \uD30C\uC77C\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4. \uCCAB \uBC88\uC9F8 \uC2DC\uD2B8\uC758 \uC55E 25\uD589 \uC548\uC5D0 \uBA38\uB9AC\uAE00\uC774 \uC788\uC5B4\uC57C \uD569\uB2C8\uB2E4."),
            React.createElement("li", null, "\uC785\uB825 \uC624\uB958\uB294 \uD589 \uBC88\uD638\u00B7\uAC70\uB798\uCC98\u00B7\uACE0\uAC1D\uCF54\uB4DC\u00B7\uC218\uAE08\uBC88\uD638\u00B7\uC0AC\uC720\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \u2018\uC624\uB958\uB9CC \uBCF4\uAE30\u2019\uB85C \uD574\uB2F9 \uD589\uC744 \uBAA8\uC544\uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4."),
            React.createElement("li", null, "\uBBF8\uB4F1\uB85D\u00B7\uBAA8\uD638\uD55C \uACE0\uAC1D\uCF54\uB4DC\uAC00 \uC788\uC73C\uBA74 \uAC70\uB798\uCC98 \uD655\uC778 \uCC3D\uC774 \uBA3C\uC800 \uC5F4\uB9BD\uB2C8\uB2E4. \uAE30\uC874 \uAC70\uB798\uCC98 \uC5F0\uACB0, \uC5D1\uC140 \uCF54\uB4DC\uB85C \uC2E0\uADDC \uB4F1\uB85D, \uC774\uBC88 \uC5C5\uB85C\uB4DC \uC81C\uC678 \uC911 \uC9C1\uC811 \uC120\uD0DD\uD558\uACE0 \uD655\uC778\uB780\uC744 \uCCB4\uD06C\uD569\uB2C8\uB2E4. \uAC19\uC740 \uCF54\uB4DC\uC758 \uD589\uC740 \uD568\uAED8 \uCC98\uB9AC\uD569\uB2C8\uB2E4."),
            React.createElement("li", null, "\uAE30\uC874 \uAC70\uB798\uCC98 \uC5F0\uACB0\uC740 \uCF54\uB4DC\u00B7\uC0AC\uC5C5\uBD80\u00B7\uCC44\uAD8C\uC794\uC561\uC744 \uBE44\uAD50\uD558\uACE0 5~500\uC790 \uC0AC\uC720\uB97C \uC785\uB825\uD569\uB2C8\uB2E4. \uC2E0\uADDC \uB4F1\uB85D\uC740 \uAC70\uB798\uCC98\uBA85\uACFC \uC0AC\uC5C5\uBD80\uAC00 \uD544\uC218\uC774\uBA70 \uC218\uAE08 \uB4F1\uB85D \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uC0C8 \uAC70\uB798\uCC98\uB294 \uC794\uC561 0\uC6D0\u00B7\uD68C\uC218\uAE30\uAC04 \uBBF8\uC785\uB825\uC73C\uB85C \uC2DC\uC791\uD558\uACE0, \uC2B9\uC778 \uC2DC \uC218\uAE08\uC740 \uC120\uC218\uAE08\uC73C\uB85C \uCC98\uB9AC\uB429\uB2C8\uB2E4."),
            React.createElement("li", null, "\u2018\uC120\uD0DD \uBC18\uC601 \u00B7 \uC911\uBCF5 \uC7AC\uAC80\uC99D\u2019\uC740 \uC800\uC7A5 \uC804 \uAC80\uC99D \uB2E8\uACC4\uC785\uB2C8\uB2E4. \uC5F0\uACB0\uD55C \uAC70\uB798\uCC98 \uAE30\uC900\uC73C\uB85C \uAE30\uC874 \uC218\uAE08\uACFC \uB2E4\uC2DC \uBE44\uAD50\uD55C \uB4A4 \uC911\uBCF5 \uD655\uC778 \uCC3D\uC774 \uC5F4\uB9BD\uB2C8\uB2E4. \uAE30\uC874 \uCF54\uB4DC\uB97C \uBCC0\uACBD\uD558\uAC70\uB098 \uB2E4\uC74C \uD30C\uC77C\uC758 \uCF54\uB4DC\uB97C \uC790\uB3D9 \uBCC0\uD658\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
            React.createElement("li", null, "\uAC01 \uD6C4\uBCF4\uC758 \u2018\uC911\uBCF5 \uD655\uC778\u00B7\uC774\uBC88 \uD589 \uC81C\uC678\u2019\uB97C \uCCB4\uD06C\uD569\uB2C8\uB2E4. \uB0B4\uC6A9\uC774 \uB3D9\uC77C\uD55C \uAE30\uB4F1\uB85D \uAC74\uC740 \uC77C\uAD04 \uD655\uC778\uB3C4 \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uD655\uC778 \uC804\uC5D0\uB294 \uCD94\uAC00 \uB4F1\uB85D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
            React.createElement("li", null, "\uACE0\uAC1D\u00B7\uC218\uAE08\uC77C\u00B7\uAE08\uC561\u00B7\uBC29\uBC95\uB9CC \uAC19\uC740 \uD6C4\uBCF4\uAC00 \uC2E4\uC81C \uBCC4\uB3C4 \uC218\uAE08\uC774\uBA74 \u2018\uC911\uBCF5 \uC544\uB2D8\u00B7\uBCC4\uB3C4 \uC218\uAE08 \uB4F1\uB85D\u2019\uC744 \uC120\uD0DD\uD558\uACE0 5~500\uC790 \uC0AC\uC720\uC640 \uD655\uC778 \uCCB4\uD06C\uB97C \uC785\uB825\uD569\uB2C8\uB2E4."),
            React.createElement("li", null, "\uD655\uC778 \uC644\uB8CC \uD6C4 \uC81C\uC678\uD55C \uD589\uC744 \uBE7C\uACE0 \uB098\uBA38\uC9C0\uB97C \uC2B9\uC778 \uB300\uAE30\uB85C \uB4F1\uB85D\uD569\uB2C8\uB2E4. \uC2B9\uC778\uAD8C\uC790\uB9CC \uC989\uC2DC \uC2B9\uC778\u00B7\uC0C1\uACC4\uB97C \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC804\uBD80 \uC911\uBCF5\uC774\uC5B4\uB3C4 \uD655\uC778 \uC774\uB825\uC744 \uC800\uC7A5\uD558\uBA70 \uCC44\uAD8C\uC740 \uB2E4\uC2DC \uCC28\uAC10\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
            React.createElement("li", null, "\uCD5C\uC885 \uB4F1\uB85D\uC774 \uC131\uACF5\uD560 \uB54C \uD544\uC694\uD55C \uC2E0\uADDC \uAC70\uB798\uCC98\uC640 \uC218\uAE08\uC744 \uD568\uAED8 \uC800\uC7A5\uD569\uB2C8\uB2E4. \uC624\uB958\uAC00 \uB098\uBA74 \uB458 \uB2E4 \uC800\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC81C\uC678\uD55C \uC218\uAE08\uC744 \uC704\uD55C \uAC70\uB798\uCC98\uB294 \uC0DD\uC131\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
            React.createElement("li", null, "\uC5C5\uB85C\uB4DC \uC774\uB825\uC758 \uC911\uBCF5\u00B7\uAC70\uB798\uCC98 \uD655\uC778 \uBC84\uD2BC\uC5D0\uC11C \uC6D0\uBCF8 \uCF54\uB4DC\u00B7\uC5F0\uACB0 \uCF54\uB4DC\u00B7\uC2E0\uADDC/\uC81C\uC678 \uD310\uB2E8\u00B7\uC0AC\uC720\u00B7\uD655\uC778\uC790\u00B7\uD655\uC778\uC77C\uC2DC\uB97C \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.")),
        React.createElement("div", { className: "tablewrap" },
            React.createElement("table", { className: "manual-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "\uC5D1\uC140 \uC5F4"),
                        React.createElement("th", null, "\uD544\uC218 \uC5EC\uBD80"),
                        React.createElement("th", null, "\uC785\uB825\u00B7\uAC80\uC99D \uAE30\uC900"))),
                React.createElement("tbody", null, columns.map((r) => React.createElement("tr", { key: r[0] },
                    React.createElement("td", null, r[0]),
                    React.createElement("td", null, r[1]),
                    React.createElement("td", null, r[2])))))),
        React.createElement("div", { className: "tablewrap", style: { marginTop: 16 } },
            React.createElement("table", { className: "manual-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "\uC218\uAE08\uAD6C\uBD84"),
                        React.createElement("th", null, "\uC218\uAE08\uAD6C\uBD84\uC720\uD615"),
                        React.createElement("th", null, "\uAE30\uC874 \uC218\uAE08\uBC29\uBC95"))),
                React.createElement("tbody", null,
                    React.createElement("tr", null,
                        React.createElement("td", null, "\uC81C\uC608\uAE08 / \uC81C \uC608 \uAE08"),
                        React.createElement("td", null, "1 \uB610\uB294 \uC81C\uC608\uAE08\u00B7\uACC4\uC88C\uC218\uAE08 \uBA85\uCE6D"),
                        React.createElement("td", null, "\uACC4\uC88C\uC218\uAE08")),
                    React.createElement("tr", null,
                        React.createElement("td", null, "\uCE74\uB4DC / \uCE74    \uB4DC"),
                        React.createElement("td", null, "5 \uB610\uB294 \uCE74\uB4DC\u00B7\uCE74\uB4DC\uC218\uAE08 \uBA85\uCE6D"),
                        React.createElement("td", null, "\uCE74\uB4DC\uC218\uAE08")),
                    React.createElement("tr", null,
                        React.createElement("td", null, "\uC5B4\uC74C / \uBC1B\uC744\uC5B4\uC74C / \uC804\uC790\uC5B4\uC74C"),
                        React.createElement("td", null, "\uC5B4\uC74C \uBA85\uCE6D\uC73C\uB85C \uD310\uC815. \uBBF8\uD655\uC778 \uC22B\uC790\uCF54\uB4DC\uB97C \uC784\uC758\uB85C \uC5B4\uC74C\uC73C\uB85C \uCD94\uC815\uD558\uC9C0 \uC54A\uC74C"),
                        React.createElement("td", null, "\uC5B4\uC74C\uC218\uAE08"))))),
        React.createElement("div", { className: "manual-notices", style: { marginTop: 16 } },
            React.createElement("div", null,
                React.createElement("b", null, "\uB4F1\uB85D \uC911\uB2E8 \uC624\uB958"),
                React.createElement("span", null, "\uD544\uC218 \uC5F4\u00B7\uAC12 \uB204\uB77D, \uC798\uBABB\uB41C \uB0A0\uC9DC\u00B7\uC218\uAE08\uBC29\uBC95, \uC74C\uC218\u00B7\uC18C\uC218\u00B7\uBB38\uC790 \uAE08\uC561, 0\uC6D0 \uC218\uAE08, \uC218\uAE08\uB144\uC6D4 \uBD88\uC77C\uCE58\uB294 \uC6D0\uBCF8 \uC218\uC815\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uBBF8\uB4F1\uB85D\u00B7\uBAA8\uD638\uD55C \uCF54\uB4DC\uB294 \uAC70\uB798\uCC98 \uC120\uD0DD\uC73C\uB85C \uD574\uACB0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC2E0\uADDC \uB4F1\uB85D\uD558\uB824\uB294 \uC218\uAE08\uC6D4\uC774 \uB9C8\uAC10\uB418\uC5C8\uAC70\uB098 \uC6D0\uC7A5\u00B7\uC9D1\uACC4\uC794\uC561\uC774 \uB2E4\uB974\uBA74 \uB4F1\uB85D\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD569\uACC4\uD589\uC740 \uC2E4\uC81C \uB0B4\uC5ED \uD569\uACC4\uC640 \uB300\uC870\uD569\uB2C8\uB2E4.")),
            React.createElement("div", null,
                React.createElement("b", null, "\uBC88\uD638\u00B7\uC21C\uBC88 \uC911\uBCF5"),
                React.createElement("span", null, "\uAC19\uC740 \uC218\uAE08\uBC88\uD638\u00B7\uC21C\uBC88\uC740 \uD31D\uC5C5\uC5D0\uC11C \uAE30\uC874 \uAC12\uACFC \uBE44\uAD50\uD558\uACE0 \uC774\uBC88 \uD589\uC744 \uC81C\uC678\uD560\uC9C0 \uD655\uC778\uD569\uB2C8\uB2E4. \uAC12\uC774 \uB2EC\uB77C\uB3C4 \uC790\uB3D9 \uB36E\uC5B4\uC4F0\uAC70\uB098 \uBCC4\uB3C4 \uC0DD\uC131\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD30C\uC77C \uC548\uC5D0\uC11C \uC911\uBCF5\uB418\uBA74 \uBA3C\uC800 \uB098\uC628 \uD589\uACFC \uBE44\uAD50\uD558\uC5EC \uB4A4\uC758 \uD589 \uC81C\uC678 \uC5EC\uBD80\uB97C \uD655\uC778\uD569\uB2C8\uB2E4. \uC815\uC815\uC774 \uD544\uC694\uD55C \uACBD\uC6B0 \uB3CC\uC544\uAC00\uC11C \uC6D0\uBCF8 \uB610\uB294 \uAE30\uC874 \uB0B4\uC5ED\uC744 \uD655\uC778\uD558\uC138\uC694.")),
            React.createElement("div", null,
                React.createElement("b", null, "\uD655\uC778 \uC911 \uBCC0\uACBD"),
                React.createElement("span", null, "\uD31D\uC5C5 \uD655\uC778 \uB4A4 \uAC70\uB798\uCC98 \uCF54\uB4DC\u00B7\uC774\uB984\u00B7\uC0AC\uC5C5\uBD80\u00B7\uC794\uC561, \uD30C\uC77C \uB610\uB294 \uAE30\uC874 \uC218\uAE08\uC774 \uBC14\uB00C\uBA74 \uCD5C\uC2E0 \uB0B4\uC5ED\uC744 \uB2E4\uC2DC \uD45C\uC2DC\uD558\uACE0 \uC7AC\uD655\uC778\uC744 \uBC1B\uC2B5\uB2C8\uB2E4. \uBBF8\uD655\uC778 \uD589\uC744 \uC790\uB3D9 \uC81C\uC678\uD558\uAC70\uB098 \uCD94\uAC00 \uB4F1\uB85D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")),
            React.createElement("div", null,
                React.createElement("b", null, "\uCC44\uAD8C \uC0C1\uACC4"),
                React.createElement("span", null, "\uC2B9\uC778 \uC2DC \uACE0\uAC1D\uCF54\uB4DC\uC758 \uBD80\uC2E4 \u2192 \uBBF8\uC218 \u2192 \uC815\uC0C1\uCC44\uAD8C \uC21C\uC11C\uC774\uBA70 \uAC01 \uAD6C\uBD84\uC5D0\uC11C\uB294 \uC624\uB798\uB41C \uBC1C\uC0DD\uC6D4\uBD80\uD130 \uCC28\uAC10\uD569\uB2C8\uB2E4. \uC0AC\uC5C5\uBD80\uB294 \uAE30\uC874 \uCC44\uAD8C \uC6D0\uC7A5\uC744 \uB530\uB985\uB2C8\uB2E4. \uD30C\uC77C\uC758 \uC815\uC0C1\uC218\uAE08+\uC120\uC218\uAE08\uC744 \uD55C \uBC88\uB9CC \uBC18\uC601\uD558\uBA70 \uCD08\uACFC\uBD84\uB9CC \uC120\uC218\uAE08\uC73C\uB85C \uBCF4\uAD00\uD569\uB2C8\uB2E4.")),
            React.createElement("div", null,
                React.createElement("b", null, "\uC2B9\uC778\u00B7\uB9C8\uAC10\u00B7\uD30C\uC77C"),
                React.createElement("span", null, "\uC2B9\uC778 \uB300\uAE30 \uAC74\uC740 \uC794\uC561\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB4F1\uB85D \uB4A4 \uC218\uAE08\uC6D4\uC774 \uB9C8\uAC10\uB418\uBA74 \uC5C5\uB85C\uB4DC \uC218\uAE08\uC758 \uC2B9\uC778\uC774 \uCC28\uB2E8\uB429\uB2C8\uB2E4. .xlsx/.xls/.csv, 10MB \uC774\uD558, \uCD5C\uB300 5,000\uD589\uC744 \uC9C0\uC6D0\uD558\uBA70 \uBCF4\uC548 \uCC98\uB9AC\uB41C \uD30C\uC77C\uC740 \uC0AC\uB0B4 \uBC18\uCD9C \uC808\uCC28\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4."))));
}
function Manual() {
    const steps = [
        ["1", "조회기준 확인", "화면 상단에서 마감 기준 또는 최신 출고 포함 기준을 선택합니다."],
        ["2", "출고자료 반영", "관리자가 아마란스 출고자료를 올리고 월별 분리·합계·제외된 마감월을 확인합니다."],
        ["3", "거래처 관리", "회수기간·담당자·수금목표일·비고를 입력합니다. 상세에서는 채권 건별 사업부를 사유와 함께 정정할 수 있습니다."],
        ["4", "수금 등록·승인", "채권 상세를 선택해 금액과 적요를 자동 입력하고, 승인된 수금만 잔액에 반영합니다."],
        ["5", "현황 보고", "채권요약·결산회의 자료를 확인하고 PPT·PNG·Excel로 내려받습니다."],
    ];
    const menus = [
        ["대시보드", "전체 채권·전일 수금·거래처 확인", "조회기준과 사업부를 먼저 선택"],
        ["채권요약현황", "사업부별 채권·수금 실적 보고", "결산자료는 PPT 또는 PNG 다운로드"],
        ["결산회의 미수채권", "잔액이 있는 미수채권만 회의자료로 확인", "부실·0원 거래처는 제외하고 PPT·PNG 다운로드"],
        ["거래처별 현황", "채권 상세·회수기간·담당자·비고·사업부 관리", "사업부 변경 시 합계·보고서가 즉시 변경되므로 원본자료도 함께 정정"],
        ["담당자별 채권현황", "담당자별 거래처와 채권잔액 확인", "미배정 거래처를 우선 점검"],
        ["수금 등록", "채권 선택·자동 적요·승인·반려", "미등록 거래처 선수금은 간편등록 후 처리"],
        ["수금등록 데이터 업로드", "고객코드 매칭·중복 확인 팝업·수금 일괄등록", "중복 여부를 체크한 뒤 신규 건 등록, 확인 이력 조회"],
        ["수금목표 관리", "예정 수금액과 완료일 관리", "완료 시 실제 수금등록 여부도 확인"],
        ["출고 데이터 업로드", "아마란스 출고자료 반영·이전 파일 복원", "월 자동 분리, 마감월 제외, 재업로드 결과 확인"],
        ["수금계획 다운로드", "선택한 조회기준으로 계획서 생성", "카드수금은 입금예정 3영업일까지 포함"],
        ["계정·권한 관리", "사용자 계정과 업무권한 설정", "관리자만 변경하고 퇴사자는 사용 정지"],
    ];
    const implementation = [
        ["① 출고 입력", "출고파일의 합계액을 거래처·사업부·발생월별 원장으로 저장합니다. 마감된 월은 다시 반영하지 않습니다."],
        ["② 채권 계산", "발생월에 회수기간을 더해 정상회수월을 계산합니다. 미입력은 임시 1개월(익월)로 계산하되 미입력 필터에 유지하며, 직접 저장하면 관련 정상채권을 자동 재계산합니다."],
        ["③ 수금·선수금", "승인된 수금은 상세 원장에서 차감하고, 채권보다 많은 금액은 선수금으로 보관합니다. 새 출고채권이 생기면 선수금을 자동 상계합니다."],
        ["④ 재업로드", "같은 월 출고분을 새 파일로 교체할 때 기존 수금과 선수금 상계를 되돌린 후 최신 금액으로 다시 대사합니다. 직전 파일 상태 복원도 가능합니다."],
        ["⑤ 조회·보고", "상세 원장을 기준으로 거래처·담당자·사업부 합계를 만들며, 보고 화면에는 선택한 조회기준을 공통 적용합니다."],
    ];
    const terms = [
        ["정상채권", "정상회수월이 아직 지나지 않은 채권"],
        ["미수채권", "정상회수월이 지났거나 거래종료 등의 사유로 직접 전환한 관리대상 채권"],
        ["부실채권", "장기연체 등 별도 집중관리가 필요한 채권"],
        ["선수금·음수잔액", "채권 발생 전 먼저 수금되었거나 수금액이 채권보다 큰 상태"],
    ];
    return React.createElement(React.Fragment, null,
        React.createElement(Card, { title: "\uCC98\uC74C \uC0AC\uC6A9\uD560 \uB54C \u00B7 \uAE30\uBCF8 \uC5C5\uBB34 \uC21C\uC11C" },
            React.createElement("div", { className: "manual-steps" }, steps.map(([no, title, text]) => React.createElement("div", { className: "manual-step", key: no },
                React.createElement("b", null, no),
                React.createElement("span", null,
                    React.createElement("strong", null, title),
                    React.createElement("small", null, text)))))),
        React.createElement(Card, { title: "\uBA54\uB274\uBCC4 \uC0AC\uC6A9\uBC95", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", { className: "manual-table" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uBA54\uB274"),
                            React.createElement("th", null, "\uC8FC\uC694 \uAE30\uB2A5"),
                            React.createElement("th", null, "\uAC04\uB2E8 \uC0AC\uC6A9\uBC95"))),
                    React.createElement("tbody", null, menus.map((row) => React.createElement("tr", { key: row[0] },
                        React.createElement("td", { className: "t-strong" }, row[0]),
                        React.createElement("td", null, row[1]),
                        React.createElement("td", null, row[2]))))))),
        React.createElement(CollectionUploadGuide, null),
        React.createElement(Card, { title: "\uD504\uB85C\uADF8\uB7A8\uC774 \uCC44\uAD8C\uC744 \uACC4\uC0B0\uD558\uB294 \uBC29\uC2DD" },
            React.createElement("div", { className: "manual-notices" }, implementation.map(([title, text]) => React.createElement("div", { key: title },
                React.createElement("b", null, title),
                React.createElement("span", null, text))))),
        React.createElement(Card, { title: "\uCC44\uAD8C \uAD6C\uBD84 \uC774\uD574\uD558\uAE30", flush: true },
            React.createElement("div", { className: "tablewrap" },
                React.createElement("table", { className: "manual-table" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "\uAD6C\uBD84"),
                            React.createElement("th", null, "\uD504\uB85C\uADF8\uB7A8 \uCC98\uB9AC \uAE30\uC900"))),
                    React.createElement("tbody", null, terms.map((row) => React.createElement("tr", { key: row[0] },
                        React.createElement("td", { className: "t-strong" }, row[0]),
                        React.createElement("td", null, row[1]))))))),
        React.createElement(Card, { title: "\uAF2D \uD655\uC778\uD558\uC138\uC694" },
            React.createElement("div", { className: "manual-notices" },
                React.createElement("div", null,
                    React.createElement("b", null, "\uC870\uD68C\uAE30\uC900"),
                    React.createElement("span", null, "\uBCF4\uACE0 \uD654\uBA74\uC740 \uC120\uD0DD\uD55C \uC870\uD68C\uAE30\uC900\uC744 \uB530\uB974\uBA70, \uC218\uAE08\u00B7\uC5C5\uB85C\uB4DC \uD654\uBA74\uC740 \uD56D\uC0C1 \uCD5C\uC2E0 \uC6B4\uC601\uB370\uC774\uD130\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.")),
                React.createElement("div", null,
                    React.createElement("b", null, "\uC218\uAE08 \uC2B9\uC778"),
                    React.createElement("span", null, "\uC2B9\uC778 \uC644\uB8CC \uD6C4 \uC794\uC561\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4. \uC218\uAE08 \uC5C5\uB85C\uB4DC\uC5D0\uC11C \uC2B9\uC778\uAD8C\uC790\uB294 \uC989\uC2DC \uC2B9\uC778\u00B7\uC0C1\uACC4\uB97C \uC120\uD0DD\uD560 \uC218 \uC788\uC73C\uBA70, \uC120\uD0DD\uD558\uC9C0 \uC54A\uC73C\uBA74 \uC2B9\uC778 \uB300\uAE30\uB85C \uB4F1\uB85D\uB429\uB2C8\uB2E4.")),
                React.createElement("div", null,
                    React.createElement("b", null, "\uCE74\uB4DC\uC218\uAE08"),
                    React.createElement("span", null, "\uCC44\uAD8C\uC5D0\uC11C\uB294 \uC2B9\uC778 \uC989\uC2DC \uCC28\uAC10\uB418\uC9C0\uB9CC \uC218\uAE08\uACC4\uD68D\uC5D0\uB294 \uD1B5\uC7A5 \uC785\uAE08\uC608\uC815\uC77C\uC778 \uC218\uAE08\uC77C \uC774\uD6C4 3\uC601\uC5C5\uC77C\uAE4C\uC9C0 \uD3EC\uD568\uB429\uB2C8\uB2E4.")),
                React.createElement("div", null,
                    React.createElement("b", null, "\uC120\uC218\uAE08 \uB300\uC0AC"),
                    React.createElement("span", null, "\uCD9C\uACE0\uD30C\uC77C\uC744 \uB2E4\uC2DC \uC62C\uB824\uB3C4 \uC9C1\uC804 \uC0C1\uACC4 \uACB0\uACFC\uB97C \uBCF5\uC6D0\uD55C \uB4A4 \uCD5C\uC2E0 \uCD9C\uACE0\uAE08\uC561\uACFC \uC120\uC218\uAE08\uC744 \uB2E4\uC2DC \uC790\uB3D9 \uB300\uC0AC\uD569\uB2C8\uB2E4.")),
                React.createElement("div", null,
                    React.createElement("b", null, "\uC6D4 \uB9C8\uAC10"),
                    React.createElement("span", null, "\uB9C8\uAC10\uB41C \uC6D4\uC758 \uCD9C\uACE0\uC790\uB8CC\uB294 \uC7AC\uC5C5\uB85C\uB4DC \uD30C\uC77C\uC5D0 \uD3EC\uD568\uB418\uC5B4 \uC788\uC5B4\uB3C4 \uC0C8 \uCC44\uAD8C\uC73C\uB85C \uB2E4\uC2DC \uBC18\uC601\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")),
                React.createElement("div", null,
                    React.createElement("b", null, "\uBBF8\uC218 \uC804\uD658"),
                    React.createElement("span", null, "\uAC70\uB798\uAC00 \uC885\uB8CC\uB41C \uC815\uC0C1\uCC44\uAD8C\uC740 \uCC44\uAD8C \uC0C1\uC138\uC5D0\uC11C \uBBF8\uC218\uCC44\uAD8C\uC73C\uB85C \uC804\uD658\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.")),
                React.createElement("div", null,
                    React.createElement("b", null, "\uACC4\uC815 \uBCF4\uC548"),
                    React.createElement("span", null, "\uC544\uC774\uB514\uB294 \uACE0\uC815\uB418\uBA70, \uB85C\uADF8\uC778 \uD6C4 \uC0C1\uB2E8\uC758 \uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD\uC5D0\uC11C \uBCF8\uC778\uC774 \uC9C1\uC811 \uBCC0\uACBD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.")))));
}
/* ══════════════════ 셸 ══════════════════ */
const SCREENS = [
    { key: "dashboard", label: "대시보드", perm: "dashboard_view", group: "현황" },
    { key: "summary", label: "채권요약현황", perm: "dashboard_view", group: "현황" },
    { key: "closing", label: "결산회의 미수채권", perm: "dashboard_view", group: "현황" },
    { key: "customers", label: "거래처별 현황", perm: "customer_view", group: "현황" },
    { key: "owners", label: "담당자별 채권현황", perm: "owner_view", group: "현황" },
    { key: "collections", label: "수금 등록", perm: "collection_register", group: "수금", alt: "collection_approve" },
    { key: "collectionUpload", label: "수금등록 데이터 업로드", perm: "collection_register", group: "수금", alt: "collection_approve" },
    { key: "targets", label: "수금목표 관리", perm: "target_manage", group: "수금" },
    { key: "upload", label: "출고 데이터 업로드", perm: "upload_data", group: "관리" },
    { key: "cashplan", label: "수금계획 다운로드", perm: "data_export", group: "관리" },
    { key: "users", label: "계정·권한 관리", perm: "user_manage", group: "관리" },
    { key: "manual", label: "사용 매뉴얼", perm: null, group: "도움말" },
];
const REPORT_SCREENS = new Set(["dashboard", "summary", "closing", "customers", "owners", "targets", "cashplan"]);
const SCREEN_STORAGE_KEY = "ar_active_screen";
function initialScreen() {
    try {
        const navigation = performance.getEntriesByType("navigation")[0];
        return navigation && navigation.type === "reload"
            ? (sessionStorage.getItem(SCREEN_STORAGE_KEY) || "dashboard")
            : "dashboard";
    }
    catch (_) {
        return "dashboard";
    }
}
function App() {
    const [user, setUser] = useState(undefined);
    const [data, setData] = useState(null);
    const [screen, setScreen] = useState(initialScreen);
    const [preset, setPreset] = useState(null);
    const [toast, setToast] = useState(null);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [dataView, setDataView] = useState(() => localStorage.getItem("ar_data_view") || "combined");
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
            else {
                sessionStorage.removeItem(SCREEN_STORAGE_KEY);
                setScreen("dashboard");
                setUser(null);
            }
        }).catch(() => {
            sessionStorage.removeItem(SCREEN_STORAGE_KEY);
            setScreen("dashboard");
            setUser(null);
        });
    }, [load, notify]);
    const can = useCallback((perm) => !!(user && user.permissions.includes(perm)), [user]);
    const visible = useMemo(() => SCREENS.filter((s) => !s.perm || can(s.perm) || (s.alt && can(s.alt))), [can]);
    useEffect(() => {
        if (user && visible.length && !visible.some((s) => s.key === screen))
            setScreen(visible[0].key);
    }, [user, visible, screen]);
    useEffect(() => {
        if (user && data)
            sessionStorage.setItem(SCREEN_STORAGE_KEY, screen);
    }, [user, data, screen]);
    useEffect(() => {
        if (!data)
            return;
        const options = data.meta.dashboard_views || [];
        if (!options.some((view) => view.key === dataView)) {
            const fallback = options.some((view) => view.key === "combined") ? "combined" : (options[0] && options[0].key);
            if (fallback)
                setDataView(fallback);
        }
    }, [data, dataView]);
    useEffect(() => { localStorage.setItem("ar_data_view", dataView); }, [dataView]);
    if (user === undefined) {
        return React.createElement("div", { className: "boot" },
            React.createElement("div", { className: "boot__mark" }, "MP"),
            React.createElement("p", { className: "boot__text" }, "\uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4."));
    }
    if (user === null)
        return React.createElement(Login, { onDone: () => {
                sessionStorage.removeItem(SCREEN_STORAGE_KEY);
                setScreen("dashboard");
                load();
            } });
    if (!data)
        return React.createElement("div", { className: "boot" },
            React.createElement("div", { className: "boot__mark" }, "MP"),
            React.createElement("p", { className: "boot__text" }, "\uB370\uC774\uD130\uB97C \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4."));
    const patchCustomer = (c) => setData((d) => ({
        ...d, customers: d.customers.map((x) => (x.code === c.code ? { ...x, ...c } : x)),
    }));
    const applyUpload = (res) => setData((d) => ({
        ...d, customers: res.customers, uploads: res.uploads,
    }));
    const current = SCREENS.find((s) => s.key === screen) || SCREENS[0];
    const viewOptions = data.meta.dashboard_views || [{ key: "combined", label: data.meta.reflection_label }];
    const reportScreen = REPORT_SCREENS.has(screen);
    const selectedView = viewOptions.find((view) => view.key === dataView) || viewOptions[0];
    const effectiveView = selectedView.key;
    const reportData = effectiveView === "closing"
        ? { ...data, customers: data.dashboard_closing_customers || data.customers }
        : data;
    const screenData = reportScreen ? reportData : data;
    const groups = [...new Set(visible.map((s) => s.group))];
    const pendingCount = data.collections.filter((c) => c.state === "pending").length;
    async function signOut() {
        await api("/api/logout", { method: "POST" });
        sessionStorage.removeItem(SCREEN_STORAGE_KEY);
        setScreen("dashboard");
        setUser(null);
        setData(null);
    }
    return (React.createElement("div", { className: "shell" },
        React.createElement("nav", { className: "side" },
            React.createElement("div", { className: "side__top" },
                React.createElement("div", { className: "side__logo" },
                    React.createElement("span", null, "MP"),
                    "\uCC44\uAD8C\uAD00\uB9AC")),
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
                        "\uAE30\uC900\uC77C ",
                        data.meta.today,
                        " \u00B7 ",
                        reportScreen ? selectedView.label : "현재 운영데이터 기준"),
                    React.createElement("div", { className: "sub" },
                        "\uAC70\uB798\uCC98 ",
                        screenData.customers.length,
                        "\uACF3 \u00B7 \uC804\uCCB4 \uCC44\uAD8C ",
                        won(sum(screenData.customers, "balance")),
                        "\uC6D0")),
                React.createElement("div", { className: "spacer" }),
                reportScreen ? React.createElement("label", { className: "view-select" },
                    React.createElement("span", null, "\uC870\uD68C\uAE30\uC900"),
                    React.createElement("select", { className: "select", value: effectiveView, onChange: (e) => setDataView(e.target.value) }, viewOptions.map((view) => React.createElement("option", { key: view.key, value: view.key }, view.label)))) : React.createElement("span", { className: "badge badge--brand" }, "\uD604\uC7AC \uC6B4\uC601\uB370\uC774\uD130 \uAE30\uC900"),
                React.createElement("div", { className: "who" },
                    React.createElement("b", null,
                        user.name,
                        user.title && " " + user.title),
                    React.createElement("span", null,
                        data.meta.roles[user.role].label,
                        " \u00B7 ",
                        user.username)),
                React.createElement("button", { className: "btn btn--sm", onClick: () => setPasswordOpen(true) }, "\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD"),
                React.createElement("button", { className: "btn btn--sm", onClick: signOut }, "\uB85C\uADF8\uC544\uC6C3")),
            React.createElement("div", { className: "page" },
                screen === "dashboard" && React.createElement(Dashboard, { data: reportData, setScreen: setScreen, setPreset: setPreset }),
                screen === "summary" && React.createElement(BondSummary, { data: reportData, notify: notify }),
                screen === "closing" && React.createElement(ClosingReceivables, { data: reportData, notify: notify }),
                screen === "customers" && React.createElement(Customers, { data: reportData, can: can, preset: preset, notify: notify, patchCustomer: patchCustomer }),
                screen === "owners" && React.createElement(Owners, { data: reportData }),
                screen === "collections" && React.createElement(Collections, { data: data, can: can, notify: notify, refresh: load }),
                screen === "collectionUpload" && React.createElement(CollectionUpload, { can: can, notify: notify, refresh: load }),
                screen === "targets" && React.createElement(Targets, { data: reportData, notify: notify, refresh: load }),
                screen === "upload" && React.createElement(Upload, { data: data, can: can, notify: notify, applyUpload: applyUpload, refresh: load }),
                screen === "cashplan" && React.createElement(CashPlan, { data: reportData, dataView: effectiveView, notify: notify }),
                screen === "users" && React.createElement(Users, { data: data, notify: notify, refresh: load }),
                screen === "manual" && React.createElement(Manual, null))),
        toast && React.createElement("div", { className: "toast" + (toast.bad ? " toast--bad" : "") }, toast.message),
        passwordOpen && React.createElement(ChangePassword, { user: user, onClose: () => setPasswordOpen(false), notify: notify })));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
