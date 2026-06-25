from django.urls import path, include
from django.views.i18n import JavaScriptCatalog
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'players', views.PlayerViewSet)
router.register(r'matches', views.MatchViewSet)
router.register(r'elo', views.EloListView)
#router.register(r'match-types', views.MatchTypeViewSet)

urlpatterns = [
    path('jsi18n/', JavaScriptCatalog.as_view(), name='javascript-catalog'),
    path('api/', include(router.urls)),
    path('api/members/', views.MemberListView.as_view()),
    path("", views.with_menu, name="qualitybutchertv.production"),
    path("testing", views.clean, name="qualitybutchertv.testing"),
]
