import json
from datetime import datetime
from django.shortcuts import render
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .elo_service import SCALING_FACTOR, K_FACTOR, DEFAULT_ELO
from .models import Player, Match, ELO, MatchParticipant
from .matchtypes import MATCH_TYPES
from members.models import Member, Yeargroup


def member_list(request):
    search = request.GET.get('search')
    qs = Member.objects.filter(active=True).select_related('user')
    if search:
        qs = qs.filter(
            Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
        )

    yeargroups = {yg.year: {'name': yg.name, 'year': yg.year} for yg in Yeargroup.objects.all()}

    data = []
    for m in qs:
        generation = yeargroups.get(m.member_since)
        data.append({
            'id': m.id,
            'display_name': str(m),
            'generation': generation
        })

    return JsonResponse(data, safe=False)


@require_http_methods(["GET", "POST"])
def player_list(request):
    yeargroups = {yg.year: {'name': yg.name, 'year': yg.year} for yg in Yeargroup.objects.all()}

    if request.method == 'POST':
        data = json.loads(request.body)
        player = Player.objects.create(
            member_id=data['member_id'],
            nickname=data['nickname']
        )
        generation = yeargroups.get(player.member.member_since)
        return JsonResponse({'id': str(player.id), 'nickname': player.nickname, 'member': {'id': player.member.id, 'display_name': str(player.member), 'generation': generation}})

    qs = Player.objects.filter(member__active=True).select_related('member').all()
    data = []
    for p in qs:
        generation = yeargroups.get(p.member.member_since)
        data.append({
            'id': str(p.id),
            'nickname': p.nickname,
            'member': {
                'id': p.member.id,
                'display_name': str(p.member),
                'generation': generation
            }
        })
    return JsonResponse(data, safe=False)


@require_http_methods(["GET", "POST"])
def match_list(request):
    yeargroups = {yg.year: {'name': yg.name, 'year': yg.year} for yg in Yeargroup.objects.all()}

    if request.method == 'POST':
        data = json.loads(request.body)

        timestamp_played_str = data.get('timestamp_played')
        if timestamp_played_str:
            timestamp_played = datetime.fromisoformat(timestamp_played_str).replace(tzinfo=None)
        else:
            timestamp_played = datetime.now()

        timestamp_uploaded = datetime.now()

        match = Match.objects.create(
            match_type=data['match_type'],
            score_team_1=data['score_team_1'],
            score_team_2=data['score_team_2'],
            timestamp_played=timestamp_played,
            timestamp_uploaded=timestamp_uploaded,
        )

        if 'ranked' in data:
            match.ranked = data['ranked']
            match.save()

        participants_data = []
        for p_data in data['participants']:
            player = Player.objects.get(id=p_data['player'])
            mp = MatchParticipant.objects.create(
                match=match,
                player=player,
                team=p_data['team']
            )
            generation = yeargroups.get(mp.player.member.member_since)
            participants_data.append({
                'player': {
                    'id': str(mp.player.id),
                    'nickname': mp.player.nickname,
                    'member': {
                        'id': mp.player.member.id,
                        'display_name': str(mp.player.member),
                        'generation': generation
                    }
                },
                'team': mp.team,
                'elo_gain': mp.elo_gain
            })

        response_data = {
            'id': match.id,
            'match_type': MATCH_TYPES[match.match_type]['label'],
            'score_team_1': match.score_team_1,
            'score_team_2': match.score_team_2,
            'ranked': match.ranked,
            'participants': participants_data,
            'timestamp_played': match.timestamp_played.isoformat()
        }
        return JsonResponse(response_data)

    # GET request
    qs = Match.objects.filter(matchparticipant__player__member__active=True).distinct().order_by('-timestamp_played').prefetch_related('matchparticipant_set__player__member')

    ranked_filter = request.GET.get('ranked')
    if ranked_filter == 'true':
        qs = qs.filter(ranked=True)
    elif ranked_filter == 'false':
        qs = qs.filter(ranked=False)

    data = []
    for m in qs:
        participants = []
        for p in m.matchparticipant_set.all():
            generation = yeargroups.get(p.player.member.member_since)
            participants.append({
                'player': {
                    'id': str(p.player.id),
                    'nickname': p.player.nickname,
                    'member': {
                        'id': p.player.member.id,
                        'display_name': str(p.player.member),
                        'generation': generation
                    }
                },
                'team': p.team,
                'elo_gain': p.elo_gain
            })

        data.append({
            'id': m.id,
            'match_type': MATCH_TYPES[m.match_type]['label'],
            'score_team_1': m.score_team_1,
            'score_team_2': m.score_team_2,
            'ranked': m.ranked,
            'participants': participants,
            'timestamp_played': m.timestamp_played.isoformat()
        })
    return JsonResponse(data, safe=False)


def elo_list(request):
    qs = ELO.objects.filter(player__member__active=True).select_related('player', 'player__member').order_by('-elo')
    match_type = request.GET.get('match_type')
    if match_type:
        qs = qs.filter(match_type=match_type)

    data = []
    for e in qs:
        data.append({
            'player': {
                'id': str(e.player.id),
                'nickname': e.player.nickname,
                'member': {
                    'id': e.player.member.id,
                    'display_name': str(e.player.member)
                }
            },
            'elo': e.elo,
            'match_type': MATCH_TYPES[e.match_type]['label']
        })
    return JsonResponse(data, safe=False)


def clean(request):
    context = {
        'scaling_factor': SCALING_FACTOR,
        'k_factor': K_FACTOR,
        'default_rating': DEFAULT_ELO,
        'base_template': "qualitybutchertv/clean-base.html",
        'match_types': json.dumps(MATCH_TYPES)
    }
    return render(request, 'qualitybutchertv/main.html', context)


def with_menu(request):
    context = {
        'scaling_factor': SCALING_FACTOR,
        'k_factor': K_FACTOR,
        'default_rating': DEFAULT_ELO,
        'base_template': "rskv3/base.html",
        'match_types': json.dumps(MATCH_TYPES)
    }
    return render(request, 'qualitybutchertv/main.html', context)
