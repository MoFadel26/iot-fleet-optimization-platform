"""
Solver tests on small fixed inputs (a few seconds in total).

Checks the MILP in optimizer_api.FleetOptimizer against the problem
constraints and the nearest-neighbour baseline.
"""

import pytest

from optimizer_api import (
    FleetOptimizer,
    Location,
    OptimizationConfig,
    Vehicle,
    build_distance_matrix,
    solve_baseline,
)

DEPOT = (24.7136, 46.6753)  # seed_db.DEPOT

# Six Riyadh delivery areas from seed_db.AREAS.
POINTS = [
    (24.6900, 46.6850),  # Al Olaya
    (24.6650, 46.7200),  # Al Malaz
    (24.6950, 46.6600),  # Sulaimaniyah
    (24.7300, 46.7200),  # Al Rawdah
    (24.7650, 46.6350),  # Al Nakheel
    (24.7200, 46.6400),  # Al Mursalat
]


def make_locations(demands):
    depot = Location(id=0, name="Depot", lat=DEPOT[0], lon=DEPOT[1],
                     time_window_start=0, time_window_end=1440)
    customers = [
        Location(id=i + 1, name=f"C{i + 1}", lat=lat, lon=lon, demand=d,
                 service_time=5, time_window_start=0, time_window_end=1440)
        for i, ((lat, lon), d) in enumerate(zip(POINTS, demands))
    ]
    return [depot] + customers


def make_vehicle(i, capacity=500, cost=1.0, co2=0.1):
    return Vehicle(id=i, name=f"V{i}", vehicle_type="ICE", capacity=capacity,
                   cost_per_km=cost, co2_per_km=co2, max_range=400,
                   max_shift_hours=8.0, speed_kmh=40.0)


def solve(locations, vehicles, weights):
    w_cost, w_co2, w_fair = weights
    config = OptimizationConfig(w_cost=w_cost, w_co2=w_co2, w_fairness=w_fair,
                                time_limit_seconds=None, solver_gap=0.0)
    result = FleetOptimizer(locations, vehicles, config).solve()
    assert result["status"] == "Optimal", result
    return result


def weighted_objective(result, weights):
    """The MILP objective, recomputed from a result's routes."""
    w_cost, w_co2, w_fair = weights
    dists = [r["distance_km"] for r in result["routes"].values()]
    spread = max(dists) - min(dists) if dists else 0.0
    return w_cost * result["total_cost_sar"] + w_co2 * result["total_co2_kg"] + w_fair * spread


# Total demand 300 with capacity 120: needs at least three vehicles.
TIGHT_DEMANDS = [60, 40, 50, 70, 30, 50]
TIGHT_CAPACITY = 120


@pytest.fixture(scope="module")
def tight_case():
    locations = make_locations(TIGHT_DEMANDS)
    vehicles = [make_vehicle(i, capacity=TIGHT_CAPACITY) for i in range(3)]
    result = solve(locations, vehicles, (0.5, 0.3, 0.2))
    return locations, vehicles, result


def test_every_stop_assigned_exactly_once(tight_case):
    locations, _, result = tight_case
    visited = []
    for r in result["routes"].values():
        route = r["route"]
        assert route[0] == 0 and route[-1] == 0, route
        assert 0 not in route[1:-1], route
        visited.extend(route[1:-1])
    assert sorted(visited) == list(range(1, len(locations)))


def test_vehicle_capacity_respected(tight_case):
    locations, vehicles, result = tight_case
    by_name = {v.name: v for v in vehicles}
    for r in result["routes"].values():
        load = sum(locations[c].demand for c in r["route"] if c != 0)
        assert load == pytest.approx(r["load_kg"])
        assert load <= by_name[r["vehicle"]].capacity
    # Capacity is binding: 300 kg needs all three 120 kg vehicles.
    assert result["vehicles_used"] == 3


@pytest.mark.parametrize("weights", [(0.5, 0.3, 0.2), (0.7, 0.2, 0.1), (0.2, 0.2, 0.6)])
def test_milp_not_worse_than_nearest_neighbour(weights):
    locations = make_locations(TIGHT_DEMANDS)
    vehicles = [
        make_vehicle(0, capacity=TIGHT_CAPACITY, cost=1.8, co2=0.27),
        make_vehicle(1, capacity=TIGHT_CAPACITY, cost=0.6, co2=0.02),
        make_vehicle(2, capacity=TIGHT_CAPACITY, cost=0.9, co2=0.09),
        make_vehicle(3, capacity=TIGHT_CAPACITY, cost=1.2, co2=0.18),
    ]
    baseline = solve_baseline(locations, vehicles, build_distance_matrix(locations))
    assert sum(len(r["route"]) - 2 for r in baseline["routes"].values()) == len(POINTS)

    optimized = solve(locations, vehicles, weights)
    # Route totals are rounded to 2 decimals, hence the small tolerance.
    assert weighted_objective(optimized, weights) <= weighted_objective(baseline, weights) + 0.05


def test_higher_co2_weight_lowers_emissions():
    # One cheap-but-dirty and one expensive-but-clean vehicle, each able to
    # serve every stop, so the weights decide which one is used.
    locations = make_locations([20] * len(POINTS))
    vehicles = [
        make_vehicle(0, cost=0.5, co2=0.30),
        make_vehicle(1, cost=2.0, co2=0.02),
    ]
    cost_heavy = solve(locations, vehicles, (0.9, 0.1, 0.0))
    co2_heavy = solve(locations, vehicles, (0.1, 0.9, 0.0))

    assert co2_heavy["total_co2_kg"] < cost_heavy["total_co2_kg"]
    assert cost_heavy["total_cost_sar"] <= co2_heavy["total_cost_sar"]
