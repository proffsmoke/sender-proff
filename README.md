curl -X POST http://localhost:3000/send-email \
     -H "Content-Type: application/json" \
     -d '{
           "from": "seu-email@dominio.com",
           "to": "proff@yopmail.com",
           "subject": "Teste aeeee",
           "text": "Este é um e-mail de teste para gerar logs no Postfix.",
           "html": "<p>Este é um <strong>e-mail</strong> de teste para gerar logs no Postfix.</p>"
         }'