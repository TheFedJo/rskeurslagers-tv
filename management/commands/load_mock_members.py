# qualitybutchertv/management/commands/load_mock_members.py
import csv
from django.core.management.base import BaseCommand
from models import MockRSKMember, Generation

class Command(BaseCommand):
    help = 'Load MockRSKMember data from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str)

    def handle(self, *args, **options):
        path = options['csv_path']
        created = skipped = 0

        with open(path, newline=None, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for index, row in enumerate(reader):
                # adjust field names to match your CSV headers and model fields

                # Parse start year from the generation string e.g. '2025-2026' → 2025
                start_year = int(row['Generatie'].split('-')[0])
                generation = Generation.objects.get(start_year=start_year)

                _, was_created = MockRSKMember.objects.get_or_create(
                    name=row['Naam'],
                    defaults={
                        'birth_date':  row['Geboortedatum'],
                        'generation':  generation,
                        'residence':   row['Woonplaats'],
                    }
                )
                if was_created:
                    created += 1
                else:
                    skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done — {created} created, {skipped} already existed'
        ))