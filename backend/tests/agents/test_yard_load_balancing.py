"""Spec 3.2: unit coverage for the pure yard-load-balancing helper.

Covers every I/O & edge-case matrix row that bears on the helper:
  * THRESHOLD_BOUNDARY - `tuas_utilization_high` True at exactly 0.85, False at 0.849.
  * reroute-available ceiling - `pasir_panjang_reroute_available` True below 0.70, False at/above.
  * `should_offer_pasir_panjang` truth table (both gates).
  * `format_block_utilization` exact string, rounded ints.
  * missing / non-numeric / out-of-range / bool / NaN `yard_utilization`
    -> False / "" with no exception raised.
"""

from __future__ import annotations

import pytest

from agents.yard_load_balancing import (
    PASIR_PANJANG_HEADROOM_CEILING,
    TUAS_HIGH_THRESHOLD,
    format_block_utilization,
    pasir_panjang_reroute_available,
    should_offer_pasir_panjang,
    tuas_utilization_high,
)


class TestThresholdBoundary:
    def test_exactly_threshold_is_high(self):
        assert tuas_utilization_high({"tuas_c7": 0.85}) is True

    def test_just_below_threshold_is_not_high(self):
        assert tuas_utilization_high({"tuas_c7": 0.849}) is False

    def test_well_above_threshold_is_high(self):
        assert tuas_utilization_high({"tuas_c7": 0.93}) is True

    def test_full_utilization_is_high(self):
        assert tuas_utilization_high({"tuas_c7": 1.0}) is True

    def test_zero_utilization_is_not_high(self):
        assert tuas_utilization_high({"tuas_c7": 0.0}) is False

    def test_constants_are_the_documented_values(self):
        assert TUAS_HIGH_THRESHOLD == 0.85
        assert PASIR_PANJANG_HEADROOM_CEILING == 0.70


class TestRerouteAvailableCeiling:
    def test_below_ceiling_is_available(self):
        assert pasir_panjang_reroute_available({"pasir_panjang_p2": 0.44}) is True

    def test_just_below_ceiling_is_available(self):
        assert pasir_panjang_reroute_available({"pasir_panjang_p2": 0.699}) is True

    def test_exactly_ceiling_is_not_available(self):
        assert pasir_panjang_reroute_available({"pasir_panjang_p2": 0.70}) is False

    def test_above_ceiling_is_not_available(self):
        assert pasir_panjang_reroute_available({"pasir_panjang_p2": 0.85}) is False

    def test_zero_utilization_is_available(self):
        assert pasir_panjang_reroute_available({"pasir_panjang_p2": 0.0}) is True


class TestShouldOfferTruthTable:
    def test_high_tuas_and_headroom_offers(self):
        assert should_offer_pasir_panjang({"tuas_c7": 0.93, "pasir_panjang_p2": 0.44}) is True

    def test_low_tuas_does_not_offer(self):
        assert should_offer_pasir_panjang({"tuas_c7": 0.55, "pasir_panjang_p2": 0.40}) is False

    def test_high_tuas_but_no_headroom_does_not_offer(self):
        assert should_offer_pasir_panjang({"tuas_c7": 0.93, "pasir_panjang_p2": 0.80}) is False

    def test_low_tuas_and_no_headroom_does_not_offer(self):
        assert should_offer_pasir_panjang({"tuas_c7": 0.40, "pasir_panjang_p2": 0.90}) is False

    def test_boundary_pair_offers(self):
        assert should_offer_pasir_panjang({"tuas_c7": 0.85, "pasir_panjang_p2": 0.699}) is True

    def test_ceiling_exactly_at_headroom_does_not_offer(self):
        # 0.70 is not < 0.70 - the reroute gate is strict.
        assert should_offer_pasir_panjang({"tuas_c7": 0.85, "pasir_panjang_p2": 0.70}) is False


class TestFormatBlockUtilization:
    def test_exact_string(self):
        util = {"tuas_c7": 0.93, "pasir_panjang_p2": 0.44}
        assert format_block_utilization(util) == "Tuas C7 93% · Pasir Panjang P2 44%"

    def test_rounds_to_nearest_int(self):
        util = {"tuas_c7": 0.856, "pasir_panjang_p2": 0.404}
        assert format_block_utilization(util) == "Tuas C7 86% · Pasir Panjang P2 40%"

    def test_half_up_rounding_matches_frontend(self):
        util = {"tuas_c7": 0.125, "pasir_panjang_p2": 0.125}
        assert format_block_utilization(util) == "Tuas C7 13% · Pasir Panjang P2 13%"

    def test_missing_key_yields_empty_string(self):
        assert format_block_utilization({"tuas_c7": 0.93}) == ""
        assert format_block_utilization({"pasir_panjang_p2": 0.44}) == ""

    def test_malformed_value_yields_empty_string(self):
        assert format_block_utilization({"tuas_c7": "high", "pasir_panjang_p2": 0.44}) == ""


class TestMalformedInputNeverRaises:
    @pytest.mark.parametrize(
        "util",
        [
            None,
            {},
            {"tuas_c7": None, "pasir_panjang_p2": None},
            {"tuas_c7": "0.9", "pasir_panjang_p2": "0.4"},
            {"tuas_c7": True, "pasir_panjang_p2": False},
            {"tuas_c7": 1.5, "pasir_panjang_p2": -0.2},
            {"tuas_c7": float("nan"), "pasir_panjang_p2": float("nan")},
            {"tuas_c7": [0.9], "pasir_panjang_p2": {"x": 1}},
            "not a dict",
            42,
        ],
    )
    def test_all_helpers_return_falsey_and_do_not_raise(self, util):
        assert tuas_utilization_high(util) is False
        assert pasir_panjang_reroute_available(util) is False
        assert should_offer_pasir_panjang(util) is False
        assert format_block_utilization(util) == ""

    def test_bool_true_is_not_a_fraction(self):
        # True == 1 numerically, but must never count as 100% utilization.
        assert tuas_utilization_high({"tuas_c7": True}) is False

    def test_nan_is_rejected(self):
        assert tuas_utilization_high({"tuas_c7": float("nan")}) is False
        assert pasir_panjang_reroute_available({"pasir_panjang_p2": float("nan")}) is False
