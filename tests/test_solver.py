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
    build_time_matrix,
    generate_data,
    mip_gap_from_cbc_log,
    route_fits_time_limits,
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


def min_clock_minutes(locations, vehicle, route):
    """Shortest depot-to-depot clock time of a route; None if a window is missed.

    With T(a, b) the service plus travel time along the route from a to b,
    service at stop j starts at the largest of departure + T(depot, j) and
    e_i + T(i, j) over the stops i up to j. Leaving as late as the windows
    allow gives the least waiting.
    """
    tm = build_time_matrix(build_distance_matrix(locations), vehicle.speed_kmh)
    cum = [0.0]
    for a, b in zip(route, route[1:]):
        cum.append(cum[-1] + locations[a].service_time + tm[a][b])
    stops = [(cum[p], locations[route[p]]) for p in range(1, len(route) - 1)]
    for p, (t_j, j) in enumerate(stops):
        if any(i.time_window_start + t_j - t_i > j.time_window_end for t_i, i in stops[:p + 1]):
            return None
    depart = min([locations[0].time_window_end] + [j.time_window_end - t_j for t_j, j in stops])
    if depart < 0:
        return None
    back = max([depart + cum[-1]] + [j.time_window_start + cum[-1] - t_j for t_j, j in stops])
    return back - depart


def assert_routes_fit_shift(result, locations, vehicles):
    for k, r in result["routes"].items():
        minutes = min_clock_minutes(locations, vehicles[int(k)], r["route"])
        assert minutes is not None, r["route"]
        assert minutes <= vehicles[int(k)].max_shift_hours * 60 + 1e-6, (r["route"], minutes)


def weighted_objective(result, weights, refs):
    """The MILP objective as a fraction of the baseline, from a result's routes.

    refs is FleetOptimizer._objective_refs(baseline).
    """
    w_cost, w_co2, w_fair = weights
    cost_ref, co2_ref, fair_ref = refs
    dists = [r["distance_km"] for r in result["routes"].values()]
    spread = max(dists) - min(dists) if dists else 0.0
    return (w_cost * result["total_cost_sar"] / cost_ref
            + w_co2 * result["total_co2_kg"] / co2_ref + w_fair * spread / fair_ref)


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


def test_shift_respected(tight_case):
    locations, vehicles, result = tight_case
    assert_routes_fit_shift(result, locations, vehicles)


def test_waiting_for_a_time_window_counts_towards_the_shift():
    # Two stops a few minutes of driving apart, but the second opens nine
    # hours after the first closes. One vehicle serving both would be out for
    # more than its 8-hour shift, most of it waiting.
    depot = Location(id=0, name="Depot", lat=DEPOT[0], lon=DEPOT[1],
                     time_window_start=0, time_window_end=1440)
    morning = Location(id=1, name="Morning", lat=POINTS[0][0], lon=POINTS[0][1], demand=20,
                       service_time=5, time_window_start=480, time_window_end=540)
    evening = Location(id=2, name="Evening", lat=POINTS[1][0], lon=POINTS[1][1], demand=20,
                       service_time=5, time_window_start=1080, time_window_end=1140)
    locations = [depot, morning, evening]
    vehicles = [make_vehicle(0), make_vehicle(1)]
    shift = vehicles[0].max_shift_hours * 60

    # Travel plus service alone is far below the shift; the clock time is not.
    tm = build_time_matrix(build_distance_matrix(locations), vehicles[0].speed_kmh)
    assert tm[0][1] + 5 + tm[1][2] + 5 + tm[2][0] < 60
    assert min_clock_minutes(locations, vehicles[0], [0, 1, 2, 0]) > shift

    assert not route_fits_time_limits([0, 1, 2, 0], locations, vehicles[0], tm)
    # A route may leave the depot late, so a stop that opens at 18:00 is fine.
    assert route_fits_time_limits([0, 2, 0], locations, vehicles[0], tm)

    result = solve(locations, vehicles, (0.5, 0.3, 0.2))
    assert_every_stop_once(result, 2)
    assert result["vehicles_used"] == 2
    assert_routes_fit_shift(result, locations, vehicles)
    # Nearest neighbour keeps the stops on separate vehicles, so its routes
    # are a valid start.
    assert result["warm_start"] is True


def make_timed_locations(windows):
    """Depot plus one stop per (start, end) window, at POINTS in order."""
    depot = Location(id=0, name="Depot", lat=DEPOT[0], lon=DEPOT[1],
                     time_window_start=0, time_window_end=1440)
    customers = [
        Location(id=i + 1, name=f"C{i + 1}", lat=lat, lon=lon, demand=20,
                 service_time=5, time_window_start=start, time_window_end=end)
        for i, ((lat, lon), (start, end)) in enumerate(zip(POINTS, windows))
    ]
    return [depot] + customers


