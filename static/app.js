const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback
} = React;

/* ══════════════════ 유틸 ══════════════════ */

const won = n => (Number(n) || 0).toLocaleString("ko-KR");
function short(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e8) return {
    value: (v / 1e8).toFixed(1),
    unit: "억"
  };
  if (Math.abs(v) >= 1e4) return {
    value: Math.round(v / 1e4).toLocaleString("ko-KR"),
    unit: "만"
  };
  return {
    value: v.toLocaleString("ko-KR"),
    unit: "원"
  };
}
const STATUS_STYLE = {
  정상: "ok",
  연체: "warn",
  부실: "bad"
};
const STATUS_LABEL = {
  정상: "정상채권",
  연체: "미수채권",
  부실: "부실채권"
};
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const sum = (list, key) => list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
const code5 = code => String(code || "").padStart(5, "0");
const overdueMonths = days => Math.ceil(Math.max(0, Number(days) || 0) / 30);
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: options.body ? {
      "Content-Type": "application/json"
    } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = {};
  try {
    data = await res.json();
  } catch (e) {/* 본문 없음 */}
  if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했습니다. (" + res.status + ")");
  return data;
}

/* ══════════════════ 공용 컴포넌트 ══════════════════ */

function Card({
  title,
  actions,
  children,
  flush
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, (title || actions) && /*#__PURE__*/React.createElement("header", {
    className: "card__head"
  }, /*#__PURE__*/React.createElement("h3", null, title), /*#__PURE__*/React.createElement("div", {
    className: "spacer"
  }), actions), /*#__PURE__*/React.createElement("div", {
    className: "card__body" + (flush ? " card__body--flush" : "")
  }, children));
}
function Empty({
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("b", null, title), children);
}
function Badge({
  status
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "badge badge--" + (STATUS_STYLE[status] || "mute")
  }, STATUS_LABEL[status] || status);
}
function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, label), children);
}

/* ══════════════════ 로그인 ══════════════════ */

function Login({
  onDone
}) {
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
      const {
        user
      } = await api("/api/login", {
        method: "POST",
        body: {
          username: loginUsername,
          password: loginPassword
        }
      });
      onDone(user);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "login"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "login__aside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "login__brand"
  }, "MEDPARK"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "login__head"
  }, "\uBBF8\uC218\uCC44\uAD8C", /*#__PURE__*/React.createElement("br", null), "\uAD00\uB9AC \uC2DC\uC2A4\uD15C"), /*#__PURE__*/React.createElement("p", {
    className: "login__sub"
  }, "\uB374\uD0C8\xB7\uBA54\uB514\uCEEC\xB7\uC5D0\uC2A4\uD14C\uD2F1 \uC138 \uC0AC\uC5C5\uBD80\uC758 \uCC44\uAD8C \uC794\uC561\uACFC \uC218\uAE08 \uC9C4\uD589\uC744 \uD55C \uD654\uBA74\uC5D0\uC11C \uBD05\uB2C8\uB2E4."), /*#__PURE__*/React.createElement("div", {
    className: "login__stat"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "3"), "\uC0AC\uC5C5\uBD80"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "9"), "\uCC44\uAD8C \uBD84\uB958"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "11"), "\uAD8C\uD55C \uAD6C\uBD84"))), /*#__PURE__*/React.createElement("div", {
    className: "login__brand",
    style: {
      opacity: .55
    }
  }, "\uB0B4\uBD80 \uC5C5\uBB34\uC6A9 \xB7 \uC678\uBD80 \uACF5\uC720 \uAE08\uC9C0")), /*#__PURE__*/React.createElement("div", {
    className: "login__panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "login__form"
  }, /*#__PURE__*/React.createElement("h2", null, "\uB85C\uADF8\uC778"), /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "\uD68C\uC0AC\uC5D0\uC11C \uBC1C\uAE09\uBC1B\uC740 \uACC4\uC815\uC73C\uB85C \uC811\uC18D\uD558\uC138\uC694."), error && /*#__PURE__*/React.createElement("div", {
    className: "alert alert--bad"
  }, error), /*#__PURE__*/React.createElement(Field, {
    label: "\uC544\uC774\uB514"
  }, /*#__PURE__*/React.createElement("input", {
    ref: usernameRef,
    className: "input",
    value: username,
    autoFocus: true,
    autoComplete: "username",
    onChange: e => setUsername(e.target.value),
    onInput: e => setUsername(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "Medpark0"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\uBE44\uBC00\uBC88\uD638"
  }, /*#__PURE__*/React.createElement("input", {
    ref: passwordRef,
    className: "input",
    type: "password",
    value: password,
    autoComplete: "current-password",
    onChange: e => setPassword(e.target.value),
    onInput: e => setPassword(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit()
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--primary",
    style: {
      width: "100%",
      marginTop: 6
    },
    onClick: submit,
    disabled: busy
  }, busy ? "확인하는 중" : "로그인"))));
}

/* ══════════════════ 대시보드 ══════════════════ */

