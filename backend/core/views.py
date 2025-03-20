from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from .forms_registro_user import UserRegistrationForm, LoginForm
from .models import UserProfile, Certificado
from django.http import HttpResponse, JsonResponse
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from datetime import datetime
from django.urls import reverse
from .form_confirmacao_cert import UserProfileForm
from django.middleware.csrf import get_token
from django.db import IntegrityError
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from .models import Certificado
import pika
import json
import os
import time

def home(request):
    return render(request, 'core/home.html')

def logout_view(request):
    logout(request)
    return redirect('home')

def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            user = authenticate(request, username=cd['username'], password=cd['password'])
            if user is not None:
                login(request, user)
                return redirect('home')
            else:
                return HttpResponse('Invalid login')
    else:
        form = LoginForm()
    return render(request, 'core/login.html', {'form': form})

def register_view(request):
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            new_user = form.save(commit=False)
            new_user.set_password(form.cleaned_data['password'])
            new_user.save()
            try:
                UserProfile.objects.create(user=new_user)
            except IntegrityError:
                # Se o perfil já existir, redirecionar para a página de login
                return redirect('login')
            return redirect('login')
    else:
        form = UserRegistrationForm()
    return render(request, 'core/register.html', {'form': form})

@login_required
def treinamento(request):
    return render(request, 'core/treinamento.html')

@login_required
def treinamento_passo1(request):
    return render(request, 'core/treinamento_passo1.html')

@login_required
def treinamento_passo2(request):
    return render(request, 'core/treinamento_passo2.html')

@login_required
def treinamento_passo3(request):
    return render(request, 'core/treinamento_passo3.html')

@login_required
def treinamento_passo4(request):
    return render(request, 'core/treinamento_passo4.html')

@login_required
def treinamento_passo5(request):
    return render(request, 'core/treinamento_passo5.html')

@login_required
def questionario(request):
    return render(request, 'core/questionario.html')

@login_required
def questionario_submit(request):
    if request.method == 'POST':
        respostas = {
            'pergunta1': request.POST.get('pergunta1'),
            'pergunta2': request.POST.get('pergunta2'),
            'pergunta3': request.POST.get('pergunta3'),
            'pergunta4': request.POST.get('pergunta4'),
            'pergunta5': request.POST.get('pergunta5'),
            'pergunta6': request.POST.get('pergunta6'),
            'pergunta7': request.POST.get('pergunta7'),
            'pergunta8': request.POST.get('pergunta8'),
            'pergunta9': request.POST.get('pergunta9'),
            'pergunta10': request.POST.get('pergunta10'),
        }
        
        nota = 0
        respostas_corretas = {
            'pergunta1': 'b',
            'pergunta2': 'd',
            'pergunta3': 'a',
            'pergunta4': 'b',
            'pergunta5': 'b',
            'pergunta6': 'b',
            'pergunta7': 'b',
            'pergunta8': 'b',
            'pergunta9': 'a',
            'pergunta10': 'b',
        }
        
        for pergunta, resposta in respostas.items():
            if resposta == respostas_corretas[pergunta]:
                nota += 1
        
        # Salvar a nota no perfil do usuário
        user_profile = UserProfile.objects.get(user=request.user)
        user_profile.nota = nota
        user_profile.save()
        
        if nota >= 7:
            request.session['nota_minima_atingida'] = True
            request.session['nota'] = nota
            return redirect('perfil')
        else:
            request.session['nota_minima_atingida'] = False
            return render(request, 'core/nota_minima.html', {'nota': nota})
    return redirect('questionario')

