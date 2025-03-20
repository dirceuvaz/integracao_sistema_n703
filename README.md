# Projeto Visita Guiada e ValidaCert

Este repositório contém dois sistemas:

- **Visita Guiada**: Sistema backend desenvolvido com Django, rodando na porta `8000`.
- **ValidaCert**: Sistema frontend desenvolvido com React, rodando na porta `3000`.

Esses dois sistemas se comunicam entre si, com RabbitMQ para mensagens assíncronas e MySQL para persistência de dados.

## Requisitos

- [Docker](https://www.docker.com/products/docker-desktop) instalado
- [Docker Compose](https://docs.docker.com/compose/install/) instalado
- [Node.js](https://nodejs.org/) (para rodar o frontend)
- [Python 3](https://www.python.org/) (para rodar o backend Django)
- Um editor de código de sua preferência (ex.: [Visual Studio Code](https://code.visualstudio.com/))

## Passo a Passo para Rodar o Projeto

### 1. Baixar o Repositório

Clone o repositório para sua máquina local:

```bash
git clone <URL_DO_REPOSITORIO>
```
```bash
cd nome do projeto
```
```bash
docker-compose up - build
```