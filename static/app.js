import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
  return /*#__PURE__*/_jsxs("section", {
    className: "card",
    children: [(title || actions) && /*#__PURE__*/_jsxs("header", {
      className: "card__head",
      children: [/*#__PURE__*/_jsx("h3", {
        children: title
      }), /*#__PURE__*/_jsx("div", {
        className: "spacer"
      }), actions]
    }), /*#__PURE__*/_jsx("div", {
      className: "card__body" + (flush ? " card__body--flush" : ""),
      children: children
    })]
  });
}
function Empty({
  title,
  children
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "empty",
    children: [/*#__PURE__*/_jsx("b", {
      children: title
    }), children]
  });
}
function Badge({
  status
}) {
  return /*#__PURE__*/_jsx("span", {
    className: "badge badge--" + (STATUS_STYLE[status] || "mute"),
    children: STATUS_LABEL[status] || status
  });
}
function Field({
  label,
  children
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/_jsx("label", {
      children: label
    }), children]
  });
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
  return /*#__PURE__*/_jsxs("div", {
    className: "login",
    children: [/*#__PURE__*/_jsxs("aside", {
      className: "login__aside",
      children: [/*#__PURE__*/_jsx("div", {
        className: "login__brand",
        children: "MEDPARK"
      }), /*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsxs("h1", {
          className: "login__head",
          children: ["미수채권", /*#__PURE__*/_jsx("br", {}), "관리 시스템"]
        }), /*#__PURE__*/_jsx("p", {
          className: "login__sub",
          children: "덴탈·메디컬·에스테틱 세 사업부의 채권 잔액과 수금 진행을 한 화면에서 봅니다."
        }), /*#__PURE__*/_jsxs("div", {
          className: "login__stat",
          children: [/*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("b", {
              children: "3"
            }), "사업부"]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("b", {
              children: "9"
            }), "채권 분류"]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("b", {
              children: "11"
            }), "권한 구분"]
          })]
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "login__brand",
        style: {
          opacity: .55
        },
        children: "내부 업무용 · 외부 공유 금지"
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "login__panel",
      children: /*#__PURE__*/_jsxs("div", {
        className: "login__form",
        children: [/*#__PURE__*/_jsx("h2", {
          children: "로그인"
        }), /*#__PURE__*/_jsx("p", {
          className: "hint",
          children: "회사에서 발급받은 계정으로 접속하세요."
        }), error && /*#__PURE__*/_jsx("div", {
          className: "alert alert--bad",
          children: error
        }), /*#__PURE__*/_jsx(Field, {
          label: "아이디",
          children: /*#__PURE__*/_jsx("input", {
            ref: usernameRef,
            className: "input",
            value: username,
            autoFocus: true,
            autoComplete: "username",
            onChange: e => setUsername(e.target.value),
            onInput: e => setUsername(e.target.value),
            onKeyDown: e => e.key === "Enter" && submit(),
            placeholder: "Medpark0"
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "비밀번호",
          children: /*#__PURE__*/_jsx("input", {
            ref: passwordRef,
            className: "input",
            type: "password",
            value: password,
            autoComplete: "current-password",
            onChange: e => setPassword(e.target.value),
            onInput: e => setPassword(e.target.value),
            onKeyDown: e => e.key === "Enter" && submit()
          })
        }), /*#__PURE__*/_jsx("button", {
          className: "btn btn--primary",
          style: {
            width: "100%",
            marginTop: 6
          },
          onClick: submit,
          disabled: busy,
          children: busy ? "확인하는 중" : "로그인"
        })]
      })
    })]
  });
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
  const topUnitSelect = (value, setter, label) => /*#__PURE__*/_jsx("select", {
    className: "select",
    style: {
      width: 110,
      padding: "6px 9px"
    },
    value: value,
    onChange: e => setter(e.target.value),
    "aria-label": label,
    children: ["전체", ...data.meta.units].map(u => /*#__PURE__*/_jsx("option", {
      value: u,
      children: u
    }, u))
  });
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
  const yesterdayDate = new Date(data.meta.today + "T00:00:00");
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const customerUnit = Object.fromEntries(customers.map(c => [c.code, c.biz_unit]));
  const yesterdayCollections = approved.filter(c => c.paid_at === yesterday);
  const yesterdayByUnit = data.meta.units.map(u => ({
    unit: u,
    amount: sum(yesterdayCollections.filter(c => customerUnit[c.customer_code] === u), "amount")
  }));
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsx("div", {
      className: "chiprow",
      children: ["전체", ...data.meta.units].map(u => /*#__PURE__*/_jsx("button", {
        className: "chip",
        "aria-pressed": unit === u,
        onClick: () => setUnit(u),
        children: u
      }, u))
    }), /*#__PURE__*/_jsx("div", {
      className: "grid grid--kpi",
      children: kpis.map(k => {
        const s = short(k.value);
        return /*#__PURE__*/_jsxs("button", {
          className: "kpi",
          onClick: () => k.key !== "전체" && jump(k.key),
          children: [/*#__PURE__*/_jsxs("div", {
            className: "kpi__label",
            children: [/*#__PURE__*/_jsx("i", {
              className: "kpi__dot",
              style: {
                background: k.color
              }
            }), k.label]
          }), /*#__PURE__*/_jsxs("div", {
            className: "kpi__value num",
            children: [s.value, /*#__PURE__*/_jsx("em", {
              children: s.unit
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "kpi__meta num",
            children: ["거래처 ", k.count, "곳 · ", won(k.value), "원"]
          })]
        }, k.key);
      })
    }), /*#__PURE__*/_jsx(Card, {
      title: "전일 수금현황 요약 · " + yesterday,
      children: /*#__PURE__*/_jsxs("div", {
        className: "grid grid--3",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("div", {
            className: "kpi__label",
            children: "승인 수금 합계"
          }), /*#__PURE__*/_jsxs("div", {
            className: "kpi__value num",
            children: [won(sum(yesterdayCollections, "amount")), /*#__PURE__*/_jsx("em", {
              children: "원"
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("div", {
            className: "kpi__label",
            children: "승인 건수"
          }), /*#__PURE__*/_jsxs("div", {
            className: "kpi__value num",
            children: [yesterdayCollections.length, /*#__PURE__*/_jsx("em", {
              children: "건"
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("div", {
            className: "kpi__label",
            children: "사업부별 수금"
          }), /*#__PURE__*/_jsx("div", {
            className: "t-sm",
            children: yesterdayByUnit.map(r => /*#__PURE__*/_jsxs("span", {
              style: {
                display: "block",
                marginTop: 3
              },
              children: [r.unit, " · ", /*#__PURE__*/_jsxs("b", {
                className: "num",
                children: [won(r.amount), "원"]
              })]
            }, r.unit))
          })]
        })]
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "grid grid--2",
      children: [/*#__PURE__*/_jsxs(Card, {
        title: "사업부별 채권 분류 현황",
        actions: /*#__PURE__*/_jsxs("div", {
          className: "legend",
          children: [/*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("i", {
              style: {
                background: "var(--ok)"
              }
            }), "정상채권"]
          }), /*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("i", {
              style: {
                background: "var(--warn)"
              }
            }), "미수채권"]
          }), /*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("i", {
              style: {
                background: "var(--bad)"
              }
            }), "부실채권"]
          })]
        }),
        children: [/*#__PURE__*/_jsx("div", {
          className: "signal",
          children: byUnit.map(g => /*#__PURE__*/_jsxs("div", {
            className: "signal__row",
            children: [/*#__PURE__*/_jsx("div", {
              className: "signal__unit",
              children: g.unit
            }), /*#__PURE__*/_jsx("div", {
              className: "signal__bar",
              style: {
                width: Math.max(8, g.total / maxUnit * 100) + "%"
              },
              children: ["정상", "연체", "부실"].map(s => g[s] > 0 && /*#__PURE__*/_jsx("button", {
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
              }, s))
            }), /*#__PURE__*/_jsxs("div", {
              className: "signal__total num",
              children: [short(g.total).value, short(g.total).unit]
            })]
          }, g.unit))
        }), /*#__PURE__*/_jsx("p", {
          className: "t-sm t-muted",
          style: {
            margin: "14px 0 0"
          },
          children: "막대를 누르면 해당 사업부·분류의 거래처 목록으로 이동합니다."
        })]
      }), /*#__PURE__*/_jsx(Card, {
        title: "월별 수금 실적",
        flush: true,
        children: monthly.length === 0 ? /*#__PURE__*/_jsx(Empty, {
          title: "승인된 수금 내역이 아직 없습니다.",
          children: "수금 등록 화면에서 입력하고 재무담당이 승인하면 여기에 집계됩니다."
        }) : /*#__PURE__*/_jsx("div", {
          className: "tablewrap",
          children: /*#__PURE__*/_jsxs("table", {
            children: [/*#__PURE__*/_jsx("thead", {
              children: /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("th", {
                  children: "기준월"
                }), /*#__PURE__*/_jsx("th", {
                  className: "r",
                  children: "건수"
                }), /*#__PURE__*/_jsx("th", {
                  className: "r",
                  children: "수금액 (원)"
                })]
              })
            }), /*#__PURE__*/_jsx("tbody", {
              children: monthly.map(m => /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  className: "t-strong num",
                  children: m.month
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: m.count
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num t-strong",
                  children: won(m.amount)
                })]
              }, m.month))
            }), /*#__PURE__*/_jsx("tfoot", {
              children: /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  children: "합계"
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: sum(monthly, "count")
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(sum(monthly, "amount"))
                })]
              })
            })]
          })
        })
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "grid grid--3",
      children: [/*#__PURE__*/_jsxs(Card, {
        title: "수금목표 요약",
        children: [/*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "구분"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "건수"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "목표금액 (원)"
              })]
            })
          }), /*#__PURE__*/_jsxs("tbody", {
            children: [/*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                children: "오늘 목표"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                children: dueToday.length
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(sum(dueToday, "amount"))
              })]
            }), /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                children: "이번 주 목표"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                children: dueWeek.length
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(sum(dueWeek, "amount"))
              })]
            }), /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                children: "기한 초과"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                style: {
                  color: overdueTargets.length ? "var(--bad)" : "inherit"
                },
                children: overdueTargets.length
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(sum(overdueTargets, "amount"))
              })]
            })]
          })]
        }), /*#__PURE__*/_jsx("button", {
          className: "btn btn--sm",
          style: {
            marginTop: 12
          },
          onClick: () => setScreen("targets"),
          children: "수금목표 관리로 이동"
        })]
      }), /*#__PURE__*/_jsx(Card, {
        title: "정상채권 TOP 5",
        actions: topUnitSelect(normalTopUnit, setNormalTopUnit, "정상채권 사업부 선택"),
        flush: true,
        children: /*#__PURE__*/_jsx("div", {
          className: "tablewrap",
          children: /*#__PURE__*/_jsx("table", {
            children: /*#__PURE__*/_jsxs("tbody", {
              children: [normalTop5.map((c, i) => /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  className: "t-muted num",
                  style: {
                    width: 26
                  },
                  children: i + 1
                }), /*#__PURE__*/_jsx("td", {
                  className: "t-strong",
                  children: c.name
                }), /*#__PURE__*/_jsx("td", {
                  children: /*#__PURE__*/_jsx(Badge, {
                    status: "정상"
                  })
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(c.normal_balance)
                })]
              }, c.code)), normalTop5.length === 0 && /*#__PURE__*/_jsx("tr", {
                children: /*#__PURE__*/_jsx("td", {
                  className: "t-muted",
                  children: "정상채권 데이터가 없습니다."
                })
              })]
            })
          })
        })
      }), /*#__PURE__*/_jsx(Card, {
        title: "미수채권 TOP 5",
        actions: topUnitSelect(overdueTopUnit, setOverdueTopUnit, "미수채권 사업부 선택"),
        flush: true,
        children: /*#__PURE__*/_jsx("div", {
          className: "tablewrap",
          children: /*#__PURE__*/_jsx("table", {
            children: /*#__PURE__*/_jsxs("tbody", {
              children: [overdueTop5.map((c, i) => /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  className: "t-muted num",
                  style: {
                    width: 26
                  },
                  children: i + 1
                }), /*#__PURE__*/_jsx("td", {
                  className: "t-strong",
                  children: c.name
                }), /*#__PURE__*/_jsxs("td", {
                  className: "num t-sm t-muted",
                  children: [overdueMonths(c.overdue_days), "개월"]
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(c.overdue_balance)
                })]
              }, c.code)), overdueTop5.length === 0 && /*#__PURE__*/_jsx("tr", {
                children: /*#__PURE__*/_jsx("td", {
                  className: "t-muted",
                  children: "미수채권 데이터가 없습니다."
                })
              })]
            })
          })
        })
      })]
    }), /*#__PURE__*/_jsx(Card, {
      title: "담당자별 채권 현황",
      flush: true,
      children: /*#__PURE__*/_jsx("div", {
        className: "tablewrap",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "담당자"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "거래처"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "정상채권"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "미수채권"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "부실채권"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "합계"
              }), /*#__PURE__*/_jsx("th", {
                style: {
                  width: 150
                },
                children: "미수·부실채권 비중"
              })]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: owners.map(o => {
              const risk = o.total ? (o.연체 + o.부실) / o.total * 100 : 0;
              return /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  className: "t-strong",
                  children: o.owner
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: o.count
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(o.정상)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(o.연체)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(o.부실)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num t-strong",
                  children: won(o.total)
                }), /*#__PURE__*/_jsx("td", {
                  children: /*#__PURE__*/_jsxs("div", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    },
                    children: [/*#__PURE__*/_jsx("div", {
                      className: "bar",
                      children: /*#__PURE__*/_jsx("i", {
                        style: {
                          width: risk + "%",
                          background: risk > 40 ? "var(--bad)" : risk > 15 ? "var(--warn)" : "var(--ok)"
                        }
                      })
                    }), /*#__PURE__*/_jsxs("span", {
                      className: "t-sm num t-muted",
                      children: [risk.toFixed(0), "%"]
                    })]
                  })
                })]
              }, o.owner);
            })
          })]
        })
      })
    })]
  });
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs(Card, {
      title: "1. 사업부별 채권 분류 현황 (" + sourceMonth + " 기준)",
      flush: true,
      children: [/*#__PURE__*/_jsx("div", {
        className: "tablewrap summary-table",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsxs("thead", {
            children: [/*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                rowSpan: "2",
                children: "사업부"
              }), /*#__PURE__*/_jsx("th", {
                colSpan: "4",
                className: "summary-head summary-head--normal",
                children: "정상채권"
              }), /*#__PURE__*/_jsx("th", {
                rowSpan: "2",
                className: "summary-head summary-head--overdue",
                children: "미수채권"
              }), /*#__PURE__*/_jsx("th", {
                rowSpan: "2",
                className: "summary-head summary-head--bad",
                children: "부실채권"
              }), /*#__PURE__*/_jsx("th", {
                rowSpan: "2",
                className: "summary-head summary-head--total",
                children: "합계"
              }), /*#__PURE__*/_jsx("th", {
                rowSpan: "2",
                className: "summary-head summary-head--total",
                children: "미수채권 비중"
              })]
            }), /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "10월 이후"
              }), /*#__PURE__*/_jsx("th", {
                children: "9월 분"
              }), /*#__PURE__*/_jsx("th", {
                children: "8월 분(당월)"
              }), /*#__PURE__*/_jsx("th", {
                children: "[소계]"
              })]
            })]
          }), /*#__PURE__*/_jsx("tbody", {
            children: summary.map(r => /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                className: "t-strong",
                children: unitNames[r.unit]
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-normal",
                children: won(r.later)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-normal",
                children: won(r.next)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-normal",
                children: won(r.current)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-subtotal",
                children: won(r.normal)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-overdue",
                children: won(r.overdue)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-bad",
                children: won(r.bad)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                children: won(r.total)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                children: rate(r.overdue, r.total)
              })]
            }, r.unit))
          }), /*#__PURE__*/_jsx("tfoot", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                children: "합계"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("later"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("next"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("current"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-subtotal",
                children: won(total("normal"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num summary-overdue",
                children: won(total("overdue"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("bad"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("total"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: rate(total("overdue"), total("total"))
              })]
            })
          })]
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "summary-note",
        children: ["현재 운영 기초자료 ", data.customers.length, "개 거래처 기준 · 금액 단위: 원"]
      })]
    }), /*#__PURE__*/_jsx(Card, {
      title: "2. " + Number(sourceMonth.slice(5, 7)) + "월 수금실적",
      flush: true,
      children: /*#__PURE__*/_jsx("div", {
        className: "tablewrap summary-table",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsxs("thead", {
            children: [/*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                rowSpan: "2",
                children: "사업부"
              }), /*#__PURE__*/_jsx("th", {
                colSpan: "4",
                className: "summary-head summary-head--normal",
                children: "정상채권 (당월분)"
              }), /*#__PURE__*/_jsx("th", {
                colSpan: "4",
                className: "summary-head summary-head--overdue",
                children: "미수채권 (부실채권 제외)"
              })]
            }), /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "기초"
              }), /*#__PURE__*/_jsx("th", {
                children: "수금액"
              }), /*#__PURE__*/_jsx("th", {
                children: "잔액"
              }), /*#__PURE__*/_jsx("th", {
                children: "회수율"
              }), /*#__PURE__*/_jsx("th", {
                children: "기초"
              }), /*#__PURE__*/_jsx("th", {
                children: "수금액"
              }), /*#__PURE__*/_jsx("th", {
                children: "잔액"
              }), /*#__PURE__*/_jsx("th", {
                children: "회수율"
              })]
            })]
          }), /*#__PURE__*/_jsx("tbody", {
            children: summary.map(r => {
              const normalOpening = r.current + r.normalCollected;
              const overdueOpening = r.overdue + r.overdueCollected;
              return /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  className: "t-strong",
                  children: unitNames[r.unit]
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(normalOpening)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num summary-normal",
                  children: won(r.normalCollected)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num summary-subtotal",
                  children: won(r.current)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num t-strong",
                  children: rate(r.normalCollected, normalOpening)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(overdueOpening)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num summary-overdue",
                  children: won(r.overdueCollected)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num summary-subtotal",
                  children: won(r.overdue)
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num t-strong",
                  children: rate(r.overdueCollected, overdueOpening)
                })]
              }, r.unit);
            })
          }), /*#__PURE__*/_jsx("tfoot", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                children: "합계"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("current") + total("normalCollected"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("normalCollected"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("current"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: rate(total("normalCollected"), total("current") + total("normalCollected"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("overdue") + total("overdueCollected"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("overdueCollected"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(total("overdue"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: rate(total("overdueCollected"), total("overdue") + total("overdueCollected"))
              })]
            })
          })]
        })
      })
    })]
  });
}

