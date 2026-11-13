"""
Road distances and travel times from the HERE Matrix Routing API v8.

requests.post is replaced by a fake whose answers are laid out as in the HERE
docs, so nothing here reaches HERE (conftest.py blocks real HTTP calls). The
live API is not covered by these tests.
"""

import numpy as np
import pytest
import requests

import optimizer_api
from optimizer_api import (
    FleetOptimizer,
    Location,
    OptimizationConfig,
    app,
    build_distance_matrix,
    generate_data,
    haversine_km,
    runs_col,
    solve_baseline,
    to_json_safe,
    travel_matrices,
)
from test_solver import (
    DEPOT,
    POINTS,
    assert_every_stop_once,
    assert_routes_fit_shift,
    make_locations,
    make_vehicle,
)

KEY = "secret-test-key"


class FakeResponse:
    def __init__(self, body, status_code=200):
        self.body, self.status_code = body, status_code

    def json(self):
        if isinstance(self.body, Exception):
            raise self.body
        return self.body


def here_body(distances_m, travel_times_s, error_codes=None):
    """A synchronous matrix response: flat arrays, row by row (origin by origin)."""
    n = len(distances_m)
    matrix = {
        "numOrigins": n,
        "numDestinations": n,
        "travelTimes": [int(t) for row in travel_times_s for t in row],
        "distances": [int(d) for row in distances_m for d in row],
    }
    if error_codes is not None:
        matrix["errorCodes"] = error_codes
    return {
        "matrixId": "0b7f828f-49c8-43e4-9727-063eafbf7d7a",
        "matrix": matrix,
        # autoCircle comes back as the circle HERE derived.
        "regionDefinition": {"type": "circle", "center": {"lat": 24.71, "lng": 46.68},
                             "radius": 12900},
    }


def synthetic_road(coords, seed=7, speed_kmh=30.0):
    """Metres and seconds: the straight line x 1.2-1.5, drawn for each direction."""
    rng = np.random.RandomState(seed)
    n = len(coords)
    metres, seconds = np.zeros((n, n), dtype=int), np.zeros((n, n), dtype=int)
    for i in range(n):
        for j in range(n):
            if i != j:
                m = haversine_km(*coords[i], *coords[j]) * 1000 * rng.uniform(1.2, 1.5)
                metres[i][j] = round(m)
                seconds[i][j] = round(m / 1000 / speed_kmh * 3600)
    return metres, seconds


def coords_of(locations):
    return [(loc.lat, loc.lon) for loc in locations]


def road_matrices(locations, speed_kmh=30.0):
    """What travel_matrices() must return for a synthetic_road() answer."""
    metres, seconds = synthetic_road(coords_of(locations), speed_kmh=speed_kmh)
    return metres / 1000.0, seconds / 60.0


class FakeHere:
    """Stands in for requests.post. reply(coords) returns a FakeResponse or an
    exception to raise; by default it answers with synthetic_road()."""

    def __init__(self):
        self.calls = []
        self.reply = lambda coords: FakeResponse(here_body(*synthetic_road(coords)))

    def post(self, url, params=None, json=None, timeout=None):
        self.calls.append({"url": url, "params": params, "json": json, "timeout": timeout})
        out = self.reply([(o["lat"], o["lng"]) for o in json["origins"]])
        if isinstance(out, Exception):
            raise out
        return out


@pytest.fixture
def here(monkeypatch):
    fake = FakeHere()
    monkeypatch.setenv("HERE_API_KEY", KEY)
    monkeypatch.setattr(optimizer_api.requests, "post", fake.post)
    optimizer_api._here_matrix.cache_clear()
    yield fake
    optimizer_api._here_matrix.cache_clear()


@pytest.fixture
def client():
    runs_col().delete_many({})
    yield app.test_client()
    runs_col().delete_many({})


def route_km(route, dist):
    return sum(dist[a][b] for a, b in zip(route, route[1:]))


