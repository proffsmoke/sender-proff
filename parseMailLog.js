const fs = require('fs');
const path = require('path');
const winston = require('winston');
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
    /(?:sendmail|sm-mta)\[\d+\]: (\S+): .*?to=<([^>]+)>,.*?stat=(.*?)(?:\s*\((.+?)\))?$/i;

  // Regex para linhas com 'DSN:'
  const regexDSN =
    /(?:sendmail|sm-mta)\[\d+\]: (\S+): (\S+): DSN: (.*)$/i;

  // Regex para linhas com 'stat=' mas sem 'to='
  const regexWithoutTo =
    /(?:sendmail|sm-mta)\[\d+\]: (\S+): .*?stat=(.*?)(?:\s*\((.+?)\))?$/i;

  let match = line.match(regexWithTo);
  if (match) {
    const messageId = match[1];
    const to = match[2];
    const status = match[3].trim();
    const details = match[4] || '';

    if (status.startsWith('Sent')) {
      const logMessage = `SUCESSO | ID: ${messageId} | Para: ${to} | Detalhes: ${details}`;
      logger.info(logMessage);
      addRecentLog(logMessage);
      displayRecentLogs();
    } else {
      const logMessage = `FALHA | ID: ${messageId} | Para: ${to} | Status: ${status} | Detalhes: ${details}`;
      logger.error(logMessage);
      addRecentLog(logMessage);
      displayRecentLogs();
    }
    return;
  }

  match = line.match(regexDSN);
  if (match) {
    const messageId = match[1];
    const relatedMessageId = match[2];
    const dsnStatus = match[3];

    const logMessage = `FALHA | ID: ${messageId} | DSN Message ID: ${relatedMessageId} | DSN Status: ${dsnStatus}`;
    logger.error(logMessage);
    addRecentLog(logMessage);
    displayRecentLogs();
    return;
  }

  match = line.match(regexWithoutTo);
  if (match) {
    const messageId = match[1];
    const status = match[2].trim();
    const details = match[3] || '';

    const logMessage = `FALHA | ID: ${messageId} | Status: ${status} | Detalhes: ${details}`;
    logger.error(logMessage);
    addRecentLog(logMessage);
    displayRecentLogs();
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

// Armazena a posição atual no arquivo para ler novas linhas apenas
let filePosition = 0;

// Função para ler novas linhas adicionadas ao arquivo
function readNewLines() {
  fs.stat(MAIL_LOG_PATH, (err, stats) => {
    if (err) {
      logger.error(
        `Erro ao obter estatísticas do arquivo de log: ${err.message}`
      );
      return;
    }

    if (stats.size < filePosition) {
      // O arquivo foi truncado, resetar a posição
      filePosition = 0;
    }

    if (stats.size > filePosition) {
      const stream = fs.createReadStream(MAIL_LOG_PATH, {
        start: filePosition,
        end: stats.size,
      });
      let buffer = '';
      stream.on('data', (data) => {
        buffer += data.toString();
      });
      stream.on('end', () => {
        filePosition = stats.size;
        const lines = buffer.split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            processLogLine(line);
          }
        });
      });
    }
  });
}

// Função para inicializar o monitoramento e carregar os logs existentes
function initialize() {
  fs.readFile(MAIL_LOG_PATH, 'utf8', (err, data) => {
    if (err) {
      logger.error(`Erro ao ler o arquivo de log: ${err.message}`);
      return;
    }
    const lines = data.split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        processLogLine(line);
      }
    });
    filePosition = data.length;
  });
}

// Função principal que executa o loop de verificação a cada 10 segundos
function mainLoop() {
  readNewLines();
}

// Inicializa o monitoramento
initialize();
displayRecentLogs();

console.log(`Monitorando o arquivo de log: ${MAIL_LOG_PATH}`);
console.log(`Exibindo os últimos ${MAX_LOGS} logs no console.\n`);

// Inicia o loop de verificação a cada 10 segundos
setInterval(mainLoop, 10000);
