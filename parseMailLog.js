const fs = require('fs');
const path = require('path');
const winston = require('winston');
const readline = require('readline');
require('dotenv').config();

// Configuração do Winston para logs detalhados e de erros
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    // Log de resultados concisos
    new winston.transports.File({
      filename: path.join(__dirname, 'parsed_logs', 'email_results.log'),
    }),
    // Log de erros
    new winston.transports.File({
      filename: path.join(__dirname, 'parsed_logs', 'email_errors.log'),
      level: 'error',
    }),
  ],
});

// Se não estiver em produção, também logar no console
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Estrutura para armazenar os últimos 500 logs
const MAX_LOGS = 500;
let recentLogs = [];

// Estrutura para mapear IDs de mensagem originais e DSN
const messageMap = {};

// Estrutura para contagem de status
const statusCounts = {
  SUCESSO: 0,
  FALHA: 0,
  INDEFINIDO: 0,
  // Adicione outros status conforme necessário
};

// Função para adicionar um log à estrutura e manter o limite
function addRecentLog(log) {
  recentLogs.push(log);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift(); // Remove o log mais antigo
  }
}

// Função para exibir apenas um log no console
function displayNewLog(log) {
  console.log(log);
}

// Função para exibir as contagens de status
function displayStatusCounts() {
  console.log('\nContagem de Status de E-mail:');
  console.log(`SUCESSO: ${statusCounts.SUCESSO}`);
  console.log(`FALHA: ${statusCounts.FALHA}`);
  console.log(`INDEFINIDO: ${statusCounts.INDEFINIDO}`);
  // Adicione outras contagens conforme necessário
  console.log('-------------------------------------------\n');
}

// Função para processar cada linha do mail.log
function processLogLine(line) {
  // Regex para linhas com 'stat=' e 'to='
  const regexWithTo =
    /(?:sendmail|sm-mta)\[\d+\]: (\S+): .*?to=?<?([^>,]+)>?,.*?stat=([^()]+)(?:\s*\((.+?)\))?$/i;

  // Regex para linhas com 'DSN:'
  const regexDSN =
    /(?:sendmail|sm-mta)\[\d+\]: (\S+): (\S+): DSN: (.*)$/i;

  // Regex para linhas com 'stat=' mas sem 'to='
  const regexWithoutTo =
    /(?:sendmail|sm-mta)\[\d+\]: (\S+): .*?stat=([^()]+)(?:\s*\((.+?)\))?$/i;

  let match = line.match(regexWithTo);
  if (match) {
    const originalMessageId = match[1].replace(/:$/, ''); // Remove o ':' no final
    const to = match[2].trim();
    const status = match[3].trim();
    const details = match[4] ? match[4].trim() : '';

    // Verifica se o ID é um DSNMessageId e encontra o originalMessageId
    let finalMessageId = originalMessageId;
    // Itera sobre messageMap para encontrar se originalMessageId é um DSN
    for (const key in messageMap) {
      if (messageMap[key].dsnMessageId === originalMessageId) {
        finalMessageId = key;
        break;
      }
    }

    // Inicializa o objeto no messageMap se não existir
    if (!messageMap[finalMessageId]) {
      messageMap[finalMessageId] = {};
    }

    // Atualiza informações no messageMap
    messageMap[finalMessageId].to = to;
    messageMap[finalMessageId].status = status;
    messageMap[finalMessageId].details = details;

    let logMessage = '';
    let statusKey = '';

    if (status.toLowerCase().startsWith('sent')) {
      logMessage = `SUCESSO | ID: ${finalMessageId} | Para: ${to} | Detalhes: ${details}`;
      statusKey = 'SUCESSO';
      logger.info(logMessage);
    } else {
      logMessage = `FALHA | ID: ${finalMessageId} | Para: ${to} | Status: ${status} | Detalhes: ${details}`;
      statusKey = 'FALHA';
      logger.error(logMessage);
    }

    addRecentLog(logMessage);
    displayNewLog(logMessage);

    // Atualiza contagens
    if (statusKey) {
      statusCounts[statusKey] += 1;
      displayStatusCounts();
    }

    return;
  }

  match = line.match(regexDSN);
  if (match) {
    const messageId = match[1].replace(/:$/, '');
    const dsnMessageId = match[2].replace(/:$/, '');
    const dsnStatus = match[3].trim();

    // Inicializa o objeto no messageMap se não existir
    if (!messageMap[messageId]) {
      messageMap[messageId] = {};
    }

    // Atualiza informações de DSN no messageMap
    messageMap[messageId].dsnMessageId = dsnMessageId;
    messageMap[messageId].dsnStatus = dsnStatus;

    const logMessage = `FALHA | ID: ${messageId} | DSN Message ID: ${dsnMessageId} | DSN Status: ${dsnStatus}`;
    logger.error(logMessage);
    addRecentLog(logMessage);
    displayNewLog(logMessage);

    // Atualiza contagens
    statusCounts['FALHA'] += 1;
    displayStatusCounts();

    return;
  }

  match = line.match(regexWithoutTo);
  if (match) {
    const messageId = match[1].replace(/:$/, '');
    const status = match[2].trim();
    const details = match[3] ? match[3].trim() : '';

    // Verifica se o ID é um DSNMessageId e encontra o originalMessageId
    let finalMessageId = messageId;
    for (const key in messageMap) {
      if (messageMap[key].dsnMessageId === messageId) {
        finalMessageId = key;
        break;
      }
    }

    // Inicializa o objeto no messageMap se não existir
    if (!messageMap[finalMessageId]) {
      messageMap[finalMessageId] = {};
    }

    // Atualiza informações no messageMap
    messageMap[finalMessageId].status = status;
    messageMap[finalMessageId].details = details;

    let logMessage = '';
    let statusKey = '';

    if (status.toLowerCase().startsWith('sent')) {
      logMessage = `SUCESSO | ID: ${finalMessageId} | Status: ${status} | Detalhes: ${details}`;
      statusKey = 'SUCESSO';
      logger.info(logMessage);
    } else {
      logMessage = `FALHA | ID: ${finalMessageId} | Status: ${status} | Detalhes: ${details}`;
      statusKey = 'FALHA';
      logger.error(logMessage);
    }

    addRecentLog(logMessage);
    displayNewLog(logMessage);

    // Atualiza contagens
    if (statusKey) {
      statusCounts[statusKey] += 1;
      displayStatusCounts();
    }

    return;
  }

  // Regex para detectar 'Saved message' e finalizar o log
  const regexSavedMessage = /(?:sendmail|sm-mta)\[\d+\]: (\S+): Saved message in .*$/i;
  match = line.match(regexSavedMessage);
  if (match) {
    const messageId = match[1].replace(/:$/, '');

    // Verifica se o messageId é um DSNMessageId e encontra o originalMessageId
    let originalMessageId = messageId;
    for (const key in messageMap) {
      if (messageMap[key].dsnMessageId === messageId) {
        originalMessageId = key;
        break;
      }
    }

    if (messageMap[originalMessageId]) {
      const { to, status, details, dsnMessageId, dsnStatus } = messageMap[originalMessageId];

      let logMessage = `FALHA | ID: ${originalMessageId}`;
      if (dsnMessageId && dsnStatus) {
        logMessage += ` | DSN Message ID: ${dsnMessageId} | DSN Status: ${dsnStatus}`;
      }
      if (to) {
        logMessage += ` | Para: ${to}`;
      }
      if (status) {
        logMessage += ` | Status: ${status}`;
      }
      if (details) {
        logMessage += ` | Detalhes: ${details}`;
      }

      // Log final
      logger.error(logMessage);
      addRecentLog(logMessage);
      displayNewLog(logMessage);

      // Atualiza contagens
      statusCounts['FALHA'] += 1;
      displayStatusCounts();

      // Remove a entrada do messageMap após o log
      delete messageMap[originalMessageId];
    }
    return;
  }

  // Caso a linha não corresponda aos padrões acima, ignorar ou processar conforme necessário
}

