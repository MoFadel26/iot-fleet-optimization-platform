"""
MongoDB connection + collection helpers.
Call get_db() anywhere to get the database handle.

If MONGO_URI is missing or the server can't be reached, the app falls back to
an in-memory database (mongomock) seeded with the same data as seed_db.py.
Writes in that mode (e.g. optimization runs) are lost on restart.
"""

import os
import logging

import mongomock
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("db")

_client = None
_offline = False


def _offline_client():
    # Imported here: seed_db imports this module at load time.
    from seed_db import AREAS, VEHICLES, DEPOT, DEFAULT_CONFIG

    client = mongomock.MongoClient()
    db = client[os.environ.get("MONGO_DB", "fleet_optimizer")]
    # Copy the dicts: insert_* adds an _id to the documents it is given.
    db["areas"].insert_many([dict(a) for a in AREAS])
    db["vehicles"].insert_many([dict(v) for v in VEHICLES])
    db["depot"].insert_one(dict(DEPOT))
    db["optimization_config"].insert_one(dict(DEFAULT_CONFIG))
    return client


def get_client():
    global _client, _offline
    if _client is not None:
        return _client

    uri = os.environ.get("MONGO_URI", "").strip()
    reason = None
    if not uri:
        reason = "MONGO_URI is not set"
    else:
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            _client = client
            return _client
        except Exception as e:
            reason = f"cannot reach MongoDB ({type(e).__name__}: {e})"

    log.warning("%s. Using in-memory seed data; runs are kept until restart only.", reason)
    _offline = True
    _client = _offline_client()
    return _client


def is_offline() -> bool:
    get_client()
    return _offline


def get_db():
    db_name = os.environ.get("MONGO_DB", "fleet_optimizer")
    return get_client()[db_name]


# ── Convenience accessors ──────────────────────────────────────────────────────

def areas_col():
    return get_db()["areas"]

def vehicles_col():
    return get_db()["vehicles"]

def depot_col():
    return get_db()["depot"]

def config_col():
    return get_db()["optimization_config"]

def runs_col():
    return get_db()["optimization_runs"]