function Dashboard({
  data,
  setScreen,
  setPreset
}) {
  const {
    customers,
    collections,
    targets
  } = data;
  const [unit, setUnit] = useState("전체");
  const [normalTopUnit, setNormalTopUnit] = useState("전체");
  const [overdueTopUnit, setOverdueTopUnit] = useState("전체");
  const scoped = useMemo(() => unit === "전체" ? customers : customers.filter(c => c.biz_unit === unit), [customers, unit]);
  const totals = useMemo(() => {
    const by = {
      정상: sum(scoped, "normal_balance"),
      연체: sum(scoped, "overdue_balance"),
      부실: sum(scoped, "bad_balance")
    };
    const cnt = {
      정상: scoped.filter(c => c.normal_balance !== 0).length,
      연체: scoped.filter(c => c.overdue_balance !== 0).length,
      부실: scoped.filter(c => c.bad_balance !== 0).length
    };
    return {
      by,
      cnt,
      all: sum(scoped, "balance")
    };
  }, [scoped]);
  const byUnit = useMemo(() => data.meta.units.map(u => {
    const rows = customers.filter(c => c.biz_unit === u);
    const g = {
      unit: u,
      정상: 0,
      연체: 0,
      부실: 0,
      count: rows.length
    };
    rows.forEach(c => {
      g.정상 += c.normal_balance;
      g.연체 += c.overdue_balance;
      g.부실 += c.bad_balance;
    });
    g.total = g.정상 + g.연체 + g.부실;
    return g;
  }), [customers, data.meta.units]);
  const approved = collections.filter(c => c.state === "approved");
  const monthly = useMemo(() => {
    const map = {};
    approved.forEach(c => {
      const m = (c.paid_at || "").slice(0, 7);
      if (!m) return;
      map[m] = map[m] || {
        month: m,
        amount: 0,
        count: 0
      };
      map[m].amount += c.amount;
      map[m].count += 1;
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
  }, [approved]);
  const normalTop5 = customers.filter(c => (normalTopUnit === "전체" || c.biz_unit === normalTopUnit) && c.normal_balance > 0).sort((a, b) => b.normal_balance - a.normal_balance).slice(0, 5);
  const overdueTop5 = customers.filter(c => (overdueTopUnit === "전체" || c.biz_unit === overdueTopUnit) && c.overdue_balance > 0).sort((a, b) => b.overdue_balance - a.overdue_balance).slice(0, 5);
  const topUnitSelect = (value, setter, label) => /*#__PURE__*/React.createElement("select", {
    className: "select",
    style: {
      width: 110,
      padding: "6px 9px"
    },
    value: value,
    onChange: e => setter(e.target.value),
    "aria-label": label
  }, ["전체", ...data.meta.units].map(u => /*#__PURE__*/React.createElement("option", {
    key: u,
    value: u
  }, u)));
  const todayStr = today();
  const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const openTargets = targets.filter(t => t.state !== "done");
  const dueToday = openTargets.filter(t => t.target_date === todayStr);
  const dueWeek = openTargets.filter(t => t.target_date > todayStr && t.target_date <= weekEnd);
  const overdueTargets = openTargets.filter(t => t.target_date < todayStr);
  const owners = useMemo(() => {
    const map = {};
    scoped.forEach(c => {
      const key = c.owner || "미지정";
      map[key] = map[key] || {
        owner: key,
        정상: 0,
        연체: 0,
        부실: 0,
        total: 0,
        count: 0
      };
      map[key].정상 += c.normal_balance;
      map[key].연체 += c.overdue_balance;
      map[key].부실 += c.bad_balance;
      map[key].total += c.balance;
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [scoped]);
  const jump = status => {
    setPreset({
      status,
      unit
    });
    setScreen("customers");
  };
  const maxUnit = Math.max(1, ...byUnit.map(g => g.total));
  const kpis = [{
    key: "전체",
    label: "전체 채권 잔액",
    value: totals.all,
    count: scoped.length,
    color: "var(--brand)"
  }, {
    key: "정상",
    label: "정상채권 잔액",
    value: totals.by.정상,
    count: totals.cnt.정상,
    color: "var(--ok)"
  }, {
    key: "연체",
    label: "미수채권(11개월 내) 잔액",
    value: totals.by.연체,
    count: totals.cnt.연체,
    color: "var(--warn)"
  }, {
    key: "부실",
    label: "부실채권(12개월 이상)",
    value: totals.by.부실,
    count: totals.cnt.부실,
    color: "var(--bad)"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "chiprow"
  }, ["전체", ...data.meta.units].map(u => /*#__PURE__*/React.createElement("button", {
    key: u,
    className: "chip",
    "aria-pressed": unit === u,
    onClick: () => setUnit(u)
  }, u))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid--kpi"
  }, kpis.map(k => {
    const s = short(k.value);
    return /*#__PURE__*/React.createElement("button", {
      key: k.key,
      className: "kpi",
      onClick: () => k.key !== "전체" && jump(k.key)
    }, /*#__PURE__*/React.createElement("div", {
      className: "kpi__label"
    }, /*#__PURE__*/React.createElement("i", {
      className: "kpi__dot",
      style: {
        background: k.color
      }
    }), k.label), /*#__PURE__*/React.createElement("div", {
      className: "kpi__value num"
    }, s.value, /*#__PURE__*/React.createElement("em", null, s.unit)), /*#__PURE__*/React.createElement("div", {
      className: "kpi__meta num"
    }, "\uAC70\uB798\uCC98 ", k.count, "\uACF3 \xB7 ", won(k.value), "\uC6D0"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid--2"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "\uC0AC\uC5C5\uBD80\uBCC4 \uCC44\uAD8C \uBD84\uB958 \uD604\uD669",
    actions: /*#__PURE__*/React.createElement("div", {
      className: "legend"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      style: {
        background: "var(--ok)"
      }
    }), "\uC815\uC0C1\uCC44\uAD8C"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      style: {
        background: "var(--warn)"
      }
    }), "\uBBF8\uC218\uCC44\uAD8C"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
      style: {
        background: "var(--bad)"
      }
    }), "\uBD80\uC2E4\uCC44\uAD8C"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "signal"
  }, byUnit.map(g => /*#__PURE__*/React.createElement("div", {
    className: "signal__row",
    key: g.unit
  }, /*#__PURE__*/React.createElement("div", {
    className: "signal__unit"
  }, g.unit), /*#__PURE__*/React.createElement("div", {
    className: "signal__bar",
    style: {
      width: Math.max(8, g.total / maxUnit * 100) + "%"
    }
  }, ["정상", "연체", "부실"].map(s => g[s] > 0 && /*#__PURE__*/React.createElement("button", {
    key: s,
    className: "signal__seg signal__seg--" + STATUS_STYLE[s],
    style: {
      width: g[s] / g.total * 100 + "%"
    },
    title: g.unit + " " + STATUS_LABEL[s] + " " + won(g[s]) + "원",
    onClick: () => {
      setPreset({
        status: s,
        unit: g.unit
      });
      setScreen("customers");
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "signal__total num"
  }, short(g.total).value, short(g.total).unit)))), /*#__PURE__*/React.createElement("p", {
    className: "t-sm t-muted",
    style: {
      margin: "14px 0 0"
    }
  }, "\uB9C9\uB300\uB97C \uB204\uB974\uBA74 \uD574\uB2F9 \uC0AC\uC5C5\uBD80\xB7\uBD84\uB958\uC758 \uAC70\uB798\uCC98 \uBAA9\uB85D\uC73C\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.")), /*#__PURE__*/React.createElement(Card, {
    title: "\uC6D4\uBCC4 \uC218\uAE08 \uC2E4\uC801",
    flush: true
  }, monthly.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "\uC2B9\uC778\uB41C \uC218\uAE08 \uB0B4\uC5ED\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4."
  }, "\uC218\uAE08 \uB4F1\uB85D \uD654\uBA74\uC5D0\uC11C \uC785\uB825\uD558\uACE0 \uC7AC\uBB34\uB2F4\uB2F9\uC774 \uC2B9\uC778\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uC9D1\uACC4\uB429\uB2C8\uB2E4.") : /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uAE30\uC900\uC6D4"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uAC74\uC218"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uC218\uAE08\uC561 (\uC6D0)"))), /*#__PURE__*/React.createElement("tbody", null, monthly.map(m => /*#__PURE__*/React.createElement("tr", {
    key: m.month
  }, /*#__PURE__*/React.createElement("td", {
    className: "t-strong num"
  }, m.month), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, m.count), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, won(m.amount))))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "\uD569\uACC4"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, sum(monthly, "count")), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(monthly, "amount"))))))))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid--3"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "\uC218\uAE08\uBAA9\uD45C \uC694\uC57D"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uAD6C\uBD84"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uAC74\uC218"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uBAA9\uD45C\uAE08\uC561 (\uC6D0)"))), /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "\uC624\uB298 \uBAA9\uD45C"), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, dueToday.length), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(dueToday, "amount")))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "\uC774\uBC88 \uC8FC \uBAA9\uD45C"), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, dueWeek.length), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(dueWeek, "amount")))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "\uAE30\uD55C \uCD08\uACFC"), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong",
    style: {
      color: overdueTargets.length ? "var(--bad)" : "inherit"
    }
  }, overdueTargets.length), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(overdueTargets, "amount")))))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    style: {
      marginTop: 12
    },
    onClick: () => setScreen("targets")
  }, "\uC218\uAE08\uBAA9\uD45C \uAD00\uB9AC\uB85C \uC774\uB3D9")), /*#__PURE__*/React.createElement(Card, {
    title: "\uC815\uC0C1\uCC44\uAD8C TOP 5",
    actions: topUnitSelect(normalTopUnit, setNormalTopUnit, "정상채권 사업부 선택"),
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("tbody", null, normalTop5.map((c, i) => /*#__PURE__*/React.createElement("tr", {
    key: c.code
  }, /*#__PURE__*/React.createElement("td", {
    className: "t-muted num",
    style: {
      width: 26
    }
  }, i + 1), /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, c.name), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    status: "\uC815\uC0C1"
  })), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(c.normal_balance)))), normalTop5.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "t-muted"
  }, "\uC815\uC0C1\uCC44\uAD8C \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")))))), /*#__PURE__*/React.createElement(Card, {
    title: "\uBBF8\uC218\uCC44\uAD8C TOP 5",
    actions: topUnitSelect(overdueTopUnit, setOverdueTopUnit, "미수채권 사업부 선택"),
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("tbody", null, overdueTop5.map((c, i) => /*#__PURE__*/React.createElement("tr", {
    key: c.code
  }, /*#__PURE__*/React.createElement("td", {
    className: "t-muted num",
    style: {
      width: 26
    }
  }, i + 1), /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, c.name), /*#__PURE__*/React.createElement("td", {
    className: "num t-sm t-muted"
  }, overdueMonths(c.overdue_days), "\uAC1C\uC6D4"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(c.overdue_balance)))), overdueTop5.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "t-muted"
  }, "\uBBF8\uC218\uCC44\uAD8C \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."))))))), /*#__PURE__*/React.createElement(Card, {
    title: "\uB2F4\uB2F9\uC790\uBCC4 \uCC44\uAD8C \uD604\uD669",
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uB2F4\uB2F9\uC790"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uAC70\uB798\uCC98"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uC815\uC0C1\uCC44\uAD8C"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uBBF8\uC218\uCC44\uAD8C"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uBD80\uC2E4\uCC44\uAD8C"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uD569\uACC4"), /*#__PURE__*/React.createElement("th", {
    style: {
      width: 150
    }
  }, "\uBBF8\uC218\xB7\uBD80\uC2E4\uCC44\uAD8C \uBE44\uC911"))), /*#__PURE__*/React.createElement("tbody", null, owners.map(o => {
    const risk = o.total ? (o.연체 + o.부실) / o.total * 100 : 0;
    return /*#__PURE__*/React.createElement("tr", {
      key: o.owner
    }, /*#__PURE__*/React.createElement("td", {
      className: "t-strong"
    }, o.owner), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, o.count), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, won(o.정상)), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, won(o.연체)), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, won(o.부실)), /*#__PURE__*/React.createElement("td", {
      className: "r num t-strong"
    }, won(o.total)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar"
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: risk + "%",
        background: risk > 40 ? "var(--bad)" : risk > 15 ? "var(--warn)" : "var(--ok)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "t-sm num t-muted"
    }, risk.toFixed(0), "%"))));
  }))))));
}