/* ══════════════════ 거래처별 현황 ══════════════════ */

function InlineEdit({
  value,
  type = "text",
  placeholder,
  canEdit,
  onSave,
  formatValue
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
  if (!editing) return /*#__PURE__*/_jsx("button", {
    type: "button",
    className: "inline-edit",
    disabled: !canEdit,
    onClick: () => canEdit && setEditing(true),
    children: value !== "" && value != null ? formatValue ? formatValue(value) : value : /*#__PURE__*/_jsx("span", {
      className: "t-muted",
      children: placeholder
    })
  });
  return /*#__PURE__*/_jsx("input", {
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsx(Card, {
      title: "조회 조건",
      children: /*#__PURE__*/_jsxs("div", {
        className: "customer-filters",
        children: [/*#__PURE__*/_jsx(Field, {
          label: "사업부별 필터",
          children: /*#__PURE__*/_jsxs("select", {
            className: "select",
            value: unit,
            onChange: e => setUnit(e.target.value),
            children: [/*#__PURE__*/_jsx("option", {
              children: "전체"
            }), data.meta.units.map(u => /*#__PURE__*/_jsx("option", {
              children: u
            }, u))]
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "채권유형별 필터",
          children: /*#__PURE__*/_jsxs("select", {
            className: "select",
            value: type,
            onChange: e => setType(e.target.value),
            children: [/*#__PURE__*/_jsx("option", {
              children: "전체"
            }), data.meta.statuses.map(s => /*#__PURE__*/_jsx("option", {
              value: s,
              children: STATUS_LABEL[s]
            }, s))]
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "거래처 검색",
          children: /*#__PURE__*/_jsx("input", {
            className: "input",
            value: q,
            placeholder: "거래처명·코드·담당자",
            onChange: e => setQ(e.target.value)
          })
        }), /*#__PURE__*/_jsx("button", {
          className: "btn btn--sm",
          onClick: () => {
            setUnit("전체");
            setType("전체");
            setQ("");
          },
          children: "초기화"
        })]
      })
    }), /*#__PURE__*/_jsx(Card, {
      title: (STATUS_LABEL[type] || type) + " · 거래처 " + distinctCustomers + "곳 / 채권 " + rows.length + "건",
      flush: true,
      children: rows.length === 0 ? /*#__PURE__*/_jsx(Empty, {
        title: "조건에 맞는 채권이 없습니다.",
        children: "상단 필터나 검색어를 바꿔보세요."
      }) : /*#__PURE__*/_jsx("div", {
        className: "tablewrap customer-table",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "코드"
              }), /*#__PURE__*/_jsx("th", {
                children: "거래처명"
              }), /*#__PURE__*/_jsx("th", {
                children: "사업부"
              }), /*#__PURE__*/_jsx("th", {
                children: "채권유형"
              }), /*#__PURE__*/_jsx("th", {
                children: "회수기간"
              }), /*#__PURE__*/_jsx("th", {
                children: "담당자"
              }), /*#__PURE__*/_jsx("th", {
                children: "수금목표일"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "채권잔액"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "선수금"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "연체기간(개월)"
              }), /*#__PURE__*/_jsx("th", {
                children: "최종수금일"
              }), /*#__PURE__*/_jsx("th", {
                style: {
                  minWidth: 180
                },
                children: "비고"
              })]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: rows.map(c => /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                className: "num t-muted",
                children: code5(c.code)
              }), /*#__PURE__*/_jsx("td", {
                className: "t-strong",
                children: c.name
              }), /*#__PURE__*/_jsx("td", {
                children: c.biz_unit
              }), /*#__PURE__*/_jsx("td", {
                children: /*#__PURE__*/_jsx(Badge, {
                  status: c.status
                })
              }), /*#__PURE__*/_jsx("td", {
                className: "num" + (c.period == null || Number(c.period) < 0 ? " customer-period--missing" : ""),
                children: /*#__PURE__*/_jsx(InlineEdit, {
                  value: c.period == null || Number(c.period) < 0 ? "" : String(c.period),
                  placeholder: "미입력",
                  type: "number",
                  canEdit: can("customer_info_edit"),
                  formatValue: value => Number(value) === 0 ? "0개월 (당월)" : Number(value) === 1 ? "1개월 (익월)" : value + "개월",
                  onSave: period => updateCustomer(c.code, {
                    period
                  }, "회수기간을 저장했습니다.")
                })
              }), /*#__PURE__*/_jsx("td", {
                children: /*#__PURE__*/_jsx(InlineEdit, {
                  value: c.owner,
                  placeholder: "클릭해 입력",
                  canEdit: can("note_edit"),
                  onSave: owner => updateCustomer(c.code, {
                    owner
                  }, "담당자를 저장했습니다.")
                })
              }), /*#__PURE__*/_jsx("td", {
                children: /*#__PURE__*/_jsx(InlineEdit, {
                  value: c.collection_target_date,
                  placeholder: "날짜 선택",
                  type: "date",
                  canEdit: can("note_edit"),
                  onSave: collection_target_date => updateCustomer(c.code, {
                    collection_target_date
                  }, "수금목표일을 저장했습니다.")
                })
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                children: won(c.balance)
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: c.advance ? won(c.advance) : "–"
              }), /*#__PURE__*/_jsxs("td", {
                className: "r num",
                children: [c.months, "개월"]
              }), /*#__PURE__*/_jsx("td", {
                className: "num t-muted t-sm",
                children: c.last_paid_at || "–"
              }), /*#__PURE__*/_jsx("td", {
                style: {
                  whiteSpace: "normal"
                },
                children: editingNote === c.rowKey ? /*#__PURE__*/_jsxs("div", {
                  className: "inline-note",
                  children: [/*#__PURE__*/_jsx("input", {
                    className: "input",
                    value: draftNote,
                    autoFocus: true,
                    onChange: e => setDraftNote(e.target.value),
                    onKeyDown: e => e.key === "Enter" && saveNote(c.code)
                  }), /*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm btn--primary",
                    onClick: () => saveNote(c.code),
                    children: "저장"
                  }), /*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm",
                    onClick: () => setEditingNote(null),
                    children: "취소"
                  })]
                }) : /*#__PURE__*/_jsx("button", {
                  type: "button",
                  className: "inline-edit",
                  disabled: !can("note_edit"),
                  onClick: () => {
                    setEditingNote(c.rowKey);
                    setDraftNote(c.note || "");
                  },
                  children: c.note || /*#__PURE__*/_jsx("span", {
                    className: "t-muted",
                    children: "클릭해 입력"
                  })
                })
              })]
            }, c.rowKey))
          }), /*#__PURE__*/_jsx("tfoot", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsxs("td", {
                colSpan: 7,
                children: ["합계 · 거래처 ", distinctCustomers, "곳 / 채권 ", rows.length, "건"]
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(sum(rows, "balance"))
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(sum(rows, "advance"))
              }), /*#__PURE__*/_jsx("td", {
                colSpan: 3
              })]
            })
          })]
        })
      })
    })]
  });
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs("div", {
      className: "chiprow",
      children: [/*#__PURE__*/_jsx("button", {
        className: "chip",
        "aria-pressed": owner === "전체",
        onClick: () => setOwner("전체"),
        children: "전체"
      }), list.map(o => /*#__PURE__*/_jsxs("button", {
        className: "chip",
        "aria-pressed": owner === o.owner,
        onClick: () => setOwner(o.owner),
        children: [o.owner, " (", o.rows.length, ")"]
      }, o.owner))]
    }), /*#__PURE__*/_jsx("div", {
      className: "grid grid--3",
      children: (active ? [active] : list).map(o => /*#__PURE__*/_jsxs(Card, {
        title: o.owner,
        children: [/*#__PURE__*/_jsxs("div", {
          className: "kpi__value num",
          style: {
            marginTop: 0
          },
          children: [short(o.total).value, /*#__PURE__*/_jsx("em", {
            children: short(o.total).unit
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "kpi__meta num",
          style: {
            marginBottom: 12
          },
          children: ["거래처 ", o.rows.length, "곳 · ", won(o.total), "원"]
        }), /*#__PURE__*/_jsx("div", {
          className: "signal__bar",
          children: ["정상", "연체", "부실"].map(s => o[s] > 0 && /*#__PURE__*/_jsx("div", {
            className: "signal__seg signal__seg--" + STATUS_STYLE[s],
            style: {
              width: o[s] / o.total * 100 + "%"
            },
            title: STATUS_LABEL[s] + " " + won(o[s])
          }, s))
        })]
      }, o.owner))
    }), active && /*#__PURE__*/_jsx(Card, {
      title: active.owner + " 담당 거래처",
      flush: true,
      children: /*#__PURE__*/_jsx("div", {
        className: "tablewrap",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "코드"
              }), /*#__PURE__*/_jsx("th", {
                children: "거래처명"
              }), /*#__PURE__*/_jsx("th", {
                children: "사업부"
              }), /*#__PURE__*/_jsx("th", {
                children: "분류"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "채권잔액"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "연체기간(개월)"
              }), /*#__PURE__*/_jsx("th", {
                children: "비고"
              })]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: [...active.rows].sort((a, b) => b.balance - a.balance).map(c => /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                className: "num t-muted",
                children: code5(c.code)
              }), /*#__PURE__*/_jsx("td", {
                className: "t-strong",
                children: c.name
              }), /*#__PURE__*/_jsx("td", {
                children: c.biz_unit
              }), /*#__PURE__*/_jsx("td", {
                children: /*#__PURE__*/_jsx(Badge, {
                  status: c.status
                })
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                children: won(c.balance)
              }), /*#__PURE__*/_jsxs("td", {
                className: "r num",
                children: [overdueMonths(c.overdue_days), "개월"]
              }), /*#__PURE__*/_jsx("td", {
                className: "t-sm t-muted",
                style: {
                  whiteSpace: "normal"
                },
                children: c.note || "–"
              })]
            }, c.code))
          }), /*#__PURE__*/_jsx("tfoot", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                colSpan: 4,
                children: "합계"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(active.total)
              }), /*#__PURE__*/_jsx("td", {
                colSpan: 2
              })]
            })
          })]
        })
      })
    })]
  });
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
  return /*#__PURE__*/_jsxs("div", {
    className: "customer-search",
    children: [/*#__PURE__*/_jsx("input", {
      className: "input",
      value: query,
      placeholder: "거래처명 또는 코드 검색",
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
    }), open && /*#__PURE__*/_jsxs("div", {
      className: "customer-search__menu",
      role: "listbox",
      children: [matches.map(c => /*#__PURE__*/_jsxs("button", {
        type: "button",
        role: "option",
        className: "customer-search__option",
        onMouseDown: e => e.preventDefault(),
        onClick: () => choose(c),
        children: [/*#__PURE__*/_jsxs("span", {
          children: [/*#__PURE__*/_jsx("b", {
            children: c.name
          }), /*#__PURE__*/_jsxs("small", {
            children: [code5(c.code), " · ", c.biz_unit]
          })]
        }), /*#__PURE__*/_jsxs("strong", {
          className: "num",
          children: [won(c.balance), "원"]
        })]
      }, c.code)), matches.length === 0 && /*#__PURE__*/_jsx("div", {
        className: "customer-search__empty",
        children: "검색 결과가 없습니다."
      })]
    })]
  });
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [can("collection_register") && /*#__PURE__*/_jsxs(Card, {
      title: "수금 등록",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "formrow",
        children: [/*#__PURE__*/_jsx(Field, {
          label: "거래처",
          children: /*#__PURE__*/_jsx(CustomerSearch, {
            customers: data.customers,
            value: form.customer_code,
            onChange: code => setForm({
              ...form,
              customer_code: code
            })
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "수금액 (원)",
          children: /*#__PURE__*/_jsx("input", {
            className: "input num",
            inputMode: "numeric",
            value: form.amount,
            onChange: set("amount"),
            placeholder: "0"
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "수금방법",
          children: /*#__PURE__*/_jsx("select", {
            className: "select",
            value: form.method,
            onChange: set("method"),
            children: data.meta.methods.map(m => /*#__PURE__*/_jsx("option", {
              children: m
            }, m))
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "수금일",
          children: /*#__PURE__*/_jsx("input", {
            className: "input",
            type: "date",
            value: form.paid_at,
            onChange: set("paid_at")
          })
        })]
      }), /*#__PURE__*/_jsx(Field, {
        label: "비고",
        children: /*#__PURE__*/_jsx("input", {
          className: "input",
          value: form.note,
          onChange: set("note"),
          placeholder: "입금자명, 분할 회차 등"
        })
      }), target && Number(form.amount) > target.balance && /*#__PURE__*/_jsxs("div", {
        className: "alert alert--warn",
        children: ["입력한 수금액이 현재 미수잔액(", won(target.balance), "원)보다 큽니다. 금액을 확인하세요."]
      }), /*#__PURE__*/_jsx("button", {
        className: "btn btn--primary",
        onClick: register,
        disabled: busy || !form.customer_code || !form.amount,
        children: "승인 요청으로 등록"
      })]
    }), /*#__PURE__*/_jsx(Card, {
      title: "승인 대기 " + pending.length + "건",
      flush: true,
      children: pending.length === 0 ? /*#__PURE__*/_jsx(Empty, {
        title: "대기 중인 수금 건이 없습니다.",
        children: "영업담당이 등록하면 이곳에 표시됩니다."
      }) : /*#__PURE__*/_jsx("div", {
        className: "tablewrap",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "등록일"
              }), /*#__PURE__*/_jsx("th", {
                children: "거래처"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "수금액"
              }), /*#__PURE__*/_jsx("th", {
                children: "방법"
              }), /*#__PURE__*/_jsx("th", {
                children: "수금일"
              }), /*#__PURE__*/_jsx("th", {
                children: "등록자"
              }), /*#__PURE__*/_jsx("th", {
                children: "비고"
              }), /*#__PURE__*/_jsx("th", {})]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: pending.map(c => /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                className: "t-sm t-muted num",
                children: (c.created_at || "").slice(0, 10)
              }), /*#__PURE__*/_jsx("td", {
                className: "t-strong",
                children: c.customer_name
              }), /*#__PURE__*/_jsx("td", {
                className: "r num t-strong",
                children: won(c.amount)
              }), /*#__PURE__*/_jsx("td", {
                children: c.method
              }), /*#__PURE__*/_jsx("td", {
                className: "num",
                children: c.paid_at
              }), /*#__PURE__*/_jsx("td", {
                children: c.registered_by
              }), /*#__PURE__*/_jsx("td", {
                className: "t-sm t-muted",
                style: {
                  whiteSpace: "normal"
                },
                children: c.note || "–"
              }), /*#__PURE__*/_jsx("td", {
                className: "r",
                children: can("collection_approve") ? /*#__PURE__*/_jsxs("div", {
                  className: "btnrow",
                  style: {
                    justifyContent: "flex-end"
                  },
                  children: [/*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm btn--ok",
                    onClick: () => decide(c.id, "approve"),
                    children: "승인"
                  }), /*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm btn--danger",
                    onClick: () => decide(c.id, "reject"),
                    children: "반려"
                  })]
                }) : /*#__PURE__*/_jsx("span", {
                  className: "badge badge--mute",
                  children: "승인 대기"
                })
              })]
            }, c.id))
          }), /*#__PURE__*/_jsx("tfoot", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                colSpan: 2,
                children: "대기 합계"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(sum(pending, "amount"))
              }), /*#__PURE__*/_jsx("td", {
                colSpan: 5
              })]
            })
          })]
        })
      })
    }), /*#__PURE__*/_jsx(Card, {
      title: "처리 내역",
      flush: true,
      children: decided.length === 0 ? /*#__PURE__*/_jsx(Empty, {
        title: "처리된 내역이 없습니다."
      }) : /*#__PURE__*/_jsx("div", {
        className: "tablewrap",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "상태"
              }), /*#__PURE__*/_jsx("th", {
                children: "거래처"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "수금액"
              }), /*#__PURE__*/_jsx("th", {
                children: "방법"
              }), /*#__PURE__*/_jsx("th", {
                children: "수금일"
              }), /*#__PURE__*/_jsx("th", {
                children: "등록자"
              }), /*#__PURE__*/_jsx("th", {
                children: "처리자"
              }), /*#__PURE__*/_jsx("th", {
                children: "사유·비고"
              })]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: decided.map(c => /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                children: /*#__PURE__*/_jsx("span", {
                  className: "badge badge--" + (c.state === "approved" ? "ok" : "bad"),
                  children: c.state === "approved" ? "승인" : "반려"
                })
              }), /*#__PURE__*/_jsx("td", {
                className: "t-strong",
                children: c.customer_name
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(c.amount)
              }), /*#__PURE__*/_jsx("td", {
                children: c.method
              }), /*#__PURE__*/_jsx("td", {
                className: "num",
                children: c.paid_at
              }), /*#__PURE__*/_jsx("td", {
                children: c.registered_by
              }), /*#__PURE__*/_jsx("td", {
                children: c.approved_by
              }), /*#__PURE__*/_jsx("td", {
                className: "t-sm t-muted",
                style: {
                  whiteSpace: "normal"
                },
                children: c.reject_reason || c.note || "–"
              })]
            }, c.id))
          })]
        })
      })
    })]
  });
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs(Card, {
      title: "수금목표 추가",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "formrow",
        children: [/*#__PURE__*/_jsx(Field, {
          label: "거래처",
          children: /*#__PURE__*/_jsx(CustomerSearch, {
            customers: data.customers,
            value: form.customer_code,
            onChange: code => setForm({
              ...form,
              customer_code: code
            })
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "목표금액 (원)",
          children: /*#__PURE__*/_jsx("input", {
            className: "input num",
            inputMode: "numeric",
            value: form.amount,
            onChange: set("amount")
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "목표일",
          children: /*#__PURE__*/_jsx("input", {
            className: "input",
            type: "date",
            value: form.target_date,
            onChange: set("target_date")
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "수금방법",
          children: /*#__PURE__*/_jsx("select", {
            className: "select",
            value: form.method,
            onChange: set("method"),
            children: data.meta.methods.map(m => /*#__PURE__*/_jsx("option", {
              children: m
            }, m))
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "담당자",
          children: /*#__PURE__*/_jsx("input", {
            className: "input",
            value: form.assignee,
            onChange: set("assignee"),
            placeholder: "이름"
          })
        })]
      }), /*#__PURE__*/_jsx(Field, {
        label: "비고",
        children: /*#__PURE__*/_jsx("input", {
          className: "input",
          value: form.note,
          onChange: set("note"),
          placeholder: "약속 내용, 연락 결과 등"
        })
      }), /*#__PURE__*/_jsx("button", {
        className: "btn btn--primary",
        onClick: create,
        disabled: !form.customer_code || !form.target_date,
        children: "목표 추가"
      })]
    }), /*#__PURE__*/_jsx(Card, {
      title: "수금목표 " + rows.length + "건",
      flush: true,
      actions: /*#__PURE__*/_jsx("div", {
        className: "chiprow",
        children: ["진행", "완료", "전체"].map(f => /*#__PURE__*/_jsx("button", {
          className: "chip",
          "aria-pressed": filter === f,
          onClick: () => setFilter(f),
          children: f
        }, f))
      }),
      children: rows.length === 0 ? /*#__PURE__*/_jsx(Empty, {
        title: "등록된 목표가 없습니다.",
        children: "위에서 첫 목표를 추가하세요."
      }) : /*#__PURE__*/_jsx("div", {
        className: "tablewrap",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "목표일"
              }), /*#__PURE__*/_jsx("th", {
                children: "거래처"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "목표금액"
              }), /*#__PURE__*/_jsx("th", {
                children: "수금방법"
              }), /*#__PURE__*/_jsx("th", {
                children: "담당자"
              }), /*#__PURE__*/_jsx("th", {
                children: "완료일"
              }), /*#__PURE__*/_jsx("th", {
                children: "비고"
              }), /*#__PURE__*/_jsx("th", {})]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: rows.map(t => {
              const late = t.state !== "done" && t.target_date < today();
              return /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsxs("td", {
                  className: "num",
                  style: {
                    color: late ? "var(--bad)" : "inherit",
                    fontWeight: late ? 600 : 400
                  },
                  children: [t.target_date, late && " ⚠"]
                }), /*#__PURE__*/_jsx("td", {
                  className: "t-strong",
                  children: t.customer_name
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(t.amount)
                }), /*#__PURE__*/_jsx("td", {
                  children: t.method || "–"
                }), /*#__PURE__*/_jsx("td", {
                  children: t.assignee || "–"
                }), /*#__PURE__*/_jsx("td", {
                  children: /*#__PURE__*/_jsx("input", {
                    className: "input num",
                    type: "date",
                    style: {
                      width: 148
                    },
                    value: t.done_date || "",
                    onChange: e => patch(t.id, {
                      done_date: e.target.value
                    })
                  })
                }), /*#__PURE__*/_jsx("td", {
                  style: {
                    whiteSpace: "normal",
                    minWidth: 180
                  },
                  children: /*#__PURE__*/_jsx("input", {
                    className: "input",
                    defaultValue: t.note,
                    onBlur: e => e.target.value !== t.note && patch(t.id, {
                      note: e.target.value
                    })
                  })
                }), /*#__PURE__*/_jsx("td", {
                  className: "r",
                  children: /*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm btn--danger",
                    onClick: () => remove(t.id),
                    children: "삭제"
                  })
                })]
              }, t.id);
            })
          }), /*#__PURE__*/_jsx("tfoot", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("td", {
                colSpan: 2,
                children: "합계"
              }), /*#__PURE__*/_jsx("td", {
                className: "r num",
                children: won(sum(rows, "amount"))
              }), /*#__PURE__*/_jsx("td", {
                colSpan: 5
              })]
            })
          })]
        })
      })
    })]
  });
}

