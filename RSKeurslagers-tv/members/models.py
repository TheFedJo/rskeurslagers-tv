from django.contrib.auth.base_user import AbstractBaseUser
from django.db import models

class AbstractUser(AbstractBaseUser):
    username = models.CharField('gebruikersnaam',)
    first_name = models.CharField("voornaam", max_length=150, blank=True)
    last_name = models.CharField("achternaam", max_length=150, blank=True)

    def get_full_name(self):
        return ' '.join((self.first_name, self.last_name))

    def get_short_name(self):
        return self.first_name

    class Meta:
        verbose_name = "gebruiker"
        verbose_name_plural = "gebruikers"
        abstract = True


class User(AbstractUser):
    class Meta(AbstractUser.Meta):
        abstract = False
        # swappable = "AUTH_USER_MODEL"

class Member(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    # avatar = models.ImageField()
    member_since = models.PositiveSmallIntegerField(verbose_name='lid sinds')

    def __str__(self):
        return self.user.get_full_name()

    class Meta:
        ordering = ('user__first_name', 'user__last_name')
        verbose_name = 'profiel'
        verbose_name_plural = 'profielen'


class Yeargroup(models.Model):
    year = models.PositiveSmallIntegerField(verbose_name='jaarlaag')
    name = models.CharField(max_length=25, verbose_name='naam')
    description = models.TextField(blank=True, null=True, verbose_name='omschrijving')

    @property
    def get_members(self):
        return Member.objects.filter(member_since=self.year).order_by(
            '-active', 'user__first_name'
        )

    class Meta:
        ordering = ('-year',)
        verbose_name = 'jaargroep'
        verbose_name_plural = 'jaargroepen'
