.PHONY: all dev start start-backend start-frontend test test-backend test-frontend check seed verify build clean

all: dev

dev:
	npm run dev

start:
	npm start

start-backend:
	npm run start:backend

start-frontend:
	npm run start:frontend

test:
	npm test

test-backend:
	npm run test:backend

test-frontend:
	npm run test:frontend

check:
	npm run check

seed:
	npm run seed

verify:
	npm run verify

build:
	npm run build
