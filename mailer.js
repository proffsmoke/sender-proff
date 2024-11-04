// mailer.js

const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Função auxiliar para selecionar um elemento aleatório de um array.
 * @param {Array} array - O array do qual selecionar um elemento.
 * @returns {*} - Um elemento aleatório do array.
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Função para enviar e-mails usando Nodemailer e Sendmail.
 * @param {Object} params - Parâmetros para envio do e-mail.
 * @param {string} [params.from] - Endereço de e-mail do remetente (opcional). Se não fornecido, será gerado automaticamente.
 * @param {string} params.name - Nome do remetente para exibição no campo "From".
 * @param {string} params.emailDomain - Domínio do e-mail para geração do remetente.
 * @param {string|string[]} params.to - Endereço(s) de e-mail do destinatário ou uma string vazia se usar BCC.
 * @param {string} params.subject - Assunto do e-mail.
 * @param {string} params.text - Corpo do e-mail em texto.
 * @param {string} [params.html] - Corpo do e-mail em HTML (opcional).
 * @param {string|string[]} [params.bcc] - Endereços de e-mail para cópia oculta, separados por vírgula ou array (opcional).
 * @returns {Promise<Object>} - Retorna uma promessa que resolve as informações do envio.
 * @throws {Error} - Lança erro se o envio falhar ou se parâmetros necessários estiverem ausentes.
 */
async function sendEmail({ from, name, emailDomain, to, subject, text, html, bcc }) {
  try {
    // Verifica se 'to' e 'subject' estão fornecidos
    if (!to) {
      throw new Error("O campo 'to' é obrigatório.");
    }
    if (!subject) {
      throw new Error("O campo 'subject' é obrigatório.");
    }
    if (!name || !emailDomain) {
      if (!from) {
        throw new Error("É necessário fornecer 'from' ou ambos 'name' e 'emailDomain'.");
      }
    }

    // Configuração do transporte usando sendmail (Postfix ou Sendmail)
    const transporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: process.env.SENDMAIL_PATH || '/usr/sbin/sendmail',
    });

    // Geração do 'fromEmail' se 'from' não for fornecido
    let fromEmail = from;
    if (!fromEmail) {
      const prefixes = ['contato', 'naoresponder', 'noreply', 'notifica', 'notificacoes'];
      const randomPrefix = getRandomElement(prefixes);
      fromEmail = `"${name}" <${randomPrefix}@${emailDomain}>`;
    }

    // Opções do e-mail
    const mailOptions = {
      from: fromEmail,
      to: to, // Pode ser uma string ou array
      subject,
      text,
      html,
    };

    // Adicionar BCC se fornecido
    if (bcc) {
      mailOptions.bcc = bcc;
    }

    // Enviar o e-mail
    const info = await transporter.sendMail(mailOptions);
    console.log('E-mail enviado:', info.envelope);
    return info;
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    throw error;
  }
}

module.exports = { sendEmail };
