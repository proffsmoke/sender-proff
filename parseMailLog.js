const fs = require('fs');
const path = require('path');
const winston = require('winston');
const dotenv = require('dotenv');
const syslogParser = require('syslog-parser');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

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
    // Log de linhas não reconhecidas
    new winston.transports.File({ filename: path.join(__dirname, 'parsed_logs', 'unparsed_lines.log'), level: 'warn' }),
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
  try {
    // Utiliza o syslog-parser para estruturar a linha
    const parsed = syslogParser.parse(line);

    // Verifica se a mensagem é do sendmail ou sm-mta
    if (parsed.program === 'sendmail' || parsed.program === 'sm-mta') {
      // Exemplo de mensagem:
      // 4A44Mbng011203: to=<destinatario@exemplo.com>, ... stat=Sent (<detalhes da mensagem>)
      // 4A44Mbng011204: to=<destinatario@exemplo.com>, ... stat=Deferred: Connection timed out

      const message = parsed.message;

      // Expressão regular para capturar mensagens de sucesso
      const sentRegex = /(\S+): to=<(.+?)>,.*?stat=Sent\s*\((.+)\)/i;
      // Expressão regular para capturar mensagens de falha
      const failedRegex = /(\S+): to=<(.+?)>,.*?stat=(Deferred|Bounced|Rejected|Error):?\s*(.+)/i;

      let match = message.match(sentRegex);
      if (match) {
        const [_, messageId, to, response] = match;
        const logMessage = `SUCESSO | ID: ${messageId} | Para: ${to} | Resposta: ${response}`;
        logger.info(logMessage);
        addRecentLog(logMessage);
        displayRecentLogs();
        return;
      }

      match = message.match(failedRegex);
      if (match) {
        const [_, messageId, to, status, error] = match;
        const logMessage = `FALHA | ID: ${messageId} | Para: ${to} | Status: ${status} | Erro: ${error}`;
        logger.error(logMessage);
        addRecentLog(logMessage);
        displayRecentLogs();
        return;
      }

      // Se a linha não corresponder a nenhum padrão conhecido
      logger.warn(`Linha não reconhecida do sendmail: ${line}`);
      return;
    }

    // Se a mensagem não for do sendmail ou sm-mta, ignorar ou processar conforme necessário
  } catch (err) {
    logger.error(`Erro ao processar a linha: ${err.message} | Linha: ${line}`);
  }
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
