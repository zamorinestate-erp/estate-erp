@echo off
TITLE Zamorin Cafe ERP — Database Seeder
COLOR 0D
echo ===============================================================================
echo                ZAMORIN CAFE ERP — INITIAL DATABASE SEEDER
echo ===============================================================================
echo.

cd /d %~dp0backend
call npm run seed

echo.
echo Database Seeding Complete.
pause
