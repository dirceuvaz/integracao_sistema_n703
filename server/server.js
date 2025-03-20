require('dotenv').config();
const express = require('express');
const amqp = require('amqplib');
const net = require('net');

const app = express();
app.use(require('cors')());
app.use(express.json());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'rabbitmq';
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || 5672;
const SERVER_PORT = process.env.SERVER_PORT || 5001;
const RECONNECT_TIMEOUT = process.env.RECONNECT_TIMEOUT || 5000;
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT || 30000; // Timeout para solicitações
const REPLY_QUEUE_NAME = process.env.REPLY_QUEUE_NAME || 'api_response_queue'; // Nome fixo para a fila de resposta

let channel, connection;
let isConnecting = false;
let pendingRequests = new Map();
let connectionRetries = 0;
const MAX_RETRIES = 20; // Número máximo de tentativas
const INITIAL_RETRY_DELAY = 1000; // Delay inicial de 1 segundo

// Função para conectar ao RabbitMQ com tratamento de reconexão
async function connectRabbitMQ() {
    if (isConnecting) return;

    isConnecting = true;

    try {
        // Fechar a conexão anterior se existir
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar conexão anterior:', err.message);
            }
        }

        console.log(`Tentando conectar ao RabbitMQ em ${RABBITMQ_URL}...`);
        connection = await amqp.connect(RABBITMQ_URL);
        console.log('Conectado ao RabbitMQ!');

        // Reset contador de tentativas após sucesso
        connectionRetries = 0;

        // Configurar listeners para reconexão em caso de erro
        connection.on('error', (err) => {
            console.error('Erro na conexão com RabbitMQ:', err.message);
            reconnectWithBackoff();
        });

        connection.on('close', () => {
            console.warn('Conexão com RabbitMQ fechada, tentando reconectar...');
            reconnectWithBackoff();
        });

        // Criar canal
        channel = await connection.createChannel();

        // Tentar excluir a fila caso já exista
        try {
            await channel.deleteQueue('consulta_certificados');
            console.log('Fila de consulta_certificados excluída');
        } catch (err) {
            console.warn('Fila de consulta_certificados não encontrada, criando uma nova...');
        }

        // Criar a fila com o TTL (30 minutos)
        await channel.assertQueue('consulta_certificados', {
            durable: true,
            arguments: {
                'x-message-ttl': 1800000 // TTL de 30 minutos
            }
        });

        // Configurar resposta global com nome fixo (mais resiliente a reinicializações)
        const replyQueue = await channel.assertQueue(REPLY_QUEUE_NAME, {
            exclusive: false,
            autoDelete: false, // Não excluir quando desconectar
            durable: true      // Persistir entre reinicializações
        });

        // Limpar a fila antes de começar a consumir (evita mensagens antigas)
        await channel.purgeQueue(REPLY_QUEUE_NAME);

        channel.consume(replyQueue.queue, (msg) => {
            if (!msg) return;

            const correlationId = msg.properties.correlationId;
            const pendingRequest = pendingRequests.get(correlationId);

            if (pendingRequest) {
                clearTimeout(pendingRequest.timeout);
                console.log(`Resposta recebida do RabbitMQ para ${correlationId}`);
                pendingRequest.res.json(JSON.parse(msg.content.toString()));
                pendingRequests.delete(correlationId);
            } else {
                console.log(`Resposta recebida para correlationId desconhecido: ${correlationId}`);
            }

            channel.ack(msg);
        });

        // Armazenar a fila de resposta global
        app.locals.replyQueue = replyQueue.queue;

        isConnecting = false;
    } catch (error) {
        console.error('Erro ao conectar ao RabbitMQ:', error.message);
        isConnecting = false;
        reconnectWithBackoff();
    }
}

// Função para reconexão com backoff exponencial
function reconnectWithBackoff() {
    if (isConnecting) return;

    // Incrementar contador de tentativas
    connectionRetries++;

    // Calcular delay com backoff exponencial (1s, 2s, 4s, 8s, etc)
    const retryDelay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, connectionRetries - 1),
        60000 // Máximo de 1 minuto entre tentativas
    );

    console.log(`Tentativa ${connectionRetries}/${MAX_RETRIES} em ${retryDelay}ms...`);

    // Se excedeu o número máximo de tentativas, reinicia o contador e aplicação
    if (connectionRetries >= MAX_RETRIES) {
        console.error(`Falha após ${MAX_RETRIES} tentativas de reconexão. Reiniciando aplicação...`);
        connectionRetries = 0;
    }

    setTimeout(connectRabbitMQ, retryDelay);
}

// Função para verificar disponibilidade do RabbitMQ
function checkRabbitMQAvailability(callback) {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.on('connect', function() {
        socket.destroy();
        callback(true);
    }).on('error', function(err) {
        console.error(`Erro de conexão socket: ${err.message}`);
        socket.destroy();
        callback(false);
    }).on('timeout', function() {
        console.error('Timeout ao verificar disponibilidade do RabbitMQ');
        socket.destroy();
        callback(false);
    }).connect(RABBITMQ_PORT, RABBITMQ_HOST);
}

