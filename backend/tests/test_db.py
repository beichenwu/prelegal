from sqlalchemy import inspect, select

from app.db import SessionLocal, engine, init_db
from app.models import AppMeta


def test_init_db_creates_schema():
    init_db()

    assert "app_meta" in inspect(engine).get_table_names()


def test_init_db_recreates_from_scratch():
    init_db()
    with SessionLocal() as session:
        session.add(AppMeta(key="scratch", value="x"))
        session.commit()

    init_db()  # drop + recreate should wipe the scratch row

    with SessionLocal() as session:
        keys = session.execute(select(AppMeta.key)).scalars().all()
    assert "scratch" not in keys
