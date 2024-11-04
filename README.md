curl -X POST http://localhost:3000/send-email \
     -H "Content-Type: application/json" \
     -d '{
           "from": "seu-email@dominio.com",
           "name": "Correios",
           "to": "prasmatic@outlook.com",
           "subject": "Teste de E-mail",
           "text": "Este é um e-mail de teste.",
           "html": "<p>Este é um <strong>e-mail</strong> de teste.</p>"
         }'

curl -X POST http://localhost:3000/send-email \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Correios",
           "emailDomain": "correios.com.br",
           "to": ["pedrim54@hotmail.com", "proff@yopmail.com", "prasmatic@outlook.com"],
           "subject": "Teste de E-mail para Múltiplos Destinatários",
           "text": "Este é um e-mail de teste para múltiplos destinatários.",
           "html": "<p>Este é um <strong>e-mail</strong> de teste para múltiplos destinatários.</p>"
         }'