@pytest.mark.parametrize("windows", [
    [(600, 660), (480, 540)],    # the second stop closes before the first opens
    [(480, 540), (1080, 1140)],  # nine hours of waiting: longer than the shift
])
def test_baseline_obeys_time_windows_and_shift(windows):
    locations = make_timed_locations(windows)
    vehicles = [make_vehicle(0), make_vehicle(1)]
    dist = build_distance_matrix(locations)

    # By distance alone nearest neighbour drives 0 -> 1 -> 2 -> 0 on one
    # vehicle, which the time rules forbid.
    assert dist[0][1] < dist[0][2]
    plain = min_clock_minutes(locations, vehicles[0], [0, 1, 2, 0])
    assert plain is None or plain > vehicles[0].max_shift_hours * 60

    baseline = solve_baseline(locations, vehicles, dist)
    assert_every_stop_once(baseline, 2)
    assert_routes_fit_shift(baseline, locations, vehicles)
    assert baseline["unserved"] == []

    result = solve(locations, vehicles, (0.5, 0.3, 0.2))
    assert result["warm_start"] is True
    assert FleetOptimizer(locations, vehicles).compare(baseline, result)["baseline_served_all"] is True


def test_baseline_reports_stops_it_cannot_serve():
    # Stop 3 is nearest to the depot, so the first vehicle starts there. Stop 1
    # has closed by then and stop 2 opens nine hours later, so it takes neither.
    # The second vehicle takes stop 1 and cannot wait for stop 2 either. The
    # MILP serves all three: 1 then 3 on one vehicle, 2 on the other.
    locations = make_timed_locations([(480, 540), (1200, 1260), (600, 660)])
    vehicles = [make_vehicle(0), make_vehicle(1)]

    baseline = solve_baseline(locations, vehicles, build_distance_matrix(locations))
    assert [r["route"] for r in baseline["routes"].values()] == [[0, 3, 0], [0, 1, 0]]
    assert baseline["unserved"] == [2]
    assert_routes_fit_shift(baseline, locations, vehicles)

    result = solve(locations, vehicles, (0.5, 0.3, 0.2))
    assert_every_stop_once(result, 3)
    assert result["warm_start"] is False
    assert FleetOptimizer(locations, vehicles).compare(baseline, result)["baseline_served_all"] is False


def test_infeasible_when_no_shift_spans_the_time_windows():
    # Three stops whose windows are at least four hours apart, and two
    # vehicles with 3-hour and 1-hour shifts: each can serve one stop at most.
    # CBC 2.10.3 returned a three-stop route for this exact instance, labelled
    # optimal, before solve() re-solved without preprocessing.
    depot = Location(id=0, name="Depot", lat=24.714, lon=46.675,
                     time_window_start=0, time_window_end=1440)
    stops = [(24.647, 46.745, 20, 0, 240), (24.731, 46.683, 60, 900, 960),
             (24.810, 46.633, 60, 480, 540)]
    customers = [
        Location(id=i + 1, name=f"C{i + 1}", lat=lat, lon=lon, demand=demand,
                 service_time=5, time_window_start=start, time_window_end=end)
        for i, (lat, lon, demand, start, end) in enumerate(stops)
    ]
    vehicles = [
        Vehicle(id=0, name="V0", vehicle_type="ICE", capacity=500, cost_per_km=1.8,
                co2_per_km=0.02, max_range=400, max_shift_hours=3.0, speed_kmh=30.0),
        Vehicle(id=1, name="V1", vehicle_type="ICE", capacity=100, cost_per_km=0.6,
                co2_per_km=0.02, max_range=400, max_shift_hours=1.0, speed_kmh=40.0),
    ]
    config = OptimizationConfig(time_limit_seconds=None, solver_gap=0.0)
    result = FleetOptimizer([depot] + customers, vehicles, config).solve()
    assert result["status"] == "Infeasible", result


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
    optimizer = FleetOptimizer(locations, vehicles, config)
    optimized = optimizer.solve()
    assert optimized["status"] in ("Optimal", "Feasible"), optimized
    assert_every_stop_once(optimized, len(POINTS))
    refs = optimizer._objective_refs(baseline)
    # Route totals are rounded to 2 decimals, hence the small tolerance.
    assert (weighted_objective(optimized, weights, refs)
            <= weighted_objective(baseline, weights, refs) + 0.002)