def test_request_and_response_follow_the_here_docs(here):
    # The 3 x 3 Berlin example from the HERE Region mode tutorial; the travel
    # times are made up. Both arrays differ by direction.
    points = [(52.52103, 13.41268), (52.51628, 13.37771), (52.47342, 13.40357)]
    locations = [Location(id=i, name=f"P{i}", lat=lat, lon=lon)
                 for i, (lat, lon) in enumerate(points)]
    metres = [[0, 2907, 6446], [3258, 0, 5954], [6669, 5966, 0]]
    seconds = [[0, 420, 780], [455, 0, 700], [810, 705, 0]]
    here.reply = lambda coords: FakeResponse(here_body(metres, seconds))

    dist, road_time, source = travel_matrices(locations)

    assert here.calls == [{
        "url": "https://matrix.router.hereapi.com/v8/matrix",
        "params": {"async": "false", "apiKey": KEY},
        "json": {
            "origins": [{"lat": lat, "lng": lng} for lat, lng in points],
            "regionDefinition": {"type": "autoCircle"},
            "matrixAttributes": ["distances", "travelTimes"],
            "departureTime": "any",
        },
        "timeout": 10.0,
    }]
    assert source == "road"
    assert dist.tolist() == [[0, 2.907, 6.446], [3.258, 0, 5.954], [6.669, 5.966, 0]]
    assert road_time == pytest.approx(
        np.array([[0, 7.0, 13.0], [455 / 60, 0, 700 / 60], [13.5, 11.75, 0]]))
    assert dist[0][1] != dist[1][0] and road_time[0][2] != road_time[2][0]


def bad_length(coords):
    body = here_body(*synthetic_road(coords))
    body["matrix"]["distances"].pop()
    return FakeResponse(body)


def travel_times_only(coords):
    body = here_body(*synthetic_road(coords))
    del body["matrix"]["distances"]
    return FakeResponse(body)


def one_pair_unroutable(coords):
    codes = [0] * len(coords) ** 2
    codes[1] = 2
    return FakeResponse(here_body(*synthetic_road(coords), error_codes=codes))


@pytest.mark.parametrize("reply, reason", [
    # requests names the URL, key included, in its error messages.
    (lambda c: requests.Timeout(f"POST /v8/matrix?apiKey={KEY} timed out"), "Timeout"),
    (lambda c: requests.ConnectionError(f"/v8/matrix?apiKey={KEY}"), "ConnectionError"),
    (lambda c: FakeResponse({"error": "Unauthorized"}, 401), "status 401"),
    (lambda c: FakeResponse({"title": "Rate limit exceeded"}, 429), "status 429"),
    (lambda c: FakeResponse(requests.exceptions.JSONDecodeError("x", "", 0)), "malformed"),
    (lambda c: FakeResponse({"matrixId": "x", "error": {"title": "timeout"}}), "malformed"),
    (bad_length, "malformed"),
    (travel_times_only, "malformed"),
    (one_pair_unroutable, "error codes [2]"),
], ids=["timeout", "connection", "401", "429", "not-json", "no-matrix", "bad-length",
        "no-distances", "error-code"])
def test_falls_back_to_straight_line_and_logs_why(here, caplog, reply, reason):
    locations = make_locations([20] * len(POINTS))
    here.reply = reply

    dist, road_time, source = travel_matrices(locations)

    assert source == "straight_line" and road_time is None
    assert np.array_equal(dist, build_distance_matrix(locations))
    assert len(here.calls) == 1
    warnings = [r.getMessage() for r in caplog.records if r.levelname == "WARNING"]
    assert len(warnings) == 1 and reason in warnings[0]
    assert KEY not in caplog.text


def test_no_key_means_no_request(here, monkeypatch, caplog):
    monkeypatch.setenv("HERE_API_KEY", "")
    locations = make_locations([20] * len(POINTS))

    dist, road_time, source = travel_matrices(locations)

    assert source == "straight_line" and road_time is None
    assert np.array_equal(dist, build_distance_matrix(locations))
    assert here.calls == []
    assert "HERE_API_KEY is not set" in caplog.text


def test_same_coordinates_are_asked_for_once(here):
    locations = make_locations([20] * len(POINTS))
    first = travel_matrices(locations)
    second = travel_matrices(make_locations([50] * len(POINTS)))  # same places
    assert len(here.calls) == 1
    assert first[0] is second[0] and first[1] is second[1]

    travel_matrices(locations[:4])
    assert len(here.calls) == 2


def test_failed_request_is_not_cached(here):
    locations = make_locations([20] * len(POINTS))
    answer = here.reply
    here.reply = lambda coords: requests.Timeout()
    assert travel_matrices(locations)[2] == "straight_line"

    here.reply = answer
    assert travel_matrices(locations)[2] == "road"
    assert len(here.calls) == 2


def one_way_ring(n, with_km, against_km, with_min, against_min):
    """Matrices for points on a one-way ring 0 -> 1 -> ... -> n-1 -> 0."""
    dist = np.full((n, n), float(against_km))
    minutes = np.full((n, n), float(against_min))
    for i in range(n):
        dist[i][(i + 1) % n], minutes[i][(i + 1) % n] = with_km, with_min
        dist[i][i] = minutes[i][i] = 0
    return dist, minutes