@login_required
def gerar_certificado(request):
    user_profile = UserProfile.objects.get(user=request.user)
    
    if not user_profile.nome_completo or not user_profile.cpf:
        return redirect('perfil')
    
    if not request.session.get('nota_minima_atingida'):
        return redirect('questionario')
    
    if request.method == 'POST':
        nome = user_profile.nome_completo
        cpf = user_profile.cpf
        email = request.user.email
        usuario = request.user.username
        nota = request.session.get('nota')
        
        # Verificar se o certificado já foi gerado com o mesmo e-mail, nome completo e CPF
        certificado_existente = Certificado.objects.filter(user=request.user, cpf=cpf, nome_completo=nome).first()
        if certificado_existente:
            # Atualizar a data de conclusão do certificado existente
            certificado_existente.data_conclusao = datetime.now()
            certificado_existente.save()
        else:
            # Verificar se já existe um certificado com o mesmo e-mail, mas com nome ou CPF diferente
            certificado_diferente = Certificado.objects.filter(user=request.user).exclude(cpf=cpf).exclude(nome_completo=nome).exists()
            if certificado_diferente:
                return render(request, 'core/certificado_erro.html')
            
            # Salvar os dados no banco de dados
            Certificado.objects.create(
                user=request.user,
                nome_completo=nome,
                cpf=cpf,
                email=email,
                nota=nota
            )
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="certificado_{nome}.pdf"'
        
        # Criação do PDF
        doc = SimpleDocTemplate(response, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # Título
        title = "Certificado de Conclusão"
        elements.append(Paragraph(title, styles['Title']))
        elements.append(Spacer(1, 24))

        # Nome do participante
        text = f"Certificamos que <b>{nome}</b>"
        elements.append(Paragraph(text, styles['Heading2']))
        elements.append(Spacer(1, 12))

        # CPF do participante
        text = f"CPF: <b>{cpf}</b>"
        elements.append(Paragraph(text, styles['Heading2']))
        elements.append(Spacer(1, 12))

        # Texto de conclusão
        text = "concluiu com êxito o treinamento."
        elements.append(Paragraph(text, styles['Normal']))
        elements.append(Spacer(1, 24))

        # Data de conclusão
        data_conclusao = datetime.now().strftime("%d de %B de %Y")
        text = f"Data de Conclusão: <b>{data_conclusao}</b>"
        elements.append(Paragraph(text, styles['Normal']))
        elements.append(Spacer(1, 24))

        # Nome do assinante
        text = "Dr. João Bosco"
        elements.append(Paragraph(text, styles['Normal']))
        elements.append(Spacer(1, 12))

        # Cargo do assinante
        text = "Coordenador do Treinamento - Visita Guiada."
        elements.append(Paragraph(text, styles['Normal']))

        # Construir o PDF
        doc.build(elements)
        
        return response
    
    return render(request, 'core/gerar_certificado.html')

def admin_redirect(request):
    return redirect(reverse('home'))

@login_required
def perfil(request):
    user_profile = UserProfile.objects.get(user=request.user)
    if request.method == 'POST':
        form = UserProfileForm(request.POST, instance=user_profile)
        if form.is_valid():
            form.save()
            return redirect('gerar_certificado')
    else:
        form = UserProfileForm(instance=user_profile)
    return render(request, 'core/perfil.html', {'form': form})

@login_required
def alterar_senha(request):
    if request.method == 'POST':
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            user = form.save()
            update_session_auth_hash(request, user)  # Importante para manter o usuário logado após a alteração da senha
            messages.success(request, 'Sua senha foi alterada com sucesso!')
            return redirect('alterar_senha')
        else:
            messages.error(request, 'Por favor, corrija os erros abaixo.')
    else:
        form = PasswordChangeForm(request.user)
    return render(request, 'core/alterar_senha.html', {'form': form})

def consultar_certificado(cpf, nome):
    try:
        certificado = Certificado.objects.get(cpf=cpf, nome_completo=nome)
        data = {
            'nome': certificado.nome_completo,
            'cpf': certificado.cpf,
            'data_conclusao': certificado.data_conclusao.strftime('%d/%m/%Y'),
            'nota': certificado.nota,
        }
        return data
    except Certificado.DoesNotExist:
        return {'error': 'Certificado não encontrado'}

def conectar_rabbitmq():
    while True:
        try:
            # Conectar ao RabbitMQ usando o nome do serviço 'rabbitmq'
            connection = pika.BlockingConnection(pika.ConnectionParameters(host='rabbitmq'))
            return connection
        except pika.exceptions.AMQPConnectionError:
            print("RabbitMQ não está disponível. Tentando novamente...")
            time.sleep(5)  # Espera 5 segundos antes de tentar novamente

def consumir_mensagem_rabbitmq():
    connection = conectar_rabbitmq()  # Usando a função para conectar com o RabbitMQ
    channel = connection.channel()

    # Declarando a fila com o argumento x-message-ttl
    channel.queue_declare(
        queue='consulta_certificados', 
        durable=True, 
        arguments={'x-message-ttl': 1800000}  # Tempo de vida das mensagens em milissegundos (30 minutos)
    )

    def callback(ch, method, properties, body):
        mensagem = json.loads(body)
        cpf = mensagem['cpf']
        nome = mensagem['nome']
        print(f"Mensagem recebida do RabbitMQ: CPF={cpf}, Nome={nome}")
        
        # Chama a função para consultar o certificado
        response = consultar_certificado(cpf, nome)
        print(f"Enviando resposta para RabbitMQ: {response}")

        # Envia a resposta de volta para o RabbitMQ
        ch.basic_publish(
            exchange='',
            routing_key=properties.reply_to,
            properties=pika.BasicProperties(
                correlation_id=properties.correlation_id
            ),
            body=json.dumps(response)
        )
        ch.basic_ack(delivery_tag=method.delivery_tag)

    # Consome as mensagens da fila
    channel.basic_consume(queue='consulta_certificados', on_message_callback=callback)
    channel.start_consuming()

import threading
# Rodando a função de consumir mensagens em uma thread separada
threading.Thread(target=consumir_mensagem_rabbitmq).start()