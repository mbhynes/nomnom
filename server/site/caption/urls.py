from django.shortcuts import render
from django.urls import include, path, re_path

from rest_framework.authtoken import views as rest_auth_views
from rest_framework import authentication, permissions, routers

from . import views

router = routers.SimpleRouter()
# router.register(r'image', views.ImageView, basename='image')
# router.register(r'apikeys', views.ApiKeyViewSet)

urlpatterns = [
    path('auth-token/', rest_auth_views.obtain_auth_token),
    path("auth-check/", views.AuthTokenValidationView.as_view(), name="auth-check"),
    path("auth/", include('rest_framework.urls')),
    path("image/", views.ImageView.as_view(), name="image"),
    path("", include(router.urls)),
]
