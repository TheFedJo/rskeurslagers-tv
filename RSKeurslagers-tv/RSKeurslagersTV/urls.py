from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView

class HomePageView(TemplateView):
    template_name = "qualitybutchertv/clean-base.html"

urlpatterns = [
    path('admin/', admin.site.urls),
    path('rskeurslagers-tv/', include('qualitybutchertv.urls')),
    path('', HomePageView.as_view()),
]
