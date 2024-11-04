// app.js
const express = require('express');
const { sendEmail } = require('./mailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

/**
 * Rota para enviar e-mail via POST.
 * Endpoint: /send-email
 * Método: POST
 * Corpo da Requisição (JSON):
 * {
 *   "from": "remetente@dominio.com", // Opcional, usa EMAIL_FROM se não fornecido
 *   "to": "destinatario@dominio.com",
 *   "subject": "Assunto do E-mail",
 *   "text": "Corpo do e-mail em texto",
 *   "html": "<p>Corpo do e-mail em <strong>HTML</strong></p>" // Opcional
 * }
 */
app.post('/send-email', async (req, res) => {
  const { from, to, subject, text, html } = req.body;

  // Validação básica
  if (!to || !subject || !text) {
    return res.status(400).json({
      error: 'Parâmetros "to", "subject" e "text" são obrigatórios.',
    });
  }

  try {
    await sendEmail({ from, to, subject, text, html });
    res.status(200).json({ message: 'E-mail enviado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao enviar e-mail.' });
  }
});

/**
 * Rota para verificar se o servidor está rodando.
 * Endpoint: /
 * Método: GET
 */
app.get('/', (req, res) => {
  res.send('Servidor de envio de e-mails está funcionando.');
});

// Inicializar o aplicativo
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});