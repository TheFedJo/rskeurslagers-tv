MATCH_TYPES = {
    "1v1": {
        "label": "1 tegen 1",
        "players_team_1": 1,
        "players_team_2": 1,
        "elo_eligible": True
    },
    "1v2": {
        "label": "1 tegen 2",
        "players_team_1": 1,
        "players_team_2": 2,
        "elo_eligible": False
    },
    "2v2": {
        "label": "2 tegen 2",
        "players_team_1": 2,
        "players_team_2": 2,
        "elo_eligible": True
    },
    "4v4": {
        "label": "4 tegen 4",
        "players_team_1": 4,
        "players_team_2": 4,
        "elo_eligible": True
    }
}

MAX_RANKED_SCORE = 12
MIN_RANKED_SCORE = 10


def get_match_labels():
    return [(key, value["label"]) for key, value in MATCH_TYPES.items()]
