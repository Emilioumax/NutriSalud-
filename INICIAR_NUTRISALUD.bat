@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js/npm. Instala Node.js LTS y vuelve a abrir este archivo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Instalando dependencias de NutriSalud+...
  call npm ci
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias. Revisa tu conexion a Internet.
    pause
    exit /b 1
  )
)

echo Iniciando NutriSalud+. Deja esta ventana abierta mientras uses la pagina.
call npm run dev -- --open
pause
