from django.shortcuts import render

from rest_framework import mixins, generics, viewsets

from keur.elo_service import SCALING_FACTOR, K_FACTOR, DEFAULT_ELO
from keur.models import MockRSKMember, Player, Match, ELO, MatchType
from keur.serializers import (
    MockRSKMemberSerializer, PlayerSerializer,
    MatchSerializer, EloSerializer, MatchTypeSerializer
)

class MemberListView(generics.ListAPIView):
    serializer_class = MockRSKMemberSerializer

    def get_queryset(self):
        qs = MockRSKMember.objects.all()
        search = self.request.query_params.get('search')
        if search:
            qs =   qs.filter(name__icontains=search)       \
                 | qs.filter(first_name__icontains=search) \
                 | qs.filter(last_name__icontains=search)  \
                 | qs.filter(generation__name__icontains=search)
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