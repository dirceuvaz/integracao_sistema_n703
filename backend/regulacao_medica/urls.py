from django.contrib import admin
from django.urls import path, include
from core import views  # Importando views

urlpatterns = [
    path('admin/', admin.site.urls),   
    path('', include('core.urls')),  # Incluindo as URLs do app 'core'
    path('accounts/', include('django.contrib.auth.urls')),  # URLs de autenticação
    path('register/', views.register_view, name='register'),  # Registrar usuário
]
