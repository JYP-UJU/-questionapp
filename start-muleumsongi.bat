@echo off
echo 물음송이 시작 중... 🌸
echo.

start "백엔드" cmd /k "cd /d D:\물음송이\muleumsongi-v2\backend && node server.js"
timeout /t 2 /nobreak > nul
start "프론트엔드" cmd /k "cd /d D:\물음송이\muleumsongi-v2\frontend && npm start"

echo 백엔드와 프론트엔드가 시작되었어요!
echo 백엔드: http://localhost:5000
echo 프론트: http://localhost:3000
