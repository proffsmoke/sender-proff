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
      const message = parsed.message;
      const msgData = parseMessage(message);

      if (!msgData) {
        logger.warn(`Linha não reconhecida do sendmail: ${line}`);
        return;
      }

      const { messageId, to, stat, dsn } = msgData;
      if (!messageId || !to || !stat) {
        logger.warn(`Linha incompleta do sendmail: ${line}`);
        return;
      }

      const recipient = to.replace(/^<|>$/g, ''); // Remove os sinais de menor e maior

      if (stat.trim().toLowerCase().startsWith('sent')) {
        // Mensagem enviada com sucesso
        const responseMatch = stat.match(/Sent\s*(?:\((.*)\))?/i);
        const response = responseMatch ? responseMatch[1] || '' : '';
        const logMessage = `SUCESSO | ID: ${messageId} | Para: ${recipient} | Resposta: ${response} | DSN: ${dsn || 'N/A'}`;
        logger.info(logMessage);
        addRecentLog(logMessage);
      } else {
        // Mensagem com falha
        const logMessage = `FALHA | ID: ${messageId} | Para: ${recipient} | Status: ${stat.trim()} | DSN: ${dsn || 'N/A'}`;
        logger.error(logMessage);
        addRecentLog(logMessage);
      }

      displayRecentLogs();
      return;
    }
    // Se a mensagem não for do sendmail ou sm-mta, ignorar ou processar conforme necessário
  } catch (err) {
    logger.error(`Erro ao processar a linha: ${err.message} | Linha: ${line}`);
  }
}

// Função para analisar a mensagem em pares chave=valor
function parseMessage(message) {
  const result = {};
  const colonIndex = message.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }
  result.messageId = message.substring(0, colonIndex).trim();
  const rest = message.substring(colonIndex + 1).trim();
  const parts = rest.split(/,\s*/);
  for (const part of parts) {
    const equalIndex = part.indexOf('=');
    if (equalIndex !== -1) {
      const key = part.substring(0, equalIndex).trim();
      const value = part.substring(equalIndex + 1).trim();
      result[key] = value;
    } else {
      // Tratamento para partes sem sinal de igual
      const [key, ...valueParts] = part.trim().split(/\s+/);
      result[key] = valueParts.join(' ');
    }
  }
  return result;
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
