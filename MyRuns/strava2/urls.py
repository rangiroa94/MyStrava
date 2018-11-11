from django.urls import path, re_path
from django.conf.urls import url
from django.contrib.staticfiles.views import serve
from django.views.generic import RedirectView
from . import views

app_name = 'strava2'
urlpatterns = [
    re_path(r'^$', views.IndexView.as_view(), name='index'),
    re_path(r'^(?P<loginId>[0-9]+)/$', views.login, name='login'),
    re_path(r'callback/.*$', views.auth, name='auth'),
    re_path(r'activities/', views.ActivitiesView.as_view(), name='activities'),
    re_path(r'^(?P<pk>[0-9]+)/workout$', views.WorkoutView.as_view(), name='workout'),
    re_path(r'^workoutDetail/(?P<pk>[0-9]+)$', views.WorkoutDetail.as_view(), name='workoutDetail'),
    ]
