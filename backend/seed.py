"""
DB 초기 시드 스크립트.
사용법:
    python seed.py            # 비어있을 때만 채움
    python seed.py --force    # 기존 데이터 삭제 후 재시딩
"""
import json
import os
import sys

from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app_factory import create_app  # noqa: E402
from models import db, User, Customer, CollectionQueueEntry, MonthRecord, UploadHistoryEntry  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def load_json(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return json.load(f)


def _run_seed():
    """현재 app_context 안에서 시드 데이터를 실제로 적재. 호출 전에 비어있는지 확인은 호출자 책임."""
    users = load_json("seed_users.json")
    for u in users:
        db.session.add(User(
            id=u["id"], login_id=u["loginId"],
            password_hash=generate_password_hash(u["password"]),
            must_change_password=u.get("mustChangePassword", True),
            name=u["name"], scope=u["scope"], role=u["role"],
            perms=u["perms"], status=u["status"], last_login=u.get("lastLogin", "-"),
        ))
    print(f"users: {len(users)}건")

    customers = load_json("seed_customers.json")
    for c in customers:
        db.session.add(Customer(
            code=c["code"], name=c["name"], bu=c["bu"], period=c.get("period"),
            overdue=c.get("overdue", 0), balance=c["balance"], status=c["status"],
            note=c.get("note", "-"), flag=c.get("flag"), target_date=c.get("targetDate"),
            completed_date=c.get("completedDate"), method=c.get("method"), owner=c.get("owner"),
        ))
    print(f"customers: {len(customers)}건")

    queue = load_json("seed_queue.json")
    for q in queue:
        db.session.add(CollectionQueueEntry(
            id=q["id"], code=q["code"], name=q["name"], bu=q["bu"],
            recv_status=q.get("recvStatus"), date=q["date"], amount=q["amount"],
            method=q.get("method"), memo=q.get("memo", "-"), input_by=q.get("inputBy"),
            input_at=q.get("inputAt"), status=q["status"], balance_at_input=q.get("balanceAtInput"),
            dup=q.get("dup", False), approved_by=q.get("approvedBy"), approved_at=q.get("approvedAt"),
            reject_reason=q.get("rejectReason"), owner=q.get("owner"),
        ))
    print(f"collection_queue: {len(queue)}건")

    months = load_json("seed_months.json")
    for key, m in months.items():
        db.session.add(MonthRecord(key=key, label=m["label"], locked=m.get("locked", False), deadline=m.get("deadline")))
        for h in m.get("history", []):
            db.session.add(UploadHistoryEntry(
                month_key=key, seq=h["seq"], file=h["file"], at=h["at"], by=h.get("by"),
                rows=h.get("rows", 0), amount=h.get("amount", 0),
                is_current=h.get("current", False), is_final=h.get("final", False),
            ))
    print(f"months: {len(months)}건")

    db.session.commit()
    print("시딩 완료.")


def seed_if_empty(app):
    """앱 기동 시 자동 호출됨(app.py). 테이블이 없으면 만들고, users 테이블이 비어있을 때만 시딩."""
    with app.app_context():
        db.create_all()
        if User.query.count() == 0:
            _run_seed()


def seed(force=False):
    app = create_app()
    with app.app_context():
        db.create_all()

        if force:
            print("기존 데이터 삭제 중...")
            UploadHistoryEntry.query.delete()
            MonthRecord.query.delete()
            CollectionQueueEntry.query.delete()
            Customer.query.delete()
            User.query.delete()
            db.session.commit()

        if User.query.count() > 0 and not force:
            print("이미 데이터가 있습니다. --force로 재시딩하세요. 건너뜁니다.")
            return

        _run_seed()


if __name__ == "__main__":
    seed(force="--force" in sys.argv)
