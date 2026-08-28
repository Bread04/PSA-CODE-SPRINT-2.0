"""Spec 3.2: pure yard-load-balancing decision helper (FR17).

Epic 3's second Scalability & Responsible-AI proof point: the pipeline must
extend to a second terminal cluster (Pasir Panjang P2) without redesign. This
module is the *only* new code in the decision path - a pure, deterministic
helper that decides, from a per-block utilization dict, whether a Pasir Panjang
reroute option should be offered, and formats the two-block load string.

Purity contract (mirrors the specialist pure-data modules): NO imports from
``orchestrator/``, ``policy/``, ``agents/base.py``, ``agents/dispatch.py``, no
network, no wall-clock. Utilization reaches this helper only via the correlated
signal's ``payload["yard_utilization"] = {"tuas_c7": <0..1>,
"pasir_panjang_p2": <0..1>}``, which ``IncidentRegistry.correlate()`` deep-copies
onto the ``CORRELATE`` trace entry and ``_incident_summary()`` renders into the
specialist brief unchanged.

Every function is total: malformed / missing / out-of-range input yields
``False`` / ``""``, never an exception.
"""

from __future__ import annotations

# Demo-tuned, no AD backing: 0.85 trips on the Story 3.2 demo incident (Tuas C7
# 93%); a nominally <70% P2 is treated as having reroute headroom.
# Tuas C7 is "under pressure" at or above this utilization fraction.
TUAS_HIGH_THRESHOLD = 0.85
# Pasir Panjang P2 can absorb a reroute only while below this utilization.
PASIR_PANJANG_HEADROOM_CEILING = 0.70


def _real_fraction(value: object) -> float | None:
    """Return ``value`` as a float iff it is a real number in ``[0, 1]``; else ``None``.

    ``bool`` is rejected explicitly (``True``/``False`` are ``int`` subclasses and
    must never read as a utilization fraction).
    """
    if isinstance(value, bool):
        return None
    if not isinstance(value, (int, float)):
        return None
    numeric = float(value)
    if numeric != numeric:  # NaN
        return None
    if not 0.0 <= numeric <= 1.0:
        return None
    return numeric


def _block(util: object, key: str) -> float | None:
    """Extract ``util[key]`` as a validated fraction, tolerating a non-dict ``util``."""
    if not isinstance(util, dict):
        return None
    return _real_fraction(util.get(key))


def tuas_utilization_high(util: object) -> bool:
    """True iff ``util['tuas_c7']`` is a real number in ``[0, 1]`` and ``>= 0.85``."""
    value = _block(util, "tuas_c7")
    return value is not None and value >= TUAS_HIGH_THRESHOLD


def pasir_panjang_reroute_available(util: object) -> bool:
    """True iff ``util['pasir_panjang_p2']`` is a real number in ``[0, 1]`` and ``< 0.70``."""
    value = _block(util, "pasir_panjang_p2")
    return value is not None and value < PASIR_PANJANG_HEADROOM_CEILING


def should_offer_pasir_panjang(util: object) -> bool:
    """True iff Tuas C7 is under pressure AND Pasir Panjang P2 has headroom to absorb it."""
    return tuas_utilization_high(util) and pasir_panjang_reroute_available(util)


def format_block_utilization(util: object) -> str:
    """Render ``"Tuas C7 93% · Pasir Panjang P2 44%"`` (rounded ints).

    Returns ``""`` when either block's value is missing or malformed.
    """
    tuas = _block(util, "tuas_c7")
    pasir = _block(util, "pasir_panjang_p2")
    if tuas is None or pasir is None:
        return ""
    # Half-up rounding over the [0,1] domain to match the frontend's Math.round().
    return (
        f"Tuas C7 {int(tuas * 100 + 0.5)}% · "
        f"Pasir Panjang P2 {int(pasir * 100 + 0.5)}%"
    )