/* ══════════════════ 채권요약현황 ══════════════════ */

function BondSummary({
  data
}) {
  const unitNames = {
    덴탈: "국내덴탈",
    메디컬: "국내메디컬",
    에스테틱: "국내에스테틱"
  };
  const units = data.meta.units;
  function liveNormal(c) {
    const source = {
      later: Number(c.normal_later_balance) || 0,
      next: Number(c.normal_next_balance) || 0,
      current: Number(c.normal_current_balance) || 0
    };
    let paid = Math.max(0, source.later + source.next + source.current - (Number(c.normal_balance) || 0));
    const current = Math.max(0, source.current - paid);
    paid = Math.max(0, paid - source.current);
    const next = Math.max(0, source.next - paid);
    paid = Math.max(0, paid - source.next);
    const later = Math.max(0, source.later - paid);
    return {
      later,
      next,
      current
    };
  }
  const summary = useMemo(() => units.map(unit => {
    const customers = data.customers.filter(c => c.biz_unit === unit);
    const row = {
      unit,
      later: 0,
      next: 0,
      current: 0,
      overdue: 0,
      bad: 0,
      normalCollected: 0,
      overdueCollected: 0
    };
    customers.forEach(c => {
      const live = liveNormal(c);
      row.later += live.later;
      row.next += live.next;
      row.current += live.current;
      row.overdue += Number(c.overdue_balance) || 0;
      row.bad += Number(c.bad_balance) || 0;
      const normalSource = (Number(c.normal_later_balance) || 0) + (Number(c.normal_next_balance) || 0) + (Number(c.normal_current_balance) || 0);
      row.normalCollected += (Number(c.normal_collected) || 0) + Math.max(0, normalSource - (Number(c.normal_balance) || 0));
      row.overdueCollected += (Number(c.overdue_collected) || 0) + Math.max(0, (Number(c.overdue_source_balance) || 0) - (Number(c.overdue_balance) || 0));
    });
    row.normal = row.later + row.next + row.current;
    row.total = row.normal + row.overdue + row.bad;
    return row;
  }), [data.customers, units]);
  const total = key => sum(summary, key);
  const rate = (value, base) => base ? (value / base * 100).toFixed(1) + "%" : "0.0%";
  const sourceMonth = data.uploads[0] && data.uploads[0].month || thisMonth();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    title: "1. 사업부별 채권 분류 현황 (" + sourceMonth + " 기준)",
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap summary-table"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    rowSpan: "2"
  }, "\uC0AC\uC5C5\uBD80"), /*#__PURE__*/React.createElement("th", {
    colSpan: "4",
    className: "summary-head summary-head--normal"
  }, "\uC815\uC0C1\uCC44\uAD8C"), /*#__PURE__*/React.createElement("th", {
    rowSpan: "2",
    className: "summary-head summary-head--overdue"
  }, "\uBBF8\uC218\uCC44\uAD8C"), /*#__PURE__*/React.createElement("th", {
    rowSpan: "2",
    className: "summary-head summary-head--bad"
  }, "\uBD80\uC2E4\uCC44\uAD8C"), /*#__PURE__*/React.createElement("th", {
    rowSpan: "2",
    className: "summary-head summary-head--total"
  }, "\uD569\uACC4"), /*#__PURE__*/React.createElement("th", {
    rowSpan: "2",
    className: "summary-head summary-head--total"
  }, "\uBBF8\uC218\uCC44\uAD8C \uBE44\uC911")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "10\uC6D4 \uC774\uD6C4"), /*#__PURE__*/React.createElement("th", null, "9\uC6D4 \uBD84"), /*#__PURE__*/React.createElement("th", null, "8\uC6D4 \uBD84(\uB2F9\uC6D4)"), /*#__PURE__*/React.createElement("th", null, "[\uC18C\uACC4]"))), /*#__PURE__*/React.createElement("tbody", null, summary.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.unit
  }, /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, unitNames[r.unit]), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-normal"
  }, won(r.later)), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-normal"
  }, won(r.next)), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-normal"
  }, won(r.current)), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-subtotal"
  }, won(r.normal)), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-overdue"
  }, won(r.overdue)), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-bad"
  }, won(r.bad)), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, won(r.total)), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, rate(r.overdue, r.total))))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "\uD569\uACC4"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("later"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("next"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("current"))), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-subtotal"
  }, won(total("normal"))), /*#__PURE__*/React.createElement("td", {
    className: "r num summary-overdue"
  }, won(total("overdue"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("bad"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("total"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, rate(total("overdue"), total("total"))))))), /*#__PURE__*/React.createElement("div", {
    className: "summary-note"
  }, "\uD604\uC7AC \uC6B4\uC601 \uAE30\uCD08\uC790\uB8CC ", data.customers.length, "\uAC1C \uAC70\uB798\uCC98 \uAE30\uC900 \xB7 \uAE08\uC561 \uB2E8\uC704: \uC6D0")), /*#__PURE__*/React.createElement(Card, {
    title: "2. " + Number(sourceMonth.slice(5, 7)) + "월 수금실적",
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap summary-table"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    rowSpan: "2"
  }, "\uC0AC\uC5C5\uBD80"), /*#__PURE__*/React.createElement("th", {
    colSpan: "4",
    className: "summary-head summary-head--normal"
  }, "\uC815\uC0C1\uCC44\uAD8C (\uB2F9\uC6D4\uBD84)"), /*#__PURE__*/React.createElement("th", {
    colSpan: "4",
    className: "summary-head summary-head--overdue"
  }, "\uBBF8\uC218\uCC44\uAD8C (\uBD80\uC2E4\uCC44\uAD8C \uC81C\uC678)")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uAE30\uCD08"), /*#__PURE__*/React.createElement("th", null, "\uC218\uAE08\uC561"), /*#__PURE__*/React.createElement("th", null, "\uC794\uC561"), /*#__PURE__*/React.createElement("th", null, "\uD68C\uC218\uC728"), /*#__PURE__*/React.createElement("th", null, "\uAE30\uCD08"), /*#__PURE__*/React.createElement("th", null, "\uC218\uAE08\uC561"), /*#__PURE__*/React.createElement("th", null, "\uC794\uC561"), /*#__PURE__*/React.createElement("th", null, "\uD68C\uC218\uC728"))), /*#__PURE__*/React.createElement("tbody", null, summary.map(r => {
    const normalOpening = r.current + r.normalCollected;
    const overdueOpening = r.overdue + r.overdueCollected;
    return /*#__PURE__*/React.createElement("tr", {
      key: r.unit
    }, /*#__PURE__*/React.createElement("td", {
      className: "t-strong"
    }, unitNames[r.unit]), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, won(normalOpening)), /*#__PURE__*/React.createElement("td", {
      className: "r num summary-normal"
    }, won(r.normalCollected)), /*#__PURE__*/React.createElement("td", {
      className: "r num summary-subtotal"
    }, won(r.current)), /*#__PURE__*/React.createElement("td", {
      className: "r num t-strong"
    }, rate(r.normalCollected, normalOpening)), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, won(overdueOpening)), /*#__PURE__*/React.createElement("td", {
      className: "r num summary-overdue"
    }, won(r.overdueCollected)), /*#__PURE__*/React.createElement("td", {
      className: "r num summary-subtotal"
    }, won(r.overdue)), /*#__PURE__*/React.createElement("td", {
      className: "r num t-strong"
    }, rate(r.overdueCollected, overdueOpening)));
  })), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "\uD569\uACC4"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("current") + total("normalCollected"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("normalCollected"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("current"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, rate(total("normalCollected"), total("current") + total("normalCollected"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("overdue") + total("overdueCollected"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("overdueCollected"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(total("overdue"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, rate(total("overdueCollected"), total("overdue") + total("overdueCollected")))))))));
}

/* ══════════════════ 거래처별 현황 ══════════════════ */

function InlineEdit({
  value,
  type = "text",
  placeholder,
  canEdit,
  onSave
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);
  async function commit() {
    setEditing(false);
    if (draft === (value || "")) return;
    await onSave(draft);
  }
  if (!editing) return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "inline-edit",
    disabled: !canEdit,
    onClick: () => canEdit && setEditing(true)
  }, value || /*#__PURE__*/React.createElement("span", {
    className: "t-muted"
  }, placeholder));
  return /*#__PURE__*/React.createElement("input", {
    className: "input input--compact",
    type: type,
    value: draft,
    autoFocus: true,
    onChange: e => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: e => {
      if (e.key === "Enter") e.currentTarget.blur();
      if (e.key === "Escape") setEditing(false);
    }
  });
}
function Customers({
  data,
  can,
  preset,
  notify,
  patchCustomer
}) {
  const [unit, setUnit] = useState(preset && preset.unit || "전체");
  const [type, setType] = useState(preset && preset.status || "전체");
  const [q, setQ] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [draftNote, setDraftNote] = useState("");
  useEffect(() => {
    if (preset) {
      setUnit(preset.unit);
      setType(preset.status);
    }
  }, [preset]);
  const rows = useMemo(() => data.customers.flatMap(c => {
    const parts = [{
      status: "정상",
      balance: Number(c.normal_balance) || 0,
      months: 0
    }, {
      status: "연체",
      balance: Number(c.overdue_balance) || 0,
      months: overdueMonths(c.overdue_days)
    }, {
      status: "부실",
      balance: Number(c.bad_balance) || 0,
      months: overdueMonths(c.overdue_days)
    }].filter(part => part.balance !== 0);
    return parts.map((part, index) => ({
      ...c,
      ...part,
      advance: index === 0 ? c.advance : 0,
      rowKey: c.code + "-" + part.status
    }));
  }).filter(c => {
    if (unit !== "전체" && c.biz_unit !== unit) return false;
    if (type !== "전체" && c.status !== type) return false;
    if (q && !(c.name.includes(q) || c.code.includes(q) || code5(c.code).includes(q) || (c.owner || "").includes(q))) return false;
    return true;
  }), [data.customers, unit, type, q]);
  async function updateCustomer(code, body, message) {
    try {
      const {
        customer
      } = await api("/api/customers/" + encodeURIComponent(code), {
        method: "PATCH",
        body
      });
      patchCustomer(customer);
      notify(message);
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function saveNote(code) {
    await updateCustomer(code, {
      note: draftNote
    }, "비고를 저장했습니다.");
    setEditingNote(null);
  }
  const distinctCustomers = new Set(rows.map(r => r.code)).size;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    title: "\uC870\uD68C \uC870\uAC74"
  }, /*#__PURE__*/React.createElement("div", {
    className: "customer-filters"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\uC0AC\uC5C5\uBD80\uBCC4 \uD544\uD130"
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: unit,
    onChange: e => setUnit(e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "\uC804\uCCB4"), data.meta.units.map(u => /*#__PURE__*/React.createElement("option", {
    key: u
  }, u)))), /*#__PURE__*/React.createElement(Field, {
    label: "\uCC44\uAD8C\uC720\uD615\uBCC4 \uD544\uD130"
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: type,
    onChange: e => setType(e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "\uC804\uCCB4"), data.meta.statuses.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, STATUS_LABEL[s])))), /*#__PURE__*/React.createElement(Field, {
    label: "\uAC70\uB798\uCC98 \uAC80\uC0C9"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: q,
    placeholder: "\uAC70\uB798\uCC98\uBA85\xB7\uCF54\uB4DC\xB7\uB2F4\uB2F9\uC790",
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    onClick: () => {
      setUnit("전체");
      setType("전체");
      setQ("");
    }
  }, "\uCD08\uAE30\uD654"))), /*#__PURE__*/React.createElement(Card, {
    title: (STATUS_LABEL[type] || type) + " · 거래처 " + distinctCustomers + "곳 / 채권 " + rows.length + "건",
    flush: true
  }, rows.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uCC44\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
  }, "\uC0C1\uB2E8 \uD544\uD130\uB098 \uAC80\uC0C9\uC5B4\uB97C \uBC14\uAFD4\uBCF4\uC138\uC694.") : /*#__PURE__*/React.createElement("div", {
    className: "tablewrap customer-table"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uCF54\uB4DC"), /*#__PURE__*/React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"), /*#__PURE__*/React.createElement("th", null, "\uC0AC\uC5C5\uBD80"), /*#__PURE__*/React.createElement("th", null, "\uCC44\uAD8C\uC720\uD615"), /*#__PURE__*/React.createElement("th", null, "\uB2F4\uB2F9\uC790"), /*#__PURE__*/React.createElement("th", null, "\uC218\uAE08\uBAA9\uD45C\uC77C"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uCC44\uAD8C\uC794\uC561"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uC120\uC218\uAE08"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uC5F0\uCCB4\uAE30\uAC04(\uAC1C\uC6D4)"), /*#__PURE__*/React.createElement("th", null, "\uCD5C\uC885\uC218\uAE08\uC77C"), /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: 180
    }
  }, "\uBE44\uACE0"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.rowKey
  }, /*#__PURE__*/React.createElement("td", {
    className: "num t-muted"
  }, code5(c.code)), /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, c.name), /*#__PURE__*/React.createElement("td", null, c.biz_unit), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    status: c.status
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(InlineEdit, {
    value: c.owner,
    placeholder: "\uD074\uB9AD\uD574 \uC785\uB825",
    canEdit: can("note_edit"),
    onSave: owner => updateCustomer(c.code, {
      owner
    }, "담당자를 저장했습니다.")
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(InlineEdit, {
    value: c.collection_target_date,
    placeholder: "\uB0A0\uC9DC \uC120\uD0DD",
    type: "date",
    canEdit: can("note_edit"),
    onSave: collection_target_date => updateCustomer(c.code, {
      collection_target_date
    }, "수금목표일을 저장했습니다.")
  })), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, won(c.balance)), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, c.advance ? won(c.advance) : "–"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, c.months, "\uAC1C\uC6D4"), /*#__PURE__*/React.createElement("td", {
    className: "num t-muted t-sm"
  }, c.last_paid_at || "–"), /*#__PURE__*/React.createElement("td", {
    style: {
      whiteSpace: "normal"
    }
  }, editingNote === c.rowKey ? /*#__PURE__*/React.createElement("div", {
    className: "inline-note"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: draftNote,
    autoFocus: true,
    onChange: e => setDraftNote(e.target.value),
    onKeyDown: e => e.key === "Enter" && saveNote(c.code)
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm btn--primary",
    onClick: () => saveNote(c.code)
  }, "\uC800\uC7A5"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    onClick: () => setEditingNote(null)
  }, "\uCDE8\uC18C")) : /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "inline-edit",
    disabled: !can("note_edit"),
    onClick: () => {
      setEditingNote(c.rowKey);
      setDraftNote(c.note || "");
    }
  }, c.note || /*#__PURE__*/React.createElement("span", {
    className: "t-muted"
  }, "\uD074\uB9AD\uD574 \uC785\uB825")))))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 6
  }, "\uD569\uACC4 \xB7 \uAC70\uB798\uCC98 ", distinctCustomers, "\uACF3 / \uCC44\uAD8C ", rows.length, "\uAC74"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(rows, "balance"))), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(rows, "advance"))), /*#__PURE__*/React.createElement("td", {
    colSpan: 3
  })))))));
}

