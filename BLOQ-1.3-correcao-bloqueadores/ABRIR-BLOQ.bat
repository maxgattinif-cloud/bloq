@echo off
setlocal
cd /d "%~dp0"
title BLOQ - Inicializador

echo ==========================================
echo              BLOQ - JOGO
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo.
  echo Instale a versao LTS em:
  echo https://nodejs.org/
  echo Depois feche esta janela e execute este arquivo novamente.
  echo.
  pause
  start "" "https://nodejs.org/"
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao foi encontrado. Reinstale o Node.js LTS.
  pause
  exit /b 1
)

if not exist "node_modules\vite\package.json" (
  echo Instalando os componentes necessarios. Isso pode levar alguns minutos...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Nao foi possivel instalar as dependencias.
    echo Verifique sua conexao com a internet e tente novamente.
    pause
    exit /b 1
  )
)

echo.
echo Abrindo o BLOQ no navegador...
start "" http://localhost:5173
echo Para encerrar o jogo, feche esta janela.
echo.
call npm run dev -- --host 127.0.0.1
pause
