from django.shortcuts import render
from django.db.models import Q

from rest_framework import mixins, generics, viewsets

from .elo_service import SCALING_FACTOR, K_FACTOR, DEFAULT_ELO
from .models import Player, Match, ELO, MatchType
from .serializers import (
    MemberSerializer, PlayerSerializer,
    MatchSerializer, EloSerializer, MatchTypeSerializer
)

from members.models import Member

class MemberListView(generics.ListAPIView):
    serializer_class = MemberSerializer

    def get_queryset(self):
        qs = Member.objects.select_related('user')
        search = self.request.query_params.get('search')
        if search:
            qs =   qs.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search)
            )
        return qs


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer


class MatchViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'patch']
    serializer_class = MatchSerializer
    queryset = Match.objects.prefetch_related(
        'matchparticipant_set__player__member__generation'
    ).all()

    def get_queryset(self):
        qs = super().get_queryset()
        ranked = self.request.query_params.get('ranked')
        if ranked == 'true':
            qs = qs.filter(ranked=True)
        return qs


class EloListView(mixins.ListModelMixin,
                  viewsets.GenericViewSet):
    queryset = ELO.objects.select_related(
        'player__member__generation', 'match_type'
    ).order_by('-elo')
    serializer_class = EloSerializer
    http_method_names = ['get']

    def get_queryset(self):
        qs = super().get_queryset()
        match_type = self.request.query_params.get('match_type')
        if match_type:
            qs = qs.filter(match_type__match_type=match_type)
        return qs


class MatchTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MatchType.objects.all()
    serializer_class = MatchTypeSerializer


def index(request):
    context = {
        'scaling_factor': SCALING_FACTOR,
        'k_factor': K_FACTOR,
        'default_rating': DEFAULT_ELO,
    }
    return render(request, 'qualitybutchertv/main.html', context)