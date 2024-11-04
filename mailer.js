// mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Função para enviar e-mails usando Nodemailer e Sendmail.
 * @param {string} to - Endereço de e-mail do destinatário.
 * @param {string} subject - Assunto do e-mail.
 * @param {string} text - Corpo do e-mail em texto.
 * @param {string} html - Corpo do e-mail em HTML (opcional).
 * @returns {Promise} - Retorna uma promessa que resolve as informações do envio.
 */
async function sendEmail({ from, to, subject, text, html }) {
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
      to,
      subject,
      text,
      html,
    };

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