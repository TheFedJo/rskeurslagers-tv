# keur/management/commands/load_generations.py
import csv
from django.core.management.base import BaseCommand
from keur.models import MatchType

class Command(BaseCommand):
    help = 'Load MatchType data from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str)

    def handle(self, *args, **options):
        path = options['csv_path']
        created = skipped = 0

        with open(path, newline=None, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for index, row in enumerate(reader):
                # adjust field names to match your CSV headers and model fields
                _, was_created = MatchType.objects.get_or_create(
                    match_type=row['Wedstrijdtype'],
                    players_team_1=int(row['Spelers team 1']),
                    players_team_2=int(row['Spelers team 2']),
                    elo_eligible=bool(row['Klassement']),
                )
                if was_created:
                    created += 1
                else:
                    skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done — {created} created, {skipped} already existed'
        ))