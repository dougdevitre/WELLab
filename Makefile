.PHONY: install dev test lint type-check format build docker-build docker-up clean audit

install:
	npm ci
	pip install -r requirements.txt

dev:
	@echo "Starting all services..."
	npm run dev --workspace=src/frontend & \
	npm run dev --workspace=src/backend & \
	python -m uvicorn src.ml.api:app --host 0.0.0.0 --port 8000 --reload & \
	wait

test:
	npm run test --workspaces --if-present
	python -m pytest src/ml/ --tb=short -q --cov=src/ml --cov-report=xml --cov-fail-under=70

lint:
	npm run lint
	python -m flake8 src/ml/ --max-line-length=120
	python -m black --check src/ml/
	python -m mypy src/ml/ --ignore-missing-imports

type-check:
	npx tsc --noEmit
	python -m mypy src/ml/ --ignore-missing-imports

format:
	npx prettier --write 'src/**/*.{ts,tsx,json,css}'
	python -m black src/ml/

build:
	npm run build --workspace=src/frontend
	npm run build --workspace=src/backend

docker-build:
	docker compose build

docker-up:
	docker compose up

clean:
	rm -rf dist/
	rm -rf src/frontend/dist/
	rm -rf src/backend/dist/
	rm -rf coverage/
	rm -rf .pytest_cache/
	rm -rf htmlcov/
	rm -f coverage.xml
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name '*.pyc' -delete 2>/dev/null || true

audit:
	npm audit
	pip-audit -r requirements.txt
