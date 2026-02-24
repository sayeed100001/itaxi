@echo off
REM WhatsApp Webhook Test Script
REM Usage: test-whatsapp-webhook.bat [delivered|read|failed]

SET STATUS=%1
IF "%STATUS%"=="" SET STATUS=delivered

SET PAYLOAD={"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"statuses":[{"id":"msg_test_123","status":"%STATUS%","timestamp":"1234567890"}]}}]}]}

REM Generate signature (requires OpenSSL)
echo %PAYLOAD% > temp_payload.txt
FOR /F "tokens=*" %%i IN ('openssl dgst -sha256 -hmac "%WHATSAPP_APP_SECRET%" temp_payload.txt ^| findstr /R "="') DO SET SIGNATURE=%%i
SET SIGNATURE=%SIGNATURE:~-64%
del temp_payload.txt

echo Testing webhook with status: %STATUS%
echo Signature: sha256=%SIGNATURE%
echo.

curl -X POST http://localhost:5001/api/whatsapp/webhook ^
  -H "Content-Type: application/json" ^
  -H "x-hub-signature-256: sha256=%SIGNATURE%" ^
  -d "%PAYLOAD%"

echo.
echo Done!
