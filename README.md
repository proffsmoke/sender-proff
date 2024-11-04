curl -X POST http://localhost:3000/send-email \
     -H "Content-Type: application/json" \
     -d '{
           "from": "seu-email@dominio.com",
           "to": "prasmatic@outlook.com",
           "subject": "Teste de E-mail",
           "text": "Este é um e-mail de teste.",
           "html": "<p>Este é um <strong>e-mail</strong> de teste.</p>"
         }'


curl -X POST http://localhost:3000/send-email \
     -H "Content-Type: application/json" \
     -d '{
           "from": "seu-email@dominio.com",
           "to": ["pedrim54@hotmail.com", "proff@yopmail.com", "prasmtic@outlook.com"],
           "subject": "Teste de E-mail para Múltiplos Destinatários",
           "text": "Este é um e-mail de teste para múltiplos destinatários.",
           "html": "<p>Este é um <strong>e-mail</strong> de teste para múltiplos destinatários.</p>"
         }'
