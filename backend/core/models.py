from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    nome_completo = models.CharField(max_length=255, blank=True, null=True)
    cpf = models.CharField(max_length=14, blank=True, null=True)
    email = models.EmailField(blank=True)
    usuario_gmail = models.CharField(max_length=255, blank=True)
    nota = models.IntegerField(default=0)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)
    is_admin = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username

class Certificado(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    nome_completo = models.CharField(max_length=255)
    cpf = models.CharField(max_length=14)
    email = models.EmailField()
    nota = models.IntegerField()
    data_conclusao = models.DateField(auto_now_add=True)

    def __str__(self):
        return self.nome_completo

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.userprofile.save()


