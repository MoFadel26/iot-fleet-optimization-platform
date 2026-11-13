# IoT Fleet Optimization Platform

An intelligent, multi-objective fleet dispatching and routing platform that combines **operations research and mathematical optimization** with **real-time IoT telemetry** for last-mile logistics.

---

## 1. The Idea & The Challenge

Last-mile delivery is one of the most expensive and carbon-intensive segments of modern supply chains. Fleet managers face three conflicting goals:

1. **Economic Cost**: Fuel expenses, driver hours, and vehicle wear-and-tear.
2. **Environmental Footprint ($CO_2$)**: Fleet decarbonization and sustainable transition toward Electric Vehicles (EVs) subject to battery range constraints.
3. **Workload Equity**: Preventing driver fatigue and unfair schedule distributions across the workforce.

Standard navigation apps and greedy route planners (like nearest-neighbor heuristics) only look at shortest distances. Furthermore, static routing schedules break down in practice due to real-world physical events—such as traffic delays, cargo temperature spikes, or vehicle breakdowns.

---

## 2. The Project Overview

This platform provides an end-to-end operational system connecting managers, drivers, and vehicles:

- **Web Command Dashboard**: Interactive live fleet map, route test sandboxes with Saudi address geocoding, multi-objective optimization tuning, and compliance audits.
- **Driver Mobile Experience**: Real-time stop execution, turn-by-turn navigation, cargo health monitoring, and issue reporting.
- **Real-Time IoT Telemetry**: Telemetry streaming (cargo temperature, motion states, speed, GPS) paired with an automated disruption detection engine.

```
[Customer Orders & Depot] ──► [Mathematical Optimization Engine]
                                         │
                                         ▼
                            [Optimized Dispatch Plan]
                                   │          │
                     (Fleet Manager)          (Mobile Driver)
                                   ▲          │
                                   │          ▼
                        [Automated Reroute] ◄── [IoT Disruption Detector]
```

---

## 3. The Optimization & Machine Learning Engine

The core calculation service models the delivery network as a **Multi-Objective Vehicle Routing Problem with Time Windows (MO-VRPTW)**, formulated as a **Mixed-Integer Linear Program (MILP)** solved using the **COIN-OR Branch-and-Cut (CBC)** engine.

### A. Decision Variables

- $x_{ijk} \in \{0, 1\}$: Binary arc choice: equals $1$ if vehicle $k$ drives directly from location $i$ to location $j$.
- $y_k \in \{0, 1\}$: Binary deployment choice: equals $1$ if vehicle $k$ leaves the depot.
- $s_{ik} \ge 0$: Arrival / service start time of vehicle $k$ at stop $i$.
- $L_k \ge 0$: Total route distance driven by vehicle $k$.
- $L_{\max}, L_{\min} \ge 0$: Minimax auxiliary bounds measuring driver workload spread.

---

### B. Multi-Objective Function

Rather than minimizing pure travel distance, the solver uses a parameterized scalarization that allows fleet operators to balance three competing objectives:

$$\min \quad w_{\text{cost}} \cdot \frac{\text{Cost}}{\text{Cost}^{\text{NN}}} \;+\; w_{\text{co2}} \cdot \frac{\text{CO}_2}{\text{CO}_2^{\text{NN}}} \;+\; w_{\text{fairness}} \cdot \frac{\text{Fairness}}{L_{\max}^{\text{NN}}}$$

Each term is divided by its value in the nearest-neighbor baseline plan (section D): the baseline's total cost $\text{Cost}^{\text{NN}}$, its total $CO_2$ $\text{CO}_2^{\text{NN}}$, and the length of its longest route $L_{\max}^{\text{NN}}$. All three terms are then unitless fractions of the baseline, so the weights compare like with like and the routes do not change with the currency or the $CO_2$ unit. If the baseline's cost or $CO_2$ is zero because every vehicle it used has a zero rate, the baseline distance priced at the fleet's mean rate is used instead.

$$\text{Cost} = \sum_{k} \sum_{i} \sum_{j \neq i} c_k \cdot d_{ij} \cdot x_{ijk}$$

$$\text{CO}_2 = \sum_{k} \sum_{i} \sum_{j \neq i} e_k \cdot d_{ij} \cdot x_{ijk}$$

$$\text{Fairness} = L_{\max} - L_{\min}$$

- **Cost Optimization ($c_k$)**: Considers vehicle-specific fuel/electricity operating costs per kilometer.
- **$CO_2$ Decarbonization ($e_k$)**: Differentiates internal combustion engines (ICE), hybrids, and zero-tailpipe-emission electric vehicles (EVs).
- **Workload Balance**: Minimizes the difference between the longest and shortest routes across active drivers ($L_{\max} - L_{\min}$).

---

### C. Operational Constraints

1. **Guaranteed Delivery**: Every customer is served exactly once by one vehicle.
2. **Network Flow Conservation**: If a vehicle arrives at a stop, it must leave that stop.
3. **Heterogeneous Vehicle Capacity**: Cargo demand on route $k$ cannot exceed vehicle capacity $Q_k$.
4. **EV Range Limits**: Total route distance cannot exceed the vehicle's maximum driving range $R_k$.
5. **Time Windows (Big-M Formulation)**: Deliveries must occur within customer time windows $[e_j, l_j]$:
   $$s_{jk} \ge s_{ik} + \tau_i + t_{ijk} - M_{ij}(1 - x_{ijk})$$
   *(where $\tau_i$ is service time, $t_{ijk}$ is travel time, and $M_{ij}$ is the minimum valid upper bound)*.
6. **Maximum Driver Shift**: The time from leaving the depot to returning to it (driving, service, and waiting for time windows to open) cannot exceed the driver shift limit $T_k^{\max}$.
7. **Fairness Envelope**: Enforces $L_{\max} \ge L_k$ and $L_{\min} \le L_k$ for all active vehicles.

---

### D. Heuristic Warm-Start & Street-Level Geometry

- **Greedy Baseline Heuristic**: A nearest-neighbor algorithm rapidly constructs a valid baseline.
- **MIP Warm-Start Injection**: The baseline is injected as the initial feasible integer solution (incumbent) into the Branch-and-Cut solver, ensuring fast convergence and guaranteeing that the solver's output is always as good as or better than the heuristic.
- **Road-Network Projection**: Solved point-to-point sequences are projected onto real street networks using OpenStreetMap / OSRM routing.

---

## 4. Closed-Loop IoT Disruption Feedback

When vehicles are in transit, continuous telemetry is evaluated against operating thresholds:

| IoT Sensor / Event | Detected Condition | Algorithmic Reaction |
|---|---|---|
| **Cargo Temperature** | Exceeds perishable safety threshold ($>32^\circ\text{C}$) | Raises critical alert; flags route for emergency priority delivery or depot return. |
| **Motion & Speed** | Prolonged unplanned stop or sharp deceleration | Identifies vehicle breakdown or road accident. |
| **GPS Fix & Connectivity** | Lost satellite lock or dropped packets | Flags connection reliability and triggers fallback estimation. |
| **Dynamic Recalculation** | Triggered by active disruption | Perturbs affected waypoints and recalculates alternative street routes around bottlenecks. |

---

## 5. Technology Stack Summary

- **Optimization Core**: Python, PuLP, COIN-OR CBC MILP Solver, NumPy.
- **Backend API**: Flask, Gunicorn, MongoDB.
- **Frontend Dashboard & Mobile App**: React 18, TypeScript, Tailwind CSS, Leaflet.
- **IoT & Hardware Integration**: ESP32 firmware, DHT temperature/humidity sensors, accelerometer motion states.
