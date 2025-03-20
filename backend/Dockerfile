FROM python:3.9

ENV PYTHONUNBUFFERED 1

WORKDIR /app

COPY requirements.txt /app/
RUN pip install -r requirements.txt

COPY . /app/
COPY wait-for-it.sh /app/wait-for-it.sh
RUN chmod +x /app/wait-for-it.sh

CMD ["sh", "-c", "./wait-for-it.sh mysql:3306 -- python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]