// mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Função para enviar e-mails usando Nodemailer e Sendmail.
 * @param {string} to - Endereço de e-mail do destinatário ou uma string vazia se usar BCC.
 * @param {string} subject - Assunto do e-mail.
 * @param {string} text - Corpo do e-mail em texto.
 * @param {string} html - Corpo do e-mail em HTML (opcional).
 * @param {string} from - Endereço de e-mail do remetente (opcional).
 * @param {string} bcc - Endereços de e-mail para cópia oculta, separados por vírgula (opcional).
 * @returns {Promise} - Retorna uma promessa que resolve as informações do envio.
 */
async function sendEmail({ from, to, subject, text, html, bcc }) {
  try {
    // Configuração do transporte usando sendmail (Postfix ou Sendmail)
    let transporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: process.env.SENDMAIL_PATH || '/usr/sbin/sendmail',
    });

    // Opções do e-mail
    let mailOptions = {
      from: from || process.env.EMAIL_FROM || 'seu-email@dominio.com',
      to: to || '', // Pode ser uma string ou vazio
      subject,
      text,
      html,
    };

    // Adicionar BCC se fornecido
    if (bcc) {
      mailOptions.bcc = bcc;
    }

    // Enviar o e-mail
    let info = await transporter.sendMail(mailOptions);
    console.log('E-mail enviado:', info.envelope);
    return info;
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    throw error;
  }
}

module.exports = { sendEmail };