def test_solver_reads_each_arc_in_its_own_direction():
    # Driving against the ring is 10 times shorter but far too slow for the
    # 8-hour shift (3 x 200 minutes), so the only plan is 0 -> 1 -> 2 -> 0.
    # Reading any matrix entry the wrong way round gives the reverse route or
    # no route at all.
    locations = make_locations([20, 20])[:3]
    vehicles = [make_vehicle(0)]
    dist, minutes = one_way_ring(3, with_km=10, against_km=1, with_min=10, against_min=200)

    # Nearest neighbour starts against the ring (1 km) and cannot go on.
    baseline = solve_baseline(locations, vehicles, dist, minutes)
    assert [r["route"] for r in baseline["routes"].values()] == [[0, 2, 0]]
    assert baseline["unserved"] == [1]
    assert baseline["total_distance_km"] == 11

    config = OptimizationConfig(time_limit_seconds=None, solver_gap=0.0)
    result = FleetOptimizer(locations, vehicles, config, dist, minutes).solve()
    assert result["status"] == "Optimal", result
    assert [r["route"] for r in result["routes"].values()] == [[0, 1, 2, 0]]
    assert result["total_distance_km"] == 30
    # solve() builds its own baseline; with the road times it is the one above,
    # which leaves a stop out and so cannot be the MILP start.
    assert result["warm_start"] is False
    assert_routes_fit_shift(result, locations, vehicles, minutes)


def test_optimize_uses_one_road_matrix_for_baseline_and_milp(here, client):
    # 4 km/h: slow enough that the 8-hour shift splits the baseline into two
    # routes. On speed_kmh travel times it would be a single route.
    here.reply = lambda coords: FakeResponse(here_body(*synthetic_road(coords, speed_kmh=4.0)))
    res = client.post("/optimize", json={"n_customers": 5, "n_vehicles": 2, "seed": 42,
                                         "time_limit": 20, "solver_gap": 0.0})
    assert res.status_code == 200, res.get_json()
    data = res.get_json()["data"]

    assert data["distance_source"] == "road"
    assert len(here.calls) == 1
    locations, vehicles = generate_data(5, 2, seed=42)
    assert here.calls[0]["json"]["origins"] == [{"lat": lat, "lng": lng}
                                                for lat, lng in coords_of(locations)]
    dist, minutes = road_matrices(locations, speed_kmh=4.0)
    assert data["baseline"] == to_json_safe(solve_baseline(locations, vehicles, dist, minutes))
    assert data["baseline"]["vehicles_used"] == 2
    assert solve_baseline(locations, vehicles, dist)["vehicles_used"] == 1
    for plan in (data["baseline"], data["optimized"]):
        assert plan["routes"]
        for r in plan["routes"].values():
            assert r["distance_km"] == pytest.approx(route_km(r["route"], dist), abs=0.006)
            # Not the straight line, and not the same route driven backwards.
            assert r["distance_km"] > 1.19 * route_km(r["route"], build_distance_matrix(locations))
        assert_routes_fit_shift(plan, locations, vehicles, minutes)
    assert_every_stop_once(data["optimized"], 5)

    # The Live Fleet map shows the saved run and needs no matrix for it.
    fleet = client.get("/fleet-routes").get_json()["data"]
    assert fleet["source"] == "optimized" and fleet["distance_source"] == "road"
    assert len(here.calls) == 1


def test_fleet_routes_baseline_asks_once_for_its_16_points(here, client):
    for _ in range(2):
        res = client.get("/fleet-routes")
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["source"] == "baseline" and data["distance_source"] == "road"
    assert len(here.calls) == 1
    assert len(here.calls[0]["json"]["origins"]) == 16


def test_endpoints_report_straight_line_without_a_key(client):
    # No fake here: conftest.py makes any HTTP call fail the request.
    res = client.get("/fleet-routes")
    assert res.status_code == 200
    assert res.get_json()["data"]["distance_source"] == "straight_line"

    res = client.post("/api/optimize-custom", json={
        "depot": {"lat": DEPOT[0], "lng": DEPOT[1]},
        "customers": [{"lat": lat, "lng": lng} for lat, lng in POINTS[:3]],
        "n_vehicles": 1,
    })
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["data"]["distance_source"] == "straight_line"

    res = client.post("/optimize", json={"n_customers": 5, "n_vehicles": 2, "seed": 42,
                                         "time_limit": 20, "solver_gap": 0.0})
    assert res.status_code == 200, res.get_json()
    data = res.get_json()["data"]
    assert data["distance_source"] == "straight_line"
    locations, _ = generate_data(5, 2, seed=42)
    straight = build_distance_matrix(locations)
    for r in data["optimized"]["routes"].values():
        assert r["distance_km"] == pytest.approx(route_km(r["route"], straight), abs=0.006)
