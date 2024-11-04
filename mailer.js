// mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Função para enviar e-mails usando Nodemailer e Sendmail.
 * @param {Object} params - Parâmetros para envio do e-mail.
 * @param {string} [params.from] - Endereço de e-mail do remetente (opcional).
 * @param {string} [params.name] - Nome do remetente para exibição no campo "From". Necessário se 'from' não for fornecido.
 * @param {string} [params.emailDomain] - Domínio do e-mail para geração do remetente. Necessário se 'from' não for fornecido.
 * @param {string} [params.to] - Endereço de e-mail do destinatário ou uma string vazia se usar BCC.
 * @param {string} params.subject - Assunto do e-mail.
 * @param {string} params.text - Corpo do e-mail em texto.
 * @param {string} [params.html] - Corpo do e-mail em HTML (opcional).
 * @param {string} [params.bcc] - Endereços de e-mail para cópia oculta, separados por vírgula (opcional).
 * @returns {Promise} - Retorna uma promessa que resolve as informações do envio.
 */
async function sendEmail({ from, name, emailDomain, to, subject, text, html, bcc }) {
  try {
    // Configuração do transporte usando sendmail (Postfix ou Sendmail)
    let transporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: process.env.SENDMAIL_PATH || '/usr/sbin/sendmail',
    });

    // Gerar 'from' se não for fornecido
    if (!from && name && emailDomain) {
      const prefixes = ['contato', 'naoresponder', 'noreply', 'notifica', 'notificacoes'];
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      from = `"${name}" <${randomPrefix}@${emailDomain}>`;
    } else {
      from = from || process.env.EMAIL_FROM || 'seu-email@dominio.com';
    }

    // Opções do e-mail
    let mailOptions = {
      from,
      subject,
      text,
      html,
    };

    // Definir 'to' ou deixar vazio se 'bcc' for fornecido
    if (to && to.length > 0) {
      mailOptions.to = to;
    }

    // Adicionar BCC se fornecido
    if (bcc && bcc.length > 0) {
      mailOptions.bcc = bcc;
    }

    // Validar que pelo menos 'to' ou 'bcc' está presente
    if ((!to || to.length === 0) && (!bcc || bcc.length === 0)) {
      throw new Error('Parâmetros "to" (string ou array de strings), "subject" e "text" são obrigatórios.');
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
