import os

# The solver tests build their inputs directly and never touch MongoDB.
# An empty MONGO_URI makes db.py pick the in-memory fallback at import time
# instead of trying to reach Atlas from a developer's .env (load_dotenv does
# not override variables that are already set).
os.environ["MONGO_URI"] = ""
