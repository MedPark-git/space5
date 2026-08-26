const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ══════════════════ 유틸 ══════════════════ */

const won = (n) => (Number(n) || 0).toLocaleString("ko-KR");

function short(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e8) return { value: (v / 1e8).toFixed(1), unit: "억" };
  if (Math.abs(v) >= 1e4) return { value: Math.round(v / 1e4).toLocaleString("ko-KR"), unit: "만" };
  return { value: v.toLocaleString("ko-KR"), unit: "원" };
}

const STATUS_STYLE = { 정상: "ok", 연체: "warn", 부실: "bad" };
const STATUS_LABEL = { 정상: "정상채권", 연체: "미수채권", 부실: "부실채권" };
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
  const { customers, collections, targets } = data;
  const [unit, setUnit] = useState("전체");
  const [normalTopUnit, setNormalTopUnit] = useState("전체");
  const [overdueTopUnit, setOverdueTopUnit] = useState("전체");

  const scoped = useMemo(
    () => (unit === "전체" ? customers : customers.filter((c) => c.biz_unit === unit)),
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
      if (!m) return;
      map[m] = map[m] || { month: m, amount: 0, count: 0 };
      map[m].amount += c.amount; map[m].count += 1;
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
  }, [approved]);

  const normalTop5 = customers
    .filter((c) => (normalTopUnit === "전체" || c.biz_unit === normalTopUnit) && c.normal_balance > 0)
    .sort((a, b) => b.normal_balance - a.normal_balance).slice(0, 5);
  const overdueTop5 = customers
    .filter((c) => (overdueTopUnit === "전체" || c.biz_unit === overdueTopUnit) && c.overdue_balance > 0)
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
                    <td className="num t-sm t-muted">{c.overdue_days}일</td>
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

function BondSummary({ data }) {
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
    const customers = data.customers.filter((c) => c.biz_unit === unit);
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

  return (
    <>
      <Card title={"1. 사업부별 채권 분류 현황 (" + sourceMonth + " 기준)"} flush>
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
        <div className="summary-note">현재 운영 기초자료 {data.customers.length}개 거래처 기준 · 금액 단위: 원</div>
      </Card>

      <Card title={"2. " + Number(sourceMonth.slice(5, 7)) + "월 수금실적"} flush>
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
    </>
  );
}

/* ══════════════════ 거래처별 현황 ══════════════════ */

