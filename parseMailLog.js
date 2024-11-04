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

// Estrutura para mapear IDs de mensagem a detalhes adicionais
const messageMap = {};

// Função para adicionar um log à estrutura e manter o limite
function addRecentLog(log) {
  recentLogs.push(log);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift(); // Remove o log mais antigo
  }
}

// Função para exibir os últimos 500 logs no console
function displayRecentLogs() {
  console.clear();
  console.log(`\nÚltimos ${recentLogs.length} logs de e-mail:\n`);
  recentLogs.forEach((log) => {
    console.log(log);
  });
  console.log('\nAguardando novos logs...\n');
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
    const messageId = match[1].replace(/:$/, ''); // Remove o ':' no final
    const to = match[2].trim();
    const status = match[3].trim();
    const details = match[4] ? match[4].trim() : '';

    // Armazena informações adicionais no mapa
    if (!messageMap[messageId]) {
      messageMap[messageId] = {};
    }
    messageMap[messageId].to = to;

    if (status.toLowerCase().startsWith('sent')) {
      const logMessage = `SUCESSO | ID: ${messageId} | Para: ${to} | Detalhes: ${details}`;
      logger.info(logMessage);
      addRecentLog(logMessage);
    } else {
      const logMessage = `FALHA | ID: ${messageId} | Para: ${to} | Status: ${status} | Detalhes: ${details}`;
      logger.error(logMessage);
      addRecentLog(logMessage);
    }
    return;
  }

  match = line.match(regexDSN);
  if (match) {
    const originalMessageId = match[1].replace(/:$/, '');
    const dsnMessageId = match[2].replace(/:$/, '');
    const dsnStatus = match[3].trim();

    // Atualiza o mapa com informações de DSN
    if (!messageMap[originalMessageId]) {
      messageMap[originalMessageId] = {};
    }
    messageMap[originalMessageId].dsnMessageId = dsnMessageId;
    messageMap[originalMessageId].dsnStatus = dsnStatus;

    const logMessage = `FALHA | ID: ${originalMessageId} | DSN Message ID: ${dsnMessageId} | DSN Status: ${dsnStatus}`;
    logger.error(logMessage);
    addRecentLog(logMessage);
    return;
  }

  match = line.match(regexWithoutTo);
  if (match) {
    const messageId = match[1].replace(/:$/, '');
    const status = match[2].trim();
    const details = match[3] ? match[3].trim() : '';

    const logMessage = `FALHA | ID: ${messageId} | Status: ${status} | Detalhes: ${details}`;
    logger.error(logMessage);
    addRecentLog(logMessage);
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
    displayRecentLogs();
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
