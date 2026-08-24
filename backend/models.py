"""
SQLAlchemy 모델 정의.
PostgreSQL / MySQL 둘 다 동일한 코드로 동작합니다 (DATABASE_URL의 스킴만 다름).
  - PostgreSQL: postgresql+psycopg2://user:pass@host:5432/dbname
  - MySQL:      mysql+pymysql://user:pass@host:3306/dbname
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(40), primary_key=True)
    login_id = db.Column(db.String(40), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    must_change_password = db.Column(db.Boolean, default=True, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    scope = db.Column(db.String(20), nullable=False, default="전체")  # 전체/덴탈/메디컬/에스테틱
    role = db.Column(db.String(20), nullable=False, default="viewer")  # viewer/sales/finance/executive/admin/custom
    perms = db.Column(db.JSON, nullable=False, default=list)  # ["VIEW", "COLLECT_CREATE", ...]
    status = db.Column(db.String(10), nullable=False, default="active")  # active/inactive
    last_login = db.Column(db.String(30), default="-")

    def to_dict(self, include_password=False):
        d = {
            "id": self.id, "loginId": self.login_id, "mustChangePassword": self.must_change_password,
            "name": self.name, "scope": self.scope, "role": self.role, "perms": self.perms or [],
            "status": self.status, "lastLogin": self.last_login,
        }
        return d


class Customer(db.Model):
    __tablename__ = "customers"

    code = db.Column(db.String(40), primary_key=True)
    name = db.Column(db.String(120), nullable=False, index=True)
    bu = db.Column(db.String(20), nullable=False, index=True)  # 덴탈/메디컬/에스테틱/미분류
    period = db.Column(db.Integer, nullable=True)  # 회수기간
    overdue = db.Column(db.Integer, default=0)  # 연체기간(개월)
    balance = db.Column(db.BigInteger, nullable=False, default=0)
    status = db.Column(db.String(10), nullable=False, index=True)  # 정상/미수/부실
    note = db.Column(db.Text, default="-")  # = 비고
    flag = db.Column(db.String(120), nullable=True)  # 정합성 플래그
    target_date = db.Column(db.String(10), nullable=True)  # 수금목표일 YYYY-MM-DD
    completed_date = db.Column(db.String(10), nullable=True)  # 수금완료일
    method = db.Column(db.String(20), nullable=True)  # 계좌수금/카드수금/어음수금/현금수금/기타수금
    owner = db.Column(db.String(40), nullable=True)  # 담당자 (직접 입력)

    def to_dict(self):
        return {
            "code": self.code, "name": self.name, "bu": self.bu, "period": self.period,
            "overdue": self.overdue, "balance": self.balance, "status": self.status,
            "note": self.note, "flag": self.flag, "targetDate": self.target_date,
            "completedDate": self.completed_date, "method": self.method, "owner": self.owner,
        }


class CollectionQueueEntry(db.Model):
    __tablename__ = "collection_queue"

    id = db.Column(db.String(20), primary_key=True)
    code = db.Column(db.String(40), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    bu = db.Column(db.String(20), nullable=False)
    recv_status = db.Column(db.String(10), nullable=True)
    date = db.Column(db.String(10), nullable=False)
    amount = db.Column(db.BigInteger, nullable=False)
    method = db.Column(db.String(20), nullable=True)
    memo = db.Column(db.Text, default="-")
    input_by = db.Column(db.String(80), nullable=True)
    input_at = db.Column(db.String(30), nullable=True)
    status = db.Column(db.String(10), nullable=False, default="대기")
    balance_at_input = db.Column(db.BigInteger, nullable=True)
    dup = db.Column(db.Boolean, default=False)
    approved_by = db.Column(db.String(80), nullable=True)
    approved_at = db.Column(db.String(30), nullable=True)
    reject_reason = db.Column(db.Text, nullable=True)
    owner = db.Column(db.String(40), nullable=True)

    def to_dict(self):
        return {
            "id": self.id, "code": self.code, "name": self.name, "bu": self.bu,
            "recvStatus": self.recv_status, "date": self.date, "amount": self.amount,
            "method": self.method, "memo": self.memo, "inputBy": self.input_by,
            "inputAt": self.input_at, "status": self.status, "balanceAtInput": self.balance_at_input,
            "dup": self.dup, "approvedBy": self.approved_by, "approvedAt": self.approved_at,
            "rejectReason": self.reject_reason, "owner": self.owner,
        }


class MonthRecord(db.Model):
    __tablename__ = "months"

    key = db.Column(db.String(7), primary_key=True)
    label = db.Column(db.String(20), nullable=False)
    locked = db.Column(db.Boolean, default=False, nullable=False)
    deadline = db.Column(db.String(10), nullable=True)

    def to_dict(self):
        return {"key": self.key, "label": self.label, "locked": self.locked, "deadline": self.deadline}


class UploadHistoryEntry(db.Model):
    __tablename__ = "upload_history"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    month_key = db.Column(db.String(7), db.ForeignKey("months.key"), nullable=False, index=True)
    seq = db.Column(db.Integer, nullable=False)
    file = db.Column(db.String(200), nullable=False)
    at = db.Column(db.String(30), nullable=False)
    by = db.Column(db.String(80), nullable=True)
    rows = db.Column(db.Integer, default=0)
    amount = db.Column(db.BigInteger, default=0)
    is_current = db.Column(db.Boolean, default=False)
    is_final = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "seq": self.seq, "file": self.file, "at": self.at, "by": self.by,
            "rows": self.rows, "amount": self.amount, "current": self.is_current, "final": self.is_final,
        }
