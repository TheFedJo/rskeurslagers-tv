from django.urls import path
from django.views.i18n import JavaScriptCatalog
from . import views

urlpatterns = [
    path('jsi18n/', JavaScriptCatalog.as_view(), name='javascript-catalog'),
    path('api/members/', views.member_list),
    path('api/players/', views.player_list),
    path('api/matches/', views.match_list),
    path('api/elo/', views.elo_list),
    path("", views.with_menu, name="qualitybutchertv.production"),
    path("testing", views.clean, name="qualitybutchertv.testing"),
]
