"""
MedPark 채권관리 API 서버.

프론트엔드(App.jsx)의 loadStorage/saveStorage가 이 API를 호출하도록 바뀌었습니다.
"통째로 조회 / 통째로 교체" 패턴을 그대로 유지해서, 화면 쪽 로직은 거의 손대지 않았습니다.

인증: 세션 쿠키 기반. 로그인하지 않으면 /api/customers 등 데이터 API는 전부 401을 반환합니다
(예전처럼 화면에서만 막는 게 아니라 서버에서도 실제로 막습니다).
"""
import os
from functools import wraps

from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

from app_factory import create_app
from models import db, User, Customer, CollectionQueueEntry, MonthRecord, UploadHistoryEntry
from seed import seed_if_empty

app = create_app()
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")

# 앱이 처음 뜰 때 테이블이 없으면 만들고, users가 비어있으면 자동으로 초기 데이터를 채운다.
# (AI Space 배포 후 별도로 셸에 접속해 seed.py를 수동 실행하지 않아도 되도록)
try:
    seed_if_empty(app)
except Exception as e:  # DB가 아직 준비 전이면 조용히 넘어가고, 요청 시점에 다시 시도되게 둔다
    print(f"[startup] 초기 시딩 스킵/실패: {e}")


# ------------------------------------------------------------------ #
# 인증
# ------------------------------------------------------------------ #

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "로그인이 필요합니다."}), 401
        return fn(*args, **kwargs)
    return wrapper


def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return User.query.get(uid)


@app.post("/api/auth/login")
def login():
    data = request.get_json(force=True) or {}
    login_id = (data.get("loginId") or "").strip()
    password = data.get("password") or ""
    if not login_id or not password:
        return jsonify({"error": "아이디와 비밀번호를 입력해 주세요."}), 400

    user = User.query.filter_by(login_id=login_id).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401
    if user.status != "active":
        return jsonify({"error": "비활성화된 계정입니다. 관리자에게 문의해 주세요."}), 403

    session["user_id"] = user.id
    session.permanent = True
    return jsonify(user.to_dict())


@app.post("/api/auth/logout")
def logout():
    session.pop("user_id", None)
    return jsonify({"ok": True})


@app.get("/api/auth/me")
def me():
    user = current_user()
    if not user:
        return jsonify(None)
    return jsonify(user.to_dict())


@app.post("/api/auth/change-password")
@login_required
def change_password():
    data = request.get_json(force=True) or {}
    user = current_user()
    if not check_password_hash(user.password_hash, data.get("currentPassword") or ""):
        return jsonify({"error": "현재 비밀번호가 일치하지 않습니다."}), 400
    new_password = data.get("newPassword") or ""
    if not new_password:
        return jsonify({"error": "새 비밀번호를 입력해 주세요."}), 400
    user.password_hash = generate_password_hash(new_password)
    user.must_change_password = False
    db.session.commit()
    return jsonify(user.to_dict())


# ------------------------------------------------------------------ #
# 거래처(채권) — 통째로 조회 / 통째로 교체
# ------------------------------------------------------------------ #

@app.get("/api/customers")
@login_required
def get_customers():
    return jsonify([c.to_dict() for c in Customer.query.all()])


@app.put("/api/customers")
@login_required
def put_customers():
    """프론트엔드의 setCustomers(...) 결과 전체를 그대로 받아 upsert + 삭제 동기화."""
    rows = request.get_json(force=True) or []
    incoming_codes = {r["code"] for r in rows}

    existing = {c.code: c for c in Customer.query.all()}
    for r in rows:
        c = existing.get(r["code"])
        if c is None:
            c = Customer(code=r["code"])
            db.session.add(c)
        c.name = r["name"]; c.bu = r["bu"]; c.period = r.get("period")
        c.overdue = r.get("overdue", 0); c.balance = r["balance"]; c.status = r["status"]
        c.note = r.get("note", "-"); c.flag = r.get("flag")
        c.target_date = r.get("targetDate"); c.completed_date = r.get("completedDate")
        c.method = r.get("method"); c.owner = r.get("owner")

    for code, c in existing.items():
        if code not in incoming_codes:
            db.session.delete(c)

    db.session.commit()
    return jsonify([c.to_dict() for c in Customer.query.all()])


# ------------------------------------------------------------------ #
# 수금 등록 대기열
# ------------------------------------------------------------------ #

@app.get("/api/collection-queue")
@login_required
def get_queue():
    return jsonify([q.to_dict() for q in CollectionQueueEntry.query.all()])