/* ══════════════════ 담당자별 채권현황 ══════════════════ */

function Owners({
  data
}) {
  const [owner, setOwner] = useState("전체");
  const list = useMemo(() => {
    const map = {};
    data.customers.forEach(c => {
      const k = c.owner || "미지정";
      map[k] = map[k] || {
        owner: k,
        rows: [],
        total: 0,
        정상: 0,
        연체: 0,
        부실: 0
      };
      map[k].rows.push(c);
      map[k].total += c.balance;
      map[k][c.status] += c.balance;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [data.customers]);
  const active = owner === "전체" ? null : list.find(o => o.owner === owner);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "chiprow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "chip",
    "aria-pressed": owner === "전체",
    onClick: () => setOwner("전체")
  }, "\uC804\uCCB4"), list.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.owner,
    className: "chip",
    "aria-pressed": owner === o.owner,
    onClick: () => setOwner(o.owner)
  }, o.owner, " (", o.rows.length, ")"))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid--3"
  }, (active ? [active] : list).map(o => /*#__PURE__*/React.createElement(Card, {
    key: o.owner,
    title: o.owner
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi__value num",
    style: {
      marginTop: 0
    }
  }, short(o.total).value, /*#__PURE__*/React.createElement("em", null, short(o.total).unit)), /*#__PURE__*/React.createElement("div", {
    className: "kpi__meta num",
    style: {
      marginBottom: 12
    }
  }, "\uAC70\uB798\uCC98 ", o.rows.length, "\uACF3 \xB7 ", won(o.total), "\uC6D0"), /*#__PURE__*/React.createElement("div", {
    className: "signal__bar"
  }, ["정상", "연체", "부실"].map(s => o[s] > 0 && /*#__PURE__*/React.createElement("div", {
    key: s,
    className: "signal__seg signal__seg--" + STATUS_STYLE[s],
    style: {
      width: o[s] / o.total * 100 + "%"
    },
    title: STATUS_LABEL[s] + " " + won(o[s])
  })))))), active && /*#__PURE__*/React.createElement(Card, {
    title: active.owner + " 담당 거래처",
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uCF54\uB4DC"), /*#__PURE__*/React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"), /*#__PURE__*/React.createElement("th", null, "\uC0AC\uC5C5\uBD80"), /*#__PURE__*/React.createElement("th", null, "\uBD84\uB958"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uCC44\uAD8C\uC794\uC561"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uC5F0\uCCB4\uAE30\uAC04(\uAC1C\uC6D4)"), /*#__PURE__*/React.createElement("th", null, "\uBE44\uACE0"))), /*#__PURE__*/React.createElement("tbody", null, [...active.rows].sort((a, b) => b.balance - a.balance).map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.code
  }, /*#__PURE__*/React.createElement("td", {
    className: "num t-muted"
  }, code5(c.code)), /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, c.name), /*#__PURE__*/React.createElement("td", null, c.biz_unit), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    status: c.status
  })), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, won(c.balance)), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, overdueMonths(c.overdue_days), "\uAC1C\uC6D4"), /*#__PURE__*/React.createElement("td", {
    className: "t-sm t-muted",
    style: {
      whiteSpace: "normal"
    }
  }, c.note || "–")))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 4
  }, "\uD569\uACC4"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(active.total)), /*#__PURE__*/React.createElement("td", {
    colSpan: 2
  })))))));
}