/* ══════════════════ 출고 데이터 업로드 ══════════════════ */

const COLUMN_ALIASES = {
  code: ["거래처코드", "코드", "거래처 코드", "고객코드", "code"],
  name: ["거래처명", "거래처", "업체명", "고객명", "name"],
  biz_unit: ["사업부", "사업부문", "부문", "unit"],
  status: ["채권분류", "분류", "채권상태", "상태", "status"],
  owner: ["담당자", "영업담당", "담당", "owner"],
  collection_period: ["회수기간(개월)", "회수기간", "collection_period"],
  shipment_amount: ["출고금액", "출고액", "shipment_amount"],
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
  const [shipmentDate, setShipmentDate] = useState(data.meta.today);
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
        const shipmentMode = map.shipment_amount !== undefined;
        const required = shipmentMode ? ["code", "name", "biz_unit"] : ["code", "name", "biz_unit", "normal_balance", "overdue_balance", "bad_balance"];
        const missing = required.filter(field => map[field] === undefined);
        if (missing.length) {
          setError("필수 열이 없습니다: " + missing.map(field => ({
            code: "거래처코드",
            name: "거래처명",
            biz_unit: "사업부",
            normal_balance: "정상채권잔액",
            overdue_balance: "미수채권(11개월 내)",
            bad_balance: "부실채권(12개월 이상)",
            collection_period: "회수기간(개월)",
            shipment_amount: "출고금액"
          })[field]).join(", "));
          return;
        }
        const rows = [],
          issues = [];
        for (let i = headerRow + 1; i < grid.length; i++) {
          const raw = grid[i] || [];
          const pick = f => map[f] === undefined ? "" : raw[map[f]];
          const code = String(pick("code") || "").trim();
          if (!code || /^#REF|^#N\/A/.test(code)) continue;
          const normalizedCode = /^\d+$/.test(code) ? code.padStart(5, "0") : code;
          const name = String(pick("name") || "").trim();
          const bizUnit = String(pick("biz_unit") || "").trim();
          if (!name) issues.push(i + 1 + "행: 거래처명 누락");
          if (!data.meta.units.includes(bizUnit)) issues.push(i + 1 + "행: 사업부 오류");
          const period = pick("collection_period");
          if (shipmentMode && period !== "" && (Number(period) < 0 || !Number.isFinite(Number(period)))) {
            issues.push(i + 1 + "행: 회수기간 오류");
          }
          rows.push({
            code: normalizedCode,
            name,
            biz_unit: bizUnit,
            status: String(pick("status") || "").trim(),
            owner: String(pick("owner") || "").trim(),
            collection_period: period,
            shipment_amount: pick("shipment_amount"),
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
            overdue_days: map.overdue_months !== undefined ? (Number(pick("overdue_months")) || 0) * 30 : pick("overdue_days"),
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
          issues,
          mapped: Object.keys(map),
          mode: shipmentMode ? "shipment" : "snapshot"
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
          shipment_date: shipmentDate,
          filename: parsed.filename,
          rows: parsed.rows,
          mode: parsed.mode
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs(Card, {
      title: "출고 데이터 업로드",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "formrow",
        children: [/*#__PURE__*/_jsx(Field, {
          label: "기준월",
          children: /*#__PURE__*/_jsx("input", {
            className: "input",
            type: "month",
            value: month,
            onChange: e => setMonth(e.target.value)
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "출고기준일",
          children: /*#__PURE__*/_jsx("input", {
            className: "input",
            type: "date",
            value: shipmentDate,
            onChange: e => setShipmentDate(e.target.value)
          })
        }), /*#__PURE__*/_jsx(Field, {
          label: "마감 상태",
          children: /*#__PURE__*/_jsxs("div", {
            className: "btnrow",
            style: {
              alignItems: "center",
              minHeight: 38
            },
            children: [/*#__PURE__*/_jsx("span", {
              className: "badge badge--" + (locked ? "bad" : "ok"),
              children: locked ? "잠김" : "열림"
            }), can("month_lock") && /*#__PURE__*/_jsx("button", {
              className: "btn btn--sm",
              onClick: toggleLock,
              children: locked ? "잠금 해제" : "마감 잠금"
            })]
          })
        })]
      }), /*#__PURE__*/_jsxs("div", {
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
        },
        children: [/*#__PURE__*/_jsx("p", {
          style: {
            margin: "0 0 10px"
          },
          children: "엑셀 파일을 끌어다 놓거나 아래에서 선택하세요."
        }), /*#__PURE__*/_jsx("input", {
          ref: fileRef,
          type: "file",
          accept: ".xlsx,.xls,.csv",
          onChange: e => e.target.files[0] && readFile(e.target.files[0])
        }), /*#__PURE__*/_jsx("p", {
          className: "t-sm t-muted",
          style: {
            margin: "12px 0 0"
          },
          children: "월별 출고 최소 서식: 거래처코드 · 거래처명 · 사업부 · 담당자 · 회수기간(개월) · 출고금액 · 비고"
        })]
      }), error && /*#__PURE__*/_jsx("div", {
        className: "alert alert--bad",
        style: {
          marginTop: 12
        },
        children: error
      }), locked && /*#__PURE__*/_jsxs("div", {
        className: "alert alert--warn",
        style: {
          marginTop: 12
        },
        children: [month, " 은 마감 잠금 상태라 업로드할 수 없습니다. 잠금을 해제한 뒤 다시 시도하세요."]
      }), parsed && /*#__PURE__*/_jsxs("div", {
        style: {
          marginTop: 16
        },
        children: [/*#__PURE__*/_jsxs("div", {
          className: "alert alert--info",
          children: [/*#__PURE__*/_jsx("b", {
            children: parsed.filename
          }), " — 유효한 ", parsed.rows.length, "행을 읽었습니다. 인식한 열: ", parsed.mapped.length, "개.", parsed.dupes.length > 0 && " 중복 코드 " + parsed.dupes.length + "건이 있습니다."]
        }), (parsed.dupes.length > 0 || parsed.issues.length > 0) && /*#__PURE__*/_jsxs("div", {
          className: "alert alert--bad",
          style: {
            marginTop: 10
          },
          children: ["업로드 전 수정 필요: ", parsed.dupes.length > 0 && "중복 코드 " + parsed.dupes.join(", "), parsed.dupes.length > 0 && parsed.issues.length > 0 && " · ", parsed.issues.slice(0, 8).join(" · "), parsed.issues.length > 8 && " 외 " + (parsed.issues.length - 8) + "건"]
        }), /*#__PURE__*/_jsxs("p", {
          className: "t-sm t-muted",
          children: [parsed.mode === "shipment" ? month + " 출고분만 재설정하며 회수기간에 따라 수금대상월을 자동 산출합니다." : month + " 의 기존 확정 채권 데이터를 교체합니다.", " 다른 월 데이터는 그대로 유지됩니다."]
        }), /*#__PURE__*/_jsx("div", {
          className: "tablewrap",
          style: {
            maxHeight: 260,
            overflowY: "auto",
            marginBottom: 12
          },
          children: /*#__PURE__*/_jsxs("table", {
            children: [/*#__PURE__*/_jsx("thead", {
              children: /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("th", {
                  children: "코드"
                }), /*#__PURE__*/_jsx("th", {
                  children: "거래처명"
                }), /*#__PURE__*/_jsx("th", {
                  children: "사업부"
                }), /*#__PURE__*/_jsx("th", {
                  children: parsed.mode === "shipment" ? "회수기간" : "분류"
                }), /*#__PURE__*/_jsx("th", {
                  children: "담당자"
                }), /*#__PURE__*/_jsx("th", {
                  className: "r",
                  children: parsed.mode === "shipment" ? "출고금액" : "채권잔액"
                })]
              })
            }), /*#__PURE__*/_jsx("tbody", {
              children: parsed.rows.slice(0, 12).map((r, i) => /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  className: "num",
                  children: r.code
                }), /*#__PURE__*/_jsx("td", {
                  children: r.name
                }), /*#__PURE__*/_jsx("td", {
                  children: r.biz_unit || "–"
                }), /*#__PURE__*/_jsx("td", {
                  children: parsed.mode === "shipment" ? r.collection_period + "개월" : r.status || "자동판정"
                }), /*#__PURE__*/_jsx("td", {
                  children: r.owner || "–"
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: won(parsed.mode === "shipment" ? r.shipment_amount : r.balance)
                })]
              }, i))
            })]
          })
        }), /*#__PURE__*/_jsxs("div", {
          className: "btnrow",
          children: [/*#__PURE__*/_jsxs("button", {
            className: "btn btn--primary",
            onClick: send,
            disabled: busy || locked || !shipmentDate || parsed.dupes.length > 0 || parsed.issues.length > 0,
            children: [month, " 데이터로 반영"]
          }), /*#__PURE__*/_jsx("button", {
            className: "btn",
            onClick: () => setParsed(null),
            children: "취소"
          })]
        })]
      })]
    }), /*#__PURE__*/_jsx(Card, {
      title: "업로드 이력",
      flush: true,
      children: /*#__PURE__*/_jsx("div", {
        className: "tablewrap",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "업로드 일시"
              }), /*#__PURE__*/_jsx("th", {
                children: "출고기준일"
              }), /*#__PURE__*/_jsx("th", {
                children: "기준월"
              }), /*#__PURE__*/_jsx("th", {
                children: "파일명"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "반영 행"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "교체된 행"
              }), /*#__PURE__*/_jsx("th", {
                children: "업로더"
              }), /*#__PURE__*/_jsx("th", {
                children: "마감"
              })]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: data.uploads.map(u => {
              const l = lockOf(u.month);
              return /*#__PURE__*/_jsxs("tr", {
                children: [/*#__PURE__*/_jsx("td", {
                  className: "num t-sm",
                  children: u.uploaded_at
                }), /*#__PURE__*/_jsx("td", {
                  className: "num t-sm",
                  children: u.shipment_date || "–"
                }), /*#__PURE__*/_jsx("td", {
                  className: "num t-strong",
                  children: u.month
                }), /*#__PURE__*/_jsx("td", {
                  children: u.filename
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num",
                  children: u.row_count
                }), /*#__PURE__*/_jsx("td", {
                  className: "r num t-muted",
                  children: u.replaced
                }), /*#__PURE__*/_jsx("td", {
                  children: u.uploaded_by
                }), /*#__PURE__*/_jsx("td", {
                  children: /*#__PURE__*/_jsx("span", {
                    className: "badge badge--" + (l && l.locked ? "bad" : "mute"),
                    children: l && l.locked ? "잠김" : "열림"
                  })
                })]
              }, u.id);
            })
          })]
        })
      })
    })]
  });
}
function UploadTemplate() {
  async function downloadTemplate() {
    try {
      const response = await fetch("/static/receivables_upload_template.b64");
      if (!response.ok) throw new Error("서식 파일을 불러오지 못했습니다.");
      const encoded = (await response.text()).trim();
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "MedPark_출고데이터_업로드서식.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    }
  }
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs(Card, {
      title: "출고데이터 업로드서식",
      children: [/*#__PURE__*/_jsx("p", {
        style: {
          marginTop: 0
        },
        children: "월별 출고데이터를 등록하는 표준 서식입니다."
      }), /*#__PURE__*/_jsx("div", {
        className: "alert alert--info",
        style: {
          marginBottom: 14
        },
        children: "필수 항목: 거래처코드 · 거래처명 · 사업부"
      }), /*#__PURE__*/_jsx("button", {
        className: "btn btn--primary",
        onClick: downloadTemplate,
        children: "엑셀 업로드 서식 다운로드"
      })]
    }), /*#__PURE__*/_jsx(Card, {
      title: "사용 순서",
      children: /*#__PURE__*/_jsxs("ol", {
        className: "template-steps",
        children: [/*#__PURE__*/_jsxs("li", {
          children: ["서식을 내려받아 첫 번째 시트인 ", /*#__PURE__*/_jsx("b", {
            children: "업로드서식"
          }), "에 데이터를 입력합니다."]
        }), /*#__PURE__*/_jsx("li", {
          children: "출고 데이터 업로드 메뉴에서 기준월을 선택합니다."
        }), /*#__PURE__*/_jsx("li", {
          children: "파일을 선택해 오류·중복 여부를 확인한 뒤 해당 월 데이터로 반영합니다."
        }), /*#__PURE__*/_jsx("li", {
          children: "확정된 월은 마감 잠금하여 추가 변경을 방지합니다."
        })]
      })
    })]
  });
}

