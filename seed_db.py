"""
One-time seed script — populates MongoDB with:
  • areas              (Riyadh delivery zones)
  • vehicles           (fleet specs)
  • depot              (warehouse location)
  • optimization_config (solver defaults)

Run once:
  python seed_db.py

Safe to re-run — it clears and re-inserts each collection.
"""

import sys

from db import areas_col, vehicles_col, depot_col, config_col, is_offline

# ── 1. Riyadh delivery areas ───────────────────────────────────────────────────
AREAS = [
    {"name": "Al Olaya",           "lat": 24.6900, "lon": 46.6850},
    {"name": "Al Malaz",           "lat": 24.6650, "lon": 46.7200},
    {"name": "Al Murabba",         "lat": 24.6500, "lon": 46.7100},
    {"name": "Sulaimaniyah",       "lat": 24.6950, "lon": 46.6600},
    {"name": "Al Wurud",           "lat": 24.6800, "lon": 46.6900},
    {"name": "Al Rawdah",          "lat": 24.7300, "lon": 46.7200},
    {"name": "Al Nakheel",         "lat": 24.7650, "lon": 46.6350},
    {"name": "Al Sahafah",         "lat": 24.7900, "lon": 46.6500},
    {"name": "Al Yasmin",          "lat": 24.8100, "lon": 46.6200},
    {"name": "Al Narjis",          "lat": 24.8300, "lon": 46.6100},
    {"name": "Al Suwaidi",         "lat": 24.6100, "lon": 46.6400},
    {"name": "Al Shifa",           "lat": 24.5800, "lon": 46.7000},
    {"name": "Al Aziziyah",        "lat": 24.6300, "lon": 46.7800},
    {"name": "King Fahd District", "lat": 24.7100, "lon": 46.7500},
    {"name": "Al Hamra",           "lat": 24.7400, "lon": 46.6100},
    {"name": "Al Rabwah",          "lat": 24.6700, "lon": 46.7400},
    {"name": "Hittin",             "lat": 24.7700, "lon": 46.6000},
    {"name": "Al Mursalat",        "lat": 24.7200, "lon": 46.6400},
    {"name": "Tuwaiq",             "lat": 24.6250, "lon": 46.5900},
    {"name": "Al Khaleej",         "lat": 24.7050, "lon": 46.7600},
]

# ── 2. Vehicle fleet specs ─────────────────────────────────────────────────────
VEHICLES = [
    {
        "name": "Truck-ICE-1",  "vehicle_type": "ICE",
        "capacity": 500,        "cost_per_km": 1.80,
        "co2_per_km": 0.27,     "max_range": 400,
        "max_shift_hours": 8.0, "active": True,
    },
    {
        "name": "Truck-ICE-2",  "vehicle_type": "ICE",
        "capacity": 500,        "cost_per_km": 1.80,
        "co2_per_km": 0.27,     "max_range": 400,
        "max_shift_hours": 8.0, "active": True,
    },
    {
        "name": "Van-ICE-1",    "vehicle_type": "ICE",
        "capacity": 500,        "cost_per_km": 1.20,
        "co2_per_km": 0.18,     "max_range": 350,
        "max_shift_hours": 8.0, "active": True,
    },
    {
        "name": "Van-EV-1",     "vehicle_type": "EV",
        "capacity": 200,        "cost_per_km": 0.60,
        "co2_per_km": 0.02,     "max_range": 150,
        "max_shift_hours": 8.0, "active": True,
    },
    {
        "name": "Van-EV-2",     "vehicle_type": "EV",
        "capacity": 200,        "cost_per_km": 0.60,
        "co2_per_km": 0.02,     "max_range": 150,
        "max_shift_hours": 8.0, "active": True,
    },
    {
        "name": "Van-Hybrid-1", "vehicle_type": "Hybrid",
        "capacity": 300,        "cost_per_km": 0.90,
        "co2_per_km": 0.09,     "max_range": 250,
        "max_shift_hours": 8.0, "active": True,
    },
    {
        "name": "Pickup-ICE-1", "vehicle_type": "ICE",
        "capacity": 500,        "cost_per_km": 1.00,
        "co2_per_km": 0.15,     "max_range": 300,
        "max_shift_hours": 8.0, "active": True,
    },
]

# ── 3. Depot (warehouse) ───────────────────────────────────────────────────────
DEPOT = {
    "name": "Depot (Riyadh Warehouse)",
    "lat": 24.7136,
    "lon": 46.6753,
    "time_window_start": 300,   # 05:00
    "time_window_end":   1380,  # 23:00
}

# ── 4. Solver defaults ─────────────────────────────────────────────────────────
DEFAULT_CONFIG = {
    "w_cost":                 0.5,
    "w_co2":                  0.3,
    "w_fairness":             0.2,
    "time_limit_seconds":     30,    # stop after 30 s with the best routes found (None = no limit)
    "solver_gap":             0.05,  # stop once within 5% of the best bound (0 = prove optimal)
    "cost_reduction_target":  0.15,
    "co2_reduction_target":   0.10,
}


def seed():
    if is_offline():
        sys.exit("Cannot seed: MongoDB is not configured or not reachable. Check MONGO_URI in .env.")
    print("Seeding MongoDB …")

    col = areas_col()
    col.delete_many({})
    col.insert_many(AREAS)
    print(f"  areas:               {len(AREAS)} documents")

    col = vehicles_col()
    col.delete_many({})
    col.insert_many(VEHICLES)
    print(f"  vehicles:            {len(VEHICLES)} documents")

    col = depot_col()
    col.delete_many({})
    col.insert_one(DEPOT)
    print(f"  depot:               1 document")

    col = config_col()
    col.delete_many({})
    col.insert_one(DEFAULT_CONFIG)
    print(f"  optimization_config: 1 document")

    print("Done! MongoDB is seeded.")


if __name__ == "__main__":
    seed()