/* ══════════════════ 수금 등록 ══════════════════ */

function CustomerSearch({
  customers,
  value,
  onChange
}) {
  const selected = customers.find(c => c.code === value);
  const [query, setQuery] = useState(selected ? selected.name : "");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return customers.filter(c => !keyword || c.name.toLowerCase().includes(keyword) || String(c.code).toLowerCase().includes(keyword) || code5(c.code).includes(keyword)).slice(0, 12);
  }, [customers, query]);
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);
  function choose(customer) {
    onChange(customer.code);
    setQuery(customer.name);
    setOpen(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "customer-search"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: query,
    placeholder: "\uAC70\uB798\uCC98\uBA85 \uB610\uB294 \uCF54\uB4DC \uAC80\uC0C9",
    role: "combobox",
    "aria-expanded": open,
    "aria-autocomplete": "list",
    onFocus: () => setOpen(true),
    onBlur: () => setTimeout(() => setOpen(false), 150),
    onChange: e => {
      setQuery(e.target.value);
      onChange("");
      setOpen(true);
    }
  }), open && /*#__PURE__*/React.createElement("div", {
    className: "customer-search__menu",
    role: "listbox"
  }, matches.map(c => /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "option",
    key: c.code,
    className: "customer-search__option",
    onMouseDown: e => e.preventDefault(),
    onClick: () => choose(c)
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, c.name), /*#__PURE__*/React.createElement("small", null, code5(c.code), " \xB7 ", c.biz_unit)), /*#__PURE__*/React.createElement("strong", {
    className: "num"
  }, won(c.balance), "\uC6D0"))), matches.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "customer-search__empty"
  }, "\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")));
}
function Collections({
  data,
  can,
  notify,
  refresh
}) {
  const [form, setForm] = useState({
    customer_code: "",
    amount: "",
    method: "계좌수금",
    paid_at: today(),
    note: ""
  });
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm({
    ...form,
    [k]: e.target.value
  });
  const pending = data.collections.filter(c => c.state === "pending");
  const decided = data.collections.filter(c => c.state !== "pending").slice(0, 40);
  const target = data.customers.find(c => c.code === form.customer_code);
  async function register() {
    setBusy(true);
    try {
      await api("/api/collections", {
        method: "POST",
        body: form
      });
      notify("수금 건을 등록했습니다. 재무담당 승인 후 잔액에 반영됩니다.");
      setForm({
        ...form,
        customer_code: "",
        amount: "",
        note: ""
      });
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
    setBusy(false);
  }
  async function decide(id, action) {
    try {
      const body = action === "reject" ? {
        reason: prompt("반려 사유를 입력하세요.") || ""
      } : {};
      await api("/api/collections/" + id + "/" + action, {
        method: "POST",
        body
      });
      notify(action === "approve" ? "승인했습니다. 잔액이 갱신되었습니다." : "반려했습니다.");
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, can("collection_register") && /*#__PURE__*/React.createElement(Card, {
    title: "\uC218\uAE08 \uB4F1\uB85D"
  }, /*#__PURE__*/React.createElement("div", {
    className: "formrow"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\uAC70\uB798\uCC98"
  }, /*#__PURE__*/React.createElement(CustomerSearch, {
    customers: data.customers,
    value: form.customer_code,
    onChange: code => setForm({
      ...form,
      customer_code: code
    })
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\uC218\uAE08\uC561 (\uC6D0)"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input num",
    inputMode: "numeric",
    value: form.amount,
    onChange: set("amount"),
    placeholder: "0"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\uC218\uAE08\uBC29\uBC95"
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: form.method,
    onChange: set("method")
  }, data.meta.methods.map(m => /*#__PURE__*/React.createElement("option", {
    key: m
  }, m)))), /*#__PURE__*/React.createElement(Field, {
    label: "\uC218\uAE08\uC77C"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    type: "date",
    value: form.paid_at,
    onChange: set("paid_at")
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "\uBE44\uACE0"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: form.note,
    onChange: set("note"),
    placeholder: "\uC785\uAE08\uC790\uBA85, \uBD84\uD560 \uD68C\uCC28 \uB4F1"
  })), target && Number(form.amount) > target.balance && /*#__PURE__*/React.createElement("div", {
    className: "alert alert--warn"
  }, "\uC785\uB825\uD55C \uC218\uAE08\uC561\uC774 \uD604\uC7AC \uBBF8\uC218\uC794\uC561(", won(target.balance), "\uC6D0)\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4. \uAE08\uC561\uC744 \uD655\uC778\uD558\uC138\uC694."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--primary",
    onClick: register,
    disabled: busy || !form.customer_code || !form.amount
  }, "\uC2B9\uC778 \uC694\uCCAD\uC73C\uB85C \uB4F1\uB85D")), /*#__PURE__*/React.createElement(Card, {
    title: "승인 대기 " + pending.length + "건",
    flush: true
  }, pending.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "\uB300\uAE30 \uC911\uC778 \uC218\uAE08 \uAC74\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
  }, "\uC601\uC5C5\uB2F4\uB2F9\uC774 \uB4F1\uB85D\uD558\uBA74 \uC774\uACF3\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.") : /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uB4F1\uB85D\uC77C"), /*#__PURE__*/React.createElement("th", null, "\uAC70\uB798\uCC98"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uC218\uAE08\uC561"), /*#__PURE__*/React.createElement("th", null, "\uBC29\uBC95"), /*#__PURE__*/React.createElement("th", null, "\uC218\uAE08\uC77C"), /*#__PURE__*/React.createElement("th", null, "\uB4F1\uB85D\uC790"), /*#__PURE__*/React.createElement("th", null, "\uBE44\uACE0"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, pending.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "t-sm t-muted num"
  }, (c.created_at || "").slice(0, 10)), /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, c.customer_name), /*#__PURE__*/React.createElement("td", {
    className: "r num t-strong"
  }, won(c.amount)), /*#__PURE__*/React.createElement("td", null, c.method), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, c.paid_at), /*#__PURE__*/React.createElement("td", null, c.registered_by), /*#__PURE__*/React.createElement("td", {
    className: "t-sm t-muted",
    style: {
      whiteSpace: "normal"
    }
  }, c.note || "–"), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, can("collection_approve") ? /*#__PURE__*/React.createElement("div", {
    className: "btnrow",
    style: {
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm btn--ok",
    onClick: () => decide(c.id, "approve")
  }, "\uC2B9\uC778"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm btn--danger",
    onClick: () => decide(c.id, "reject")
  }, "\uBC18\uB824")) : /*#__PURE__*/React.createElement("span", {
    className: "badge badge--mute"
  }, "\uC2B9\uC778 \uB300\uAE30"))))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 2
  }, "\uB300\uAE30 \uD569\uACC4"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(pending, "amount"))), /*#__PURE__*/React.createElement("td", {
    colSpan: 5
  })))))), /*#__PURE__*/React.createElement(Card, {
    title: "\uCC98\uB9AC \uB0B4\uC5ED",
    flush: true
  }, decided.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "\uCC98\uB9AC\uB41C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
  }) : /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uC0C1\uD0DC"), /*#__PURE__*/React.createElement("th", null, "\uAC70\uB798\uCC98"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uC218\uAE08\uC561"), /*#__PURE__*/React.createElement("th", null, "\uBC29\uBC95"), /*#__PURE__*/React.createElement("th", null, "\uC218\uAE08\uC77C"), /*#__PURE__*/React.createElement("th", null, "\uB4F1\uB85D\uC790"), /*#__PURE__*/React.createElement("th", null, "\uCC98\uB9AC\uC790"), /*#__PURE__*/React.createElement("th", null, "\uC0AC\uC720\xB7\uBE44\uACE0"))), /*#__PURE__*/React.createElement("tbody", null, decided.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "badge badge--" + (c.state === "approved" ? "ok" : "bad")
  }, c.state === "approved" ? "승인" : "반려")), /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, c.customer_name), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(c.amount)), /*#__PURE__*/React.createElement("td", null, c.method), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, c.paid_at), /*#__PURE__*/React.createElement("td", null, c.registered_by), /*#__PURE__*/React.createElement("td", null, c.approved_by), /*#__PURE__*/React.createElement("td", {
    className: "t-sm t-muted",
    style: {
      whiteSpace: "normal"
    }
  }, c.reject_reason || c.note || "–"))))))));
}

