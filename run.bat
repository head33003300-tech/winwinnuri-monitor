@echo off
chcp 65001 > nul
cd /d C:\Users\KSA\winwinnuri-monitor

echo. >> collect.log
echo ===== [%date% %time%] 수집 시작 ===== >> collect.log

node scraper\collect.js >> collect.log 2>&1

if errorlevel 1 (
  echo [%date% %time%] 수집 실패 - 커밋 생략 >> collect.log
  exit /b 1
)

git add public/notices.json
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "공고 갱신 %date% %time%" >> collect.log 2>&1
  git push >> collect.log 2>&1
  echo [%date% %time%] 커밋 완료 >> collect.log
) else (
  echo [%date% %time%] 변경 없음 >> collect.log
)

exit /b 0