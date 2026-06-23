from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Sequence, Optional

from django.db import transaction

from .models import ELO, Match, MatchParticipant, MatchType, Player

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

K_FACTOR: float = 64.0             # ELO sensitivity per result
DEFAULT_ELO: float = 1200.0         # Starting ELO for every new player/type pair
SCALING_FACTOR: float = 400.0       # Expresses


# ---------------------------------------------------------------------------
# Internal data structures (no ORM coupling)
# ---------------------------------------------------------------------------

@dataclass
class _TeamSnapshot:
    """Holds player IDs + their pre-match ELO for one team."""
    player_ids: list[str]
    elos: list[float]

    @property
    def avg_elo(self) -> float:
        return sum(self.elos) / len(self.elos) if self.elos else DEFAULT_ELO


@dataclass
class EloResult:
    """Returned by calculate_elo_changes; maps player_id → delta."""
    deltas: dict[str, float] = field(default_factory=dict)

    def gain_for(self, player_id: str) -> float:
        return self.deltas.get(player_id, 0.0)


# ---------------------------------------------------------------------------
# Pure calculation (no DB access — easy to unit-test)
# ---------------------------------------------------------------------------

def _expected_score(rating_a: float, rating_b: float) -> float:
    """Standard ELO expected score for player A against player B."""
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / SCALING_FACTOR))


def _actual_score(team_score: int, opponent_score: int) -> float:
    if team_score > opponent_score:
        return 1.0
    if team_score == opponent_score:
        return 0.5
    return 0.0


def calculate_elo_changes(
    team1: _TeamSnapshot,
    team2: _TeamSnapshot,
    score_team1: int,
    score_team2: int,
    k: float = K_FACTOR,
) -> EloResult:
    """
    Pure function — compute ELO deltas for all participants.

    Team ELO is treated as the *average* ELO of its members.
    Each player on a team receives the same delta (team performance model).

    Returns an EloResult with {player_id: delta} for every player in both teams.
    """
    avg1 = team1.avg_elo
    avg2 = team2.avg_elo

    exp1 = _expected_score(avg1, avg2)
    exp2 = _expected_score(avg2, avg1)   # == 1 - exp1, but explicit for clarity

    actual1 = _actual_score(score_team1, score_team2)
    actual2 = _actual_score(score_team2, score_team1)

    delta1 = round(k * (actual1 - exp1), 2)
    delta2 = round(k * (actual2 - exp2), 2)

    result = EloResult()
    for pid in team1.player_ids:
        result.deltas[pid] = delta1
    for pid in team2.player_ids:
        result.deltas[pid] = delta2

    return result


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _get_or_create_elo(player: Player, match_type: MatchType) -> ELO:
    elo_obj, created = ELO.objects.get_or_create(
        player=player,
        match_type=match_type,
        defaults={"elo": DEFAULT_ELO},
    )
    if created:
        logger.debug("Created ELO record for player=%s type=%s", player.pk, match_type.match_type)
    return elo_obj


def _build_team_snapshot(
    player_ids: Sequence[str],
    match_type: MatchType,
) -> tuple[list[Player], _TeamSnapshot]:
    """
    Fetch Player objects and their current ELO, return both.
    Players are looked up in ID order to keep deterministic behaviour.
    """
    players = list(Player.objects.select_related("member").filter(pk__in=player_ids))
    # Preserve caller-supplied ordering
    player_map = {str(p.pk): p for p in players}
    ordered = [player_map[pid] for pid in player_ids if pid in player_map]

    elos = []
    for p in ordered:
        elo_obj = _get_or_create_elo(p, match_type)
        elos.append(elo_obj.elo)

    return ordered, _TeamSnapshot(player_ids=[str(p.pk) for p in ordered], elos=elos)


# ---------------------------------------------------------------------------
# Public service entry point
# ---------------------------------------------------------------------------

@transaction.atomic
def apply_elo_update(match: Match) -> Optional[EloResult]:
    """
    Compute and persist ELO changes for a completed match.

    - Reads MatchParticipant rows linked to *match*.
    - Creates ELO rows for players that have none yet.
    - Updates ELO.elo and MatchParticipant.elo_gain in bulk.
    - Returns EloResult so the caller can inspect deltas.

    Raises ValueError if participant counts don't satisfy the MatchType contract,
    or if any referenced player does not exist.
    """
    if not match.ranked:
        logger.debug(f'[ELO] not calculating ELO for match {match.pk}, match type not ranked')
        return None
    match_type: MatchType = match.match_type

    participants = (
        MatchParticipant.objects
        .select_related("player")
        .filter(match=match)
    )

    team1_ids = [str(mp.player_id) for mp in participants if mp.team == 1]
    team2_ids = [str(mp.player_id) for mp in participants if mp.team == 2]

    # --- Guard: participant counts must match MatchType definition -----------
    expected_t1 = match_type.players_team_1
    expected_t2 = match_type.players_team_2
    if len(team1_ids) != expected_t1 or len(team2_ids) != expected_t2:
        raise ValueError(
            f"Match {match.pk}: expected {expected_t1}v{expected_t2} participants, "
            f"got {len(team1_ids)}v{len(team2_ids)}."
        )

    # --- Build snapshots (reads current ELO from DB) -------------------------
    team1_players, snap1 = _build_team_snapshot(team1_ids, match_type)
    team2_players, snap2 = _build_team_snapshot(team2_ids, match_type)

    # --- Pure ELO calculation -------------------------------------------------
    result = calculate_elo_changes(
        team1=snap1,
        team2=snap2,
        score_team1=match.score_team_1,
        score_team2=match.score_team_2,
    )

    logger.info(
        "Match %s (%s) score %s-%s | team1 avg=%.1f team2 avg=%.1f | Δ team1=%.2f Δ team2=%.2f",
        match.pk,
        match_type.match_type,
        match.score_team_1,
        match.score_team_2,
        snap1.avg_elo,
        snap2.avg_elo,
        next(iter(result.deltas.values()), 0),   # same delta for all team1 members
        list(result.deltas.values())[-1] if result.deltas else 0,
    )

    # --- Persist: update ELO rows --------------------------------------------
    all_players = team1_players + team2_players
    elo_updates: list[ELO] = []

    for player in all_players:
        pid = str(player.pk)
        delta = result.gain_for(pid)
        elo_obj = _get_or_create_elo(player, match_type)
        elo_obj.elo = round(elo_obj.elo + delta, 2)
        elo_updates.append(elo_obj)

    ELO.objects.bulk_update(elo_updates, ["elo"])

    # --- Persist: stamp elo_gain on MatchParticipant rows --------------------
    participant_updates: list[MatchParticipant] = []
    for mp in participants:
        mp.elo_gain = result.gain_for(str(mp.player_id))
        participant_updates.append(mp)

    MatchParticipant.objects.bulk_update(participant_updates, ["elo_gain"])

    return result


# ---------------------------------------------------------------------------
# Serializer integration helper
# ---------------------------------------------------------------------------

def apply_elo_update_after_create(match: Match) -> None:
    """
    Thin wrapper for use inside MatchSerializer.create():

        class MatchSerializer(serializers.ModelSerializer):
            def create(self, validated_data):
                participants_data = validated_data.pop('participants')
                match = Match.objects.create(**validated_data)
                for p in participants_data:
                    MatchParticipant.objects.create(match=match, **p)
                apply_elo_update_after_create(match)
                return match
    """
    try:
        apply_elo_update(match)
    except Exception:
        # Log but don't swallow — let the transaction roll back if needed
        logger.exception("ELO update failed for match %s", match.pk)
        raise