def test_time_limit_returns_best_found_not_worse_than_baseline():
    # The optimizer page's default size; proving optimality takes about 45 s,
    # so a 1 s limit always stops early.
    locations, vehicles = generate_data(10, 5, seed=42)
    weights = (0.5, 0.3, 0.2)
    baseline = solve_baseline(locations, vehicles, build_distance_matrix(locations))
    config = OptimizationConfig(w_cost=0.5, w_co2=0.3, w_fairness=0.2,
                                time_limit_seconds=1, solver_gap=0.0)
    optimizer = FleetOptimizer(locations, vehicles, config)
    result = optimizer.solve()

    assert result["warm_start"] is True
    assert result["status"] == "Feasible"
    assert result["gap_pct"] > 0
    assert result["status_label"] == f"Best found (gap {result['gap_pct']:.1f}%)"
    assert_every_stop_once(result, 10)
    assert_routes_fit_shift(result, locations, vehicles)
    refs = optimizer._objective_refs(baseline)
    assert (weighted_objective(result, weights, refs)
            <= weighted_objective(baseline, weights, refs) + 0.002)


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


@pytest.mark.parametrize("rate", ["cost_per_km", "co2_per_km"])
def test_plan_does_not_depend_on_the_unit_of_cost_or_co2(rate):
    # Three vehicles that each can serve every stop: cheap and dirty,
    # expensive and clean, and one in between. Quoting one rate in a unit
    # 1000 times smaller (grams for kg) must leave the plan as it is. With
    # the raw sum of cost, CO2 and km, the inflated numbers took over the
    # objective and moved the stops from the middle vehicle to the cheapest
    # or the cleanest one.
    locations = make_locations([20] * len(POINTS))
    weights = (0.2, 0.7, 0.1)

    def plan(factor):
        vehicles = [make_vehicle(0, cost=0.5, co2=0.30),
                    make_vehicle(1, cost=2.0, co2=0.02),
                    make_vehicle(2, cost=1.0, co2=0.10)]
        for v in vehicles:
            setattr(v, rate, getattr(v, rate) * factor)
        return solve(locations, vehicles, weights)

    plain, scaled = plan(1), plan(1000)
    scale = {"total_cost_sar": 1, "total_co2_kg": 1}
    scale["total_cost_sar" if rate == "cost_per_km" else "total_co2_kg"] = 1000
    for total, factor in scale.items():
        # Route totals are rounded to 2 decimals.
        assert scaled[total] / factor == pytest.approx(plain[total], abs=0.02)
    assert scaled["total_distance_km"] == pytest.approx(plain["total_distance_km"], abs=0.02)
    assert scaled["workload_balance"] == plain["workload_balance"]


def test_co2_still_counts_when_the_baseline_emits_nothing():
    # Nearest neighbour puts every stop on the first vehicle, which has zero
    # CO2, so the baseline CO2 is 0 and cannot be the scale of the CO2 term.
    # The second vehicle is cheaper and emits, so the term must still decide.
    locations = make_locations([20] * len(POINTS))
    vehicles = [make_vehicle(0, cost=2.0, co2=0.0), make_vehicle(1, cost=0.5, co2=0.30)]
    baseline = solve_baseline(locations, vehicles, build_distance_matrix(locations))
    assert list(baseline["routes"]) == ["0"] and baseline["total_co2_kg"] == 0

    co2_heavy = solve(locations, vehicles, (0.1, 0.9, 0.0))
    cost_heavy = solve(locations, vehicles, (0.9, 0.1, 0.0))
    assert_every_stop_once(co2_heavy, len(POINTS))
    assert_every_stop_once(cost_heavy, len(POINTS))
    assert co2_heavy["total_co2_kg"] == 0
    assert cost_heavy["total_co2_kg"] > 0
    assert cost_heavy["total_cost_sar"] < co2_heavy["total_cost_sar"]

    # A fleet with no emissions at all: the CO2 term is 0 for every plan.
    clean = [make_vehicle(0, cost=2.0, co2=0.0), make_vehicle(1, cost=0.5, co2=0.0)]
    result = solve(locations, clean, (0.1, 0.9, 0.0))
    assert_every_stop_once(result, len(POINTS))
    assert list(result["routes"]) == ["1"]


def test_infeasible_when_no_vehicle_can_carry_any_stop():
    # The baseline has no route at all, so there is nothing to scale by.
    locations = make_locations([200] * len(POINTS))
    vehicles = [make_vehicle(0, capacity=100), make_vehicle(1, capacity=100)]
    config = OptimizationConfig(time_limit_seconds=None, solver_gap=0.0)
    result = FleetOptimizer(locations, vehicles, config).solve()
    assert result["status"] == "Infeasible", result


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
