import os

import pytest

# The solver tests build their inputs directly and never touch MongoDB.
# An empty MONGO_URI makes db.py pick the in-memory fallback at import time
# instead of trying to reach Atlas from a developer's .env (load_dotenv does
# not override variables that are already set).
os.environ["MONGO_URI"] = ""
# Same for the HERE key: without it nothing asks HERE for road distances.
os.environ["HERE_API_KEY"] = ""


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Fails any HTTP call a test does not replace with its own fake."""
    def blocked(*args, **kwargs):
        raise AssertionError("test tried to reach the network")
    monkeypatch.setattr("requests.sessions.Session.request", blocked)