@app.put("/api/collection-queue")
@login_required
def put_queue():
    rows = request.get_json(force=True) or []
    incoming_ids = {r["id"] for r in rows}

    existing = {q.id: q for q in CollectionQueueEntry.query.all()}
    for r in rows:
        q = existing.get(r["id"])
        if q is None:
            q = CollectionQueueEntry(id=r["id"])
            db.session.add(q)
        q.code = r["code"]; q.name = r["name"]; q.bu = r["bu"]; q.recv_status = r.get("recvStatus")
        q.date = r["date"]; q.amount = r["amount"]; q.method = r.get("method")
        q.memo = r.get("memo", "-"); q.input_by = r.get("inputBy"); q.input_at = r.get("inputAt")
        q.status = r["status"]; q.balance_at_input = r.get("balanceAtInput"); q.dup = r.get("dup", False)
        q.approved_by = r.get("approvedBy"); q.approved_at = r.get("approvedAt")
        q.reject_reason = r.get("rejectReason"); q.owner = r.get("owner")

    for qid, q in existing.items():
        if qid not in incoming_ids:
            db.session.delete(q)

    db.session.commit()
    return jsonify([q.to_dict() for q in CollectionQueueEntry.query.all()])


# ------------------------------------------------------------------ #
# 계정 (users) — 비밀번호 해시는 여기서만 다루고 프론트로 내려주지 않음
# ------------------------------------------------------------------ #

@app.get("/api/users")
@login_required
def get_users():
    return jsonify([u.to_dict() for u in User.query.all()])


@app.put("/api/users")
@login_required
def put_users():
    """
    프론트에서 넘어오는 배열의 각 항목은 UI용 password 평문 필드를 가질 수 있음
    (신규 계정 생성 시 "이름"을 임시 비밀번호로 넣는 기존 로직). 여기서 해시로 변환해 저장.
    비밀번호 필드가 없는 기존 계정은 해시를 건드리지 않음.
    """
    rows = request.get_json(force=True) or []
    incoming_ids = {r["id"] for r in rows}
    existing = {u.id: u for u in User.query.all()}

    for r in rows:
        u = existing.get(r["id"])
        is_new = u is None
        if is_new:
            u = User(id=r["id"])
            db.session.add(u)
        u.login_id = r["loginId"]; u.name = r["name"]; u.scope = r["scope"]
        u.role = r["role"]; u.perms = r.get("perms", []); u.status = r["status"]
        u.last_login = r.get("lastLogin", "-")
        u.must_change_password = r.get("mustChangePassword", u.must_change_password if not is_new else True)
        if r.get("password"):  # 평문이 왔을 때만(신규 생성·초기화 시) 해시 갱신
            u.password_hash = generate_password_hash(r["password"])

    for uid, u in existing.items():
        if uid not in incoming_ids:
            db.session.delete(u)

    db.session.commit()
    return jsonify([u.to_dict() for u in User.query.all()])


# ------------------------------------------------------------------ #
# 월별 출고 데이터 업로드 이력 / 잠금
# ------------------------------------------------------------------ #

@app.get("/api/months")
@login_required
def get_months():
    result = {}
    for m in MonthRecord.query.all():
        history = [
            h.to_dict() for h in
            UploadHistoryEntry.query.filter_by(month_key=m.key).order_by(UploadHistoryEntry.seq.desc()).all()
        ]
        result[m.key] = {**m.to_dict(), "history": history}
    return jsonify(result)


@app.put("/api/months/<key>")
@login_required
def put_month(key):
    """해당 월의 잠금 상태 + 업로드 이력 전체를 교체."""
    data = request.get_json(force=True) or {}
    m = MonthRecord.query.get(key)
    if m is None:
        m = MonthRecord(key=key, label=data.get("label", key))
        db.session.add(m)
    m.label = data.get("label", m.label)
    m.locked = data.get("locked", m.locked)
    m.deadline = data.get("deadline", m.deadline)

    if "history" in data:
        UploadHistoryEntry.query.filter_by(month_key=key).delete()
        for h in data["history"]:
            db.session.add(UploadHistoryEntry(
                month_key=key, seq=h["seq"], file=h["file"], at=h["at"], by=h.get("by"),
                rows=h.get("rows", 0), amount=h.get("amount", 0),
                is_current=h.get("current", False), is_final=h.get("final", False),
            ))

    db.session.commit()
    history = [
        h.to_dict() for h in
        UploadHistoryEntry.query.filter_by(month_key=key).order_by(UploadHistoryEntry.seq.desc()).all()
    ]
    return jsonify({**m.to_dict(), "history": history})


# ------------------------------------------------------------------ #
# 정적 파일 서빙 (빌드된 프론트엔드) — 기존 app.py와 동일한 역할
# ------------------------------------------------------------------ #

@app.route("/")
def index():
    return send_from_directory(DIST_DIR, "index.html")


@app.route("/<path:path>")
def static_proxy(path):
    if path.startswith("api/"):
        return jsonify({"error": "not found"}), 404
    full_path = os.path.join(DIST_DIR, path)
    if os.path.isfile(full_path):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