function Customers({ data, can, preset, notify, patchCustomer }) {
  const [open, setOpen] = useState({});          // 사업부는 모두 접힌 상태로 시작
  const [sel, setSel] = useState(preset || { unit: "전체", status: "전체" });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");

  useEffect(() => { if (preset) { setSel(preset); setOpen((o) => ({ ...o, [preset.unit]: true })); } }, [preset]);

  const rows = useMemo(() => data.customers.filter((c) => {
    if (sel.unit !== "전체" && c.biz_unit !== sel.unit) return false;
    if (sel.status !== "전체" && c.status !== sel.status) return false;
    if (q && !(c.name.includes(q) || c.code.includes(q) || (c.owner || "").includes(q))) return false;
    return true;
  }), [data.customers, sel, q]);

  const countOf = (unit, status) => data.customers.filter(
    (c) => (unit === "전체" || c.biz_unit === unit) && (status === "전체" || c.status === status)).length;

  async function saveNote(code) {
    try {
      const { customer } = await api("/api/customers/" + encodeURIComponent(code),
        { method: "PATCH", body: { note: draft } });
      patchCustomer(customer);
      setEditing(null);
      notify("비고를 저장했습니다.");
    } catch (e) { notify(e.message, true); }
  }

  return (
    <div className="grid grid--split">
      <Card title="분류">
        <div className="tree">
          <button className="tree__leaf" style={{ paddingLeft: 10, fontWeight: 600 }}
            aria-current={sel.unit === "전체" && sel.status === "전체"}
            onClick={() => setSel({ unit: "전체", status: "전체" })}>
            <span>전체 거래처</span><span className="tree__count">{data.customers.length}</span>
          </button>
          {data.meta.units.map((u) => (
            <div key={u}>
              <button className="tree__unit" onClick={() => setOpen((o) => ({ ...o, [u]: !o[u] }))}
                aria-expanded={!!open[u]}>
                <span className={"tree__caret" + (open[u] ? " tree__caret--open" : "")}>▸</span>
                {u}
                <span className="spacer" style={{ flex: 1 }} />
                <span className="tree__count">{countOf(u, "전체")}</span>
              </button>
              {open[u] && (
                <>
                  <button className="tree__leaf" aria-current={sel.unit === u && sel.status === "전체"}
                    onClick={() => setSel({ unit: u, status: "전체" })}>
                    <span>전체</span><span className="tree__count">{countOf(u, "전체")}</span>
                  </button>
                  {data.meta.statuses.map((s) => (
                    <button key={s} className="tree__leaf" aria-current={sel.unit === u && sel.status === s}
                      onClick={() => setSel({ unit: u, status: s })}>
                      <span><Badge status={s} /></span>
                      <span className="tree__count">{countOf(u, s)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card
        title={sel.unit + " · " + (STATUS_LABEL[sel.status] || sel.status) + " (" + rows.length + "곳)"}
        actions={<input className="input" style={{ width: 220 }} value={q} placeholder="거래처명·코드·담당자"
          onChange={(e) => setQ(e.target.value)} />}
        flush>
        {rows.length === 0 ? (
          <Empty title="조건에 맞는 거래처가 없습니다.">왼쪽 분류나 검색어를 바꿔보세요.</Empty>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>코드</th><th>거래처명</th><th>사업부</th><th>분류</th><th>담당자</th>
                  <th className="r">미수잔액</th><th className="r">선수금</th>
                  <th className="r">경과일</th><th>최종수금일</th><th style={{ minWidth: 200 }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.code}>
                    <td className="num t-muted">{c.code}</td>
                    <td className="t-strong">{c.name}</td>
                    <td>{c.biz_unit}</td>
                    <td><Badge status={c.status} /></td>
                    <td>{c.owner || <span className="t-muted">미지정</span>}</td>
                    <td className="r num t-strong">{won(c.balance)}</td>
                    <td className="r num">{c.advance ? won(c.advance) : "–"}</td>
                    <td className="r num">{c.overdue_days || "–"}</td>
                    <td className="num t-muted t-sm">{c.last_paid_at || "–"}</td>
                    <td style={{ whiteSpace: "normal" }}>
                      {editing === c.code ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input className="input" value={draft} autoFocus
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveNote(c.code)} />
                          <button className="btn btn--sm btn--primary" onClick={() => saveNote(c.code)}>저장</button>
                          <button className="btn btn--sm" onClick={() => setEditing(null)}>취소</button>
                        </div>
                      ) : (
                        <span onClick={() => { if (can("note_edit")) { setEditing(c.code); setDraft(c.note || ""); } }}
                          style={{ cursor: can("note_edit") ? "text" : "default" }}
                          className={c.note ? "" : "t-muted t-sm"}>
                          {c.note || (can("note_edit") ? "클릭해 입력" : "–")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>합계 {rows.length}곳</td>
                  <td className="r num">{won(sum(rows, "balance"))}</td>
                  <td className="r num">{won(sum(rows, "advance"))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
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
                  <th className="r">미수잔액</th><th className="r">경과일</th><th>비고</th></tr>
              </thead>
              <tbody>
                {[...active.rows].sort((a, b) => b.balance - a.balance).map((c) => (
                  <tr key={c.code}>
                    <td className="num t-muted">{c.code}</td>
                    <td className="t-strong">{c.name}</td>
                    <td>{c.biz_unit}</td>
                    <td><Badge status={c.status} /></td>
                    <td className="r num t-strong">{won(c.balance)}</td>
                    <td className="r num">{c.overdue_days || "–"}</td>
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
      || String(c.code).toLowerCase().includes(keyword)).slice(0, 12);
  }, [customers, query]);

  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  function choose(customer) {
    onChange(customer.code);
    setQuery(customer.name);
    setOpen(false);
  }

  return (
    <div className="customer-search">
      <input className="input" value={query} placeholder="거래처명 또는 코드 검색"
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
              <span><b>{c.name}</b><small>{c.code} · {c.biz_unit}</small></span>
              <strong className="num">{won(c.balance)}원</strong>
            </button>
          ))}
          {matches.length === 0 && <div className="customer-search__empty">검색 결과가 없습니다.</div>}
        </div>
      )}
    </div>
  );
}

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
              <CustomerSearch customers={data.customers} value={form.customer_code}
                onChange={(code) => setForm({ ...form, customer_code: code })} />
            </Field>
            <Field label="수금액 (원)">
              <input className="input num" inputMode="numeric" value={form.amount}
                onChange={set("amount")} placeholder="0" />
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
          {target && Number(form.amount) > target.balance && (
            <div className="alert alert--warn">
              입력한 수금액이 현재 미수잔액({won(target.balance)}원)보다 큽니다. 금액을 확인하세요.
            </div>
          )}
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

/* ══════════════════ 출고 데이터 업로드 ══════════════════ */

const COLUMN_ALIASES = {
  code: ["거래처코드", "코드", "거래처 코드", "고객코드", "code"],
  name: ["거래처명", "거래처", "업체명", "고객명", "name"],
  biz_unit: ["사업부", "사업부문", "부문", "unit"],
  status: ["채권분류", "분류", "채권상태", "상태", "status"],
  owner: ["담당자", "영업담당", "담당", "owner"],
  balance: ["미수잔액", "미수금액", "채권잔액", "잔액", "미수금", "balance"],
  normal_balance: ["정상채권잔액", "정상채권", "normal_balance"],
  normal_later_balance: ["10월이후수금대상", "정상채권10월이후", "normal_later_balance"],
  normal_next_balance: ["9월수금대상", "정상채권9월분", "normal_next_balance"],
  normal_current_balance: ["8월수금대상", "정상채권8월분", "normal_current_balance"],
  normal_collected: ["정상채권수금현황", "정상채권수금액", "normal_collected"],
  overdue_balance: ["미수채권(11개월내)", "11개월내", "overdue_balance"],
  overdue_source_balance: ["미수채권기초잔액", "overdue_source_balance"],
  overdue_collected: ["미수채권수금현황", "미수채권수금액", "overdue_collected"],
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
      if (map[field] !== undefined) continue;
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
    setError(""); setParsed(null);
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
            headerRow = i; map = candidate; break;
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
          if (!code || /^#REF|^#N\/A/.test(code)) continue;
          rows.push({
            code,
            name: String(pick("name") || "").trim(),
            biz_unit: String(pick("biz_unit") || "").trim(),
            status: String(pick("status") || "").trim(),
            owner: String(pick("owner") || "").trim(),
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
            overdue_days: pick("overdue_days"),
            last_paid_at: String(pick("last_paid_at") || "").trim(),
            note: String(pick("note") || "").trim(),
          });
        }
        const seen = new Set(), dupes = [];
        rows.forEach((r) => { if (seen.has(r.code)) dupes.push(r.code); seen.add(r.code); });
        setParsed({ filename: file.name, rows, dupes, mapped: Object.keys(map) });
      } catch (err) {
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

  return (
    <>
      <Card title="출고 데이터 업로드">
        <div className="formrow">
          <Field label="기준월">
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
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
            첫 번째 시트를 읽습니다. 인식하는 열: 거래처코드 · 거래처명 · 사업부 · 채권분류 ·
            담당자 · 미수잔액 · 선수금 · 경과일 · 최종수금일 · 비고
          </p>
        </div>

        {error && <div className="alert alert--bad" style={{ marginTop: 12 }}>{error}</div>}
        {locked && (
          <div className="alert alert--warn" style={{ marginTop: 12 }}>
            {month} 은 마감 잠금 상태라 업로드할 수 없습니다. 잠금을 해제한 뒤 다시 시도하세요.
          </div>
        )}

        {parsed && (
          <div style={{ marginTop: 16 }}>
            <div className="alert alert--info">
              <b>{parsed.filename}</b> — 유효한 {parsed.rows.length}행을 읽었습니다.
              인식한 열: {parsed.mapped.length}개.
              {parsed.dupes.length > 0 && " 중복 코드 " + parsed.dupes.length + "건은 마지막 값으로 덮어씁니다."}
            </div>
            <p className="t-sm t-muted">
              {month} 의 기존 데이터를 이 파일로 교체합니다. 다른 월 데이터는 그대로 유지됩니다.
            </p>
            <div className="tablewrap" style={{ maxHeight: 260, overflowY: "auto", marginBottom: 12 }}>
              <table>
                <thead>
                  <tr><th>코드</th><th>거래처명</th><th>사업부</th><th>분류</th><th>담당자</th>
                    <th className="r">미수잔액</th></tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 12).map((r, i) => (
                    <tr key={i}>
                      <td className="num">{r.code}</td><td>{r.name}</td><td>{r.biz_unit || "–"}</td>
                      <td>{r.status || "자동판정"}</td><td>{r.owner || "–"}</td>
                      <td className="r num">{won(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btnrow">
              <button className="btn btn--primary" onClick={send} disabled={busy || locked}>
                {month} 데이터로 반영
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
              <tr><th>일시</th><th>기준월</th><th>파일명</th><th className="r">반영 행</th>
                <th className="r">교체된 행</th><th>업로더</th><th>마감</th></tr>
            </thead>
            <tbody>
              {data.uploads.map((u) => {
                const l = lockOf(u.month);
                return (
                  <tr key={u.id}>
                    <td className="num t-sm">{u.uploaded_at}</td>
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

/* ══════════════════ 계정·권한 관리 ══════════════════ */

function Users({ data, notify, refresh }) {
  const [sel, setSel] = useState(null);
  const [perms, setPerms] = useState([]);
  const [role, setRole] = useState("sales");

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
                  <td className="r num">{(u.permissions || []).length} / 11</td>
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

/* ══════════════════ 셸 ══════════════════ */

const SCREENS = [
  { key: "dashboard", label: "대시보드",         perm: "dashboard_view",      group: "현황" },
  { key: "summary",   label: "채권요약현황",     perm: "dashboard_view",      group: "현황" },
  { key: "customers", label: "거래처별 현황",     perm: "customer_view",       group: "현황" },
  { key: "owners",    label: "담당자별 채권현황", perm: "owner_view",          group: "현황" },
  { key: "collections", label: "수금 등록",       perm: "collection_register", group: "수금", alt: "collection_approve" },
  { key: "targets",   label: "수금목표 관리",     perm: "target_manage",       group: "수금" },
  { key: "upload",    label: "출고 데이터 업로드", perm: "upload_data",        group: "관리" },
  { key: "users",     label: "계정·권한 관리",    perm: "user_manage",         group: "관리" },
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
    setData(d); setUser(d.user);
  }, []);

  useEffect(() => {
    api("/api/me").then((r) => {
      if (r.user) load().catch((e) => notify(e.message, true));
      else setUser(null);
    }).catch(() => setUser(null));
  }, [load, notify]);

  const can = useCallback((perm) => !!(user && user.permissions.includes(perm)), [user]);

  const visible = useMemo(
    () => SCREENS.filter((s) => can(s.perm) || (s.alt && can(s.alt))), [can]);

  useEffect(() => {
    if (visible.length && !visible.some((s) => s.key === screen)) setScreen(visible[0].key);
  }, [visible, screen]);

  if (user === undefined) {
    return <div className="boot"><div className="boot__mark">MP</div>
      <p className="boot__text">불러오는 중입니다.</p></div>;
  }
  if (user === null) return <Login onDone={() => load()} />;
  if (!data) return <div className="boot"><div className="boot__mark">MP</div>
    <p className="boot__text">데이터를 준비하고 있습니다.</p></div>;

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
    setUser(null); setData(null);
  }

  return (
    <div className="shell">
      <nav className="side">
        <div className="side__top">
          <div className="side__logo"><span>MP</span>미수채권 관리</div>
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
            <div className="sub">거래처 {data.customers.length}곳 · 미수 합계 {won(sum(data.customers, "balance"))}원</div>
          </div>
          <div className="spacer" />
          <div className="who">
            <b>{user.name}{user.title && " " + user.title}</b>
            <span>{data.meta.roles[user.role].label} · {user.username}</span>
          </div>
          <button className="btn btn--sm" onClick={signOut}>로그아웃</button>
        </header>

        <div className="page">
          {screen === "dashboard" && <Dashboard data={data} setScreen={setScreen} setPreset={setPreset} />}
          {screen === "summary" && <BondSummary data={data} />}
          {screen === "customers" && <Customers data={data} can={can} preset={preset}
            notify={notify} patchCustomer={patchCustomer} />}
          {screen === "owners" && <Owners data={data} />}
          {screen === "collections" && <Collections data={data} can={can} notify={notify} refresh={load} />}
          {screen === "targets" && <Targets data={data} notify={notify} refresh={load} />}
          {screen === "upload" && <Upload data={data} can={can} notify={notify}
            applyUpload={applyUpload} refresh={load} />}
          {screen === "users" && <Users data={data} notify={notify} refresh={load} />}
        </div>
      </main>

      {toast && <div className={"toast" + (toast.bad ? " toast--bad" : "")}>{toast.message}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