/* ══════════════════ 수금목표 관리 ══════════════════ */

function Targets({
  data,
  notify,
  refresh
}) {
  const blank = {
    customer_code: "",
    amount: "",
    target_date: today(),
    method: "계좌수금",
    assignee: "",
    note: ""
  };
  const [form, setForm] = useState(blank);
  const set = k => e => setForm({
    ...form,
    [k]: e.target.value
  });
  const [filter, setFilter] = useState("진행");
  const rows = data.targets.filter(t => filter === "전체" ? true : filter === "완료" ? t.state === "done" : t.state !== "done");
  async function create() {
    try {
      await api("/api/targets", {
        method: "POST",
        body: form
      });
      setForm(blank);
      notify("수금목표를 추가했습니다.");
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function patch(id, body) {
    try {
      await api("/api/targets/" + id, {
        method: "PATCH",
        body
      });
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function remove(id) {
    if (!confirm("이 목표를 삭제할까요?")) return;
    try {
      await api("/api/targets/" + id, {
        method: "DELETE"
      });
      notify("삭제했습니다.");
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    title: "\uC218\uAE08\uBAA9\uD45C \uCD94\uAC00"
  }, /*#__PURE__*/React.createElement("div", {
    className: "formrow"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\uAC70\uB798\uCC98"
  }, /*#__PURE__*/React.createElement(CustomerSearch, {
    customers: data.customers,
    value: form.customer_code,
    onChange: code => setForm({
      ...form,
      customer_code: code
    })
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\uBAA9\uD45C\uAE08\uC561 (\uC6D0)"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input num",
    inputMode: "numeric",
    value: form.amount,
    onChange: set("amount")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\uBAA9\uD45C\uC77C"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    type: "date",
    value: form.target_date,
    onChange: set("target_date")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\uC218\uAE08\uBC29\uBC95"
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: form.method,
    onChange: set("method")
  }, data.meta.methods.map(m => /*#__PURE__*/React.createElement("option", {
    key: m
  }, m)))), /*#__PURE__*/React.createElement(Field, {
    label: "\uB2F4\uB2F9\uC790"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: form.assignee,
    onChange: set("assignee"),
    placeholder: "\uC774\uB984"
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "\uBE44\uACE0"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: form.note,
    onChange: set("note"),
    placeholder: "\uC57D\uC18D \uB0B4\uC6A9, \uC5F0\uB77D \uACB0\uACFC \uB4F1"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--primary",
    onClick: create,
    disabled: !form.customer_code || !form.target_date
  }, "\uBAA9\uD45C \uCD94\uAC00")), /*#__PURE__*/React.createElement(Card, {
    title: "수금목표 " + rows.length + "건",
    flush: true,
    actions: /*#__PURE__*/React.createElement("div", {
      className: "chiprow"
    }, ["진행", "완료", "전체"].map(f => /*#__PURE__*/React.createElement("button", {
      key: f,
      className: "chip",
      "aria-pressed": filter === f,
      onClick: () => setFilter(f)
    }, f)))
  }, rows.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "\uB4F1\uB85D\uB41C \uBAA9\uD45C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
  }, "\uC704\uC5D0\uC11C \uCCAB \uBAA9\uD45C\uB97C \uCD94\uAC00\uD558\uC138\uC694.") : /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uBAA9\uD45C\uC77C"), /*#__PURE__*/React.createElement("th", null, "\uAC70\uB798\uCC98"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uBAA9\uD45C\uAE08\uC561"), /*#__PURE__*/React.createElement("th", null, "\uC218\uAE08\uBC29\uBC95"), /*#__PURE__*/React.createElement("th", null, "\uB2F4\uB2F9\uC790"), /*#__PURE__*/React.createElement("th", null, "\uC644\uB8CC\uC77C"), /*#__PURE__*/React.createElement("th", null, "\uBE44\uACE0"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, rows.map(t => {
    const late = t.state !== "done" && t.target_date < today();
    return /*#__PURE__*/React.createElement("tr", {
      key: t.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "num",
      style: {
        color: late ? "var(--bad)" : "inherit",
        fontWeight: late ? 600 : 400
      }
    }, t.target_date, late && " ⚠"), /*#__PURE__*/React.createElement("td", {
      className: "t-strong"
    }, t.customer_name), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, won(t.amount)), /*#__PURE__*/React.createElement("td", null, t.method || "–"), /*#__PURE__*/React.createElement("td", null, t.assignee || "–"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("input", {
      className: "input num",
      type: "date",
      style: {
        width: 148
      },
      value: t.done_date || "",
      onChange: e => patch(t.id, {
        done_date: e.target.value
      })
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        whiteSpace: "normal",
        minWidth: 180
      }
    }, /*#__PURE__*/React.createElement("input", {
      className: "input",
      defaultValue: t.note,
      onBlur: e => e.target.value !== t.note && patch(t.id, {
        note: e.target.value
      })
    })), /*#__PURE__*/React.createElement("td", {
      className: "r"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn--sm btn--danger",
      onClick: () => remove(t.id)
    }, "\uC0AD\uC81C")));
  })), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 2
  }, "\uD569\uACC4"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(sum(rows, "amount"))), /*#__PURE__*/React.createElement("td", {
    colSpan: 5
  })))))));
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
  note: ["비고", "특이사항", "메모"]
};
function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const clean = String(h || "").replace(/\s/g, "");
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[field] !== undefined) continue;
      if (aliases.some(a => clean === a.replace(/\s/g, "") || clean.includes(a.replace(/\s/g, "")))) {
        map[field] = i;
      }
    }
  });
  return map;
}
function Upload({
  data,
  can,
  notify,
  applyUpload,
  refresh
}) {
  const [month, setMonth] = useState(thisMonth());
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const lockOf = m => data.locks.find(l => l.month === m);
  const locked = !!(lockOf(month) && lockOf(month).locked);
  function readFile(file) {
    setError("");
    setParsed(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, {
          type: "array"
        });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const grid = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          blankrows: false
        });
        let headerRow = -1,
          map = {};
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
          const pick = f => map[f] === undefined ? "" : raw[map[f]];
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
            note: String(pick("note") || "").trim()
          });
        }
        const seen = new Set(),
          dupes = [];
        rows.forEach(r => {
          if (seen.has(r.code)) dupes.push(r.code);
          seen.add(r.code);
        });
        setParsed({
          filename: file.name,
          rows,
          dupes,
          mapped: Object.keys(map)
        });
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
        body: {
          month,
          filename: parsed.filename,
          rows: parsed.rows
        }
      });
      applyUpload(res);
      notify(res.inserted + "행을 반영했습니다. 기존 " + res.replaced + "행은 교체되었습니다.");
      setParsed(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      notify(e.message, true);
    }
    setBusy(false);
  }
  async function toggleLock() {
    try {
      await api("/api/locks/" + month, {
        method: "POST",
        body: {
          locked: !locked
        }
      });
      notify(locked ? month + " 잠금을 해제했습니다." : month + " 을 마감 잠금했습니다.");
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    title: "\uCD9C\uACE0 \uB370\uC774\uD130 \uC5C5\uB85C\uB4DC"
  }, /*#__PURE__*/React.createElement("div", {
    className: "formrow"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\uAE30\uC900\uC6D4"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    type: "month",
    value: month,
    onChange: e => setMonth(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\uB9C8\uAC10 \uC0C1\uD0DC"
  }, /*#__PURE__*/React.createElement("div", {
    className: "btnrow",
    style: {
      alignItems: "center",
      minHeight: 38
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge badge--" + (locked ? "bad" : "ok")
  }, locked ? "잠김" : "열림"), can("month_lock") && /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    onClick: toggleLock
  }, locked ? "잠금 해제" : "마감 잠금")))), /*#__PURE__*/React.createElement("div", {
    className: "dropzone" + (over ? " is-over" : ""),
    onDragOver: e => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: e => {
      e.preventDefault();
      setOver(false);
      if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 10px"
    }
  }, "\uC5D1\uC140 \uD30C\uC77C\uC744 \uB04C\uC5B4\uB2E4 \uB193\uAC70\uB098 \uC544\uB798\uC5D0\uC11C \uC120\uD0DD\uD558\uC138\uC694."), /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    onChange: e => e.target.files[0] && readFile(e.target.files[0])
  }), /*#__PURE__*/React.createElement("p", {
    className: "t-sm t-muted",
    style: {
      margin: "12px 0 0"
    }
  }, "\uCCAB \uBC88\uC9F8 \uC2DC\uD2B8\uB97C \uC77D\uC2B5\uB2C8\uB2E4. \uC778\uC2DD\uD558\uB294 \uC5F4: \uAC70\uB798\uCC98\uCF54\uB4DC \xB7 \uAC70\uB798\uCC98\uBA85 \xB7 \uC0AC\uC5C5\uBD80 \xB7 \uCC44\uAD8C\uBD84\uB958 \xB7 \uB2F4\uB2F9\uC790 \xB7 \uCC44\uAD8C\uC794\uC561 \xB7 \uC120\uC218\uAE08 \xB7 \uC5F0\uCCB4\uAE30\uAC04(\uAC1C\uC6D4) \xB7 \uCD5C\uC885\uC218\uAE08\uC77C \xB7 \uBE44\uACE0")), error && /*#__PURE__*/React.createElement("div", {
    className: "alert alert--bad",
    style: {
      marginTop: 12
    }
  }, error), locked && /*#__PURE__*/React.createElement("div", {
    className: "alert alert--warn",
    style: {
      marginTop: 12
    }
  }, month, " \uC740 \uB9C8\uAC10 \uC7A0\uAE08 \uC0C1\uD0DC\uB77C \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uAE08\uC744 \uD574\uC81C\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694."), parsed && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert alert--info"
  }, /*#__PURE__*/React.createElement("b", null, parsed.filename), " \u2014 \uC720\uD6A8\uD55C ", parsed.rows.length, "\uD589\uC744 \uC77D\uC5C8\uC2B5\uB2C8\uB2E4. \uC778\uC2DD\uD55C \uC5F4: ", parsed.mapped.length, "\uAC1C.", parsed.dupes.length > 0 && " 중복 코드 " + parsed.dupes.length + "건은 마지막 값으로 덮어씁니다."), /*#__PURE__*/React.createElement("p", {
    className: "t-sm t-muted"
  }, month, " \uC758 \uAE30\uC874 \uB370\uC774\uD130\uB97C \uC774 \uD30C\uC77C\uB85C \uAD50\uCCB4\uD569\uB2C8\uB2E4. \uB2E4\uB978 \uC6D4 \uB370\uC774\uD130\uB294 \uADF8\uB300\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4."), /*#__PURE__*/React.createElement("div", {
    className: "tablewrap",
    style: {
      maxHeight: 260,
      overflowY: "auto",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uCF54\uB4DC"), /*#__PURE__*/React.createElement("th", null, "\uAC70\uB798\uCC98\uBA85"), /*#__PURE__*/React.createElement("th", null, "\uC0AC\uC5C5\uBD80"), /*#__PURE__*/React.createElement("th", null, "\uBD84\uB958"), /*#__PURE__*/React.createElement("th", null, "\uB2F4\uB2F9\uC790"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uCC44\uAD8C\uC794\uC561"))), /*#__PURE__*/React.createElement("tbody", null, parsed.rows.slice(0, 12).map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.code), /*#__PURE__*/React.createElement("td", null, r.name), /*#__PURE__*/React.createElement("td", null, r.biz_unit || "–"), /*#__PURE__*/React.createElement("td", null, r.status || "자동판정"), /*#__PURE__*/React.createElement("td", null, r.owner || "–"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, won(r.balance))))))), /*#__PURE__*/React.createElement("div", {
    className: "btnrow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--primary",
    onClick: send,
    disabled: busy || locked
  }, month, " \uB370\uC774\uD130\uB85C \uBC18\uC601"), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: () => setParsed(null)
  }, "\uCDE8\uC18C")))), /*#__PURE__*/React.createElement(Card, {
    title: "\uC5C5\uB85C\uB4DC \uC774\uB825",
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uC77C\uC2DC"), /*#__PURE__*/React.createElement("th", null, "\uAE30\uC900\uC6D4"), /*#__PURE__*/React.createElement("th", null, "\uD30C\uC77C\uBA85"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uBC18\uC601 \uD589"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uAD50\uCCB4\uB41C \uD589"), /*#__PURE__*/React.createElement("th", null, "\uC5C5\uB85C\uB354"), /*#__PURE__*/React.createElement("th", null, "\uB9C8\uAC10"))), /*#__PURE__*/React.createElement("tbody", null, data.uploads.map(u => {
    const l = lockOf(u.month);
    return /*#__PURE__*/React.createElement("tr", {
      key: u.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "num t-sm"
    }, u.uploaded_at), /*#__PURE__*/React.createElement("td", {
      className: "num t-strong"
    }, u.month), /*#__PURE__*/React.createElement("td", null, u.filename), /*#__PURE__*/React.createElement("td", {
      className: "r num"
    }, u.row_count), /*#__PURE__*/React.createElement("td", {
      className: "r num t-muted"
    }, u.replaced), /*#__PURE__*/React.createElement("td", null, u.uploaded_by), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "badge badge--" + (l && l.locked ? "bad" : "mute")
    }, l && l.locked ? "잠김" : "열림")));
  }))))));
}

