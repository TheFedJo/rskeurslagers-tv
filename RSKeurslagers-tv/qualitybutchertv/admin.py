from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import Player, Match, ELO, MatchParticipant


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ('nickname', 'member')
    search_fields = ('nickname', 'member__user__first_name', 'member__user__last_name')


class MatchParticipantInline(admin.TabularInline):
    model = MatchParticipant
    extra = 0
    autocomplete_fields = ('player',)


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'match_type', 'timestamp_played', 'score_team_1', 'score_team_2', 'ranked', 'participants_link')
    list_filter = ('match_type', 'ranked')
    date_hierarchy = 'timestamp_played'
    inlines = [MatchParticipantInline]
    search_fields = ('id',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('match_type').prefetch_related('matchparticipant_set')

    @admin.display(description='Participants')
    def participants_link(self, obj):
        count = obj.matchparticipant_set.count()
        url = (
            reverse("admin:qualitybutchertv_matchparticipant_changelist")
            + f"?match__id__exact={obj.id}"
        )
        return format_html('<a href="{}">{}</a>', url, count)


@admin.register(ELO)
class ELOAdmin(admin.ModelAdmin):
    list_display = ('player', 'match_type', 'elo')
    list_filter = ('match_type',)
    autocomplete_fields = ('player',)
    search_fields = ('player__nickname',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('player', 'match_type')


@admin.register(MatchParticipant)
class MatchParticipantAdmin(admin.ModelAdmin):
    list_display = ('match', 'player', 'team', 'elo_gain')
    list_filter = ('team',)
    autocomplete_fields = ('match', 'player')
    search_fields = ('player__nickname', 'match__id')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('match', 'player')
