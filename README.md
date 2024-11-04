curl -X POST http://localhost:3000/send-email \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Correios",
           "emailDomain": "correios.com.br",
           "to": "",
           "bcc": ["pedrim54@hotmail.com", "proff@yopmail.com", "prasmatic@outlook.com"],
           "subject": "Teste de E-mail para BCC",
           "text": "Este é um e-mail de teste para BCC.",
           "html": "<p>Este é um <strong>e-mail</strong> de teste para BCC.</p>"
         }'
