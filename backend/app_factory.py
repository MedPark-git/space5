import os
from flask import Flask
from models import db

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def _build_database_url():
    """
    1순위: DATABASE_URL 환경변수 (로컬 개발/수동 설정용)
    2순위: AI Space가 DB 프로비저닝 시 자동 주입하는 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD
    3순위: SQLite (로컬 임시 테스트용 폴백)
    """
    explicit = os.environ.get("DATABASE_URL")
    if explicit:
        if explicit.startswith("postgres://"):
            explicit = explicit.replace("postgres://", "postgresql://", 1)
        return explicit

    host = os.environ.get("DB_HOST")
    if host:
        port = os.environ.get("DB_PORT")
        name = os.environ.get("DB_NAME")
        user = os.environ.get("DB_USER")
        password = os.environ.get("DB_PASSWORD", "")
        dialect = os.environ.get("DB_DIALECT", "mysql+pymysql")
        port_part = f":{port}" if port else ""
        return f"{dialect}://{user}:{password}@{host}{port_part}/{name}"

    return "sqlite:///local_dev.db"


def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = _build_database_url()
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-this-in-production")
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    db.init_app(app)
    return app
