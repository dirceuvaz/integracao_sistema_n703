from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('register/', views.register_view, name='register'),    
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='account_logout'),
    path('alterar_senha/', views.alterar_senha, name='alterar_senha'),
    path('treinamento/passo1/', views.treinamento_passo1, name='treinamento_passo1'),
    path('treinamento/passo2/', views.treinamento_passo2, name='treinamento_passo2'),
    path('treinamento/passo3/', views.treinamento_passo3, name='treinamento_passo3'),
    path('treinamento/passo4/', views.treinamento_passo4, name='treinamento_passo4'),
    path('treinamento/passo5/', views.treinamento_passo5, name='treinamento_passo5'),
    path('questionario/', views.questionario, name='questionario'),
    path('questionario/submit/', views.questionario_submit, name='questionario_submit'),
    path('gerar_certificado/', views.gerar_certificado, name='gerar_certificado'),
    path('perfil/', views.perfil, name='perfil'),
]