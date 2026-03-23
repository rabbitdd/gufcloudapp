.PHONY: install infra-up infra-down infra-status db-reset dev stop help

help:
	@echo "Targets:"
	@echo "  make install      - npm ci or npm install"
	@echo "  make infra-up     - Start local Supabase (Docker)"
	@echo "  make infra-down   - Stop local Supabase"
	@echo "  make infra-status - Show URLs and keys"
	@echo "  make db-reset     - Reset DB and re-apply migrations + seed"
	@echo "  make dev          - next dev"
	@echo "  make stop         - same as infra-down"

install:
	npm install

infra-up:
	npm run infra:up

infra-down:
	npm run infra:down

infra-status:
	npm run infra:status

db-reset:
	npm run db:reset

dev:
	npm run dev

stop: infra-down
