// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { sendEmail } = require('./mailer'); // Certifique-se de que o caminho está correto
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Rota para enviar e-mails
app.post('/send-email', async (req, res) => {
  const { from, to, subject, text, html, bcc } = req.body;

  // Validação dos parâmetros
  if (!subject) {
    return res.status(400).json({ error: 'Parâmetro "subject" é obrigatório.' });
  }

  if (!text && !html) {
    return res.status(400).json({ error: 'Pelo menos um dos campos "text" ou "html" deve ser fornecido.' });
  }

  if ((!to || to.length === 0) && (!bcc || bcc.length === 0)) {
    return res.status(400).json({ error: 'Pelo menos um dos campos "to" ou "bcc" deve ser fornecido.' });
  }

  try {
    const info = await sendEmail({ from, to, subject, text, html, bcc });
    res.status(200).json({
      message: 'E-mail enviado com sucesso.',
      info,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
