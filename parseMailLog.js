// parseMailLog.js

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const winston = require('winston');

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
    new winston.transports.File({ filename: path.join(__dirname, 'parsed_logs', 'email_results.log') }),
    // Log de erros
    new winston.transports.File({ filename: path.join(__dirname, 'parsed_logs', 'email_errors.log'), level: 'error' }),
  ],
});

// Se não estiver em produção, também logar no console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
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
  recentLogs.forEach(log => {
    console.log(log);
  });
  console.log('\nAguardando novos logs...\n');
}

// Função para processar cada linha do mail.log
function processLogLine(line) {
  // Exemplo de linha de sucesso do Postfix:
  // Sep 10 12:34:56 server postfix/smtp[12345]: ABCDEF12345: to=<destinatario@exemplo.com>, relay=mail.exemplo.com[1.2.3.4]:25, delay=2.3, delays=0.1/0.1/1.2/1.9, dsn=2.0.0, status=sent (250 OK)
  
  // Exemplo de linha de falha do Postfix:
  // Sep 10 12:35:01 server postfix/smtp[12346]: ABCDEF12346: to=<destinatario@exemplo.com>, relay=mail.exemplo.com[1.2.3.4]:25, delay=2.4, delays=0.1/0.1/1.2/1.9, dsn=4.4.1, status=deferred (connect to mail.exemplo.com[1.2.3.4]:25: Connection timed out)

  const sentRegex = /postfix\/smtp\[\d+\]: (\w+): to=<(.+?)>, .*status=sent .*?\((.+)\)/i;
  const failedRegex = /postfix\/smtp\[\d+\]: (\w+): to=<(.+?)>, .*status=(deferred|bounced) .*?\((.+)\)/i;

  let match = line.match(sentRegex);
  if (match) {
    const [_, messageId, to, response] = match;
    const logMessage = `SUCESSO | ID: ${messageId} | Para: ${to} | Resposta: ${response}`;
    logger.info(logMessage);
    addRecentLog(logMessage);
    displayRecentLogs();
    return;
  }

  match = line.match(failedRegex);
  if (match) {
    const [_, messageId, to, status, error] = match;
    const logMessage = `FALHA | ID: ${messageId} | Para: ${to} | Status: ${status} | Erro: ${error}`;
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

// Inicializa o watcher usando chokidar
const watcher = chokidar.watch(MAIL_LOG_PATH, {
  persistent: true,
  usePolling: true,
  interval: 1000,
});

// Armazena a posição atual no arquivo para ler novas linhas apenas
let filePosition = 0;

// Função para ler novas linhas adicionadas ao arquivo
function readNewLines() {
  fs.stat(MAIL_LOG_PATH, (err, stats) => {
    if (err) {
      logger.error(`Erro ao obter estatísticas do arquivo de log: ${err.message}`);
      return;
    }

    if (stats.size < filePosition) {
      // O arquivo foi truncado, resetar a posição
      filePosition = 0;
    }

    if (stats.size > filePosition) {
      const stream = fs.createReadStream(MAIL_LOG_PATH, { start: filePosition, end: stats.size });
      let buffer = '';
      stream.on('data', (data) => {
        buffer += data.toString();
      });
      stream.on('end', () => {
        filePosition = stats.size;
        const lines = buffer.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            processLogLine(line);
          }
        });
      });
    }
  });
}

// Inicia a leitura quando o watcher detecta alterações
watcher.on('change', () => {
  readNewLines();
});

// Função para inicializar o monitoramento e carregar os logs existentes
function initialize() {
  fs.readFile(MAIL_LOG_PATH, 'utf8', (err, data) => {
    if (err) {
      logger.error(`Erro ao ler o arquivo de log: ${err.message}`);
      return;
    }
    const lines = data.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        processLogLine(line);
      }
    });
    filePosition = data.length;
  });
}

// Inicializa o monitoramento
initialize();

console.log(`Monitorando o arquivo de log: ${MAIL_LOG_PATH}`);
console.log(`Exibindo os últimos ${MAX_LOGS} logs no console.\n`);