/* ══════════════════ 계정·권한 관리 ══════════════════ */

function Users({
  data,
  notify,
  refresh
}) {
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
      await api("/api/users/" + sel, {
        method: "PATCH",
        body: {
          role,
          permissions: perms
        }
      });
      notify(sel + " 권한을 저장했습니다.");
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function toggleActive(u) {
    try {
      await api("/api/users/" + u.username, {
        method: "PATCH",
        body: {
          active: !u.active
        }
      });
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function resetPassword(u) {
    const pw = prompt(u.username + " 의 새 비밀번호 (8자 이상)");
    if (!pw) return;
    if (pw.length < 8) {
      notify("8자 이상으로 입력하세요.", true);
      return;
    }
    try {
      await api("/api/users/" + u.username, {
        method: "PATCH",
        body: {
          password: pw
        }
      });
      notify("비밀번호를 변경했습니다.");
    } catch (e) {
      notify(e.message, true);
    }
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    title: "\uACC4\uC815",
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablewrap"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uC544\uC774\uB514"), /*#__PURE__*/React.createElement("th", null, "\uC774\uB984"), /*#__PURE__*/React.createElement("th", null, "\uC9C1\uC704"), /*#__PURE__*/React.createElement("th", null, "\uC5ED\uD560"), /*#__PURE__*/React.createElement("th", null, "\uC0AC\uC5C5\uBD80"), /*#__PURE__*/React.createElement("th", {
    className: "r"
  }, "\uAD8C\uD55C \uC218"), /*#__PURE__*/React.createElement("th", null, "\uC0C1\uD0DC"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, data.users.map(u => /*#__PURE__*/React.createElement("tr", {
    key: u.username,
    style: {
      background: sel === u.username ? "var(--brand-soft)" : undefined
    }
  }, /*#__PURE__*/React.createElement("td", {
    className: "t-strong"
  }, u.username), /*#__PURE__*/React.createElement("td", null, u.name), /*#__PURE__*/React.createElement("td", {
    className: "t-muted"
  }, u.title || "–"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "badge badge--brand"
  }, data.meta.roles[u.role].label)), /*#__PURE__*/React.createElement("td", null, u.biz_unit || "–"), /*#__PURE__*/React.createElement("td", {
    className: "r num"
  }, (u.permissions || []).length, " / 11"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "badge badge--" + (u.active ? "ok" : "mute")
  }, u.active ? "사용" : "정지")), /*#__PURE__*/React.createElement("td", {
    className: "r"
  }, /*#__PURE__*/React.createElement("div", {
    className: "btnrow",
    style: {
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    onClick: () => choose(u)
  }, "\uAD8C\uD55C \uD3B8\uC9D1"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    onClick: () => resetPassword(u)
  }, "\uBE44\uBC00\uBC88\uD638"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    onClick: () => toggleActive(u)
  }, u.active ? "정지" : "사용"))))))))), sel && /*#__PURE__*/React.createElement(Card, {
    title: sel + " 권한",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn--sm btn--primary",
      onClick: save
    }, "\uBCC0\uACBD \uC800\uC7A5")
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\uC5ED\uD560 \uD15C\uD50C\uB9BF"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chiprow"
  }, Object.entries(data.meta.roles).map(([key, r]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    className: "chip",
    "aria-pressed": role === key,
    onClick: () => applyTemplate(key)
  }, r.label)))), /*#__PURE__*/React.createElement("div", {
    className: "permgrid",
    style: {
      marginTop: 12
    }
  }, data.meta.permissions.map(p => /*#__PURE__*/React.createElement("label", {
    key: p.key
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: perms.includes(p.key),
    onChange: e => setPerms(e.target.checked ? [...perms, p.key] : perms.filter(x => x !== p.key))
  }), p.label)))));
}

