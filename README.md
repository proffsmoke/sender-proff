curl -X POST http://localhost:3000/send-email \
     -H "Content-Type: application/json" \
     -d '{
           "from": "seu-email@dominio.com",
           "to": "prasmatic@outlook.com",
           "subject": "Teste de Log Postfix",
           "text": "Este é um e-mail de teste para gerar logs no Postfix.",
           "html": "<p>Este é um <strong>e-mail</strong> de teste para gerar logs no Postfix.</p>"
         }'