import uuid

from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q, F

from members.models import Member
from qualitybutchertv.matchtypes import get_match_labels, MIN_RANKED_SCORE, MAX_RANKED_SCORE, MATCH_TYPES


class Player(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.OneToOneField(Member, on_delete=models.CASCADE)
    nickname = models.CharField(max_length=32)


class PlayerDistribution(models.TextChoices):
    TYPE_1V1 = '1v1', '1 tegen 1'
    TYPE_1V2 = '1v2', '1 tegen 2'
    TYPE_2V2 = '2v2', '2 tegen 2'
    TYPE_4V4 = '4v4', '4 tegen 4'


class TeamPlayerCount(models.IntegerChoices):
    ONE = 1
    TWO = 2
    FOUR = 4


class Match(models.Model):
    match_type = models.CharField(max_length=3, choices=get_match_labels())
    timestamp_played = models.DateTimeField()
    timestamp_uploaded = models.DateTimeField()
    score_team_1 = models.SmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(12)])
    score_team_2 = models.SmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(12)])

    # Explicitly flagged per match — a match type may be elo_eligible but
    # a specific match can still be unranked (e.g. scores don't meet criteria)
    ranked = models.BooleanField(default=False)

    def is_score_ranked_eligible(self):
        """
        Ranked requires:
        - Winner scored between 10 and 12 (klinker/keeper goal)
        - Loser scored at most 9
        - No draw
        """
        hi = max(self.score_team_1, self.score_team_2)
        lo = min(self.score_team_1, self.score_team_2)
        return (
            self.score_team_1 != self.score_team_2      # no draws
            and MIN_RANKED_SCORE <= hi <= MAX_RANKED_SCORE
            and lo <= 9
        )

    def save(self, *args, **kwargs):
        # Auto-set ranked based on score rules and match type eligibility
        # Can still be overridden manually by setting ranked=True/False before save
        if not self.pk:  # only auto-set on creation
            eligible = (
                MATCH_TYPES[self.match_type]['elo_eligible']
                and self.is_score_ranked_eligible()
            )
            self.ranked = eligible
        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name='match_score_team_1_non_negative',
                condition=Q(score_team_1__gte=0)
            ),
            models.CheckConstraint(
                name='match_score_team_2_non_negative',
                condition=Q(score_team_2__gte=0)
            ),
            models.CheckConstraint(
                name='match_scores_max_12',
                condition=Q(score_team_1__lte=12) & Q(score_team_2__lte=12)
            ),
            # At least one team must have scored (avoids 0-0 matches)
            models.CheckConstraint(
                name='match_not_both_zero',
                condition=~Q(score_team_1=0, score_team_2=0)
            ),
            # A ranked match must meet score criteria — DB-level guard
            # mirrors is_score_ranked_eligible() logic
            models.CheckConstraint(
                name='ranked_match_score_rules',
                condition=(
                    ~Q(ranked=True) | (
                        # winner between 10-12
                        (Q(score_team_1__gte=10) | Q(score_team_2__gte=10)) &
                        (Q(score_team_1__lte=12) & Q(score_team_2__lte=12)) &
                        # loser at most 9
                        (Q(score_team_1__lte=9) | Q(score_team_2__lte=9)) &
                        # no draws
                        ~Q(score_team_1=F('score_team_2'))
                    )
                )
            ),
        ]


class ELO(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    match_type = models.CharField(max_length=3, choices=get_match_labels())
    elo = models.FloatField(default=1500)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['player', 'match_type'],
                name='unique_player_matchtype_elo'
            )
        ]


class MatchParticipant(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE)
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    team = models.SmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(2)])
    elo_gain = models.FloatField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['player', 'match'],
                name='unique_player_match'
            ),
            models.CheckConstraint(
                name='participant_team_1_or_2',
                condition=Q(team=1) | Q(team=2)
            ),
        ]
