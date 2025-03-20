from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Cria um usuário administrador padrão'

    def handle(self, *args, **kwargs):
        username = 'admin_visita'
        password = 'visita1234'
        email = 'visita@guiada.com.br'

        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username=username, email=email, password=password)
            self.stdout.write(self.style.SUCCESS(f'Superuser "{username}" criado com sucesso.'))
        else:
            self.stdout.write(self.style.WARNING(f'Superuser "{username}" já existe.'))