// Middleware para garantir conexão com RabbitMQ
async function ensureRabbitMQConnection(req, res, next) {
    if (!channel || !connection || connection.closed) {
        try {
            await connectRabbitMQ();
            if (!channel || !connection || connection.closed) {
                return res.status(503).json({
                    error: 'Serviço RabbitMQ indisponível. Tente novamente em alguns instantes.'
                });
            }
        } catch (error) {
            return res.status(503).json({
                error: 'Serviço RabbitMQ indisponível. Tente novamente em alguns instantes.'
            });
        }
    }
    next();
}

// Gerar UUID mais confiável
function generateUuid() {
    return Date.now() + '-' + Math.round(Math.random() * 1000000);
}

// Endpoint para solicitar certificado
app.post('/solicitar-certificado', ensureRabbitMQConnection, async (req, res) => {
    const { cpf, nome } = req.body;
    if (!cpf || !nome) {
        return res.status(400).json({ error: 'CPF e nome são obrigatórios' });
    }

    try {
        const correlationId = generateUuid();
        const replyQueueName = app.locals.replyQueue;

        if (!replyQueueName) {
            console.error('Fila de resposta não configurada');
            return res.status(500).json({
                error: 'Erro de configuração do serviço. Tente novamente.'
            });
        }

        const timeoutId = setTimeout(() => {
            if (pendingRequests.has(correlationId)) {
                console.warn(`Timeout atingido para solicitação ${correlationId}`);
                pendingRequests.delete(correlationId);
                return res.status(504).json({
                    error: 'Tempo limite excedido ao aguardar resposta do serviço.'
                });
            }
        }, REQUEST_TIMEOUT);

        pendingRequests.set(correlationId, {
            res,
            timeout: timeoutId,
            timestamp: Date.now()
        });

        console.log(`Enviando mensagem para RabbitMQ: CPF=${cpf}, Nome=${nome}, ID=${correlationId}`);

        channel.sendToQueue(
            'consulta_certificados',
            Buffer.from(JSON.stringify({
                cpf,
                nome,
                timestamp: Date.now()
            })),
            {
                correlationId,
                replyTo: replyQueueName,
                persistent: true,
                expiration: String(REQUEST_TIMEOUT)
            }
        );
    } catch (error) {
        console.error('Erro ao processar solicitação:', error);
        return res.status(500).json({
            error: 'Erro interno ao processar solicitação. Tente novamente.'
        });
    }
});

// Endpoint para checar saúde do serviço
app.get('/health', (req, res) => {
    const isConnected = channel && connection && !connection.closed;
    res.status(isConnected ? 200 : 503).json({
        status: isConnected ? 'OK' : 'Disconnected',
        rabbitmq: isConnected ? 'Connected' : 'Disconnected',
        pendingRequests: pendingRequests.size,
        connectionRetries: connectionRetries,
        uptime: process.uptime() // Adicionar uptime para monitoramento
    });
});

// Função para limpar solicitações antigas pendentes
function cleanupPendingRequests() {
    const now = Date.now();
    let expired = 0;

    pendingRequests.forEach((request, id) => {
        if (now - request.timestamp > REQUEST_TIMEOUT) {
            clearTimeout(request.timeout);
            if (!request.res.headersSent) {
                request.res.status(504).json({
                    error: 'Tempo limite excedido ao aguardar resposta do serviço.'
                });
            }
            pendingRequests.delete(id);
            expired++;
        }
    });

    if (expired > 0) {
        console.log(`Limpeza: ${expired} solicitações expiradas removidas`);
    }

    setTimeout(cleanupPendingRequests, REQUEST_TIMEOUT / 2);
}

// Função para inicialização do servidor com retry exponencial
function startServerWithRetry() {
    if (connectionRetries >= MAX_RETRIES) {
        console.error(`Falha ao conectar após ${MAX_RETRIES} tentativas. Abortando.`);
        process.exit(1);
    }

    const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, connectionRetries);
    connectionRetries++;

    console.log(`Tentativa ${connectionRetries}/${MAX_RETRIES} de iniciar servidor em ${retryDelay}ms...`);

    setTimeout(() => {
        checkRabbitMQAvailability((available) => {
            if (available) {
                connectRabbitMQ().then(() => {
                    app.listen(SERVER_PORT, () => {
                        connectionRetries = 0;
                        console.log(`Servidor rodando na porta ${SERVER_PORT}`);
                        cleanupPendingRequests();
                    });
                }).catch(err => {
                    console.error('Falha ao iniciar servidor:', err);
                    startServerWithRetry();
                });
            } else {
                console.error('RabbitMQ não está disponível. Tentando novamente...');
                startServerWithRetry();
            }
        });
    }, retryDelay);
}

// Tratamento de encerramento gracioso
process.on('SIGINT', async () => {
    console.log('Encerrando aplicação...');
    try {
        if (channel) await channel.close();
        if (connection) await connection.close();
    } catch (err) {
        console.error('Erro ao encerrar conexões:', err);
    }
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('Erro não capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promessa rejeitada não tratada:', reason);
});

// Substituir a chamada original por inicialização com retry
startServerWithRetry();
