from rest_framework import serializers
from django.db import transaction

from .elo_service import apply_elo_update_after_create
from .models import Player, Match, MatchParticipant, ELO, MatchType

from members.models import Member, Yeargroup

class GenerationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Yeargroup
        fields = '__all__'

class MemberSerializer(serializers.ModelSerializer):
    generation = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, m):
        return m.user.get_full_name()

    def get_generation(self, m):
        generation = Yeargroup.objects.get(year=m.member_since)
        return GenerationSerializer(generation).data

    class Meta:
        model = Member
        fields = [
            'id', 'display_name', 'generation',
        ]


class PlayerSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)
    generation = serializers.SerializerMethodField()
    member_id = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        source='member',
        write_only=True
    )

    def get_generation(self, obj):
        return self.member.get_generation(obj.member)

    def validate_member(self, value):
        if Player.objects.filter(member=value).exists():
            raise serializers.ValidationError('This member already has a player record.')
        return value

    class Meta:
        model = Player
        fields = ['id', 'nickname', 'member_id', 'member', 'generation']


class MatchParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchParticipant
        fields = ['player', 'team', 'elo_gain']


class MatchParticipantReadSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source='player.nickname')
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        m = obj.player.member
        return ' '.join(filter(None, [m.display_name])) or m.name

    class Meta:
        model = MatchParticipant
        fields = ['player', 'nickname', 'display_name', 'team', 'elo_gain']


class MatchSerializer(serializers.ModelSerializer):
    participants = MatchParticipantSerializer(many=True, write_only=True)
    participants_detail = MatchParticipantReadSerializer(
        source='matchparticipant_set',
        many=True,
        read_only=True
    )

    # Read-only: whether this match's scores meet the ranking criteria,
    # regardless of whether it was actually saved as ranked.
    # Frontend uses this to show/hide the ranked toggle in real time.
    is_score_ranked_eligible = serializers.SerializerMethodField()

    # ranked is writable so the frontend can explicitly set it,
    # but Match.save() auto-sets it on creation if not provided.
    ranked = serializers.BooleanField(required=False)

    def get_is_score_ranked_eligible(self, obj):
        return obj.is_score_ranked_eligible()

    def validate(self, attrs):
        if not attrs.get('timestamp_played'):
            attrs['timestamp_played'] = attrs.get('timestamp_uploaded')

        # If caller is explicitly requesting ranked=True, verify scores allow it
        if attrs.get('ranked', False):
            s1 = attrs.get('score_team_1', getattr(self.instance, 'score_team_1', 0))
            s2 = attrs.get('score_team_2', getattr(self.instance, 'score_team_2', 0))
            hi, lo = max(s1, s2), min(s1, s2)
            if not (s1 != s2 and 10 <= hi <= 12 and lo <= 9):
                raise serializers.ValidationError(
                    'A ranked match requires a winner with score 10–12 and loser with at most 9.'
                )

            # Also check the match type itself allows ELO
            match_type = attrs.get('match_type', getattr(self.instance, 'match_type', None))
            if match_type and not match_type.elo_eligible:
                raise serializers.ValidationError(
                    f'Match type {match_type.match_type} is not ELO eligible.'
                )

        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            participants = validated_data.pop('participants')
            match = Match.objects.create(**validated_data)
            for p in participants:
                MatchParticipant.objects.create(match=match, **p)
            if match.ranked:
                apply_elo_update_after_create(match)
            return match

    def update(self, instance, validated_data):
        with transaction.atomic():
            participants = validated_data.pop('participants', None)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if participants is not None:
                instance.matchparticipant_set.all().delete()
                for p in participants:
                    MatchParticipant.objects.create(match=instance, **p)
            if instance.ranked:
                apply_elo_update_after_create(instance)
            return instance

    class Meta:
        model = Match
        fields = [
            'id', 'match_type', 'score_team_1', 'score_team_2',
            'timestamp_played', 'timestamp_uploaded',
            'ranked', 'is_score_ranked_eligible',
            'participants', 'participants_detail',
        ]


class MatchTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchType
        fields = '__all__'


class EloSerializer(serializers.ModelSerializer):
    player = PlayerSerializer(read_only=True)
    match_type = MatchTypeSerializer(read_only=True)

    class Meta:
        model = ELO
        fields = ['match_type', 'player', 'elo', ]
