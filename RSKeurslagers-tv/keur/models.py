import uuid

from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q, F

# Regexes
phone_regex = RegexValidator(
    regex=r'^\+?1?\d{9,15}$',
    message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
)

class Generation(models.Model):
    name = models.CharField(max_length=32)
    start_year = models.IntegerField(unique=True)
    end_year = models.IntegerField()

    def save(self, *args, **kwargs):
        if self.end_year is None:
            self.end_year = self.start_year + 1
        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name='generation_lasts_one_year',
                condition=Q(end_year=F('start_year') + 1)
            ),
            models.UniqueConstraint(
                fields=['end_year'],
                name='unique_end_year'
            ),
        ]


class MockRSKMember(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=48, null=True, blank=True)
    interject = models.CharField(max_length=16, null=True, blank=True)
    last_name = models.CharField(max_length=64, null=True, blank=True)
    name = models.CharField(max_length=128, null=True, blank=True)
    address = models.CharField(max_length=255, null=True, blank=True)
    postal_code = models.CharField(max_length=20, null=True, blank=True)
    residence = models.CharField(max_length=100, null=True, blank=True)
    phone_number = models.CharField(validators=[phone_regex], max_length=17, null=True, blank=True)
    birth_date = models.DateField(verbose_name='Geboortedatum', null=True, blank=True)
    generation = models.ForeignKey(to=Generation, to_field='start_year', on_delete=models.PROTECT)


class Player(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.OneToOneField(MockRSKMember, on_delete=models.CASCADE)
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


class MatchType(models.Model):
    match_type = models.CharField(max_length=3, choices=PlayerDistribution, unique=True)
    players_team_1 = models.SmallIntegerField(choices=TeamPlayerCount)
    players_team_2 = models.SmallIntegerField(choices=TeamPlayerCount)
    # Whether this match type can ever produce ranked matches
    elo_eligible = models.BooleanField(default=False)

    # Max score the winning team can reach for a match to be ranked:
    # 10 = klinker, 11 = keeper goal, 12 = absolute max
    MAX_RANKED_SCORE = 12
    MIN_RANKED_SCORE = 10

    class Meta:
        constraints = [
            # Team sizes must match the distribution label
            models.CheckConstraint(
                name='matchtype_1v1_sizes',
                condition=~Q(match_type='1v1') | (Q(players_team_1=1) & Q(players_team_2=1))
            ),
            models.CheckConstraint(
                name='matchtype_1v2_sizes',
                condition=~Q(match_type='1v2') | (Q(players_team_1=1) & Q(players_team_2=2))
            ),
            models.CheckConstraint(
                name='matchtype_2v2_sizes',
                condition=~Q(match_type='2v2') | (Q(players_team_1=2) & Q(players_team_2=2))
            ),
            models.CheckConstraint(
                name='matchtype_4v4_sizes',
                condition=~Q(match_type='4v4') | (Q(players_team_1=4) & Q(players_team_2=4))
            ),
        ]


class Match(models.Model):
    match_type = models.ForeignKey(to=MatchType, to_field='match_type', on_delete=models.CASCADE)
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
            and MatchType.MIN_RANKED_SCORE <= hi <= MatchType.MAX_RANKED_SCORE
            and lo <= 9
        )

    def save(self, *args, **kwargs):
        # Auto-set ranked based on score rules and match type eligibility
        # Can still be overridden manually by setting ranked=True/False before save
        if not self.pk:  # only auto-set on creation
            eligible = (
                self.match_type.elo_eligible
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
    match_type = models.ForeignKey(MatchType, on_delete=models.RESTRICT)
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