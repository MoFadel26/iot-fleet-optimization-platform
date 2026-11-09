"""
Solver tests on small fixed inputs (under 15 seconds in total).

Checks the MILP in optimizer_api.FleetOptimizer against the problem
constraints and the nearest-neighbour baseline, both when solved to proven
optimality and when cut off by the time limit.
"""

import pytest

from optimizer_api import (
    FleetOptimizer,
    Location,
    OptimizationConfig,
    Vehicle,
    build_distance_matrix,
    generate_data,
    mip_gap_from_cbc_log,
    solve_baseline,
    status_label,
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
    """Solves to proven optimality (no time limit, zero gap)."""
    w_cost, w_co2, w_fair = weights
    config = OptimizationConfig(w_cost=w_cost, w_co2=w_co2, w_fairness=w_fair,
                                time_limit_seconds=None, solver_gap=0.0)
    result = FleetOptimizer(locations, vehicles, config).solve()
    assert result["status"] == "Optimal", result
    assert result["status_label"] == "Optimal" and result["gap_pct"] == 0
    return result


def assert_every_stop_once(result, n_customers):
    visited = []
    for r in result["routes"].values():
        route = r["route"]
        assert route[0] == 0 and route[-1] == 0, route
        assert 0 not in route[1:-1], route
        visited.extend(route[1:-1])
    assert sorted(visited) == list(range(1, n_customers + 1))


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
    assert_every_stop_once(result, len(locations) - 1)


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
    """Under the default 30 s limit and 5% gap, not only when proven optimal."""
    locations = make_locations(TIGHT_DEMANDS)
    vehicles = [
        make_vehicle(0, capacity=TIGHT_CAPACITY, cost=1.8, co2=0.27),
        make_vehicle(1, capacity=TIGHT_CAPACITY, cost=0.6, co2=0.02),
        make_vehicle(2, capacity=TIGHT_CAPACITY, cost=0.9, co2=0.09),
        make_vehicle(3, capacity=TIGHT_CAPACITY, cost=1.2, co2=0.18),
    ]
    baseline = solve_baseline(locations, vehicles, build_distance_matrix(locations))
    assert sum(len(r["route"]) - 2 for r in baseline["routes"].values()) == len(POINTS)

    w_cost, w_co2, w_fair = weights
    config = OptimizationConfig(w_cost=w_cost, w_co2=w_co2, w_fairness=w_fair)
    assert (config.time_limit_seconds, config.solver_gap) == (30, 0.05)
    optimized = FleetOptimizer(locations, vehicles, config).solve()
    assert optimized["status"] in ("Optimal", "Feasible"), optimized
    assert_every_stop_once(optimized, len(POINTS))
    # Route totals are rounded to 2 decimals, hence the small tolerance.
    assert weighted_objective(optimized, weights) <= weighted_objective(baseline, weights) + 0.05


def test_time_limit_returns_best_found_not_worse_than_baseline():
    # The optimizer page's default size; proving optimality takes about 45 s,
    # so a 1 s limit always stops early.
    locations, vehicles = generate_data(10, 5, seed=42)
    weights = (0.5, 0.3, 0.2)
    baseline = solve_baseline(locations, vehicles, build_distance_matrix(locations))
    config = OptimizationConfig(w_cost=0.5, w_co2=0.3, w_fairness=0.2,
                                time_limit_seconds=1, solver_gap=0.0)
    result = FleetOptimizer(locations, vehicles, config).solve()

    assert result["warm_start"] is True
    assert result["status"] == "Feasible"
    assert result["gap_pct"] > 0
    assert result["status_label"] == f"Best found (gap {result['gap_pct']:.1f}%)"
    assert_every_stop_once(result, 10)
    assert weighted_objective(result, weights) <= weighted_objective(baseline, weights) + 0.05


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


# CBC log excerpts, one per way a solve can end.
GAP_EXIT_LOG = """Cbc0011I Exiting as integer gap of 11.092808 less than 1e-10 or 30%
Result - Optimal solution found (within gap tolerance)
"""
TIME_LIMIT_LOG = """Result - Stopped on time limit

Objective value:                35.75403186
Lower bound:                    27.498
"""
PROVEN_LOG = """Result - Optimal solution found

Objective value:                12.51087493
"""


def test_gap_read_from_cbc_log():
    assert mip_gap_from_cbc_log(GAP_EXIT_LOG, 38.59) == pytest.approx(11.092808 / 38.59)
    assert mip_gap_from_cbc_log(TIME_LIMIT_LOG, 35.754) == pytest.approx((35.754 - 27.498) / 35.754)
    assert mip_gap_from_cbc_log(PROVEN_LOG, 12.51) == 0.0
    assert mip_gap_from_cbc_log("", 12.51) is None


def test_status_label():
    assert status_label(0.0) == "Optimal"
    assert status_label(0.0312) == "Best found (gap 3.1%)"
    assert status_label(None) == "Best found (gap unknown)"


@pytest.mark.parametrize("service_time", [5, 0])
def test_no_subtours_when_stops_share_coordinates(service_time):
    """Stops at the same spot have zero travel time between them.

    With service_time > 0 the MTZ constraints are skipped and the time
    windows must still rule out a closed loop between the twins; with
    service_time == 0 the solver has to fall back to MTZ. A subtour would
    leave those stops off every depot route.
    """
    depot = Location(id=0, name="Depot", lat=DEPOT[0], lon=DEPOT[1],
                     time_window_start=0, time_window_end=1440)
    spots = [POINTS[0], POINTS[0], POINTS[0], POINTS[3], POINTS[3]]
    customers = [
        Location(id=i + 1, name=f"C{i + 1}", lat=lat, lon=lon, demand=20,
                 service_time=service_time, time_window_start=0, time_window_end=1440)
        for i, (lat, lon) in enumerate(spots)
    ]
    vehicles = [make_vehicle(0), make_vehicle(1)]
    result = solve([depot] + customers, vehicles, (0.5, 0.3, 0.2))
    assert_every_stop_once(result, len(customers))