/* ══════════════════ 셸 ══════════════════ */

const SCREENS = [{
  key: "dashboard",
  label: "대시보드",
  perm: "dashboard_view",
  group: "현황"
}, {
  key: "summary",
  label: "채권요약현황",
  perm: "dashboard_view",
  group: "현황"
}, {
  key: "customers",
  label: "거래처별 현황",
  perm: "customer_view",
  group: "현황"
}, {
  key: "owners",
  label: "담당자별 채권현황",
  perm: "owner_view",
  group: "현황"
}, {
  key: "collections",
  label: "수금 등록",
  perm: "collection_register",
  group: "수금",
  alt: "collection_approve"
}, {
  key: "targets",
  label: "수금목표 관리",
  perm: "target_manage",
  group: "수금"
}, {
  key: "upload",
  label: "출고 데이터 업로드",
  perm: "upload_data",
  group: "관리"
}, {
  key: "users",
  label: "계정·권한 관리",
  perm: "user_manage",
  group: "관리"
}];
function App() {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [preset, setPreset] = useState(null);
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, bad) => {
    setToast({
      message,
      bad
    });
    setTimeout(() => setToast(null), 4000);
  }, []);
  const load = useCallback(async () => {
    const d = await api("/api/bootstrap");
    setData(d);
    setUser(d.user);
  }, []);
  useEffect(() => {
    api("/api/me").then(r => {
      if (r.user) load().catch(e => notify(e.message, true));else setUser(null);
    }).catch(() => setUser(null));
  }, [load, notify]);
  const can = useCallback(perm => !!(user && user.permissions.includes(perm)), [user]);
  const visible = useMemo(() => SCREENS.filter(s => can(s.perm) || s.alt && can(s.alt)), [can]);
  useEffect(() => {
    if (visible.length && !visible.some(s => s.key === screen)) setScreen(visible[0].key);
  }, [visible, screen]);
  if (user === undefined) {
    return /*#__PURE__*/React.createElement("div", {
      className: "boot"
    }, /*#__PURE__*/React.createElement("div", {
      className: "boot__mark"
    }, "MP"), /*#__PURE__*/React.createElement("p", {
      className: "boot__text"
    }, "\uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4."));
  }
  if (user === null) return /*#__PURE__*/React.createElement(Login, {
    onDone: () => load()
  });
  if (!data) return /*#__PURE__*/React.createElement("div", {
    className: "boot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "boot__mark"
  }, "MP"), /*#__PURE__*/React.createElement("p", {
    className: "boot__text"
  }, "\uB370\uC774\uD130\uB97C \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4."));
  const patchCustomer = c => setData(d => ({
    ...d,
    customers: d.customers.map(x => x.code === c.code ? c : x)
  }));
  const applyUpload = res => setData(d => ({
    ...d,
    customers: res.customers,
    uploads: res.uploads
  }));
  const current = SCREENS.find(s => s.key === screen) || SCREENS[0];
  const groups = [...new Set(visible.map(s => s.group))];
  const pendingCount = data.collections.filter(c => c.state === "pending").length;
  async function signOut() {
    await api("/api/logout", {
      method: "POST"
    });
    setUser(null);
    setData(null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "shell"
  }, /*#__PURE__*/React.createElement("nav", {
    className: "side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side__top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side__logo"
  }, /*#__PURE__*/React.createElement("span", null, "MP"), "\uBBF8\uC218\uCC44\uAD8C \uAD00\uB9AC")), /*#__PURE__*/React.createElement("div", {
    className: "side__nav"
  }, groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g
  }, /*#__PURE__*/React.createElement("div", {
    className: "side__group"
  }, g), visible.filter(s => s.group === g).map(s => /*#__PURE__*/React.createElement("button", {
    key: s.key,
    className: "side__item",
    "aria-current": screen === s.key,
    onClick: () => {
      setPreset(null);
      setScreen(s.key);
    }
  }, s.label, s.key === "collections" && pendingCount > 0 && /*#__PURE__*/React.createElement("small", null, pendingCount)))))), /*#__PURE__*/React.createElement("div", {
    className: "side__foot"
  }, "\uAE30\uC900\uC77C ", data.meta.today)), /*#__PURE__*/React.createElement("main", {
    className: "main"
  }, /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, current.label), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "\uAC70\uB798\uCC98 ", data.customers.length, "\uACF3 \xB7 \uBBF8\uC218 \uD569\uACC4 ", won(sum(data.customers, "balance")), "\uC6D0")), /*#__PURE__*/React.createElement("div", {
    className: "spacer"
  }), /*#__PURE__*/React.createElement("div", {
    className: "who"
  }, /*#__PURE__*/React.createElement("b", null, user.name, user.title && " " + user.title), /*#__PURE__*/React.createElement("span", null, data.meta.roles[user.role].label, " \xB7 ", user.username)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--sm",
    onClick: signOut
  }, "\uB85C\uADF8\uC544\uC6C3")), /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, screen === "dashboard" && /*#__PURE__*/React.createElement(Dashboard, {
    data: data,
    setScreen: setScreen,
    setPreset: setPreset
  }), screen === "summary" && /*#__PURE__*/React.createElement(BondSummary, {
    data: data
  }), screen === "customers" && /*#__PURE__*/React.createElement(Customers, {
    data: data,
    can: can,
    preset: preset,
    notify: notify,
    patchCustomer: patchCustomer
  }), screen === "owners" && /*#__PURE__*/React.createElement(Owners, {
    data: data
  }), screen === "collections" && /*#__PURE__*/React.createElement(Collections, {
    data: data,
    can: can,
    notify: notify,
    refresh: load
  }), screen === "targets" && /*#__PURE__*/React.createElement(Targets, {
    data: data,
    notify: notify,
    refresh: load
  }), screen === "upload" && /*#__PURE__*/React.createElement(Upload, {
    data: data,
    can: can,
    notify: notify,
    applyUpload: applyUpload,
    refresh: load
  }), screen === "users" && /*#__PURE__*/React.createElement(Users, {
    data: data,
    notify: notify,
    refresh: load
  }))), toast && /*#__PURE__*/React.createElement("div", {
    className: "toast" + (toast.bad ? " toast--bad" : "")
  }, toast.message));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
