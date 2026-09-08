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
  if (!amount) return "";
  const parts = [];
  const eok = Math.floor(amount / 100000000);
  if (eok) { parts.push(won(eok) + "억"); amount %= 100000000; }
  const man = Math.floor(amount / 10000);
  if (man) { parts.push(won(man) + "만"); amount %= 10000; }
  if (amount) parts.push(won(amount));
  return parts.join(" ") + "원";
}

function short(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e8) return { value: (v / 1e8).toFixed(1), unit: "억" };
  if (Math.abs(v) >= 1e4) return { value: Math.round(v / 1e4).toLocaleString("ko-KR"), unit: "만" };
  return { value: v.toLocaleString("ko-KR"), unit: "원" };
}

const STATUS_STYLE = { 정상: "ok", 연체: "warn", 부실: "bad", 선수금: "brand" };
const STATUS_LABEL = { 정상: "정상채권", 연체: "미수채권", 부실: "부실채권", 선수금: "선수금" };
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const sum = (list, key) => list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
function customerForUnit(customer, unit) {
  if (unit === "전체") return customer;
  const part = customer.unit_breakdown && customer.unit_breakdown[unit];
  if (!part) return customer.biz_unit === unit && Number(customer.advance) > 0 ? customer : null;
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
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return [parsed.y, String(parsed.m).padStart(2, "0"), String(parsed.d).padStart(2, "0")].join("-");
  }
  const text = String(value || "").trim();
  if (!text) return "";
  const digits = text.replace(/[^0-9]/g, "");
  if (digits.length === 8) return digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6, 8);
  const match = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return match ? match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0") : "";
}

function parseUploadAmount(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "—") return 0;
  const wrappedNegative = /^\(.*\)$/.test(text);
  const normalized = text.replace(/[,\s원₩()]/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
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
  try { data = await res.json(); } catch (e) { /* 본문 없음 */ }
  if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했습니다. (" + res.status + ")");
  return data;
}

/* ══════════════════ 공용 컴포넌트 ══════════════════ */

function Card({ title, actions, children, flush }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card__head">
          <h3>{title}</h3>
          <div className="spacer" />
          {actions}
        </header>
      )}
      <div className={"card__body" + (flush ? " card__body--flush" : "")}>{children}</div>
    </section>
  );
}

function Empty({ title, children }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}

