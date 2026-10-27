@echo off
set "ROOT=%~dp0"
if not exist "%ROOT%.env" (
  echo Missing "%ROOT%.env". Copy ".env.example" to ".env" and add your Gemini API key for AI features.
)
start "HireWise API" /D "%ROOT%backend" cmd /k "mvn spring-boot:run"
start "HireWise UI" /D "%ROOT%frontend" cmd /k "npm install && npm run dev"
echo Started the independent HireWise API and UI.
