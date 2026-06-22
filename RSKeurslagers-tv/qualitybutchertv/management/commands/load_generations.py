# qualitybutchertv/management/commands/load_generations.py
import csv
from django.core.management.base import BaseCommand
from keur.models import Generation

class Command(BaseCommand):
    help = 'Load Generation data from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str)

    def handle(self, *args, **options):
        path = options['csv_path']
        created = skipped = 0

        with open(path, newline=None, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for index, row in enumerate(reader):
                # adjust field names to match your CSV headers and model fields
                _, was_created = Generation.objects.get_or_create(
                    name=row['Naam'],
                    start_year=int(row['Startjaar']),
                )
                if was_created:
                    created += 1
                else:
                    skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done — {created} created, {skipped} already existed'
        ))