function Badge({ status }) {
  return <span className={"badge badge--" + (STATUS_STYLE[status] || "mute")}>{STATUS_LABEL[status] || status}</span>;
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function ChangePassword({ user, onClose, notify }) {
  const [form, setForm] = useState({ current: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    if (!form.current) { notify("현재 비밀번호를 입력하세요.", true); return; }
    if (form.password.length < 8) { notify("새 비밀번호는 8자 이상이어야 합니다.", true); return; }
    if (form.password !== form.confirm) { notify("새 비밀번호 확인이 일치하지 않습니다.", true); return; }
    if (form.current === form.password) { notify("현재 비밀번호와 다른 비밀번호를 입력하세요.", true); return; }
    setBusy(true);
    try {
      await api("/api/password", { method: "POST", body: { current: form.current, password: form.password } });
      notify("비밀번호를 변경했습니다."); onClose();
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal-card password-modal" onMouseDown={(e) => e.stopPropagation()}>
      <header className="card__head"><h3>내 비밀번호 변경</h3><div className="spacer" />
        <button className="btn btn--sm" onClick={onClose}>닫기</button></header>
      <form className="card__body" onSubmit={submit}>
        <Field label="아이디"><input className="input" value={user.username} readOnly disabled /></Field>
        <Field label="현재 비밀번호"><input className="input" type="password" autoComplete="current-password"
          value={form.current} onChange={set("current")} autoFocus /></Field>
        <Field label="새 비밀번호"><input className="input" type="password" autoComplete="new-password"
          value={form.password} onChange={set("password")} placeholder="8자 이상" /></Field>
        <Field label="새 비밀번호 확인"><input className="input" type="password" autoComplete="new-password"
          value={form.confirm} onChange={set("confirm")} /></Field>
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? "변경 중" : "비밀번호 변경"}</button>
      </form>
    </section>
  </div>;
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
    setBusy(true); setError("");
    try {
      const { user } = await api("/api/login", { method: "POST", body: { username: loginUsername, password: loginPassword } });
      onDone(user);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <div className="login">
      <aside className="login__aside">
        <div className="login__brand">MEDPARK</div>
        <div>
          <h1 className="login__head">미수채권<br />관리 시스템</h1>
          <p className="login__sub">
            덴탈·메디컬·에스테틱 세 사업부의 채권 잔액과 수금 진행을 한 화면에서 봅니다.
          </p>
          <div className="login__stat">
            <div><b>3</b>사업부</div>
            <div><b>9</b>채권 분류</div>
            <div><b>11</b>권한 구분</div>
          </div>
        </div>
        <div className="login__brand" style={{ opacity: .55 }}>내부 업무용 · 외부 공유 금지</div>
      </aside>

      <div className="login__panel">
        <div className="login__form">
          <h2>로그인</h2>
          <p className="hint">회사에서 발급받은 계정으로 접속하세요.</p>
          {error && <div className="alert alert--bad">{error}</div>}
          <Field label="아이디">
            <input ref={usernameRef} className="input" value={username} autoFocus autoComplete="username"
              onChange={(e) => setUsername(e.target.value)} onInput={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Medpark0" />
          </Field>
          <Field label="비밀번호">
            <input ref={passwordRef} className="input" type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} onInput={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          <button className="btn btn--primary" style={{ width: "100%", marginTop: 6 }}
            onClick={submit} disabled={busy}>
            {busy ? "확인하는 중" : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════ 대시보드 ══════════════════ */

function Dashboard({ data, setScreen, setPreset }) {
  const { collections, targets } = data;
  const customers = data.customers;
  const [unit, setUnit] = useState("전체");
  const [normalTopUnit, setNormalTopUnit] = useState("전체");
  const [overdueTopUnit, setOverdueTopUnit] = useState("전체");

  const scoped = useMemo(
    () => customersForUnit(customers, unit),
    [customers, unit]);

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
      if (!m) return;
      map[m] = map[m] || { month: m, amount: 0, count: 0 };
      map[m].amount += c.amount; map[m].count += 1;
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
  }, [approved]);

  const normalTop5 = customersForUnit(customers, normalTopUnit)
    .filter((c) => c.normal_balance > 0)
    .sort((a, b) => b.normal_balance - a.normal_balance).slice(0, 5);
  const overdueTop5 = customersForUnit(customers, overdueTopUnit)
    .filter((c) => c.overdue_balance > 0)
    .sort((a, b) => b.overdue_balance - a.overdue_balance).slice(0, 5);
  const topUnitSelect = (value, setter, label) => (
    <select className="select" style={{ width: 110, padding: "6px 9px" }}
      value={value} onChange={(e) => setter(e.target.value)} aria-label={label}>
      {["전체", ...data.meta.units].map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );

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
      map[key].정상 += c.normal_balance; map[key].연체 += c.overdue_balance;
      map[key].부실 += c.bad_balance; map[key].total += c.balance; map[key].count += 1;
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
    if (!map[key]) map[key] = { name: c.customer_name || key, amount: 0 };
    map[key].amount += Number(c.amount) || 0;
    return map;
  }, {})).sort((a, b) => b.amount - a.amount);
  const yesterdayByUnit = data.meta.units.map((u) => ({
    unit: u,
    amount: sum(yesterdayCollections.filter((c) => customerUnit[c.customer_code] === u), "amount"),
  }));

  return (
    <>
      <div className="chiprow">
        {["전체", ...data.meta.units].map((u) => (
          <button key={u} className="chip" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u}</button>
        ))}
      </div>

      <div className="grid grid--kpi">
        {kpis.map((k) => {
          const s = short(k.value);
          return (
            <button key={k.key} className="kpi" onClick={() => k.key !== "전체" && jump(k.key)}>
              <div className="kpi__label">
                <i className="kpi__dot" style={{ background: k.color }} />{k.label}
              </div>
              <div className="kpi__value num">{s.value}<em>{s.unit}</em></div>
              <div className="kpi__meta num">
                거래처 {k.count}곳 · {won(k.value)}원
              </div>
            </button>
          );
        })}
      </div>

      <Card title={"전일 수금현황 요약 · " + yesterday}>
        <div className="grid grid--3">
          <div><div className="kpi__label">승인 수금 합계</div>
            <div className="kpi__value num">{won(sum(yesterdayCollections, "amount"))}<em>원</em></div></div>
          <div><div className="kpi__label">승인 건수</div>
            <div className="kpi__value num">{yesterdayCollections.length}<em>건</em></div>
            <div className="t-sm t-muted" style={{ marginTop: 4 }}>
              {yesterdayCustomers.length ? <>
                {yesterdayCustomers.slice(0, 3).map((c) => c.name).join(" · ")}
                {yesterdayCustomers.length > 3 ? " 외 " + (yesterdayCustomers.length - 3) + "개처" : ""}
              </> : "수금 내역 없음"}
            </div></div>
          <div><div className="kpi__label">사업부별 수금</div>
            <div className="t-sm">{yesterdayByUnit.map((r) =>
              <span key={r.unit} style={{ display: "block", marginTop: 3 }}>{r.unit} · <b className="num">{won(r.amount)}원</b></span>)}</div></div>
        </div>
      </Card>

      <div className="grid grid--2">
        <Card title="사업부별 채권 분류 현황"
          actions={<div className="legend">
            <span><i style={{ background: "var(--ok)" }} />정상채권</span>
            <span><i style={{ background: "var(--warn)" }} />미수채권</span>
            <span><i style={{ background: "var(--bad)" }} />부실채권</span>
          </div>}>
          <div className="signal">
            {byUnit.map((g) => (
              <div className="signal__row" key={g.unit}>
                <div className="signal__unit">{g.unit}</div>
                <div className="signal__bar" style={{ width: (Math.max(8, (g.total / maxUnit) * 100)) + "%" }}>
                  {["정상", "연체", "부실"].map((s) => g[s] > 0 && (
                    <button key={s} className={"signal__seg signal__seg--" + STATUS_STYLE[s]}
                      style={{ width: (g[s] / g.total) * 100 + "%" }}
                      title={g.unit + " " + STATUS_LABEL[s] + " " + won(g[s]) + "원"}
                      onClick={() => { setPreset({ status: s, unit: g.unit }); setScreen("customers"); }} />
                  ))}
                </div>
                <div className="signal__total num">{short(g.total).value}{short(g.total).unit}</div>
              </div>
            ))}
          </div>
          <p className="t-sm t-muted" style={{ margin: "14px 0 0" }}>
            막대를 누르면 해당 사업부·분류의 거래처 목록으로 이동합니다.
          </p>
        </Card>

        <Card title="월별 수금 실적" flush>
          {monthly.length === 0 ? (
            <Empty title="승인된 수금 내역이 아직 없습니다.">
              수금 등록 화면에서 입력하고 재무담당이 승인하면 여기에 집계됩니다.
            </Empty>
          ) : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>기준월</th><th className="r">건수</th><th className="r">수금액 (원)</th></tr></thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month}>
                      <td className="t-strong num">{m.month}</td>
                      <td className="r num">{m.count}</td>
                      <td className="r num t-strong">{won(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>합계</td>
                    <td className="r num">{sum(monthly, "count")}</td>
                    <td className="r num">{won(sum(monthly, "amount"))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid--3">
        <Card title="수금목표 요약">
          <table>
            <thead>
              <tr><th>구분</th><th className="r">건수</th><th className="r">목표금액 (원)</th></tr>
            </thead>
            <tbody>
              <tr><td>오늘 목표</td><td className="r num t-strong">{dueToday.length}</td>
                <td className="r num">{won(sum(dueToday, "amount"))}</td></tr>
              <tr><td>이번 주 목표</td><td className="r num t-strong">{dueWeek.length}</td>
                <td className="r num">{won(sum(dueWeek, "amount"))}</td></tr>
              <tr><td>기한 초과</td>
                <td className="r num t-strong" style={{ color: overdueTargets.length ? "var(--bad)" : "inherit" }}>
                  {overdueTargets.length}</td>
                <td className="r num">{won(sum(overdueTargets, "amount"))}</td></tr>
            </tbody>
          </table>
          <button className="btn btn--sm" style={{ marginTop: 12 }} onClick={() => setScreen("targets")}>
            수금목표 관리로 이동
          </button>
        </Card>

        <Card title="정상채권 TOP 5" actions={topUnitSelect(normalTopUnit, setNormalTopUnit, "정상채권 사업부 선택")} flush>
          <div className="tablewrap">
            <table>
              <tbody>
                {normalTop5.map((c, i) => (
                  <tr key={c.code}>
                    <td className="t-muted num" style={{ width: 26 }}>{i + 1}</td>
                    <td className="t-strong">{c.name}</td>
                    <td><Badge status="정상" /></td>
                    <td className="r num">{won(c.normal_balance)}</td>
                  </tr>
                ))}
                {normalTop5.length === 0 && <tr><td className="t-muted">정상채권 데이터가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="미수채권 TOP 5" actions={topUnitSelect(overdueTopUnit, setOverdueTopUnit, "미수채권 사업부 선택")} flush>
          <div className="tablewrap">
            <table>
              <tbody>
                {overdueTop5.map((c, i) => (
                  <tr key={c.code}>
                    <td className="t-muted num" style={{ width: 26 }}>{i + 1}</td>
                    <td className="t-strong">{c.name}</td>
                    <td className="num t-sm t-muted">{overdueMonths(c.overdue_days)}개월</td>
                    <td className="r num">{won(c.overdue_balance)}</td>
                  </tr>
                ))}
                {overdueTop5.length === 0 && (
                  <tr><td className="t-muted">미수채권 데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="담당자별 채권 현황" flush>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>담당자</th><th className="r">거래처</th><th className="r">정상채권</th>
                <th className="r">미수채권</th><th className="r">부실채권</th><th className="r">합계</th>
                <th style={{ width: 150 }}>미수·부실채권 비중</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => {
                const risk = o.total ? ((o.연체 + o.부실) / o.total) * 100 : 0;
                return (
                  <tr key={o.owner}>
                    <td className="t-strong">{o.owner}</td>
                    <td className="r num">{o.count}</td>
                    <td className="r num">{won(o.정상)}</td>
                    <td className="r num">{won(o.연체)}</td>
                    <td className="r num">{won(o.부실)}</td>
                    <td className="r num t-strong">{won(o.total)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="bar"><i style={{
                          width: risk + "%",
                          background: risk > 40 ? "var(--bad)" : risk > 15 ? "var(--warn)" : "var(--ok)"
                        }} /></div>
                        <span className="t-sm num t-muted">{risk.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
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
    const current = Math.max(0, source.current - paid); paid = Math.max(0, paid - source.current);
    const next = Math.max(0, source.next - paid); paid = Math.max(0, paid - source.next);
    const later = Math.max(0, source.later - paid);
    return { later, next, current };
  }

  const summary = useMemo(() => units.map((unit) => {
    const customers = customersForUnit(data.customers, unit);
    const row = { unit, later: 0, next: 0, current: 0, overdue: 0, bad: 0,
      normalCollected: 0, overdueCollected: 0 };
    customers.forEach((c) => {
      const live = liveNormal(c);
      row.later += live.later; row.next += live.next; row.current += live.current;
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
      if (!window.html2canvas) throw new Error("이미지 변환 모듈을 불러오지 못했습니다.");
      const canvas = await window.html2canvas(reportRef.current, {
        scale: 2, backgroundColor: "#eef1f6", useCORS: true,
      });
      const base = "채권요약현황_" + data.meta.today;
      if (kind === "png") {
        const link = document.createElement("a");
        link.download = base + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        if (!window.PptxGenJS) throw new Error("PPT 변환 모듈을 불러오지 못했습니다.");
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
    } catch (e) { notify(e.message, true); }
    finally { setExporting(false); }
  }

  return (
    <>
      <div className="export-actions">
        <span className="t-muted t-sm">결산회의용 다운로드</span>
        <button className="btn btn--sm" disabled={exporting} onClick={() => exportReport("png")}>그림파일(PNG)</button>
        <button className="btn btn--sm btn--primary" disabled={exporting} onClick={() => exportReport("pptx")}>PPT</button>
      </div>
      <div ref={reportRef} className="summary-export">
      <Card title={"1. 사업부별 채권 분류 현황 (" + reportDate + " 기준)"} flush>
        <div className="tablewrap summary-table">
          <table>
            <thead>
              <tr><th rowSpan="2">사업부</th><th colSpan="4" className="summary-head summary-head--normal">정상채권</th>
                <th rowSpan="2" className="summary-head summary-head--overdue">미수채권</th>
                <th rowSpan="2" className="summary-head summary-head--bad">부실채권</th>
                <th rowSpan="2" className="summary-head summary-head--total">합계</th>
                <th rowSpan="2" className="summary-head summary-head--total">미수채권 비중</th></tr>
              <tr><th>10월 이후</th><th>9월 분</th><th>8월 분(당월)</th><th>[소계]</th></tr>
            </thead>
            <tbody>{summary.map((r) => (
              <tr key={r.unit}><td className="t-strong">{unitNames[r.unit]}</td>
                <td className="r num summary-normal">{won(r.later)}</td>
                <td className="r num summary-normal">{won(r.next)}</td>
                <td className="r num summary-normal">{won(r.current)}</td>
                <td className="r num summary-subtotal">{won(r.normal)}</td>
                <td className="r num summary-overdue">{won(r.overdue)}</td>
                <td className="r num summary-bad">{won(r.bad)}</td>
                <td className="r num t-strong">{won(r.total)}</td>
                <td className="r num t-strong">{rate(r.overdue, r.total)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td>합계</td><td className="r num">{won(total("later"))}</td>
              <td className="r num">{won(total("next"))}</td><td className="r num">{won(total("current"))}</td>
              <td className="r num summary-subtotal">{won(total("normal"))}</td>
              <td className="r num summary-overdue">{won(total("overdue"))}</td>
              <td className="r num">{won(total("bad"))}</td><td className="r num">{won(total("total"))}</td>
              <td className="r num">{rate(total("overdue"), total("total"))}</td></tr></tfoot>
          </table>
        </div>
        <div className="summary-note" data-html2canvas-ignore="true">현재 운영 기초자료 {data.customers.length}개 거래처 기준 · 금액 단위: 원</div>
      </Card>

      <Card title={"2. " + reportMonth + "월 수금실적 (" + reportMonth + "월 1일 기초 대비, "
        + reportMonth + "월 " + reportDay + "일 누계)"} flush>
        <div className="tablewrap summary-table">
          <table>
            <thead><tr><th rowSpan="2">사업부</th>
              <th colSpan="4" className="summary-head summary-head--normal">정상채권 (당월분)</th>
              <th colSpan="4" className="summary-head summary-head--overdue">미수채권 (부실채권 제외)</th></tr>
              <tr><th>기초</th><th>수금액</th><th>잔액</th><th>회수율</th>
                <th>기초</th><th>수금액</th><th>잔액</th><th>회수율</th></tr></thead>
            <tbody>{summary.map((r) => {
              const normalOpening = r.current + r.normalCollected;
              const overdueOpening = r.overdue + r.overdueCollected;
              return <tr key={r.unit}><td className="t-strong">{unitNames[r.unit]}</td>
                <td className="r num">{won(normalOpening)}</td><td className="r num summary-normal">{won(r.normalCollected)}</td>
                <td className="r num summary-subtotal">{won(r.current)}</td><td className="r num t-strong">{rate(r.normalCollected, normalOpening)}</td>
                <td className="r num">{won(overdueOpening)}</td><td className="r num summary-overdue">{won(r.overdueCollected)}</td>
                <td className="r num summary-subtotal">{won(r.overdue)}</td><td className="r num t-strong">{rate(r.overdueCollected, overdueOpening)}</td></tr>;
            })}</tbody>
            <tfoot><tr><td>합계</td>
              <td className="r num">{won(total("current") + total("normalCollected"))}</td>
              <td className="r num">{won(total("normalCollected"))}</td><td className="r num">{won(total("current"))}</td>
              <td className="r num">{rate(total("normalCollected"), total("current") + total("normalCollected"))}</td>
              <td className="r num">{won(total("overdue") + total("overdueCollected"))}</td>
              <td className="r num">{won(total("overdueCollected"))}</td><td className="r num">{won(total("overdue"))}</td>
              <td className="r num">{rate(total("overdueCollected"), total("overdue") + total("overdueCollected"))}</td></tr></tfoot>
          </table>
        </div>
      </Card>
      </div>
    </>
  );
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
      if (!window.html2canvas) throw new Error("이미지 변환 모듈을 불러오지 못했습니다.");
      const canvas = await window.html2canvas(reportRef.current, { scale: 2, backgroundColor: "#eef1f6", useCORS: true });
      const base = "결산회의_부서별_미수채권현황_" + data.meta.today;
      if (kind === "png") {
        const link = document.createElement("a"); link.download = base + ".png";
        link.href = canvas.toDataURL("image/png"); link.click();
      } else {
        if (!window.PptxGenJS) throw new Error("PPT 변환 모듈을 불러오지 못했습니다.");
        const pptx = new window.PptxGenJS(); pptx.layout = "LAYOUT_WIDE"; pptx.author = "MEDPARK";
        const pageHeight = Math.floor(canvas.width * 6.75 / 12.65);
        const reportBox = reportRef.current.getBoundingClientRect();
        const scaleY = canvas.height / reportBox.height;
        const rowCuts = [...reportRef.current.querySelectorAll(
          ".closing-detail tbody tr, .closing-detail tfoot tr"
        )].map((row) => Math.min(canvas.height,
          Math.round((row.getBoundingClientRect().bottom - reportBox.top) * scaleY) + 2
        )).sort((a, b) => a - b);
        let top = 0;
        while (top < canvas.height) {
          const desiredBottom = Math.min(canvas.height, top + pageHeight);
          const safeCuts = rowCuts.filter((cut) => cut > top + 80 && cut <= desiredBottom);
          const bottom = desiredBottom === canvas.height ? canvas.height
            : (safeCuts.length ? safeCuts[safeCuts.length - 1] : desiredBottom);
          const slice = document.createElement("canvas"); slice.width = canvas.width;
          slice.height = bottom - top;
          slice.getContext("2d").drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
          const slide = pptx.addSlide(); slide.background = { color: "EEF1F6" };
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
    } catch (e) { notify(e.message, true); }
    finally { setExporting(false); }
  }

  return <>
    <div className="closing-toolbar">
      <Field label="사업부"><select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
        <option>전체</option>{data.meta.units.map((u) => <option key={u}>{u}</option>)}
      </select></Field>
      <div className="spacer" /><span className="t-muted t-sm">결산회의용 다운로드</span>
      <button className="btn btn--sm" disabled={exporting} onClick={() => exportReport("png")}>그림파일(PNG)</button>
      <button className="btn btn--sm btn--primary" disabled={exporting} onClick={() => exportReport("pptx")}>PPT</button>
    </div>
    <div ref={reportRef} className="closing-report">
      {reports.length === 0 && <Card><div className="zero-result">조회 대상 채권이 없습니다.</div></Card>}
      {reports.map((report) => <Card key={report.unit}
        title={(unitNames[report.unit] || report.unit) + " · 미수채권현황"} flush>
        <div className="closing-meta">기준일 {data.meta.today} · 잔액이 있는 채권만 표시</div>
        <div className="tablewrap"><table className="closing-summary"><thead><tr>
          <th>구분</th><th className="r">기초</th><th className="r">수금액</th><th className="r">잔액</th><th className="r">회수율</th><th>주요사항</th>
        </tr></thead><tbody>
          <tr className="closing-summary--overdue"><td>미수채권</td>
            <td className="r num">{won(report.overdueOpening)}</td><td className="r num">{won(report.overdueCollected)}</td>
            <td className="r num t-strong">{won(report.overdueBalance)}</td>
            <td className="r num">{rate(report.overdueCollected, report.overdueOpening)}</td>
            <td>{report.detail.filter((x) => x.notes.length).length}개 거래처 특이사항 등록</td></tr>
          {report.normalOpening > 0 && <tr><td>정상채권 (수금 대상)</td>
            <td className="r num">{won(report.normalOpening)}</td><td className="r num">{won(report.normalCollected)}</td>
            <td className="r num t-strong">{won(report.normalBalance)}</td>
            <td className="r num">{rate(report.normalCollected, report.normalOpening)}</td><td /></tr>}
        </tbody></table></div>
        <div className="tablewrap"><table className="closing-detail"><thead><tr>
          <th>거래처명</th><th>사업부</th><th className="r">회수기간</th><th className="r">연체기간</th>
          <th>채권구분</th><th className="r">채권잔액</th><th>특이사항</th>
        </tr></thead><tbody>{report.detail.map((row) => <tr key={row.code + row.category}>
          <td className="t-strong">{row.name}</td><td>{report.unit}</td>
          <td className={!row.grouped && !Number(row.period_confirmed) ? "customer-period--missing" : "r num"}>
            {row.grouped ? "합산" : !Number(row.period_confirmed)
              ? "임시 1개월 · 입력 필요" : Number(row.period) + "개월"}</td>
          <td className="r num">{row.months}개월</td><td><Badge status="연체" /></td>
          <td className="r num closing-amount">{won(row.amount)}</td>
          <td className="closing-notes">{row.notes.join(" · ") || "–"}</td>
        </tr>)}</tbody><tfoot><tr><td colSpan={5}>합계 · {report.detail.length}건</td>
          <td className="r num">{won(sum(report.detail, "amount"))}</td><td /></tr></tfoot></table></div>
      </Card>)}
    </div>
  </>;
}

/* ══════════════════ 거래처별 현황 ══════════════════ */

function InlineEdit({ value, type = "text", placeholder, canEdit, onSave, formatValue }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  useEffect(() => { if (!editing) setDraft(value || ""); }, [value, editing]);

  async function commit() {
    setEditing(false);
    if (draft === (value || "")) return;
    await onSave(draft);
  }

  if (!editing) return (
    <button type="button" className="inline-edit" disabled={!canEdit}
      onClick={() => canEdit && setEditing(true)}>
      {value !== "" && value != null ? (formatValue ? formatValue(value) : value) :
        <span className="t-muted">{placeholder}</span>}
    </button>
  );
  return <input className="input input--compact" type={type} value={draft} autoFocus
    onChange={(e) => setDraft(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }} />;
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

  useEffect(() => { if (preset) { setUnit(preset.unit); setType(preset.status); } }, [preset]);

  const rows = useMemo(() => customersForUnit(data.customers, unit).flatMap((c) => {
    const advance = Number(c.advance) || 0;
    const parts = [
      { status: "정상", balance: Number(c.normal_balance) || 0, months: 0 },
      { status: "연체", balance: Number(c.overdue_balance) || 0, months: overdueMonths(c.overdue_days) },
      { status: "부실", balance: Number(c.bad_balance) || 0, months: overdueMonths(c.overdue_days) },
    ].filter((part) => part.balance !== 0);
    if (parts.length === 0 && advance > 0) parts.push({ status: "선수금", balance: -advance, months: 0 });
    return parts.map((part, index) => ({ ...c, ...part,
      advance: part.status === "선수금" || index === 0 ? advance : 0,
      rowKey: c.code + "-" + c.biz_unit + "-" + part.status }));
  }).filter((c) => {
    if (type !== "전체" && c.status !== type) return false;
    const missingPeriod = !Number(c.period_confirmed);
    if (periodFilter === "미입력" && !missingPeriod) return false;
    if (periodFilter === "입력" && missingPeriod) return false;
    if (ownerFilter === "미배정" && c.owner) return false;
    if (ownerFilter !== "전체" && ownerFilter !== "미배정" && c.owner !== ownerFilter) return false;
    if (ageFilter === "0" && c.months !== 0) return false;
    if (ageFilter === "1-3" && (c.months < 1 || c.months > 3)) return false;
    if (ageFilter === "4-11" && (c.months < 4 || c.months > 11)) return false;
    if (ageFilter === "12+" && c.months < 12) return false;
    const query = normalizeSearch(q);
    if (query && ![c.name, c.code, code5(c.code), c.owner]
      .some((value) => normalizeSearch(value).includes(query))) return false;
    return true;
  }), [data.customers, unit, type, q, periodFilter, ownerFilter, ageFilter]);

  const owners = useMemo(() => [...new Set(data.customers.map((c) => c.owner).filter(Boolean))].sort(), [data.customers]);

  async function updateCustomer(code, body, message) {
    try {
      const { customer } = await api("/api/customers/" + encodeURIComponent(code), { method: "PATCH", body });
      patchCustomer(customer); notify(message);
    } catch (e) { notify(e.message, true); }
  }

  async function saveNote(code) {
    await updateCustomer(code, { note: draftNote }, "비고를 저장했습니다.");
    setEditingNote(null);
  }

  async function openReceivables(c) {
    try {
      const result = await api("/api/customers/" + encodeURIComponent(c.code) + "/receivables");
      setReceivableDetail({ ...result, name: c.name });
    } catch (e) { notify(e.message, true); }
  }

  async function saveItemTarget(itemId, target_date) {
    try {
      const result = await api("/api/receivables/" + itemId, { method: "PATCH", body: { target_date } });
      setReceivableDetail((d) => ({ ...d, items: d.items.map((x) => x.id === itemId ? result.item : x) }));
      notify("채권별 수금목표일을 저장했습니다.");
    } catch (e) { notify(e.message, true); }
  }

  async function saveItemNote(itemId, note) {
    try {
      const result = await api("/api/receivables/" + itemId, { method: "PATCH", body: { note } });
      const items = receivableDetail.items.map((x) => x.id === itemId ? result.item : x);
      setReceivableDetail((d) => ({ ...d, items }));
      patchCustomer({ ...receivableDetail.customer,
        detail_notes: [...new Set(items.map((x) => x.note).filter(Boolean))] });
      notify("채권 비고를 저장하고 거래처 현황에 취합 반영했습니다.");
    } catch (e) { notify(e.message, true); }
  }

  async function saveItemUnit() {
    if (!unitChange || !unitChange.target || unitChange.target === unitChange.item.biz_unit) {
      notify("현재 사업부와 다른 사업부를 선택하세요.", true); return;
    }
    if (!unitChange.reason.trim()) { notify("사업부 변경 사유를 입력하세요.", true); return; }
    try {
      const result = await api("/api/receivables/" + unitChange.item.id, {
        method: "PATCH", body: { biz_unit: unitChange.target, unit_change_reason: unitChange.reason.trim() },
      });
      setReceivableDetail((d) => ({ ...d, customer: result.customer,
        items: d.items.map((x) => x.id === result.item.id ? { ...x, ...result.item } : x) }));
      patchCustomer(result.customer); setUnitChange(null);
      notify("채권 사업부를 변경하고 사업부별 합계를 다시 계산했습니다.");
    } catch (e) { notify(e.message, true); }
  }

  async function reclassifyAsOverdue(item) {
    if (!window.confirm(won(item.balance) + "원을 정상채권에서 미수채권으로 전환할까요?")) return;
    try {
      const result = await api("/api/receivables/" + item.id, {
        method: "PATCH", body: { category: "연체" },
      });
      setReceivableDetail((d) => ({ ...d, customer: result.customer,
        items: d.items.map((x) => x.id === item.id ? { ...result.item, as_of_status: "연체" } : x) }));
      patchCustomer(result.customer);
      notify("정상채권을 미수채권으로 전환했습니다.");
    } catch (e) { notify(e.message, true); }
  }

  const distinctCustomers = new Set(rows.map((r) => r.code)).size;

  return (
    <>
      <Card title="조회 조건">
        <div className="customer-filters">
          <Field label="사업부별 필터"><select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>전체</option>{data.meta.units.map((u) => <option key={u}>{u}</option>)}
          </select></Field>
          <Field label="채권유형별 필터"><select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option>전체</option>{data.meta.statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            <option value="선수금">선수금</option>
          </select></Field>
          <Field label="회수기간"><select className="select" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
            <option>전체</option><option>미입력</option><option>입력</option>
          </select></Field>
          <Field label="담당자"><select className="select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option>전체</option><option>미배정</option>{owners.map((o) => <option key={o}>{o}</option>)}
          </select></Field>
          <Field label="연체기간"><select className="select" value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
            <option value="전체">전체</option><option value="0">0개월</option><option value="1-3">1~3개월</option>
            <option value="4-11">4~11개월</option><option value="12+">12개월 이상</option>
          </select></Field>
          <Field label="거래처 검색"><input className="input" lang="ko" inputMode="text" value={q} placeholder="거래처명·코드·담당자"
            onChange={(e) => setQ(e.target.value)} onCompositionEnd={(e) => setQ(e.currentTarget.value)} /></Field>
          <button className="btn btn--sm" onClick={() => { setUnit("전체"); setType("전체"); setPeriodFilter("전체"); setOwnerFilter("전체"); setAgeFilter("전체"); setQ(""); }}>초기화</button>
        </div>
      </Card>

      <Card title={(STATUS_LABEL[type] || type) + " · 거래처 " + distinctCustomers + "곳 / 채권 " + rows.length + "건"} flush>
          <div className="tablewrap customer-table"><table>
            <thead><tr><th>코드</th><th>거래처명</th><th>사업부</th><th>채권유형</th><th>회수기간</th><th>담당자</th>
              <th>수금목표일</th><th className="r">채권잔액</th><th className="r">선수금</th>
              <th className="r">연체기간(개월)</th><th>최종수금일</th><th style={{ minWidth: 180 }}>비고</th></tr></thead>
            <tbody>{rows.map((c) => <tr key={c.rowKey}>
              <td className="num t-muted">{code5(c.code)}</td><td className="t-strong">{c.name}</td>
              <td>{c.biz_unit}</td><td><Badge status={c.status} /></td>
              <td className={"num" + (!Number(c.period_confirmed) ? " customer-period--missing" : "")}>
                <InlineEdit value={!Number(c.period_confirmed) ? "" : String(c.period)}
                  placeholder="임시 1개월 · 입력 필요" type="number" canEdit={can("customer_info_edit")}
                  formatValue={(value) => Number(value) === 0 ? "0개월 (당월)" :
                    Number(value) === 1 ? "1개월 (익월)" : value + "개월"}
                  onSave={(period) => updateCustomer(c.code, { period }, "회수기간을 저장했습니다.")} />
              </td>
              <td><InlineEdit value={c.owner} placeholder="클릭해 입력" canEdit={can("note_edit")}
                onSave={(owner) => updateCustomer(c.code, { owner }, "담당자를 저장했습니다.")} /></td>
              <td>{c.status === "선수금" ? "–" : <button type="button" className="inline-edit" onClick={() => openReceivables(c)}>
                채권별 목표 설정</button>}</td>
              <td className="r num t-strong">{won(c.balance)}</td>
              <td className="r num">{c.advance ? won(c.advance) : "–"}</td>
              <td className="r num">{c.months}개월</td><td className="num t-muted t-sm">{c.last_paid_at || "–"}</td>
              <td style={{ whiteSpace: "normal" }}>{editingNote === c.rowKey ? <div className="inline-note">
                <input className="input" value={draftNote} autoFocus onChange={(e) => setDraftNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveNote(c.code)} />
                <button className="btn btn--sm btn--primary" onClick={() => saveNote(c.code)}>저장</button>
                <button className="btn btn--sm" onClick={() => setEditingNote(null)}>취소</button>
              </div> : <button type="button" className="inline-edit" disabled={!can("note_edit")}
                onClick={() => { setEditingNote(c.rowKey); setDraftNote(c.note || ""); }}>
                {[c.note, ...(c.detail_notes || [])].filter(Boolean).join(" · ") || <span className="t-muted">클릭해 입력</span>}</button>}</td>
            </tr>)}</tbody>
            {rows.length === 0 && <tbody><tr><td colSpan={12} className="zero-result">조회 결과 <b>0원</b></td></tr></tbody>}
            <tfoot><tr><td colSpan={7}>합계 · 거래처 {distinctCustomers}곳 / 채권 {rows.length}건</td>
              <td className="r num">{won(sum(rows, "balance"))}</td><td className="r num">{won(sum(rows, "advance"))}</td>
              <td colSpan={3} /></tr></tfoot>
          </table></div>
      </Card>
      {receivableDetail && <div className="modal-backdrop" onMouseDown={() => setReceivableDetail(null)}>
        <section className="modal-card modal-card--wide" onMouseDown={(e) => e.stopPropagation()}>
          <header className="card__head"><h3>{receivableDetail.name} · 발생월별 채권 상세</h3>
            <div className="spacer" /><button className="btn btn--sm" onClick={() => setReceivableDetail(null)}>닫기</button></header>
          <div className="alert alert--info" style={{ margin: 14 }}>
            조회기준일 {receivableDetail.as_of} · 발생월별 잔액과 정상회수월을 확인하고 채권별 목표일을 입력합니다.
          </div>
          <div className="tablewrap"><table>
            <thead><tr><th>사업부</th><th>채권발생월</th><th>정상회수월</th><th>현재 구분</th>
              <th className="r">최초금액</th><th className="r">현재잔액</th><th>수금목표일</th><th>비고</th><th>관리</th></tr></thead>
            <tbody>{receivableDetail.items.map((item) => <tr key={item.id}>
              <td><button type="button" className="inline-edit t-strong"
                disabled={!can("customer_info_edit")}
                onClick={() => setUnitChange({ item, target: item.biz_unit || receivableDetail.customer.biz_unit, reason: "" })}>
                {item.biz_unit || receivableDetail.customer.biz_unit} · 변경</button></td>
              <td className="num t-strong">{item.issue_month || "미확인"}</td>
              <td className="num">{item.target_month || "미입력"}</td><td><Badge status={item.as_of_status || item.category} /></td>
              <td className="r num">{won(item.original_amount)}</td><td className="r num t-strong">{won(item.balance)}</td>
              <td><InlineEdit value={item.target_date} placeholder="목표일 입력" type="date"
                canEdit={can("customer_info_edit")} onSave={(value) => saveItemTarget(item.id, value)} /></td>
              <td><InlineEdit value={item.note} placeholder="비고 입력" canEdit={can("note_edit")}
                onSave={(value) => saveItemNote(item.id, value)} /></td>
              <td>{item.category === "정상" && Number(item.balance) > 0 ?
                <button className="btn btn--sm btn--warn" disabled={!can("customer_info_edit")}
                  onClick={() => reclassifyAsOverdue(item)}>미수 전환</button> : "–"}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
      </div>}
      {unitChange && <div className="modal-backdrop" onMouseDown={() => setUnitChange(null)}>
        <section className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
          <header className="card__head"><h3>채권 사업부 변경</h3><div className="spacer" />
            <button className="btn btn--sm" onClick={() => setUnitChange(null)}>닫기</button></header>
          <div className="card__body">
            <div className="alert alert--warn">
              <b>주의사항</b><br />
              선택한 채권 건의 사업부별 합계·대시보드·보고서가 즉시 변경됩니다.<br />
              거래처의 다른 채권에는 영향을 주지 않습니다.<br />
              같은 출고파일을 다시 올려도 이 직접 수정값이 유지되지만, 원본 출고자료도 함께 정정해 주세요.
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <Field label="현재 사업부"><input className="input" value={unitChange.item.biz_unit || ""} readOnly disabled /></Field>
              <Field label="변경 사업부"><select className="select" value={unitChange.target}
                onChange={(e) => setUnitChange({ ...unitChange, target: e.target.value })}>
                {data.meta.units.map((u) => <option key={u}>{u}</option>)}</select></Field>
            </div>
            <Field label="변경 사유 (필수)"><textarea className="textarea" rows="3" value={unitChange.reason}
              onChange={(e) => setUnitChange({ ...unitChange, reason: e.target.value })}
              placeholder="예: 기초자료 사업부 오분류 정정" /></Field>
            <button className="btn btn--primary" disabled={!unitChange.reason.trim() || unitChange.target === unitChange.item.biz_unit}
              onClick={saveItemUnit}>주의사항 확인 후 변경</button>
          </div>
        </section>
      </div>}
    </>
  );
}

/* ══════════════════ 담당자별 채권현황 ══════════════════ */

function Owners({ data }) {
  const [owner, setOwner] = useState("전체");
  const list = useMemo(() => {
    const map = {};
    data.customers.forEach((c) => {
      const k = c.owner || "미지정";
      map[k] = map[k] || { owner: k, rows: [], total: 0, 정상: 0, 연체: 0, 부실: 0 };
      map[k].rows.push(c); map[k].total += c.balance; map[k][c.status] += c.balance;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [data.customers]);

  const active = owner === "전체" ? null : list.find((o) => o.owner === owner);

  return (
    <>
      <div className="chiprow">
        <button className="chip" aria-pressed={owner === "전체"} onClick={() => setOwner("전체")}>전체</button>
        {list.map((o) => (
          <button key={o.owner} className="chip" aria-pressed={owner === o.owner}
            onClick={() => setOwner(o.owner)}>{o.owner} ({o.rows.length})</button>
        ))}
      </div>

      <div className="grid grid--3">
        {(active ? [active] : list).map((o) => (
          <Card key={o.owner} title={o.owner}>
            <div className="kpi__value num" style={{ marginTop: 0 }}>
              {short(o.total).value}<em>{short(o.total).unit}</em>
            </div>
            <div className="kpi__meta num" style={{ marginBottom: 12 }}>
              거래처 {o.rows.length}곳 · {won(o.total)}원
            </div>
            <div className="signal__bar">
              {["정상", "연체", "부실"].map((s) => o[s] > 0 && (
                <div key={s} className={"signal__seg signal__seg--" + STATUS_STYLE[s]}
                  style={{ width: (o[s] / o.total) * 100 + "%" }} title={STATUS_LABEL[s] + " " + won(o[s])} />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {active && (
        <Card title={active.owner + " 담당 거래처"} flush>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>코드</th><th>거래처명</th><th>사업부</th><th>분류</th>
                  <th className="r">채권잔액</th><th className="r">연체기간(개월)</th><th>비고</th></tr>
              </thead>
              <tbody>
                {[...active.rows].sort((a, b) => b.balance - a.balance).map((c) => (
                  <tr key={c.code}>
                    <td className="num t-muted">{code5(c.code)}</td>
                    <td className="t-strong">{c.name}</td>
                    <td>{c.biz_unit}</td>
                    <td><Badge status={c.status} /></td>
                    <td className="r num t-strong">{won(c.balance)}</td>
                    <td className="r num">{overdueMonths(c.overdue_days)}개월</td>
                    <td className="t-sm t-muted" style={{ whiteSpace: "normal" }}>{c.note || "–"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>합계</td><td className="r num">{won(active.total)}</td><td colSpan={2} /></tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </>
  );
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

  return (
    <div className="customer-search">
      <input className="input" lang="ko" inputMode="text" value={query} placeholder="거래처명 또는 코드 검색"
        role="combobox" aria-expanded={open} aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQuery(e.target.value); onChange(""); setOpen(true); }} />
      {open && (
        <div className="customer-search__menu" role="listbox">
          {matches.map((c) => (
            <button type="button" role="option" key={c.code}
              className="customer-search__option" onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c)}>
              <span><b>{c.name}</b><small>{code5(c.code)} · {c.biz_unit}</small></span>
              <strong className="num">{won(c.balance)}원</strong>
            </button>
          ))}
          {matches.length === 0 && <div className="customer-search__empty">검색 결과가 없습니다.</div>}
        </div>
      )}
    </div>
  );
}

function QuickCustomerModal({ units, onClose, onCreated }) {
  const [form, setForm] = useState({ code: "", name: "", biz_unit: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api("/api/customers/quick", { method: "POST", body: form });
      await onCreated(result.customer);
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal-card quick-customer-modal" onMouseDown={(e) => e.stopPropagation()}>
      <header className="card__head"><h3>신규 거래처 간편등록</h3><div className="spacer" />
        <button className="btn btn--sm" type="button" onClick={onClose}>닫기</button></header>
      <form className="card__body" onSubmit={submit}>
        <div className="alert alert--info">선수금 등록을 위해 고객코드·고객명·사업부를 먼저 등록합니다. 채권잔액은 0원으로 시작합니다.</div>
        {error && <div className="alert alert--bad">{error}</div>}
        <Field label="고객코드"><input className="input" value={form.code} autoFocus
          onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="예: 00123" /></Field>
        <Field label="고객명"><input className="input" lang="ko" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="거래처명 입력" /></Field>
        <Field label="사업부"><select className="select" value={form.biz_unit}
          onChange={(e) => setForm({ ...form, biz_unit: e.target.value })}>
          <option value="">사업부 선택</option>{units.map((unit) => <option key={unit}>{unit}</option>)}
        </select></Field>
        <button className="btn btn--primary" type="submit"
          disabled={busy || !form.code.trim() || !form.name.trim() || !form.biz_unit}>
          {busy ? "등록 중" : "등록 후 선택"}</button>
      </form>
    </section>
  </div>;
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
    } else if (status === "부실") bad += amount;
    else overdue += amount;
  });
  const notes = [...normalByMonth.entries()].map(([month, amount]) =>
    month + " 매출채권 " + won(amount) + "원 수금");
  if (overdue) notes.push("미수채권 " + won(overdue) + "원 수금");
  if (bad) notes.push("부실채권 " + won(bad) + "원 수금");
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
    if (!form.customer_code) { setReceivables(null); setReceivablesBusy(false); return () => { active = false; }; }
    setReceivables(null); setReceivablesBusy(true);
    api("/api/customers/" + encodeURIComponent(form.customer_code) + "/receivables")
      .then((result) => { if (active) setReceivables(result); })
      .catch((e) => { if (active) notify(e.message, true); })
      .finally(() => { if (active) setReceivablesBusy(false); });
    return () => { active = false; };
  }, [form.customer_code, notify]);

  function toggleReceivable(item) {
    const selected = selectedReceivableIds.includes(item.id);
    const nextIds = selected ? selectedReceivableIds.filter((id) => id !== item.id)
      : [...selectedReceivableIds, item.id];
    const nextItems = (receivables?.items || []).filter((row) => nextIds.includes(row.id));
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
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  async function decide(id, action) {
    try {
      const body = action === "reject" ? { reason: prompt("반려 사유를 입력하세요.") || "" } : {};
      await api("/api/collections/" + id + "/" + action, { method: "POST", body });
      notify(action === "approve" ? "승인했습니다. 잔액이 갱신되었습니다." : "반려했습니다.");
      await refresh();
    } catch (e) { notify(e.message, true); }
  }

  return (
    <>
      {can("collection_register") && (
        <Card title="수금 등록">
          <div className="formrow">
            <Field label="거래처">
              <div className="customer-pick">
                <CustomerSearch customers={data.customers} value={form.customer_code}
                  onChange={(code) => setForm({ ...form, customer_code: code })} />
                <button className="btn btn--sm" type="button" onClick={() => setQuickCustomerOpen(true)}>신규</button>
              </div>
            </Field>
            <Field label="수금액 (원)">
              <input className="input num" inputMode="numeric" value={form.amount}
                onChange={setAmount} placeholder="0" aria-describedby="collection-amount-unit" />
              <small id="collection-amount-unit" className="amount-unit-check">
                {form.amount ? "입력금액 · " + koreanAmountUnit(form.amount) : "숫자를 입력하면 금액 단위가 표시됩니다."}
              </small>
            </Field>
            <Field label="수금방법">
              <select className="select" value={form.method} onChange={set("method")}>
                {data.meta.methods.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="수금일">
              <input className="input" type="date" value={form.paid_at} onChange={set("paid_at")} />
            </Field>
          </div>
          <Field label="비고">
            <input className="input" value={form.note} onChange={set("note")}
              placeholder="입금자명, 분할 회차 등" />
          </Field>
          {target && amountNumber(form.amount) > target.balance && (
            <div className="alert alert--warn">
              입력한 수금액이 현재 미수잔액({won(target.balance)}원)보다 큽니다. 금액을 확인하세요.
            </div>
          )}
          {target && <div className="collection-receivables">
            <div className="collection-receivables__head">
              <b>{target.name} · 채권 상세현황</b>
              <span>정상 {won(target.normal_balance)}원 · 미수 {won(target.overdue_balance)}원 · 부실 {won(target.bad_balance)}원 · 합계 {won(target.balance)}원</span>
            </div>
            {receivablesBusy ? <div className="empty"><b>채권 상세를 불러오는 중입니다.</b></div> :
              receivables && receivables.items.length ? <div className="tablewrap"><table>
                <thead><tr><th>선택</th><th>사업부</th><th>발생월</th><th>정상회수월</th><th>현재 구분</th>
                  <th className="r">최초금액</th><th className="r">현재잔액</th><th>수금목표일</th><th>비고</th></tr></thead>
                <tbody>{receivables.items.map((item) => <tr key={item.id}
                  className={selectedReceivableIds.includes(item.id) ? "is-selected" : ""}>
                  <td><input type="checkbox" checked={selectedReceivableIds.includes(item.id)}
                    disabled={Number(item.balance) <= 0} onChange={() => toggleReceivable(item)}
                    aria-label={(item.issue_month || "채권") + " " + won(item.balance) + "원 선택"} /></td>
                  <td>{item.biz_unit || target.biz_unit}</td><td className="num">{item.issue_month || "미확인"}</td>
                  <td className="num">{item.target_month || "미입력"}</td><td><Badge status={item.as_of_status || item.category} /></td>
                  <td className="r num">{won(item.original_amount)}</td><td className="r num t-strong">{won(item.balance)}</td>
                  <td className="num">{item.target_date || "–"}</td><td style={{ whiteSpace: "normal" }}>{item.note || "–"}</td>
                </tr>)}</tbody>
                <tfoot><tr><td colSpan={6}>채권 {receivables.items.length}건 합계</td>
                  <td className="r num">{won(sum(receivables.items, "balance"))}</td><td colSpan={2} /></tr></tfoot>
              </table></div> : <div className="zero-result">현재 남아 있는 채권 <b>0원</b></div>}
          </div>}
          <button className="btn btn--primary" onClick={register}
            disabled={busy || !form.customer_code || !form.amount}>
            승인 요청으로 등록
          </button>
        </Card>
      )}

      <Card title={"승인 대기 " + pending.length + "건"} flush>
        {pending.length === 0 ? (
          <Empty title="대기 중인 수금 건이 없습니다.">영업담당이 등록하면 이곳에 표시됩니다.</Empty>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>등록일</th><th>거래처</th><th className="r">수금액</th><th>방법</th>
                  <th>수금일</th><th>등록자</th><th>비고</th><th /></tr>
              </thead>
              <tbody>
                {pending.map((c) => (
                  <tr key={c.id}>
                    <td className="t-sm t-muted num">{(c.created_at || "").slice(0, 10)}</td>
                    <td className="t-strong">{c.customer_name}</td>
                    <td className="r num t-strong">{won(c.amount)}</td>
                    <td>{c.method}</td>
                    <td className="num">{c.paid_at}</td>
                    <td>{c.registered_by}</td>
                    <td className="t-sm t-muted" style={{ whiteSpace: "normal" }}>{c.note || "–"}</td>
                    <td className="r">
                      {can("collection_approve") ? (
                        <div className="btnrow" style={{ justifyContent: "flex-end" }}>
                          <button className="btn btn--sm btn--ok" onClick={() => decide(c.id, "approve")}>승인</button>
                          <button className="btn btn--sm btn--danger" onClick={() => decide(c.id, "reject")}>반려</button>
                        </div>
                      ) : <span className="badge badge--mute">승인 대기</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>대기 합계</td><td className="r num">{won(sum(pending, "amount"))}</td>
                  <td colSpan={5} /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="처리 내역" flush>
        {decided.length === 0 ? <Empty title="처리된 내역이 없습니다." /> : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>상태</th><th>거래처</th><th className="r">수금액</th><th>방법</th>
                  <th>수금일</th><th>등록자</th><th>처리자</th><th>사유·비고</th></tr>
              </thead>
              <tbody>
                {decided.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={"badge badge--" + (c.state === "approved" ? "ok" : "bad")}>
                        {c.state === "approved" ? "승인" : "반려"}
                      </span>
                    </td>
                    <td className="t-strong">{c.customer_name}</td>
                    <td className="r num">{won(c.amount)}</td>
                    <td>{c.method}</td>
                    <td className="num">{c.paid_at}</td>
                    <td>{c.registered_by}</td>
                    <td>{c.approved_by}</td>
                    <td className="t-sm t-muted" style={{ whiteSpace: "normal" }}>
                      {c.reject_reason || c.note || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {quickCustomerOpen && <QuickCustomerModal units={data.meta.units} onClose={() => setQuickCustomerOpen(false)}
        onCreated={async (customer) => {
          await refresh();
          setForm((current) => ({ ...current, customer_code: customer.code }));
          setQuickCustomerOpen(false);
          notify(customer.name + " 거래처를 등록하고 선택했습니다.");
        }} />}
    </>
  );
}

/* ══════════════════ 수금목표 관리 ══════════════════ */

function Targets({ data, notify, refresh }) {
  const blank = {
    customer_code: "", amount: "", target_date: today(), method: "계좌수금", assignee: "", note: "",
  };
  const [form, setForm] = useState(blank);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const [filter, setFilter] = useState("진행");

  const rows = data.targets.filter((t) =>
    filter === "전체" ? true : filter === "완료" ? t.state === "done" : t.state !== "done");

  async function create() {
    try {
      await api("/api/targets", { method: "POST", body: form });
      setForm(blank); notify("수금목표를 추가했습니다."); await refresh();
    } catch (e) { notify(e.message, true); }
  }
  async function patch(id, body) {
    try { await api("/api/targets/" + id, { method: "PATCH", body }); await refresh(); }
    catch (e) { notify(e.message, true); }
  }
  async function remove(id) {
    if (!confirm("이 목표를 삭제할까요?")) return;
    try { await api("/api/targets/" + id, { method: "DELETE" }); notify("삭제했습니다."); await refresh(); }
    catch (e) { notify(e.message, true); }
  }

  return (
    <>
      <Card title="수금목표 추가">
        <div className="formrow">
          <Field label="거래처">
            <CustomerSearch customers={data.customers} value={form.customer_code}
              onChange={(code) => setForm({ ...form, customer_code: code })} />
          </Field>
          <Field label="목표금액 (원)">
            <input className="input num" inputMode="numeric" value={form.amount} onChange={set("amount")} />
          </Field>
          <Field label="목표일">
            <input className="input" type="date" value={form.target_date} onChange={set("target_date")} />
          </Field>
          <Field label="수금방법">
            <select className="select" value={form.method} onChange={set("method")}>
              {data.meta.methods.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="담당자">
            <input className="input" value={form.assignee} onChange={set("assignee")} placeholder="이름" />
          </Field>
        </div>
        <Field label="비고">
          <input className="input" value={form.note} onChange={set("note")}
            placeholder="약속 내용, 연락 결과 등" />
        </Field>
        <button className="btn btn--primary" onClick={create}
          disabled={!form.customer_code || !form.target_date}>목표 추가</button>
      </Card>

      <Card title={"수금목표 " + rows.length + "건"} flush
        actions={<div className="chiprow">
          {["진행", "완료", "전체"].map((f) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>}>
        {rows.length === 0 ? <Empty title="등록된 목표가 없습니다.">위에서 첫 목표를 추가하세요.</Empty> : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>목표일</th><th>거래처</th><th className="r">목표금액</th><th>수금방법</th>
                  <th>담당자</th><th>완료일</th><th>비고</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const late = t.state !== "done" && t.target_date < today();
                  return (
                    <tr key={t.id}>
                      <td className="num" style={{ color: late ? "var(--bad)" : "inherit", fontWeight: late ? 600 : 400 }}>
                        {t.target_date}{late && " ⚠"}
                      </td>
                      <td className="t-strong">{t.customer_name}</td>
                      <td className="r num">{won(t.amount)}</td>
                      <td>{t.method || "–"}</td>
                      <td>{t.assignee || "–"}</td>
                      <td>
                        <input className="input num" type="date" style={{ width: 148 }}
                          value={t.done_date || ""}
                          onChange={(e) => patch(t.id, { done_date: e.target.value })} />
                      </td>
                      <td style={{ whiteSpace: "normal", minWidth: 180 }}>
                        <input className="input" defaultValue={t.note}
                          onBlur={(e) => e.target.value !== t.note && patch(t.id, { note: e.target.value })} />
                      </td>
                      <td className="r">
                        <button className="btn btn--sm btn--danger" onClick={() => remove(t.id)}>삭제</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>합계</td><td className="r num">{won(sum(rows, "amount"))}</td>
                  <td colSpan={5} /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
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
  const signature = Array.from(new Uint8Array(bytes).slice(0, 11), (c) => String.fromCharCode(c)).join("");
  if (signature === "BMS DocuRay") throw new Error("보안 처리된 엑셀입니다. 사내 절차에 따라 반출용 일반 엑셀로 내보내 주세요.");
  const wb = XLSX.read(bytes, { type: "array", cellDates: false });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true, blankrows: true });
  const clean = (v) => String(v ?? "").replace(/\s/g, "");
  const headerIndex = grid.slice(0, 25).findIndex((row) =>
    row.some((h) => ["고객코드", "거래처코드"].includes(clean(h))) && row.some((h) => clean(h) === "수금번호"));
  if (headerIndex < 0) throw new Error("첫 번째 시트의 앞 25행 안에 고객코드와 수금번호 머리글이 필요합니다.");
  const headers = grid[headerIndex].map(clean), mapping = {};
  for (const [key, names] of Object.entries(COLLECTION_COLUMNS)) {
    const matches = headers.map((h, i) => names.includes(h) ? i : -1).filter((i) => i >= 0);
    if (matches.length > 1) throw new Error(names[0] + " 머리글이 중복되었습니다.");
    if (matches.length) mapping[key] = matches[0];
  }
  const missing = COLLECTION_REQUIRED.filter((key) => mapping[key] === undefined);
  if (missing.length) throw new Error("필수 열 누락: " + missing.map((key) => COLLECTION_COLUMNS[key][0]).join(", "));
  const rows = [], totals = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i];
    if (row.every((v) => clean(v) === "")) continue;
    const values = Object.fromEntries(Object.entries(mapping).map(([key, column]) => [key, row[column] ?? ""]));
    if (!clean(values.customer_code) && !clean(values.receipt_no) && !clean(values.sequence)
      && [values.paid_at, values.customer_name].some((v) => ["합계", "총합계"].includes(clean(v)))) {
      totals.push(values); continue;
    }
    if (typeof values.paid_at === "number") {
      const d = XLSX.SSF.parse_date_code(values.paid_at, { date1904: !!wb.Workbook?.WBProps?.date1904 });
      if (d) values.paid_at = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } else {
      const date = String(values.paid_at).trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
      if (date) values.paid_at = date[1] + "-" + date[2].padStart(2, "0") + "-" + date[3].padStart(2, "0");
    }
    // Preserve leading zeros and raw amount text; the server validates money.
    rows.push({ ...values, customer_code: String(values.customer_code).trim(), row_number: i + 1 });
  }
  if (!rows.length || rows.length > 5000) throw new Error("수금 내역은 1~5,000행까지 업로드할 수 있습니다.");
  if (totals.length > 1) throw new Error("합계행은 한 개만 포함해 주세요. 시트 구성을 확인하세요.");
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
  const approve = can("collection_approve");
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [page, setPage] = useState(0), [result, setResult] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false), [decisions, setDecisions] = useState({});
  const [reviewHistory, setReviewHistory] = useState(null);
  const [customerOpen, setCustomerOpen] = useState(false), [customerDecisions, setCustomerDecisions] = useState({});
  const [customerApplied, setCustomerApplied] = useState([]), [errorsOnly, setErrorsOnly] = useState(false);
  const reading = useRef(0), submitting = useRef(false);
  function applyChecked(checked, selected = [], resetReviews = false) {
    setPreview(checked); setPage(0);
    const choices = Object.fromEntries(selected.map((d) => [d.issue_key, d]));
    setCustomerApplied(selected);
    setCustomerDecisions(Object.fromEntries((checked.customer_issues || []).map((i) => [i.issue_key,
      i.resolved && choices[i.issue_key] ? choices[i.issue_key] : {
        issue_key: i.issue_key, resolution_token: i.resolution_token, action: "", target_code: "",
        name: i.source_names[0] || "", biz_unit: "", reason: "", confirmed: false,
      }])));
    const nextDecisions = Object.fromEntries(checked.rows.filter((r) => r.status === "review").map((r) => {
      const previous = !resetReviews && decisions[r.row_key];
      return [r.row_key, previous?.review_token === r.review_token ? previous
        : { action: "exclude", confirmed: false, reason: "", applied: false, review_token: r.review_token }];
    }));
    setDecisions(nextDecisions);
    setCustomerOpen((checked.customer_issue_count || 0) > 0);
    setReviewOpen(!(checked.customer_issue_count || 0) && Object.values(nextDecisions).some((d) => !d.applied));
  }
  function changeCustomer(key, changes) {
    setCustomerDecisions((current) => ({ ...current, [key]: { ...current[key], confirmed: false, ...changes } }));
  }
  async function recheckCustomers() {
    if (busy || !source || !customersComplete) return;
    setBusy(true); setError("");
    const selected = customerIssues.map((i) => ({ ...customerDecisions[i.issue_key],
      issue_key: i.issue_key, resolution_token: i.resolution_token }));
    try {
      const checked = await api("/api/collection-uploads/preview", { method: "POST",
        body: { rows: source.rows, customer_resolutions: selected } });
      applyChecked(checked, selected);
      if (!checked.error_count) notify("거래처 선택을 반영했습니다. 등록 예정 내역을 확인한 뒤 최종 등록을 눌러 주세요.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function changeDecision(key, changes) {
    setDecisions((current) => ({ ...current, [key]: { ...current[key], ...changes, applied: false } }));
  }
  function openReview() {
    if (busy) return;
    setCustomerOpen(false); setReviewOpen(true);
  }
  function applyReviews() {
    if (busy || !reviewsComplete) return;
    setDecisions((current) => ({ ...current, ...Object.fromEntries(reviewRows.map((r) =>
      [r.row_key, { ...current[r.row_key], applied: true }])) }));
    setReviewOpen(false);
    if (customersNeedCheck) setCustomerOpen(true);
    notify(`중복 ${reviewRows.length}건의 선택을 적용했습니다. 최종 등록 전까지 수금·채권은 변경되지 않습니다.`);
  }
  async function openReviewHistory(batch) {
    try { const r = await api(`/api/collection-uploads/${batch.id}/reviews`);
      setReviewHistory({ batch, rows: r.reviews }); } catch (e) { notify(e.message, true); }
  }
  async function loadHistory() {
    try { const r = await api("/api/collection-uploads"); setHistory(r.batches); setHistoryError(""); }
    catch (e) { setHistoryError(e.message); }
  }
  useEffect(() => { loadHistory(); return () => { reading.current++; }; }, []);
  async function readFile(file) {
    if (!file || submitting.current) return;
    const version = ++reading.current;
    setBusy(true); setError(""); setSource(null); setPreview(null); setPage(0); setResult(null);
    setReviewOpen(false); setDecisions({});
    setCustomerOpen(false); setCustomerDecisions({}); setCustomerApplied([]); setErrorsOnly(false);
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error(".xlsx, .xls, .csv 파일을 선택하세요.");
      if (file.size > 10 * 1024 * 1024) throw new Error("파일 크기는 10MB 이하여야 합니다.");
      const parsed = parseCollectionWorkbook(await file.arrayBuffer());
      const checked = await api("/api/collection-uploads/preview", { method: "POST", body: { rows: parsed.rows } });
      if (version !== reading.current) return;
      setSource({ ...parsed, filename: file.name }); applyChecked(checked, [], true);
    } catch (e) { if (version === reading.current) setError(e.message || "엑셀 파일을 읽지 못했습니다."); }
    finally { if (version === reading.current) setBusy(false); }
  }
  async function submit() {
    if (submitting.current || busy || !source || !preview || preview.error_count || customersNeedCheck || !(preview.ready_count + (preview.review_count || 0) + (preview.customer_excluded_count || 0))) return;
    if (!reviewsApplied) { openReview(); return; }
    submitting.current = true; setBusy(true); setError("");
    try {
      const response = await api("/api/collection-uploads", { method: "POST", body: {
        filename: source.filename, rows: source.rows, approve_immediately: approve,
        customer_resolutions: customerApplied,
        reviews: reviewRows.map((r) => ({ row_key: r.row_key, review_token: r.review_token,
          action: decisions[r.row_key].action, reason: decisions[r.row_key].reason, confirmed: decisions[r.row_key].confirmed })),
      } });
      setResult(response); setPreview(null); setSource(null);
      setReviewOpen(false); setDecisions({});
      setCustomerOpen(false); setCustomerApplied([]); setCustomerDecisions({});
      notify(response.inserted ? `${response.inserted}건을 ${response.approved ? "승인·상계" : "승인 대기로 등록"}했습니다.` : response.message);
      await loadHistory();
      try { await refresh(); } catch (_) { setError("등록은 완료됐습니다. 현황을 다시 불러오려면 새로고침해 주세요."); }
    } catch (e) {
      setError(e.message);
      // Keep raw input for a fresh server check after a conflict or lost response.
      try { const checked = await api("/api/collection-uploads/preview", { method: "POST", body: { rows: source.rows, customer_resolutions: customerApplied } });
        applyChecked(checked, customerApplied); } catch (_) { setPreview(null); setReviewOpen(false); setCustomerOpen(false); }
    } finally { submitting.current = false; setBusy(false); }
  }
  async function continueUpload() {
    if (submitting.current || busy || !source || !preview) return;
    if (customersNeedCheck) {
      if (customersComplete) await recheckCustomers();
      else { setReviewOpen(false); setCustomerOpen(true); }
      return;
    }
    if (preview.error_count) {
      setErrorsOnly(true); setPage(0);
      notify(`입력 오류 ${preview.error_count}건을 확인하세요. 날짜·금액 등은 원본 파일을 수정한 뒤 다시 선택해 주세요.`, true);
      return;
    }
    if (!reviewsApplied) { openReview(); return; }
    await submit();
  }
  const errorRows = preview ? preview.rows.filter((r) => r.status === "error") : [];
  const visibleRows = preview ? (errorsOnly ? errorRows : preview.rows) : [];
  const pageRows = visibleRows.slice(page * 50, (page + 1) * 50);
  const customerIssues = preview?.customer_issues || [];
  const customerDecisionComplete = (i) => {
    const d = customerDecisions[i.issue_key];
    return d?.confirmed && d.resolution_token === i.resolution_token && i.allowed_actions.includes(d.action) && (d.reason || "").trim().length <= 500
      && (d.action !== "link" || (i.candidates.some((c) => c.code === d.target_code) && d.reason.trim().length >= 5))
      && (d.action !== "create" || (d.name.trim() && ["덴탈", "메디컬", "에스테틱"].includes(d.biz_unit)));
  };
  const customersComplete = customerIssues.every(customerDecisionComplete);
  const customerSelectionApplied = (i) => {
    const previous = customerApplied.find((d) => d.issue_key === i.issue_key), current = customerDecisions[i.issue_key];
    return i.resolved && customerDecisionComplete(i) && previous &&
      ["resolution_token", "action", "target_code", "name", "biz_unit", "reason", "confirmed"].every((key) => previous[key] === current[key]);
  };
  const customersNeedCheck = !!preview?.customer_issue_count || customerIssues.some((i) => !customerSelectionApplied(i));
  const errorDetails = <div className="alert alert--bad collection-error-details" role="alert">
    <b>입력 오류 {preview?.error_count || 0}건 · 행과 사유를 확인하세요.</b>
    <ul>{errorRows.map((r) => <li key={r.row_key}>
      <b>엑셀 {r.row_number}행 · {r.source_customer_name || r.customer_name || "거래처명 없음"} ({r.source_customer_code || r.customer_code || "코드 없음"})</b>
      <span>{r.receipt_no || "수금번호 없음"} / {r.sequence ?? "–"} · {r.errors.join(" / ")}</span>
    </li>)}</ul>
    {!!preview?.customer_issue_count && <button className="btn btn--sm" disabled={busy}
      onClick={() => { setReviewOpen(false); setCustomerOpen(true); }}>거래처 선택으로 해결</button>}
    <p>거래처 문제는 연결·신규 등록·이번 업로드 제외를 선택할 수 있습니다. 날짜·금액 등 나머지 입력 오류는 원본 파일을 수정해 다시 선택하세요.</p>
  </div>;
  const reviewRows = preview ? preview.rows.filter((r) => r.status === "review") : [];
  const identicalRows = reviewRows.filter((r) => r.review_kind === "same_key");
  const decisionComplete = (r) => {
    const d = decisions[r.row_key];
    return d?.confirmed && d.review_token === r.review_token && r.allowed_actions.includes(d.action)
      && (d.action !== "separate" || (d.reason.trim().length >= 5 && d.reason.trim().length <= 500));
  };
  const reviewsComplete = reviewRows.every(decisionComplete);
  const appliedRows = reviewRows.filter((r) => decisionComplete(r) && decisions[r.row_key].applied);
  const reviewsApplied = appliedRows.length === reviewRows.length;
  const appliedSeparate = appliedRows.filter((r) => decisions[r.row_key].action === "separate");
  const separateRows = reviewRows.filter((r) => decisions[r.row_key]?.action === "separate");
  const finalCount = (preview?.ready_count || 0) + separateRows.length;
  const finalAmount = (preview?.total_amount || 0) + separateRows.reduce((n, r) => n + r.amount, 0);
  const appliedCount = (preview?.ready_count || 0) + appliedSeparate.length;
  const appliedAmount = (preview?.total_amount || 0) + appliedSeparate.reduce((n, r) => n + r.amount, 0);
  const closeReview = () => { if (!busy) setReviewOpen(false); };
  const stateLabel = { pending: "승인 대기", approved: "승인 완료", rejected: "반려", in_file: "이번 파일" };
  return <>
    <Card title="수금등록 데이터 업로드">
      <p>아마란스10 수금자료를 고객코드로 연결합니다. 파일 선택 후 검증 결과와 금액을 확인하고 등록하세요.</p>
      <div className="alert alert--info">제예금 → 계좌수금 · 카드 → 카드수금 · 어음 → 어음수금<br />
        수금액 = 정상수금 + 선수금. 승인 시 기존 채권에 상계하고 초과분은 선수금으로 보관합니다.</div>
      <div className="dropzone" style={{ marginTop: 16 }}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy) readFile(e.dataTransfer.files[0]); }}>
        <p>수금 엑셀을 끌어다 놓거나 파일을 선택하세요.</p>
        <input type="file" aria-label="수금 엑셀 파일" accept=".xlsx,.xls,.csv" disabled={busy}
          onChange={(e) => { const file = e.target.files[0]; e.target.value = ""; readFile(file); }} />
        <p className="t-sm t-muted">첫 번째 시트 · 최대 5,000행 / 10MB · 합계행 자동 제외</p>
      </div>
      {busy && <p role="status">처리 중입니다. 잠시 기다려 주세요.</p>}
      {error && <div className="alert alert--bad" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      {result && <div className="alert alert--info" role="status" style={{ marginTop: 12 }}>
        등록 {result.inserted}건 · 즉시 승인 {result.approved}건 · 중복 확인 제외 {result.skipped}건 · 거래처 확인 제외 {result.customer_excluded || 0}건 · {won(result.total_amount)}원
        {!!result.customers_created && <div>신규 거래처 {result.customers_created}곳 등록</div>}
        {result.inserted > result.approved && <div>수금 등록 메뉴에서 승인하면 채권에 반영됩니다.</div>}
      </div>}
    </Card>
    {source && preview && <Card title={"검증 결과 · " + source.filename}>
      <p>{source.sheet} · 수금 내역 {preview.row_count}행 · 합계행 {source.skippedTotals}행 제외</p>
      <div className="collection-upload-summary">
        <div><span>신규 등록</span><b>{preview.ready_count}건</b></div>
        <div><span>중복 확인 완료</span><b>{appliedRows.length} / {reviewRows.length}건</b></div>
        <div><span>오류</span><b>{preview.error_count}건</b></div>
        <div><span>신규 수금액</span><b>{won(preview.total_amount)}원</b></div>
      </div>
      <p>승인 시 상계 예상 {won(preview.offset_amount)}원 · 선수금 잔여 예상 {won(preview.advance_remaining)}원</p>
      <p className="t-sm t-muted">예상액은 중복 후보를 제외한 신규 건의 현재 원장 기준입니다. 중복 확인 후 등록·승인 시 최신 잔액을 다시 확인합니다.</p>
      {!!preview.error_count && errorDetails}
      <div className="btnrow" style={{ marginTop: 12 }}>
        <button className="btn btn--sm" aria-pressed={errorsOnly} onClick={() => { setErrorsOnly(!errorsOnly); setPage(0); }}>
          {errorsOnly ? "전체 내역 보기" : `오류 ${preview.error_count}건만 보기`}</button>
        {!!customerIssues.length && <button className="btn btn--sm" disabled={busy}
          onClick={() => { setReviewOpen(false); setCustomerOpen(true); }}>거래처 연결·신규 등록 확인</button>}
        {!!reviewRows.length && <button className="btn btn--sm" disabled={busy} onClick={openReview}>
          중복 {reviewRows.length}건 처리{reviewsApplied ? " · 확인 완료" : ""}</button>}
      </div>
      <div className="tablewrap" style={{ marginTop: 12 }}><table>
        <thead><tr><th>행</th><th>검증</th><th>수금번호 / 순번</th><th>고객코드</th><th>거래처</th><th>수금일</th>
          <th>수금방법</th><th className="r">정상수금</th><th className="r">선수금</th><th className="r">수금액</th><th>검증 내용</th></tr></thead>
        <tbody>{pageRows.map((row) => <tr key={row.row_key || row.row_number}>
          <td>{row.row_number}</td><td><span className={"badge badge--" + ({ ready: "ok", error: "bad", review: "warn", excluded: "warn" }[row.status])}>
            {row.status === "review" && decisions[row.row_key]?.applied
              ? decisions[row.row_key].action === "separate" ? "별도 수금 확인" : "중복 제외 확인"
              : { ready: "신규", error: "오류", review: "중복 확인", excluded: "확인 후 제외" }[row.status]}</span>
            {row.status === "review" && <button className="btn btn--sm" style={{ display: "block", marginTop: 4 }}
              disabled={busy} aria-label={`엑셀 ${row.row_number}행 중복 처리 열기`} onClick={openReview}>중복 처리</button>}</td>
          <td>{row.receipt_no || "–"} / {row.sequence ?? "–"}</td><td>{row.source_customer_code && row.source_customer_code !== row.customer_code
            ? `${row.source_customer_code} → ${row.customer_code}` : row.customer_code || "–"}</td>
          <td>{row.customer_name || row.source_customer_name || "–"}</td><td>{row.paid_at || "–"}</td><td>{row.method || "–"}</td>
          <td className="r">{row.normal_amount === undefined ? "–" : won(row.normal_amount)}</td>
          <td className="r">{row.advance_amount === undefined ? "–" : won(row.advance_amount)}</td>
          <td className="r">{row.amount === undefined ? "–" : won(row.amount)}</td>
          <td style={{ minWidth: 220, whiteSpace: "normal" }}>{[...row.errors, ...row.warnings].join(" / ") || "정상"}</td>
        </tr>)}</tbody>
      </table></div>
      {visibleRows.length > 50 && <div className="btnrow" style={{ marginTop: 12 }}>
        <button className="btn btn--sm" disabled={!page} onClick={() => setPage(page - 1)}>이전</button>
        <span>{page + 1} / {Math.ceil(visibleRows.length / 50)}</span>
        <button className="btn btn--sm" disabled={(page + 1) * 50 >= visibleRows.length} onClick={() => setPage(page + 1)}>다음</button>
      </div>}
      <div className="alert alert--info" style={{ marginTop: 16 }}>
        {approve ? "최종 등록과 동시에 승인·상계됩니다. 등록할 수금액이 채권잔액에 즉시 반영됩니다."
          : "수금 승인 권한이 없어 승인 대기로 등록됩니다. 승인권자가 승인한 뒤 채권잔액에 반영됩니다."}
      </div>
      <div className="btnrow" style={{ marginTop: 16 }}>
        {!!reviewRows.length && <button className="btn" disabled={busy} onClick={openReview}>
          중복 {reviewRows.length}건 처리{reviewsApplied ? " · 확인 완료" : ""}</button>}
        {!!customerIssues.length && <button className="btn" disabled={busy}
          onClick={() => { setReviewOpen(false); setCustomerOpen(true); }}>거래처 오류·선택 확인</button>}
        <button className="btn btn--primary" aria-label="수금 업로드 최종 등록"
          disabled={busy || !preview.row_count} onClick={continueUpload}>
          {busy ? "처리 중" : customersNeedCheck ? customersComplete ? "거래처 선택 적용 · 등록 내역 재검증" : "거래처 확인 후 등록 진행"
            : preview.error_count ? `입력 오류 ${preview.error_count}건 확인`
            : !reviewsApplied ? `중복 ${reviewRows.length - appliedRows.length}건 확인 후 등록 진행`
            : appliedCount ? `최종 등록 · ${appliedCount}건 ${approve ? "즉시 승인·상계" : "승인 대기"}` : "제외 확인 이력 저장"}</button>
      </div>
      <p role="status">등록 예정 {appliedCount}건 · {won(appliedAmount)}원 / 중복 제외 {appliedRows.length - appliedSeparate.length}건 / 별도 수금 {appliedSeparate.length}건</p>
      {(!!preview.error_count || customersNeedCheck || !reviewsApplied) && <p className="t-sm t-muted" role="status">
        최종 등록 전 남은 항목: 입력 오류 {preview.error_count}건 · 중복 확인 {reviewRows.length - appliedRows.length}건.
        {customersNeedCheck ? " 거래처 선택을 적용해야 합니다. 위 등록 진행 버튼으로 확인·적용할 수 있습니다."
          : " 위 버튼을 누르면 남은 확인 단계로 이동합니다. 확인 전에는 수금이 등록되지 않습니다."}</p>}
    </Card>}
    <Card title="수금 업로드 이력" flush>
      {historyError && <div className="alert alert--bad">{historyError}</div>}
      {!history.length ? <Empty title="수금 업로드 이력이 없습니다." /> : <div className="tablewrap"><table>
        <thead><tr><th>등록일시</th><th>파일명</th><th className="r">등록 건수</th><th className="r">수금액</th>
          <th className="r">등록 시 즉시 승인</th><th>등록자</th><th>중복·거래처 확인</th></tr></thead>
        <tbody>{history.map((row) => <tr key={row.id}><td>{row.created_at}</td><td>{row.filename}</td>
          <td className="r">{row.row_count}</td><td className="r">{won(row.total_amount)}</td>
          <td className="r">{row.approved_count}</td><td>{row.uploaded_by}</td>
          <td>{row.reviewed_count ? <button className="btn btn--sm" onClick={() => openReviewHistory(row)}>
            {row.reviewed_count}건 확인 · {row.excluded_count}건 제외</button> : "–"}</td></tr>)}</tbody>
      </table></div>}
    </Card>
    {customerOpen && preview && <div className="modal-backdrop" onMouseDown={() => { if (!busy) setCustomerOpen(false); }}>
      <section className="modal-card modal-card--wide collection-review-modal" role="dialog" aria-modal="true"
        aria-labelledby="collection-customer-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="collection-customer-title">입력 오류 · 거래처 확인</h2>
        <p>같은 고객코드의 행은 함께 처리합니다. 선택 내용을 재검증한 뒤 최종 등록할 때 거래처와 수금을 저장합니다.</p>
        {error && <div className="alert alert--bad" role="alert">{error}</div>}
        {!!preview.error_count && errorDetails}
        <div className="collection-review-list">
          {customerIssues.map((issue) => {
            const d = customerDecisions[issue.issue_key] || {};
            const selected = issue.candidates.find((c) => c.code === d.target_code);
            return <div className="collection-review-item" key={issue.issue_key}>
              <h3>{issue.source_names.join(" / ") || "거래처명 없음"} · 엑셀 고객코드 {issue.source_code}</h3>
              <p role="status">{customerSelectionApplied(issue) ? "거래처 선택 반영 완료"
                : customerDecisionComplete(issue) ? "선택 확인 완료 · 아래 선택 적용 버튼을 눌러 주세요." : "처리 방법과 필수 항목을 선택하고 확인란을 체크해 주세요."}</p>
              <p>엑셀 {issue.row_numbers.join(", ")}행 · {issue.message}</p>
              {!!issue.error && <div className="alert alert--bad">{issue.error}</div>}
              {!!issue.candidates.length && <div className="tablewrap"><table><thead><tr>
                <th>기존 고객코드</th><th>거래처명</th><th>사업부</th><th className="r">채권잔액</th></tr></thead>
                <tbody>{issue.candidates.map((c) => <tr key={c.code}><td>{c.code}</td><td>{c.name}</td><td>{c.biz_unit}</td>
                  <td className="r">{won(c.balance)}원{c.balance !== c.ledger_balance && <div className="t-sm">상세 원장 불일치 · 확인 필요</div>}</td></tr>)}</tbody></table></div>}
              <Field label="처리 방법"><select className="select" aria-label={`${issue.source_code} 거래처 처리 방법`} disabled={busy}
                value={d.action || ""} onChange={(e) => changeCustomer(issue.issue_key, { action: e.target.value, target_code: "" })}>
                <option value="">처리 방법 선택</option>
                {issue.allowed_actions.includes("link") && <option value="link">기존 거래처에 연결 · 승인 시 해당 채권 처리</option>}
                {issue.allowed_actions.includes("create") && <option value="create">엑셀 고객코드로 신규 거래처 등록</option>}
                <option value="exclude">이번 업로드에서 제외</option>
              </select></Field>
              {!issue.allowed_actions.includes("create") && !issue.candidates.length && <p className="t-sm">신규 거래처 등록에는 수금 등록 권한이 필요합니다.</p>}
              {d.action === "link" && <>
                <Field label="연결할 기존 거래처"><select className="select" aria-label={`${issue.source_code} 연결 거래처`} disabled={busy}
                  value={d.target_code || ""} onChange={(e) => changeCustomer(issue.issue_key, { target_code: e.target.value })}>
                  <option value="">기존 거래처 선택</option>{issue.candidates.map((c) => <option key={c.code} value={c.code}>
                    {c.code} · {c.name} · {c.biz_unit} · 채권잔액 {won(c.balance)}원</option>)}
                </select></Field>
                <div className="alert alert--info">이번 수금은 선택한 거래처에 연결됩니다. 승인 시 해당 채권을 상계하고 잔액 초과분은 선수금으로 처리합니다.
                  {selected && <div>연결 대상: {selected.code} · {selected.name} / 채권잔액 {won(selected.balance)}원</div>}
                  기존 고객코드와 원본 엑셀은 유지하며, 다음 파일의 고객코드를 자동 변환하지 않습니다.</div>
              </>}
              {d.action === "create" && <>
                <div className="formrow"><Field label="신규 거래처명"><input className="input" aria-label={`${issue.source_code} 신규 거래처명`}
                  value={d.name || ""} disabled={busy} maxLength={200} onChange={(e) => changeCustomer(issue.issue_key, { name: e.target.value })} /></Field>
                  <Field label="사업부"><select className="select" aria-label={`${issue.source_code} 신규 사업부`} disabled={busy}
                    value={d.biz_unit || ""} onChange={(e) => changeCustomer(issue.issue_key, { biz_unit: e.target.value })}>
                    <option value="">사업부 선택</option>{["덴탈", "메디컬", "에스테틱"].map((u) => <option key={u}>{u}</option>)}
                  </select></Field></div>
                <div className="alert alert--info">고객코드 {issue.source_code}로 채권잔액 0원·회수기간 미입력 상태로 등록합니다. 이번 수금은 승인 시 선수금이 됩니다.
                  {!!issue.candidates.length && <div>같은 이름의 기존 거래처와 별도로 생성되며, 기존 거래처의 채권에는 상계되지 않습니다.</div>}</div>
              </>}
              {d.action === "exclude" && <p>이 고객코드의 {issue.row_numbers.length}개 행을 이번 업로드에서 제외하고 다른 내역을 진행합니다.</p>}
              {!!d.action && <Field label={d.action === "link" ? "연결 사유 (필수, 5~500자)" : "확인 사유 (선택, 500자 이내)"}>
                <input className="input" aria-label={`${issue.source_code} 거래처 확인 사유`} value={d.reason || ""} maxLength={500} disabled={busy}
                  onChange={(e) => changeCustomer(issue.issue_key, { reason: e.target.value })} /></Field>}
              <label className="collection-review-check"><input type="checkbox" aria-label={`${issue.source_code} 거래처 확인 완료`}
                disabled={busy || !d.action} checked={!!d.confirmed} onChange={(e) => changeCustomer(issue.issue_key, { confirmed: e.target.checked })} />
                거래처와 채권 처리 내용을 확인했으며 선택한 방법으로 진행합니다.</label>
            </div>;
          })}
        </div>
        <div className="collection-review-footer"><p>체크 후 아래 ‘거래처 선택 적용’을 눌러야 오류가 해결됩니다. 거래처와 수금은 본문의 최종 등록 시 함께 저장됩니다.</p>
          <div className="btnrow"><button className="btn" disabled={busy} onClick={() => setCustomerOpen(false)}>돌아가기</button>
            {!!reviewRows.length && <button className="btn" disabled={busy} onClick={openReview}>중복 {reviewRows.length}건 먼저 처리</button>}
            <button className="btn btn--primary" disabled={busy || !customersComplete} onClick={recheckCustomers}>
              {busy ? "재검증 중" : "거래처 선택 적용 · 등록 단계로"}</button></div></div>
      </section>
    </div>}
    {reviewOpen && preview && <div className="modal-backdrop" onMouseDown={closeReview}>
      <section className="modal-card modal-card--wide collection-review-modal" role="dialog" aria-modal="true"
        aria-labelledby="collection-review-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="collection-review-title">중복 수금 확인 · {reviewRows.length}건</h2>
        <p>기존 내역과 비교해 중복 제외 또는 별도 수금을 선택하고 확인란을 체크하세요. 선택 적용 후 본문에서 최종 등록합니다.</p>
        <div className="alert alert--info">거래처·입력 오류가 남아 있어도 중복 선택은 먼저 적용할 수 있습니다. 수금 등록과 채권 상계는 본문의 최종 등록에서 진행됩니다.</div>
        <p className="t-sm t-muted">수금번호·순번이 같은 내역은 추가 생성할 수 없습니다. 내용 정정이 필요하면 파일 또는 기존 수금 내역을 먼저 확인하세요.</p>
        {error && <div className="alert alert--bad" role="alert">{error}</div>}
        {!!preview.error_count && errorDetails}
        {!!identicalRows.length && <label className="collection-review-check">
          <input type="checkbox" disabled={busy} checked={identicalRows.every((r) => decisions[r.row_key]?.confirmed && decisions[r.row_key]?.action === "exclude")}
            onChange={(e) => { const checked = e.target.checked; setDecisions((current) => ({ ...current,
              ...Object.fromEntries(identicalRows.map((r) => [r.row_key, { action: "exclude", reason: "", confirmed: checked,
                applied: false, review_token: r.review_token }])) })); }} />
          내용이 동일한 기등록 {identicalRows.length}건을 모두 중복으로 확인
        </label>}
        <div className="collection-review-list">
          {reviewRows.map((row) => <div className="collection-review-item" key={row.row_key}>
            <b>엑셀 {row.row_number}행 · {row.receipt_no} / {row.sequence}</b>
            <p>{row.warnings[row.warnings.length - 1]}</p>
            <div className="tablewrap"><table><thead><tr><th>구분</th><th>거래처 / 코드</th><th>수금일</th><th>방법</th>
              <th className="r">수금액</th><th>정상수금 / 선수금</th><th>상태·등록자</th></tr></thead>
              <tbody><tr><td>이번 업로드</td><td>{row.customer_name}<br />{row.customer_code}</td><td>{row.paid_at}</td>
                <td>{row.method}</td><td className="r">{won(row.amount)}</td><td>{won(row.normal_amount)} / {won(row.advance_amount)}</td><td>등록 전</td></tr>
                {row.candidates.map((c, i) => <tr key={i}><td>{c.id ? `기존 #${c.id}` : `파일 ${c.row_number}행`}<br />
                  {c.receipt_no ? `${c.receipt_no} / ${c.sequence}` : "수기등록"}</td><td>{c.customer_name}<br />{c.customer_code}</td>
                  <td>{c.paid_at}</td><td>{c.method}</td><td className="r">{won(c.amount)}</td>
                  <td>{c.normal_amount == null ? "–" : won(c.normal_amount)} / {c.advance_amount == null ? "–" : won(c.advance_amount)}</td>
                  <td>{stateLabel[c.state] || c.state}<br />{c.registered_by || ""}</td></tr>)}
              </tbody></table></div>
            {row.allowed_actions.includes("separate") && <div className="formrow" style={{ marginTop: 12 }}>
              <Field label="확인 결과"><select className="select" aria-label={`엑셀 ${row.row_number}행 처리 방법`} disabled={busy}
                value={decisions[row.row_key]?.action || "exclude"} onChange={(e) => changeDecision(row.row_key, { action: e.target.value, confirmed: false })}>
                <option value="exclude">중복 수금 · 이번 행 제외</option><option value="separate">중복 아님 · 별도 수금 등록</option>
              </select></Field>
              {decisions[row.row_key]?.action === "separate" && <Field label="별도 수금 등록 사유 (5~500자)">
                <input className="input" aria-label={`엑셀 ${row.row_number}행 별도 등록 사유`} maxLength={500} disabled={busy}
                  value={decisions[row.row_key]?.reason || ""} onChange={(e) => changeDecision(row.row_key, { reason: e.target.value, confirmed: false })} />
              </Field>}
            </div>}
            <label className="collection-review-check"><input type="checkbox" disabled={busy}
              aria-label={`엑셀 ${row.row_number}행 중복 여부 확인`} checked={!!decisions[row.row_key]?.confirmed}
              onChange={(e) => changeDecision(row.row_key, { confirmed: e.target.checked })} />
              {decisions[row.row_key]?.action === "separate" ? "별도 수금임을 확인하고 등록합니다." : "중복 여부를 확인했으며 이번 업로드에서 이 행을 제외합니다."}
            </label>
          </div>)}
        </div>
        <div className="collection-review-footer">
          <b>등록 예정 {finalCount}건 · {won(finalAmount)}원 / 중복 제외 예정 {reviewRows.length - separateRows.length}건 / 거래처 확인 제외 {preview.customer_excluded_count || 0}건</b>
          <div className="btnrow"><button className="btn" disabled={busy} onClick={closeReview}>돌아가기</button>
            <button className="btn btn--primary" disabled={busy || !reviewsComplete} onClick={applyReviews}>
              중복 확인 적용 · {reviewRows.length}건</button></div>
        </div>
      </section>
    </div>}
    {reviewHistory && <div className="modal-backdrop" onMouseDown={() => setReviewHistory(null)}>
      <section className="modal-card modal-card--wide collection-review-history" role="dialog" aria-modal="true" aria-labelledby="collection-review-history-title"
        onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="collection-review-history-title">중복·거래처 확인 이력</h2><p>{reviewHistory.batch.filename}</p>
        <div className="tablewrap"><table><thead><tr><th>엑셀 행 / 수금번호</th><th>처리</th><th>사유</th><th>확인자</th><th>확인일시</th></tr></thead>
          <tbody>{reviewHistory.rows.map((r) => <tr key={r.id}><td>{r.row_number}행 · {r.receipt_no} / {r.sequence}</td>
            <td>{{ exclude: "중복 확인·제외", separate: "별도 수금 등록", customer_link: "기존 거래처 연결",
              customer_create: r.details?.created ? "신규 거래처 등록" : "신규 선택 · 수금 제외로 생성 안함", customer_exclude: "거래처 확인·이번 업로드 제외" }[r.action] || r.action}
              {r.details?.selection && <div className="t-sm">엑셀 {r.details.source?.customer_code} · {r.details.source?.customer_name}
                {r.details.selection.customer && <div>→ {r.details.selection.customer.code} · {r.details.selection.customer.name} · {r.details.selection.customer.biz_unit}</div>}</div>}</td>
            <td>{r.reason || "확인란 체크 후 처리"}</td>
            <td>{r.reviewed_by}</td><td>{r.created_at}</td></tr>)}</tbody></table></div>
        <button className="btn" onClick={() => setReviewHistory(null)}>닫기</button>
      </section>
    </div>}
  </>;
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
    if (exact >= 0) map[field] = exact;
  }
  // 과거 서식의 부가 문구가 붙은 머리글만 부분 일치로 보완한다.
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (map[field] !== undefined) continue;
    const normalized = aliases.map((a) => a.replace(/\s/g, ""));
    const fuzzy = cleaned.findIndex((header) => normalized.some((a) => a && header.includes(a)));
    if (fuzzy >= 0) map[field] = fuzzy;
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
  const unassignedUnits = parsed ? parsed.rows.filter((r) =>
    r.requires_unit_selection && !data.meta.units.includes(r.biz_unit)).length : 0;

  function selectRowUnit(index, unit) {
    setParsed((current) => ({ ...current, rows: current.rows.map((row, i) =>
      i === index ? { ...row, biz_unit: unit } : row) }));
  }

  function readFile(file) {
    setError(""); setParsed(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true });
        let headerRow = -1, map = {};
        for (let i = 0; i < Math.min(grid.length, 15); i++) {
          const candidate = mapHeaders(grid[i] || []);
          if (candidate.code !== undefined && candidate.name !== undefined) {
            headerRow = i; map = candidate; break;
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
          if (!code || /^#REF|^#N\/A/.test(code)) continue;
          const normalizedCode = /^\d+$/.test(code) ? code.padStart(5, "0") : code;
          const name = String(pick("name") || "").trim();
          const rawBizUnit = String(pick("biz_unit") || "").trim();
          const category = rawBizUnit.replace(/\s/g, "");
          const requiresUnitSelection = shipmentMode && category === "반제품";
          const bizUnit = amaranthMode ? (AMARANTH_UNIT_MAP[category] || "")
            : (requiresUnitSelection ? "" : rawBizUnit);
          if (!name) issues.push((i + 1) + "행: 거래처명 누락");
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
            source_lines: shipmentMode ? [{ row_number: i + 1, shipment_date: rowShipmentDate,
              amount: parseUploadAmount(map.total_amount !== undefined ? pick("total_amount") : pick("shipment_amount")),
              columns: (grid[headerRow] || []).map((header, column) => ({
                column: XLSX.utils.encode_col(column), name: String(header || ""), value: raw[column] ?? "",
              })).filter((cell) => cell.name || cell.value !== ""),
            }] : undefined,
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
            shipment_amount: parseUploadAmount(
              map.total_amount !== undefined ? pick("total_amount") : pick("shipment_amount")
            ),
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
              current.source_lines = [...current.source_lines, ...r.source_lines];
              current.shipment_amount = parseUploadAmount(current.shipment_amount) + parseUploadAmount(r.shipment_amount);
              current.total_amount = current.shipment_amount;
              if (r.shipment_date > current.shipment_date) current.shipment_date = r.shipment_date;
            }
            else {
              const amount = parseUploadAmount(r.shipment_amount);
              grouped.set(key, { ...r, shipment_amount: amount, total_amount: amount });
            }
          });
          preparedRows = Array.from(grouped.values());
          const unitsByCode = new Map();
          preparedRows.forEach((r) => {
            if (!unitsByCode.has(r.code)) unitsByCode.set(r.code, new Set());
            unitsByCode.get(r.code).add(r.biz_unit);
          });
          multiUnitCodes = Array.from(unitsByCode.entries())
            .filter(([, units]) => units.size > 1).map(([code]) => code);
        }
        const seen = new Set(), dupes = [];
        preparedRows.forEach((r) => {
          if (!amaranthMode && seen.has(r.code)) dupes.push(r.code);
          seen.add(r.code);
        });
        const fileDated = shipmentMode && map.shipment_date !== undefined;
        const shipmentMonths = [...new Set(preparedRows.map((r) => r.shipment_month).filter(Boolean))].sort();
        setParsed({ filename: file.name, rows: preparedRows, dupes, issues,
          mapped: Object.keys(map), amaranthMode, multiUnitCodes,
          fileDated, shipmentMonths,
          mode: shipmentMode ? "shipment" : "snapshot" });
      } catch (err) {
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
          (result[row.shipment_month] ||= []).push(row); return result;
        }, {});
        const skipped = [], applied = [];
        for (const targetMonth of Object.keys(groups).sort()) {
          const lock = lockOf(targetMonth);
          if (lock && lock.locked) { skipped.push(targetMonth); continue; }
          const groupRows = groups[targetMonth];
          const reflectedDate = groupRows.map((r) => r.shipment_date).sort().at(-1);
          res = await api("/api/uploads", { method: "POST", body: {
            month: targetMonth, shipment_date: reflectedDate, filename: parsed.filename,
            rows: groupRows, mode: "shipment",
          }});
          applied.push(targetMonth + " " + res.inserted + "행");
        }
        if (!res) throw new Error("파일에 포함된 출고월이 모두 마감되어 반영할 데이터가 없습니다.");
        applyUpload(res);
        notify("반영: " + applied.join(" · ") + (skipped.length ? " · 마감월 제외: " + skipped.join(", ") : ""));
      } else {
        res = await api("/api/uploads", {
          method: "POST",
          body: { month, shipment_date: shipmentDate, filename: parsed.filename,
            rows: parsed.rows, mode: parsed.mode },
        });
        applyUpload(res);
        notify(res.inserted + "행을 반영했습니다. 기존 " + res.replaced + "행은 교체되었습니다.");
      }
      setParsed(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  async function toggleLock() {
    try {
      await api("/api/locks/" + month, { method: "POST", body: { locked: !locked } });
      notify(locked ? month + " 잠금을 해제했습니다." : month + " 을 마감 잠금했습니다.");
      await refresh();
    } catch (e) { notify(e.message, true); }
  }

  async function rollbackUpload(upload) {
    const restored = upload.restore_filename || "직전 상태";
    if (!window.confirm(
      `최근 업로드 '${upload.filename}'을 삭제하고 '${restored}' 상태로 복원할까요?\n복원 후에는 되돌릴 수 없습니다.`
    )) return;
    setBusy(true);
    try {
      const res = await api("/api/uploads/" + upload.id, { method: "DELETE" });
      applyUpload(res);
      notify(`'${res.removed_filename}'을 삭제하고 '${res.restored_filename}' 상태로 복원했습니다.`);
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  return (
    <>
      <Card title="출고 데이터 업로드">
        <div className="formrow">
          <Field label="기준월">
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="출고기준일">
            <input className="input" type="date" value={shipmentDate}
              onChange={(e) => setShipmentDate(e.target.value)} />
          </Field>
          <Field label="마감 상태">
            <div className="btnrow" style={{ alignItems: "center", minHeight: 38 }}>
              <span className={"badge badge--" + (locked ? "bad" : "ok")}>{locked ? "잠김" : "열림"}</span>
              {can("month_lock") && (
                <button className="btn btn--sm" onClick={toggleLock}>{locked ? "잠금 해제" : "마감 잠금"}</button>
              )}
            </div>
          </Field>
        </div>

        <div className={"dropzone" + (over ? " is-over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); }}>
          <p style={{ margin: "0 0 10px" }}>엑셀 파일을 끌어다 놓거나 아래에서 선택하세요.</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} />
          <p className="t-sm t-muted" style={{ margin: "12px 0 0" }}>
            아마란스10 출고현황 원본: E열 고객코드 · F열 고객 · AK열 대분류 · AB열 합계액을 자동 인식합니다.
            <br />제품·반제품 모두 채권으로 반영합니다. 대분류가 '반제품'만 있는 경우 아래에서 사업부를 선택하세요.
          </p>
        </div>

        {error && <div className="alert alert--bad" style={{ marginTop: 12 }}>{error}</div>}
        {locked && (!parsed || !parsed.fileDated) && (
          <div className="alert alert--warn" style={{ marginTop: 12 }}>
            {month} 은 마감 잠금 상태라 업로드할 수 없습니다. 잠금을 해제한 뒤 다시 시도하세요.
          </div>
        )}

        {parsed && (
          <div style={{ marginTop: 16 }}>
            <div className="alert alert--info">
              <b>{parsed.filename}</b> — 유효한 {parsed.rows.length}행을 읽었습니다.
              {parsed.amaranthMode && " 아마란스10 원본 서식으로 인식했습니다."}
              {parsed.fileDated && " 출고일 기준으로 " + parsed.shipmentMonths.join(", ") + " 월을 자동 분리합니다."}
              인식한 열: {parsed.mapped.length}개.
              {parsed.dupes.length > 0 && (parsed.amaranthMode
                ? " 복수 사업부 코드 " + parsed.dupes.length + "건을 사업부별로 분리합니다."
                : " 중복 코드 " + parsed.dupes.length + "건이 있습니다.")}
            </div>
            {(parsed.dupes.length > 0 || parsed.issues.length > 0) && (
              <div className="alert alert--bad" style={{ marginTop: 10 }}>
                업로드 전 수정 필요: {parsed.dupes.length > 0 && "중복 코드 " + parsed.dupes.join(", ")}
                {parsed.dupes.length > 0 && parsed.issues.length > 0 && " · "}
                {parsed.issues.slice(0, 8).join(" · ")}{parsed.issues.length > 8 && " 외 " + (parsed.issues.length - 8) + "건"}
              </div>
            )}
            {unassignedUnits > 0 && (
              <div className="alert alert--warn" style={{ marginTop: 10 }}>
                반제품 {unassignedUnits}건의 사업부를 선택하세요. 아래 표에서 덴탈·메디컬·에스테틱 중 선택하면 반영할 수 있습니다.
              </div>
            )}
            <p className="t-sm t-muted">
              {parsed.mode === "shipment"
                ? (parsed.fileDated ? "각 행의 출고월별로 재설정하며 마감된 월은 자동 제외합니다."
                  : month + " 출고분만 재설정하며 회수기간에 따라 수금대상월을 자동 산출합니다.")
                : month + " 의 기존 확정 채권 데이터를 교체합니다."} 다른 월 데이터는 그대로 유지됩니다.
            </p>
            <div className="tablewrap" style={{ maxHeight: 260, overflowY: "auto", marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>{parsed.fileDated && <th>출고일</th>}<th>코드</th><th>거래처명</th><th>사업부</th>
                    <th>{parsed.mode === "shipment" ? "회수기간" : "분류"}</th>
                    <th className="r">{parsed.mode === "shipment" ? "출고금액" : "채권잔액"}</th></tr>
                </thead>
                <tbody>
                  {parsed.rows.map((r, i) => (
                    <tr key={i}>
                      {parsed.fileDated && <td className="num">{r.shipment_date}</td>}
                      <td className="num">{r.code}</td><td>{r.name}</td>
                      <td>{r.requires_unit_selection ? (
                        <select className="input" value={r.biz_unit} disabled={busy}
                          aria-label={r.code + " " + r.name + " 반제품 사업부"}
                          onChange={(e) => selectRowUnit(i, e.target.value)}>
                          <option value="">반제품 사업부 선택</option>
                          {data.meta.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      ) : (r.biz_unit || "–")}</td>
                      <td>{parsed.mode === "shipment" ? r.collection_period + "개월" : (r.status || "자동판정")}</td>
                      <td className="r num">{won(parsed.mode === "shipment" ? r.shipment_amount : r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btnrow">
              <button className="btn btn--primary" onClick={send}
                disabled={busy || unassignedUnits > 0 || (!parsed.fileDated && locked) || (!parsed.fileDated && !shipmentDate) || parsed.dupes.length > 0 || parsed.issues.length > 0}>
                {parsed.fileDated ? "출고월별 데이터 반영" : month + " 데이터로 반영"}
              </button>
              <button className="btn" onClick={() => setParsed(null)}>취소</button>
            </div>
          </div>
        )}
      </Card>

      <Card title="업로드 이력" flush>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>업로드 일시</th><th>출고기준일</th><th>기준월</th><th>파일명</th><th className="r">반영 행</th>
                <th className="r">교체된 행</th><th>업로더</th><th>마감</th><th>관리</th></tr>
            </thead>
            <tbody>
              {data.uploads.map((u) => {
                const l = lockOf(u.month);
                return (
                  <tr key={u.id}>
                    <td className="num t-sm">{u.uploaded_at}</td>
                    <td className="num t-sm">{u.shipment_date || "–"}</td>
                    <td className="num t-strong">{u.month}</td>
                    <td>{u.filename}</td>
                    <td className="r num">{u.row_count}</td>
                    <td className="r num t-muted">{u.replaced}</td>
                    <td>{u.uploaded_by}</td>
                    <td>
                      <span className={"badge badge--" + (l && l.locked ? "bad" : "mute")}>
                        {l && l.locked ? "잠김" : "열림"}
                      </span>
                    </td>
                    <td>
                      {u.can_restore ? (
                        <button className="btn btn--sm btn--danger" disabled={busy || (l && l.locked)}
                          onClick={() => rollbackUpload(u)} title={l && l.locked ? "마감 잠금을 먼저 해제하세요." : "최근 업로드 삭제 및 직전 파일 복원"}>
                          삭제·복원
                        </button>
                      ) : <span className="t-muted">–</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
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
        try { message = (await res.json()).error || message; } catch (e) { /* ignore */ }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "MedPark_" + Number(month.slice(5, 7)) + "월_수금계획" +
        (includeOverdue ? "_미수포함" : "") + (includeBad ? "_부실포함" : "") + ".xlsx";
      link.click(); URL.revokeObjectURL(url);
      notify(Number(month.slice(5, 7)) + "월 수금계획을 생성했습니다.");
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  return (
    <>
      <Card title="㈜메드파크 자금수지관리 수금계획">
        <div className="formrow">
          <Field label="수금계획 기준월">
            <select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>
              {planMonths.map((m) => <option key={m} value={m}>{Number(m.slice(5, 7))}월 수금계획</option>)}
            </select>
          </Field>
          <Field label="미수채권 조회기준일">
            <input className="input" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </Field>
        </div>
        <div className="chiprow" style={{ marginTop: 12 }}>
          <label className="chip" aria-pressed={includeOverdue}><input type="checkbox" checked={includeOverdue}
            onChange={(e) => setIncludeOverdue(e.target.checked)} /> 미수채권 포함</label>
          <label className="chip" aria-pressed={includeBad}><input type="checkbox" checked={includeBad}
            onChange={(e) => setIncludeBad(e.target.checked)} /> 부실채권 포함</label>
        </div>
        <div className="alert alert--info" style={{ margin: "12px 0" }}>
          정상채권은 선택한 월의 수금대상 금액만 반영합니다. 미수채권은 입력한 조회기준일 현재 상태로 산정합니다.
        </div>
        <button className="btn btn--primary" onClick={download} disabled={busy || !month || !asOfDate}>
          {busy ? "엑셀 생성 중" : Number(month.slice(5, 7)) + "월 수금계획 다운로드"}
        </button>
      </Card>
      <Card title="적용 기준">
        <ul className="template-steps">
          <li>본부는 <b>사업부</b>, 수금/지출은 <b>수금</b>으로 고정합니다.</li>
          <li>부서/팀과 집행항목은 덴탈·메디컬·에스테틱 사업부에 맞춰 자동 변환합니다.</li>
          <li>자금계획일·자금실행일은 해당 월 말일이며, 수금목표일이 있으면 그 날짜를 사용합니다.</li>
          <li>정상채권·미수채권·부실채권을 거래처별 별도 행으로 표시합니다.</li>
        </ul>
      </Card>
    </>
  );
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
      notify("아이디와 이름을 입력하세요.", true); return;
    }
    if (newUser.password.length < 8) {
      notify("초기 비밀번호는 8자 이상으로 입력하세요.", true); return;
    }
    try {
      await api("/api/users", { method: "POST", body: newUser });
      notify(newUser.username + " 계정을 등록했습니다.");
      setNewUser({ username: "", name: "", title: "", role: "sales", biz_unit: "", password: "" });
      await refresh();
    } catch (e) { notify(e.message, true); }
  }

  function choose(u) {
    setSel(u.username); setPerms(u.permissions || []); setRole(u.role);
  }
  function applyTemplate(r) {
    setRole(r); setPerms(data.meta.roles[r].perms);
  }
  async function save() {
    try {
      await api("/api/users/" + sel, { method: "PATCH", body: { role, permissions: perms } });
      notify(sel + " 권한을 저장했습니다."); await refresh();
    } catch (e) { notify(e.message, true); }
  }
  async function toggleActive(u) {
    try {
      await api("/api/users/" + u.username, { method: "PATCH", body: { active: !u.active } });
      await refresh();
    } catch (e) { notify(e.message, true); }
  }
  async function resetPassword(u) {
    const pw = prompt(u.username + " 의 새 비밀번호 (8자 이상)");
    if (!pw) return;
    if (pw.length < 8) { notify("8자 이상으로 입력하세요.", true); return; }
    try {
      await api("/api/users/" + u.username, { method: "PATCH", body: { password: pw } });
      notify("비밀번호를 변경했습니다.");
    } catch (e) { notify(e.message, true); }
  }

  return (
    <>
      <Card title="신규 계정 등록">
        <form onSubmit={createAccount}>
          <div className="formrow">
            <Field label="아이디*"><input className="input" value={newUser.username} onChange={setNew("username")} /></Field>
            <Field label="이름*"><input className="input" value={newUser.name} onChange={setNew("name")} /></Field>
            <Field label="직위"><input className="input" value={newUser.title} onChange={setNew("title")} /></Field>
            <Field label="역할"><select className="select" value={newUser.role} onChange={setNew("role")}>
              {Object.entries(data.meta.roles).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
            </select></Field>
            <Field label="사업부"><select className="select" value={newUser.biz_unit} onChange={setNew("biz_unit")}>
              <option value="">전체/미지정</option>{data.meta.units.map((u) => <option key={u}>{u}</option>)}
            </select></Field>
            <Field label="초기 비밀번호*"><input className="input" type="password" minLength="8"
              value={newUser.password} onChange={setNew("password")} /></Field>
          </div>
          <button className="btn btn--primary" type="submit">계정 등록</button>
        </form>
      </Card>

      <Card title="계정" flush>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>아이디</th><th>이름</th><th>직위</th><th>역할</th><th>사업부</th>
                <th className="r">권한 수</th><th>상태</th><th /></tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.username} style={{ background: sel === u.username ? "var(--brand-soft)" : undefined }}>
                  <td className="t-strong">{u.username}</td>
                  <td>{u.name}</td>
                  <td className="t-muted">{u.title || "–"}</td>
                  <td><span className="badge badge--brand">{data.meta.roles[u.role].label}</span></td>
                  <td>{u.biz_unit || "–"}</td>
                  <td className="r num">{(u.permissions || []).length} / {data.meta.permissions.length}</td>
                  <td><span className={"badge badge--" + (u.active ? "ok" : "mute")}>
                    {u.active ? "사용" : "정지"}</span></td>
                  <td className="r">
                    <div className="btnrow" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn--sm" onClick={() => choose(u)}>권한 편집</button>
                      <button className="btn btn--sm" onClick={() => resetPassword(u)}>비밀번호</button>
                      <button className="btn btn--sm" onClick={() => toggleActive(u)}>
                        {u.active ? "정지" : "사용"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {sel && (
        <Card title={sel + " 권한"}
          actions={<button className="btn btn--sm btn--primary" onClick={save}>변경 저장</button>}>
          <Field label="역할 템플릿">
            <div className="chiprow">
              {Object.entries(data.meta.roles).map(([key, r]) => (
                <button key={key} className="chip" aria-pressed={role === key}
                  onClick={() => applyTemplate(key)}>{r.label}</button>
              ))}
            </div>
          </Field>
          <div className="permgrid" style={{ marginTop: 12 }}>
            {data.meta.permissions.map((p) => (
              <label key={p.key}>
                <input type="checkbox" checked={perms.includes(p.key)}
                  onChange={(e) => setPerms(e.target.checked
                    ? [...perms, p.key] : perms.filter((x) => x !== p.key))} />
                {p.label}
              </label>
            ))}
          </div>
        </Card>
      )}
    </>
  );
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
  return <Card title="수금등록 데이터 업로드 · 사용법과 검증 기준">
    <ol>
      <li>수금 → 수금등록 데이터 업로드에서 아마란스10 파일을 선택합니다. 첫 번째 시트의 앞 25행 안에 머리글이 있어야 합니다.</li>
      <li>입력 오류는 행 번호·거래처·고객코드·수금번호·사유로 표시합니다. ‘오류만 보기’로 해당 행을 모아볼 수 있습니다.</li>
      <li>미등록·모호한 고객코드가 있으면 거래처 확인 창이 먼저 열립니다. 기존 거래처 연결, 엑셀 코드로 신규 등록, 이번 업로드 제외 중 직접 선택하고 확인란을 체크합니다. 같은 코드의 행은 함께 처리합니다.</li>
      <li>기존 거래처 연결은 코드·사업부·채권잔액을 비교하고 5~500자 사유를 입력합니다. 신규 등록은 거래처명과 사업부가 필수이며 수금 등록 권한이 필요합니다. 새 거래처는 잔액 0원·회수기간 미입력으로 시작하고, 승인 시 수금은 선수금으로 처리됩니다.</li>
      <li>‘거래처 선택 적용 · 등록 단계로’는 저장 전 검증 단계입니다. 확인란만 체크하고 창을 닫았다면 본문의 등록 진행 버튼으로 선택을 적용할 수 있습니다. 연결한 거래처 기준으로 기존 수금과 다시 비교한 뒤 중복 확인 창이 열립니다. 기존 코드를 변경하거나 다음 파일의 코드를 자동 변환하지 않습니다.</li>
      <li>‘중복 N건 처리’ 또는 각 중복 행의 ‘중복 처리’를 누릅니다. 거래처·입력 오류가 남아 있어도 중복 확인 창을 열고 별도로 처리할 수 있습니다.</li>
      <li>각 후보의 ‘중복 확인·이번 행 제외’를 체크합니다. 내용이 동일한 기등록 건은 일괄 확인도 가능합니다. 팝업의 ‘중복 확인 적용’은 선택만 반영하며 수금을 등록하지 않습니다.</li>
      <li>고객·수금일·금액·방법만 같은 후보가 실제 별도 수금이면 ‘중복 아님·별도 수금 등록’을 선택하고 5~500자 사유와 확인 체크를 입력합니다.</li>
      <li>본문의 중복 확인 완료 건수와 제외·별도 수금 선택 결과를 확인합니다. 입력 오류 0건·중복 확인 완료 상태에서 ‘최종 등록’을 눌러 등록합니다. 승인 권한이 있으면 최종 등록과 동시에 자동 승인·상계됩니다. 승인 권한이 없으면 승인 대기로 등록됩니다. 전부 중복이면 제외 확인 이력만 저장하며 채권을 다시 차감하지 않습니다.</li>
      <li>거래처 선택을 재검증해도 비교 대상과 내용이 같은 중복 확인 결과는 유지합니다. 비교 내용이 바뀐 행은 다시 확인해야 합니다. 선택은 현재 파일 처리 중에만 유지되며 새 파일 선택·새로고침 시 재확인이 필요합니다.</li>
      <li>최종 등록이 성공할 때 필요한 신규 거래처와 수금을 함께 저장합니다. 오류가 나면 둘 다 저장하지 않습니다. 제외한 수금을 위한 거래처는 생성하지 않습니다.</li>
      <li>업로드 이력의 중복·거래처 확인 버튼에서 원본 코드·연결 코드·신규/제외 판단·사유·확인자·확인일시를 조회할 수 있습니다.</li>
    </ol>
    <div className="tablewrap"><table className="manual-table">
      <thead><tr><th>엑셀 열</th><th>필수 여부</th><th>입력·검증 기준</th></tr></thead>
      <tbody>{columns.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
    </table></div>
    <div className="tablewrap" style={{ marginTop: 16 }}><table className="manual-table">
      <thead><tr><th>수금구분</th><th>수금구분유형</th><th>기존 수금방법</th></tr></thead>
      <tbody><tr><td>제예금 / 제 예 금</td><td>1 또는 제예금·계좌수금 명칭</td><td>계좌수금</td></tr>
        <tr><td>카드 / 카    드</td><td>5 또는 카드·카드수금 명칭</td><td>카드수금</td></tr>
        <tr><td>어음 / 받을어음 / 전자어음</td><td>어음 명칭으로 판정. 미확인 숫자코드를 임의로 어음으로 추정하지 않음</td><td>어음수금</td></tr></tbody>
    </table></div>
    <div className="manual-notices" style={{ marginTop: 16 }}>
      <div><b>등록 중단 오류</b><span>필수 열·값 누락, 잘못된 날짜·수금방법, 음수·소수·문자 금액, 0원 수금, 수금년월 불일치는 원본 수정이 필요합니다. 미등록·모호한 코드는 거래처 선택으로 해결할 수 있습니다. 신규 등록하려는 수금월이 마감되었거나 원장·집계잔액이 다르면 등록할 수 없습니다. 합계행은 실제 내역 합계와 대조합니다.</span></div>
      <div><b>번호·순번 중복</b><span>같은 수금번호·순번은 팝업에서 기존 값과 비교하고 이번 행을 제외할지 확인합니다. 값이 달라도 자동 덮어쓰거나 별도 생성하지 않습니다. 파일 안에서 중복되면 먼저 나온 행과 비교하여 뒤의 행 제외 여부를 확인합니다. 정정이 필요한 경우 돌아가서 원본 또는 기존 내역을 확인하세요.</span></div>
      <div><b>확인 중 변경</b><span>팝업 확인 뒤 거래처 코드·이름·사업부·잔액, 파일 또는 기존 수금이 바뀌면 최신 내역을 다시 표시하고 재확인을 받습니다. 미확인 행을 자동 제외하거나 추가 등록하지 않습니다.</span></div>
      <div><b>채권 상계</b><span>승인 시 고객코드의 부실 → 미수 → 정상채권 순서이며 각 구분에서는 오래된 발생월부터 차감합니다. 사업부는 기존 채권 원장을 따릅니다. 파일의 정상수금+선수금을 한 번만 반영하며 초과분만 선수금으로 보관합니다.</span></div>
      <div><b>승인·마감·파일</b><span>승인 대기 건은 잔액을 바꾸지 않습니다. 등록 뒤 수금월이 마감되면 업로드 수금의 승인이 차단됩니다. .xlsx/.xls/.csv, 10MB 이하, 최대 5,000행을 지원하며 보안 처리된 파일은 사내 반출 절차가 필요합니다.</span></div>
    </div>
  </Card>;
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
    ["채권·수금 추이", "일별·월별 출고 발생액과 승인 수금 비교", "그래프·기간별 표 선택으로 상세 이동"],
    ["채권·수금 상세내역", "출고채권·수금·기초이월 내역과 업로드 원본 확인", "사업부·거래처·일자·월·승인상태별 조회"],
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
  return <>
    <Card title="처음 사용할 때 · 기본 업무 순서">
      <div className="manual-steps">{steps.map(([no, title, text]) =>
        <div className="manual-step" key={no}><b>{no}</b><span><strong>{title}</strong><small>{text}</small></span></div>)}</div>
    </Card>
    <Card title="메뉴별 사용법" flush>
      <div className="tablewrap"><table className="manual-table">
        <thead><tr><th>메뉴</th><th>주요 기능</th><th>간단 사용법</th></tr></thead>
        <tbody>{menus.map((row) => <tr key={row[0]}><td className="t-strong">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody>
      </table></div>
    </Card>
    <CollectionUploadGuide />
    <Card title="프로그램이 채권을 계산하는 방식">
      <div className="manual-notices">
        {implementation.map(([title, text]) => <div key={title}><b>{title}</b><span>{text}</span></div>)}
      </div>
    </Card>
    <Card title="채권 구분 이해하기" flush>
      <div className="tablewrap"><table className="manual-table">
        <thead><tr><th>구분</th><th>프로그램 처리 기준</th></tr></thead>
        <tbody>{terms.map((row) => <tr key={row[0]}><td className="t-strong">{row[0]}</td><td>{row[1]}</td></tr>)}</tbody>
      </table></div>
    </Card>
    <Card title="채권·수금 추이 · 집계 기준">
      <ul>
        <li>시작월·종료월, 사업부, 거래처명·고객코드를 선택해 최대 24개월을 조회합니다. 일별·월별 그래프의 날짜 또는 금액 대조표를 선택하면 세부 내역으로 이동합니다.</li>
        <li>발생액은 월별 최신 반영 출고금액이며 반품·조정은 음수로 포함합니다. 재업로드는 동일 월의 이전 금액을 더하지 않습니다. 수금 상계 후 잔액을 발생액으로 사용하지 않습니다.</li>
        <li>수금은 실제 수금일 기준 승인 완료 금액이며 선수금을 포함합니다. 승인 대기·반려는 그래프에서 제외하고 상세내역에서 상태별 조회합니다. 사업부별 수금은 현재 거래처 사업부 기준이며 채권별 상계 배분을 뜻하지 않습니다.</li>
        <li>기초·이월채권은 신규 발생액에서 제외하고 별도 탭에서 현재 원금을 확인합니다. 발생액−수금액은 기간 금액의 비교이며 현재 채권잔액이나 실제 상계액과 같지 않을 수 있습니다.</li>
        <li>과거 월별 합계 자료의 출고일은 임의로 지정하지 않습니다. 월별 금액에 포함하고 일별 그래프의 미보관 금액으로 안내합니다. 해당 월의 전체 출고 원본을 다시 업로드하면 보관된 출고일로 조회할 수 있습니다.</li>
        <li>새 출고 업로드는 엑셀 원본 행·출고일·금액을 함께 보관합니다. 같은 월의 전체 자료를 다시 올리는 기존 방식이며 일부 행만 올리면 그 월의 전체 반영분이 교체됩니다. 출고 업로드 복원 시 상세 원본도 해당 반영 버전으로 돌아갑니다.</li>
        <li>상세내역은 출고채권·수금·기초이월로 나뉩니다. 업로드 원본 보기에서 파일명·등록자·엑셀 행과 원본 값을 확인합니다. 이미 제외한 중복 확인 이력은 수금 업로드 이력 메뉴에서 확인합니다.</li>
      </ul>
    </Card>
    <Card title="꼭 확인하세요">
      <div className="manual-notices">
        <div><b>조회기준</b><span>보고 화면은 선택한 조회기준을 따르며, 수금·업로드 화면은 항상 최신 운영데이터를 사용합니다.</span></div>
        <div><b>수금 승인</b><span>승인 완료 후 잔액에 반영됩니다. 수금 업로드에서 승인권자는 최종 등록과 동시에 자동 승인·상계됩니다. 승인 권한이 없는 등록자는 승인 대기로 등록됩니다.</span></div>
        <div><b>카드수금</b><span>채권에서는 승인 즉시 차감되지만 수금계획에는 통장 입금예정일인 수금일 이후 3영업일까지 포함됩니다.</span></div>
        <div><b>선수금 대사</b><span>출고파일을 다시 올려도 직전 상계 결과를 복원한 뒤 최신 출고금액과 선수금을 다시 자동 대사합니다.</span></div>
        <div><b>월 마감</b><span>마감된 월의 출고자료는 재업로드 파일에 포함되어 있어도 새 채권으로 다시 반영하지 않습니다.</span></div>
        <div><b>미수 전환</b><span>거래가 종료된 정상채권은 채권 상세에서 미수채권으로 전환할 수 있습니다.</span></div>
        <div><b>계정 보안</b><span>아이디는 고정되며, 로그인 후 상단의 비밀번호 변경에서 본인이 직접 변경할 수 있습니다.</span></div>
      </div>
    </Card>
  </>;
}

/* ══════════════════ 셸 ══════════════════ */

const SCREENS = [
  { key: "dashboard", label: "대시보드",         perm: "dashboard_view",      group: "현황" },
  { key: "summary",   label: "채권요약현황",     perm: "dashboard_view",      group: "현황" },
  { key: "activity", label: "채권·수금 추이", perm: "dashboard_view", group: "현황" },
  { key: "activityDetails", label: "채권·수금 상세내역", perm: "dashboard_view", group: "현황" },
  { key: "closing",   label: "결산회의 미수채권", perm: "dashboard_view",      group: "현황" },
  { key: "customers", label: "거래처별 현황",     perm: "customer_view",       group: "현황" },
  { key: "owners",    label: "담당자별 채권현황", perm: "owner_view",          group: "현황" },
  { key: "collections", label: "수금 등록",       perm: "collection_register", group: "수금", alt: "collection_approve" },
  { key: "collectionUpload", label: "수금등록 데이터 업로드", perm: "collection_register", group: "수금", alt: "collection_approve" },
  { key: "targets",   label: "수금목표 관리",     perm: "target_manage",       group: "수금" },
  { key: "upload",    label: "출고 데이터 업로드", perm: "upload_data",        group: "관리" },
  { key: "cashplan",  label: "수금계획 다운로드", perm: "data_export",          group: "관리" },
  { key: "users",     label: "계정·권한 관리",    perm: "user_manage",         group: "관리" },
  { key: "manual",    label: "사용 매뉴얼",       perm: null,                  group: "도움말" },
];
const REPORT_SCREENS = new Set(["dashboard", "summary", "closing", "customers", "owners", "targets", "cashplan"]);
const SCREEN_STORAGE_KEY = "ar_active_screen";

function initialScreen() {
  try {
    const navigation = performance.getEntriesByType("navigation")[0];
    return navigation && navigation.type === "reload"
      ? (sessionStorage.getItem(SCREEN_STORAGE_KEY) || "dashboard")
      : "dashboard";
  } catch (_) { return "dashboard"; }
}

function App() {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(null);
  const [screen, setScreen] = useState(initialScreen);
  const [preset, setPreset] = useState(null);
  const [activityFilters, setActivityFilters] = useState(null);
  const [toast, setToast] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [dataView, setDataView] = useState(() => localStorage.getItem("ar_data_view") || "combined");

  const notify = useCallback((message, bad) => {
    setToast({ message, bad });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    const d = await api("/api/bootstrap");
    setData(d); setUser(d.user);
  }, []);

  useEffect(() => {
    api("/api/me").then((r) => {
      if (r.user) load().catch((e) => notify(e.message, true));
      else {
        sessionStorage.removeItem(SCREEN_STORAGE_KEY);
        setScreen("dashboard"); setUser(null);
      }
    }).catch(() => {
      sessionStorage.removeItem(SCREEN_STORAGE_KEY);
      setScreen("dashboard"); setUser(null);
    });
  }, [load, notify]);

  const can = useCallback((perm) => !!(user && user.permissions.includes(perm)), [user]);

  const visible = useMemo(
    () => SCREENS.filter((s) => !s.perm || can(s.perm) || (s.alt && can(s.alt))), [can]);

  useEffect(() => {
    if (user && visible.length && !visible.some((s) => s.key === screen)) setScreen(visible[0].key);
  }, [user, visible, screen]);

  useEffect(() => {
    if (user && data) sessionStorage.setItem(SCREEN_STORAGE_KEY, screen);
  }, [user, data, screen]);

  useEffect(() => {
    if (!data) return;
    const options = data.meta.dashboard_views || [];
    if (!options.some((view) => view.key === dataView)) {
      const fallback = options.some((view) => view.key === "combined") ? "combined" : (options[0] && options[0].key);
      if (fallback) setDataView(fallback);
    }
  }, [data, dataView]);

  useEffect(() => { localStorage.setItem("ar_data_view", dataView); }, [dataView]);

  if (user === undefined) {
    return <div className="boot"><div className="boot__mark">MP</div>
      <p className="boot__text">불러오는 중입니다.</p></div>;
  }
  if (user === null) return <Login onDone={() => {
    sessionStorage.removeItem(SCREEN_STORAGE_KEY);
    setScreen("dashboard"); load();
  }} />;
  if (!data) return <div className="boot"><div className="boot__mark">MP</div>
    <p className="boot__text">데이터를 준비하고 있습니다.</p></div>;

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
    setUser(null); setData(null);
  }

  return (
    <div className="shell">
      <nav className="side">
        <div className="side__top">
          <div className="side__logo"><span>MP</span>채권관리</div>
        </div>
        <div className="side__nav">
          {groups.map((g) => (
            <div key={g}>
              <div className="side__group">{g}</div>
              {visible.filter((s) => s.group === g).map((s) => (
                <button key={s.key} className="side__item" aria-current={screen === s.key}
                  onClick={() => { setPreset(null); setScreen(s.key); }}>
                  {s.label}
                  {s.key === "collections" && pendingCount > 0 && <small>{pendingCount}</small>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="side__foot">기준일 {data.meta.today}</div>
      </nav>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{current.label}</h1>
            <div className="sub">기준일 {data.meta.today} · {reportScreen ? selectedView.label : "현재 운영데이터 기준"}</div>
            <div className="sub">거래처 {screenData.customers.length}곳 · 전체 채권 {won(sum(screenData.customers, "balance"))}원</div>
          </div>
          <div className="spacer" />
          {reportScreen ? <label className="view-select">
            <span>조회기준</span>
            <select className="select" value={effectiveView} onChange={(e) => setDataView(e.target.value)}>
              {viewOptions.map((view) => <option key={view.key} value={view.key}>{view.label}</option>)}
            </select>
          </label> : <span className="badge badge--brand">현재 운영데이터 기준</span>}
          <div className="who">
            <b>{user.name}{user.title && " " + user.title}</b>
            <span>{data.meta.roles[user.role].label} · {user.username}</span>
          </div>
          <button className="btn btn--sm" onClick={() => setPasswordOpen(true)}>비밀번호 변경</button>
          <button className="btn btn--sm" onClick={signOut}>로그아웃</button>
        </header>

        <div className="page">
          {screen === "dashboard" && <Dashboard data={reportData} setScreen={setScreen} setPreset={setPreset} />}
          {screen === "summary" && <BondSummary data={reportData} notify={notify} />}
          {(screen === "activity" || screen === "activityDetails") && <ReceivableActivity key={screen} data={data}
            detail={screen === "activityDetails"} initialFilters={activityFilters} onDetails={(filters) => {
              setActivityFilters(filters); setScreen("activityDetails");
            }} />}
          {screen === "closing" && <ClosingReceivables data={reportData} notify={notify} />}
          {screen === "customers" && <Customers data={reportData} can={can} preset={preset}
            notify={notify} patchCustomer={patchCustomer} />}
          {screen === "owners" && <Owners data={reportData} />}
          {screen === "collections" && <Collections data={data} can={can} notify={notify} refresh={load} />}
          {screen === "collectionUpload" && <CollectionUpload can={can} notify={notify} refresh={load} />}
          {screen === "targets" && <Targets data={reportData} notify={notify} refresh={load} />}
          {screen === "upload" && <Upload data={data} can={can} notify={notify}
            applyUpload={applyUpload} refresh={load} />}
          {screen === "cashplan" && <CashPlan data={reportData} dataView={effectiveView} notify={notify} />}
          {screen === "users" && <Users data={data} notify={notify} refresh={load} />}
          {screen === "manual" && <Manual />}
        </div>
      </main>

      {toast && <div className={"toast" + (toast.bad ? " toast--bad" : "")}>{toast.message}</div>}
      {passwordOpen && <ChangePassword user={user} onClose={() => setPasswordOpen(false)} notify={notify} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
