# """
# Unit tests for elo_service.calculate_elo_changes (pure logic, no DB).
# Run with:  python -m pytest tests/test_elo_service.py -v
# """
# import pytest
# from elo_service import (
#     DEFAULT_ELO,
#     K_FACTOR,
#     EloResult,
#     _TeamSnapshot,
#     _actual_score,
#     _expected_score,
#     calculate_elo_changes,
# )
#
#
# # ---------------------------------------------------------------------------
# # Helpers
# # ---------------------------------------------------------------------------
#
# def snap(ids: list[str], elos: list[float]) -> _TeamSnapshot:
#     return _TeamSnapshot(player_ids=ids, elos=elos)
#
#
# # ---------------------------------------------------------------------------
# # _expected_score
# # ---------------------------------------------------------------------------
#
# class TestExpectedScore:
#     def test_equal_ratings_expect_half(self):
#         assert _expected_score(1500, 1500) == pytest.approx(0.5)
#
#     def test_higher_rated_favoured(self):
#         assert _expected_score(1600, 1400) > 0.5
#
#     def test_lower_rated_underdog(self):
#         assert _expected_score(1400, 1600) < 0.5
#
#     def test_symmetry(self):
#         a = _expected_score(1700, 1300)
#         b = _expected_score(1300, 1700)
#         assert a + b == pytest.approx(1.0)
#
#     def test_400_point_gap(self):
#         # Classic ELO: 400 pts → ~0.909
#         assert _expected_score(1900, 1500) == pytest.approx(0.9091, abs=1e-4)
#
#
# # ---------------------------------------------------------------------------
# # _actual_score
# # ---------------------------------------------------------------------------
#
# class TestActualScore:
#     def test_win(self):        assert _actual_score(3, 1) == 1.0
#     def test_loss(self):       assert _actual_score(1, 3) == 0.0
#     def test_draw(self):       assert _actual_score(2, 2) == 0.5
#     def test_0_0_draw(self):   assert _actual_score(0, 0) == 0.5
#
#
# # ---------------------------------------------------------------------------
# # calculate_elo_changes — 1v1
# # ---------------------------------------------------------------------------
#
# class TestCalculate1v1:
#     def test_winner_gains_loser_loses(self):
#         t1 = snap(["p1"], [1500])
#         t2 = snap(["p2"], [1500])
#         result = calculate_elo_changes(t1, t2, score_team1=1, score_team2=0)
#         assert result.gain_for("p1") > 0
#         assert result.gain_for("p2") < 0
#
#     def test_zero_sum(self):
#         t1 = snap(["p1"], [1500])
#         t2 = snap(["p2"], [1500])
#         result = calculate_elo_changes(t1, t2, score_team1=1, score_team2=0)
#         assert result.gain_for("p1") + result.gain_for("p2") == pytest.approx(0.0, abs=0.01)
#
#     def test_equal_rating_win_gains_half_k(self):
#         t1 = snap(["p1"], [1500])
#         t2 = snap(["p2"], [1500])
#         result = calculate_elo_changes(t1, t2, score_team1=1, score_team2=0)
#         assert result.gain_for("p1") == pytest.approx(K_FACTOR / 2, abs=0.01)
#
#     def test_draw_equal_ratings_no_change(self):
#         t1 = snap(["p1"], [1500])
#         t2 = snap(["p2"], [1500])
#         result = calculate_elo_changes(t1, t2, score_team1=0, score_team2=0)
#         assert result.gain_for("p1") == pytest.approx(0.0, abs=0.01)
#         assert result.gain_for("p2") == pytest.approx(0.0, abs=0.01)
#
#     def test_upset_win_yields_large_gain(self):
#         """Underdog beating favourite earns more than K/2."""
#         t1 = snap(["underdog"], [1200])
#         t2 = snap(["favourite"], [1800])
#         result = calculate_elo_changes(t1, t2, score_team1=1, score_team2=0)
#         assert result.gain_for("underdog") > K_FACTOR / 2
#
#     def test_expected_win_yields_small_gain(self):
#         """Favourite beating underdog earns less than K/2."""
#         t1 = snap(["favourite"], [1800])
#         t2 = snap(["underdog"], [1200])
#         result = calculate_elo_changes(t1, t2, score_team1=1, score_team2=0)
#         assert result.gain_for("favourite") < K_FACTOR / 2
#
#
# # ---------------------------------------------------------------------------
# # calculate_elo_changes — team modes
# # ---------------------------------------------------------------------------
#
# class TestCalculateTeamModes:
#     def test_2v2_all_teammates_get_same_delta(self):
#         t1 = snap(["a", "b"], [1500, 1500])
#         t2 = snap(["c", "d"], [1500, 1500])
#         result = calculate_elo_changes(t1, t2, 2, 1)
#         assert result.gain_for("a") == result.gain_for("b")
#         assert result.gain_for("c") == result.gain_for("d")
#
#     def test_4v4_zero_sum(self):
#         t1 = snap(["a","b","c","d"], [1500]*4)
#         t2 = snap(["e","f","g","h"], [1500]*4)
#         result = calculate_elo_changes(t1, t2, 3, 0)
#         total = sum(result.deltas.values())
#         assert total == pytest.approx(0.0, abs=0.1)
#
#     def test_1v2_avg_elo_used(self):
#         """Solo player vs 2-person team; their combined avg matters."""
#         solo = snap(["s"], [1700])
#         duo  = snap(["d1","d2"], [1400, 1600])  # avg = 1500
#         result = calculate_elo_changes(solo, duo, 1, 0)
#         # Solo has higher avg (1700 vs 1500) → smaller gain than equal-rating win
#         equal_win_gain = K_FACTOR / 2
#         assert result.gain_for("s") < equal_win_gain
#
#     def test_delta_keys_cover_all_players(self):
#         t1 = snap(["x1","x2"], [1500, 1500])
#         t2 = snap(["y1","y2"], [1500, 1500])
#         result = calculate_elo_changes(t1, t2, 1, 1)
#         assert set(result.deltas.keys()) == {"x1","x2","y1","y2"}
#
#     def test_returns_elo_result_instance(self):
#         t1 = snap(["p"], [1500])
#         t2 = snap(["q"], [1500])
#         assert isinstance(calculate_elo_changes(t1, t2, 1, 0), EloResult)
#
#
# # ---------------------------------------------------------------------------
# # _TeamSnapshot
# # ---------------------------------------------------------------------------
#
# class TestTeamSnapshot:
#     def test_avg_elo_single(self):
#         assert snap(["p"], [1600]).avg_elo == 1600
#
#     def test_avg_elo_multiple(self):
#         assert snap(["a","b"], [1400, 1600]).avg_elo == pytest.approx(1500)
#
#     def test_avg_elo_empty_returns_default(self):
#         s = _TeamSnapshot(player_ids=[], elos=[])
#         assert s.avg_elo == DEFAULT_ELO
