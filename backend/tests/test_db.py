from sqlalchemy import inspect, select

from app.db import SessionLocal, engine, init_db, reset_db
from app.models import AppMeta


def test_init_db_creates_schema():
    init_db()

    tables = inspect(engine).get_table_names()
    assert {"app_meta", "users", "documents"} <= set(tables)


def test_init_db_preserves_existing_data():
    init_db()
    with SessionLocal() as session:
        session.add(AppMeta(key="scratch", value="x"))
        session.commit()

    init_db()  # must NOT drop tables — data persists across restarts

    with SessionLocal() as session:
        keys = session.execute(select(AppMeta.key)).scalars().all()
    assert "scratch" in keys


def test_reset_db_wipes_everything():
    init_db()
    with SessionLocal() as session:
        session.add(AppMeta(key="scratch", value="x"))
        session.commit()

    reset_db()

    with SessionLocal() as session:
        keys = session.execute(select(AppMeta.key)).scalars().all()
    assert "scratch" not in keys