/* ══════════════════ 자금수지 수금계획 ══════════════════ */

function CashPlan({
  data,
  notify
}) {
  const planMonths = data.meta.cash_plan_months || [thisMonth()];
  const [month, setMonth] = useState(planMonths[0]);
  const [busy, setBusy] = useState(false);
  async function download() {
    const includeOverdue = window.confirm("미수채권과 부실채권을 포함하시겠습니까?\n\n확인: 정상·미수·부실채권 포함\n취소: 정상채권만 다운로드");
    setBusy(true);
    try {
      const res = await fetch("/api/cash-plan/export", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          month,
          include_overdue: includeOverdue
        })
      });
      if (!res.ok) {
        let message = "수금계획을 생성하지 못했습니다.";
        try {
          message = (await res.json()).error || message;
        } catch (e) {/* ignore */}
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "MedPark_" + Number(month.slice(5, 7)) + "월_수금계획" + (includeOverdue ? "_미수부실포함" : "") + ".xlsx";
      link.click();
      URL.revokeObjectURL(url);
      notify(Number(month.slice(5, 7)) + "월 수금계획을 생성했습니다.");
    } catch (e) {
      notify(e.message, true);
    }
    setBusy(false);
  }
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs(Card, {
      title: "㈜메드파크 자금수지관리 수금계획",
      children: [/*#__PURE__*/_jsx("div", {
        className: "formrow",
        children: /*#__PURE__*/_jsx(Field, {
          label: "수금계획 기준월",
          children: /*#__PURE__*/_jsx("select", {
            className: "select",
            value: month,
            onChange: e => setMonth(e.target.value),
            children: planMonths.map(m => /*#__PURE__*/_jsxs("option", {
              value: m,
              children: [Number(m.slice(5, 7)), "월 수금계획"]
            }, m))
          })
        })
      }), /*#__PURE__*/_jsx("div", {
        className: "alert alert--info",
        style: {
          margin: "12px 0"
        },
        children: "정상채권은 선택한 월의 수금대상 금액만 반영합니다. 다운로드 시 미수·부실채권 포함 여부를 선택할 수 있습니다."
      }), /*#__PURE__*/_jsx("button", {
        className: "btn btn--primary",
        onClick: download,
        disabled: busy || !month,
        children: busy ? "엑셀 생성 중" : Number(month.slice(5, 7)) + "월 수금계획 다운로드"
      })]
    }), /*#__PURE__*/_jsx(Card, {
      title: "적용 기준",
      children: /*#__PURE__*/_jsxs("ul", {
        className: "template-steps",
        children: [/*#__PURE__*/_jsxs("li", {
          children: ["본부는 ", /*#__PURE__*/_jsx("b", {
            children: "사업부"
          }), ", 수금/지출은 ", /*#__PURE__*/_jsx("b", {
            children: "수금"
          }), "으로 고정합니다."]
        }), /*#__PURE__*/_jsx("li", {
          children: "부서/팀과 집행항목은 덴탈·메디컬·에스테틱 사업부에 맞춰 자동 변환합니다."
        }), /*#__PURE__*/_jsx("li", {
          children: "자금계획일·자금실행일은 해당 월 말일이며, 수금목표일이 있으면 그 날짜를 사용합니다."
        }), /*#__PURE__*/_jsx("li", {
          children: "정상채권·미수채권·부실채권을 거래처별 별도 행으로 표시합니다."
        })]
      })
    })]
  });
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
  const [newUser, setNewUser] = useState({
    username: "",
    name: "",
    title: "",
    role: "sales",
    biz_unit: "",
    password: ""
  });
  const setNew = key => e => setNewUser(v => ({
    ...v,
    [key]: e.target.value
  }));
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
      await api("/api/users", {
        method: "POST",
        body: newUser
      });
      notify(newUser.username + " 계정을 등록했습니다.");
      setNewUser({
        username: "",
        name: "",
        title: "",
        role: "sales",
        biz_unit: "",
        password: ""
      });
      await refresh();
    } catch (e) {
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
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsx(Card, {
      title: "신규 계정 등록",
      children: /*#__PURE__*/_jsxs("form", {
        onSubmit: createAccount,
        children: [/*#__PURE__*/_jsxs("div", {
          className: "formrow",
          children: [/*#__PURE__*/_jsx(Field, {
            label: "아이디*",
            children: /*#__PURE__*/_jsx("input", {
              className: "input",
              value: newUser.username,
              onChange: setNew("username")
            })
          }), /*#__PURE__*/_jsx(Field, {
            label: "이름*",
            children: /*#__PURE__*/_jsx("input", {
              className: "input",
              value: newUser.name,
              onChange: setNew("name")
            })
          }), /*#__PURE__*/_jsx(Field, {
            label: "직위",
            children: /*#__PURE__*/_jsx("input", {
              className: "input",
              value: newUser.title,
              onChange: setNew("title")
            })
          }), /*#__PURE__*/_jsx(Field, {
            label: "역할",
            children: /*#__PURE__*/_jsx("select", {
              className: "select",
              value: newUser.role,
              onChange: setNew("role"),
              children: Object.entries(data.meta.roles).map(([key, r]) => /*#__PURE__*/_jsx("option", {
                value: key,
                children: r.label
              }, key))
            })
          }), /*#__PURE__*/_jsx(Field, {
            label: "사업부",
            children: /*#__PURE__*/_jsxs("select", {
              className: "select",
              value: newUser.biz_unit,
              onChange: setNew("biz_unit"),
              children: [/*#__PURE__*/_jsx("option", {
                value: "",
                children: "전체/미지정"
              }), data.meta.units.map(u => /*#__PURE__*/_jsx("option", {
                children: u
              }, u))]
            })
          }), /*#__PURE__*/_jsx(Field, {
            label: "초기 비밀번호*",
            children: /*#__PURE__*/_jsx("input", {
              className: "input",
              type: "password",
              minLength: "8",
              value: newUser.password,
              onChange: setNew("password")
            })
          })]
        }), /*#__PURE__*/_jsx("button", {
          className: "btn btn--primary",
          type: "submit",
          children: "계정 등록"
        })]
      })
    }), /*#__PURE__*/_jsx(Card, {
      title: "계정",
      flush: true,
      children: /*#__PURE__*/_jsx("div", {
        className: "tablewrap",
        children: /*#__PURE__*/_jsxs("table", {
          children: [/*#__PURE__*/_jsx("thead", {
            children: /*#__PURE__*/_jsxs("tr", {
              children: [/*#__PURE__*/_jsx("th", {
                children: "아이디"
              }), /*#__PURE__*/_jsx("th", {
                children: "이름"
              }), /*#__PURE__*/_jsx("th", {
                children: "직위"
              }), /*#__PURE__*/_jsx("th", {
                children: "역할"
              }), /*#__PURE__*/_jsx("th", {
                children: "사업부"
              }), /*#__PURE__*/_jsx("th", {
                className: "r",
                children: "권한 수"
              }), /*#__PURE__*/_jsx("th", {
                children: "상태"
              }), /*#__PURE__*/_jsx("th", {})]
            })
          }), /*#__PURE__*/_jsx("tbody", {
            children: data.users.map(u => /*#__PURE__*/_jsxs("tr", {
              style: {
                background: sel === u.username ? "var(--brand-soft)" : undefined
              },
              children: [/*#__PURE__*/_jsx("td", {
                className: "t-strong",
                children: u.username
              }), /*#__PURE__*/_jsx("td", {
                children: u.name
              }), /*#__PURE__*/_jsx("td", {
                className: "t-muted",
                children: u.title || "–"
              }), /*#__PURE__*/_jsx("td", {
                children: /*#__PURE__*/_jsx("span", {
                  className: "badge badge--brand",
                  children: data.meta.roles[u.role].label
                })
              }), /*#__PURE__*/_jsx("td", {
                children: u.biz_unit || "–"
              }), /*#__PURE__*/_jsxs("td", {
                className: "r num",
                children: [(u.permissions || []).length, " / ", data.meta.permissions.length]
              }), /*#__PURE__*/_jsx("td", {
                children: /*#__PURE__*/_jsx("span", {
                  className: "badge badge--" + (u.active ? "ok" : "mute"),
                  children: u.active ? "사용" : "정지"
                })
              }), /*#__PURE__*/_jsx("td", {
                className: "r",
                children: /*#__PURE__*/_jsxs("div", {
                  className: "btnrow",
                  style: {
                    justifyContent: "flex-end"
                  },
                  children: [/*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm",
                    onClick: () => choose(u),
                    children: "권한 편집"
                  }), /*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm",
                    onClick: () => resetPassword(u),
                    children: "비밀번호"
                  }), /*#__PURE__*/_jsx("button", {
                    className: "btn btn--sm",
                    onClick: () => toggleActive(u),
                    children: u.active ? "정지" : "사용"
                  })]
                })
              })]
            }, u.username))
          })]
        })
      })
    }), sel && /*#__PURE__*/_jsxs(Card, {
      title: sel + " 권한",
      actions: /*#__PURE__*/_jsx("button", {
        className: "btn btn--sm btn--primary",
        onClick: save,
        children: "변경 저장"
      }),
      children: [/*#__PURE__*/_jsx(Field, {
        label: "역할 템플릿",
        children: /*#__PURE__*/_jsx("div", {
          className: "chiprow",
          children: Object.entries(data.meta.roles).map(([key, r]) => /*#__PURE__*/_jsx("button", {
            className: "chip",
            "aria-pressed": role === key,
            onClick: () => applyTemplate(key),
            children: r.label
          }, key))
        })
      }), /*#__PURE__*/_jsx("div", {
        className: "permgrid",
        style: {
          marginTop: 12
        },
        children: data.meta.permissions.map(p => /*#__PURE__*/_jsxs("label", {
          children: [/*#__PURE__*/_jsx("input", {
            type: "checkbox",
            checked: perms.includes(p.key),
            onChange: e => setPerms(e.target.checked ? [...perms, p.key] : perms.filter(x => x !== p.key))
          }), p.label]
        }, p.key))
      })]
    })]
  });
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
  key: "template",
  label: "출고데이터 업로드서식",
  perm: "upload_data",
  group: "관리"
}, {
  key: "upload",
  label: "출고 데이터 업로드",
  perm: "upload_data",
  group: "관리"
}, {
  key: "cashplan",
  label: "자금수지 수금계획",
  perm: "data_export",
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
    return /*#__PURE__*/_jsxs("div", {
      className: "boot",
      children: [/*#__PURE__*/_jsx("div", {
        className: "boot__mark",
        children: "MP"
      }), /*#__PURE__*/_jsx("p", {
        className: "boot__text",
        children: "불러오는 중입니다."
      })]
    });
  }
  if (user === null) return /*#__PURE__*/_jsx(Login, {
    onDone: () => load()
  });
  if (!data) return /*#__PURE__*/_jsxs("div", {
    className: "boot",
    children: [/*#__PURE__*/_jsx("div", {
      className: "boot__mark",
      children: "MP"
    }), /*#__PURE__*/_jsx("p", {
      className: "boot__text",
      children: "데이터를 준비하고 있습니다."
    })]
  });
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
  return /*#__PURE__*/_jsxs("div", {
    className: "shell",
    children: [/*#__PURE__*/_jsxs("nav", {
      className: "side",
      children: [/*#__PURE__*/_jsx("div", {
        className: "side__top",
        children: /*#__PURE__*/_jsxs("div", {
          className: "side__logo",
          children: [/*#__PURE__*/_jsx("span", {
            children: "MP"
          }), "미수채권 관리"]
        })
      }), /*#__PURE__*/_jsx("div", {
        className: "side__nav",
        children: groups.map(g => /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("div", {
            className: "side__group",
            children: g
          }), visible.filter(s => s.group === g).map(s => /*#__PURE__*/_jsxs("button", {
            className: "side__item",
            "aria-current": screen === s.key,
            onClick: () => {
              setPreset(null);
              setScreen(s.key);
            },
            children: [s.label, s.key === "collections" && pendingCount > 0 && /*#__PURE__*/_jsx("small", {
              children: pendingCount
            })]
          }, s.key))]
        }, g))
      }), /*#__PURE__*/_jsxs("div", {
        className: "side__foot",
        children: ["기준일 ", data.meta.today]
      })]
    }), /*#__PURE__*/_jsxs("main", {
      className: "main",
      children: [/*#__PURE__*/_jsxs("header", {
        className: "topbar",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("h1", {
            children: current.label
          }), /*#__PURE__*/_jsxs("div", {
            className: "sub",
            children: ["기준일 ", data.meta.today, " · ", data.meta.reflection_label]
          }), /*#__PURE__*/_jsxs("div", {
            className: "sub",
            children: ["거래처 ", data.customers.length, "곳 · 전체 채권 ", won(sum(data.customers, "balance")), "원"]
          })]
        }), /*#__PURE__*/_jsx("div", {
          className: "spacer"
        }), /*#__PURE__*/_jsxs("div", {
          className: "who",
          children: [/*#__PURE__*/_jsxs("b", {
            children: [user.name, user.title && " " + user.title]
          }), /*#__PURE__*/_jsxs("span", {
            children: [data.meta.roles[user.role].label, " · ", user.username]
          })]
        }), /*#__PURE__*/_jsx("button", {
          className: "btn btn--sm",
          onClick: signOut,
          children: "로그아웃"
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "page",
        children: [screen === "dashboard" && /*#__PURE__*/_jsx(Dashboard, {
          data: data,
          setScreen: setScreen,
          setPreset: setPreset
        }), screen === "summary" && /*#__PURE__*/_jsx(BondSummary, {
          data: data
        }), screen === "customers" && /*#__PURE__*/_jsx(Customers, {
          data: data,
          can: can,
          preset: preset,
          notify: notify,
          patchCustomer: patchCustomer
        }), screen === "owners" && /*#__PURE__*/_jsx(Owners, {
          data: data
        }), screen === "collections" && /*#__PURE__*/_jsx(Collections, {
          data: data,
          can: can,
          notify: notify,
          refresh: load
        }), screen === "targets" && /*#__PURE__*/_jsx(Targets, {
          data: data,
          notify: notify,
          refresh: load
        }), screen === "template" && /*#__PURE__*/_jsx(UploadTemplate, {}), screen === "upload" && /*#__PURE__*/_jsx(Upload, {
          data: data,
          can: can,
          notify: notify,
          applyUpload: applyUpload,
          refresh: load
        }), screen === "cashplan" && /*#__PURE__*/_jsx(CashPlan, {
          data: data,
          notify: notify
        }), screen === "users" && /*#__PURE__*/_jsx(Users, {
          data: data,
          notify: notify,
          refresh: load
        })]
      })]
    }), toast && /*#__PURE__*/_jsx("div", {
      className: "toast" + (toast.bad ? " toast--bad" : ""),
      children: toast.message
    })]
  });
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/_jsx(App, {}));