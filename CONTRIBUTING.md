# Contributing to WELLab

## Development Setup

1. Clone the repository and install dependencies:
   ```bash
   make install
   ```
2. Copy the environment file and fill in your values:
   ```bash
   cp .env.example .env
   ```
3. Install pre-commit hooks:
   ```bash
   pre-commit install
   ```
4. Start the development servers:
   ```bash
   make dev
   ```

## Branch Naming Conventions

Use the following prefixes for branch names:

- `feature/` -- New features (e.g., `feature/causal-inference-api`)
- `fix/` -- Bug fixes (e.g., `fix/cognito-token-refresh`)
- `docs/` -- Documentation changes (e.g., `docs/api-reference`)

## Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

Examples:
- `feat(ml): add survival analysis endpoint`
- `fix(frontend): correct pagination in publication list`
- `docs(api): update authentication flow diagram`

## Code Review Process

1. Open a pull request against `develop` (or `main` for hotfixes).
2. At least one approving review is required before merging.
3. All CI checks must pass (lint, type-check, tests, security scan).
4. Resolve all review comments before merging.
5. Use squash merging to keep the commit history clean.

## Testing Requirements

- All new features must include tests.
- Maintain a minimum of 70% code coverage for `src/ml/`.
- Run the full test suite before opening a PR:
  ```bash
  make test
  ```
- Run linting and type checks:
  ```bash
  make lint
  make type-check
  ```

## Ethics Review Requirements for ML Changes

Any pull request that modifies code in `src/ml/` must include:

1. A description of the data used and any potential biases.
2. An assessment of fairness implications across demographic groups.
3. Documentation of model limitations and failure modes.
4. Approval from at least one team member with domain expertise in the relevant health/wellness area.

These requirements exist to ensure that ML models deployed in health-adjacent contexts meet ethical standards and do not cause harm to vulnerable populations.