// Caminho para o arquivo mail.log (ajuste conforme necessário)
const MAIL_LOG_PATH = process.env.MAIL_LOG_PATH || '/var/log/mail.log';

// Verifique se o arquivo existe
if (!fs.existsSync(MAIL_LOG_PATH)) {
  console.error(`O arquivo de log não foi encontrado em: ${MAIL_LOG_PATH}`);
  process.exit(1);
}

// Assegure-se de que a pasta para os logs parseados existe
const parsedLogsDir = path.join(__dirname, 'parsed_logs');
if (!fs.existsSync(parsedLogsDir)) {
  fs.mkdirSync(parsedLogsDir);
}

// Função para inicializar o monitoramento e carregar os logs existentes
function initialize() {
  const rl = readline.createInterface({
    input: fs.createReadStream(MAIL_LOG_PATH),
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    processLogLine(line);
  });

  rl.on('close', () => {
    console.log('\nInicialização concluída. Aguardando novos logs...\n');
    displayStatusCounts();
  });

  rl.on('error', (err) => {
    logger.error(`Erro ao ler o arquivo de log: ${err.message}`);
  });
}

// Função para monitorar o arquivo de log em tempo real
function monitorLog() {
  fs.watch(MAIL_LOG_PATH, (eventType, filename) => {
    if (eventType === 'change') {
      const stream = fs.createReadStream(MAIL_LOG_PATH, { encoding: 'utf8', start: filePosition });
      let remaining = '';

      stream.on('data', (chunk) => {
        remaining += chunk;
        let index;
        while ((index = remaining.indexOf('\n')) > -1) {
          const line = remaining.substring(0, index);
          remaining = remaining.substring(index + 1);
          if (line.trim()) {
            processLogLine(line);
          }
        }
      });

      stream.on('end', () => {
        filePosition += remaining.length;
        if (remaining.trim()) {
          processLogLine(remaining);
        }
      });

      stream.on('error', (err) => {
        logger.error(`Erro ao monitorar o arquivo de log: ${err.message}`);
      });
    }
  });
}

// Variável para armazenar a posição atual no arquivo
let filePosition = 0;

// Inicializa o monitoramento
initialize();

// Inicia a monitoração do arquivo de log
monitorLog();

console.log(`Monitorando o arquivo de log: ${MAIL_LOG_PATH}`);
console.log(`Exibindo os últimos ${MAX_LOGS} logs no console.\n`);
console.log('Contagem inicial de status de e-mail:');
displayStatusCounts();
