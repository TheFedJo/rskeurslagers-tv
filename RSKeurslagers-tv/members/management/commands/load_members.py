import csv
from django.core.management.base import BaseCommand
from members.models import Member, Yeargroup, User

class Command(BaseCommand):
    help = 'Load Member data from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str)

    def handle(self, *args, **options):
        path = options['csv_path']
        members_created = members_skipped = 0
        users_created = users_skipped = 0

        with open(path, newline=None, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for index, row in enumerate(reader):
                # adjust field names to match your CSV headers and model fields

                # Parse start year from the generation string e.g. '2025-2026' → 2025
                start_year = int(row['Generatie'].split('-')[0])
                # generation = Yeargroup.objects.get(year=start_year)
                first_name, last_name = row['Naam'].split(None, 1)
                user, user_was_created = User.objects.get_or_create(
                    first_name=first_name,
                    last_name=last_name
                )

                _, member_was_created = Member.objects.get_or_create(
                    user=user,
                    defaults={
                        'member_since':  start_year
                    }
                )

                members_created += member_was_created
                members_skipped += not member_was_created
                users_created   += user_was_created
                users_skipped   += not user_was_created

        self.stdout.write(self.style.SUCCESS(
            f'Done — {members_created}/{users_created} members/users created, {members_skipped}/{users_skipped} already existed'
        ))