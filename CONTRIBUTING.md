# Contributing

Thanks for taking an interest in shisan.

## Development setup

You need Docker and Node 20+. Everything else runs in containers.

```bash
git clone https://github.com/nibuno/shisan-public.git
cd shisan-public
docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py create_household --name "My household" --username <the name you just made>
```

The app is served at http://localhost:8080.

The `create_household` step matters: data is partitioned by household, and a
user without one can log in but reaches nothing.

For backend work outside Docker:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
docker compose up -d db      # tests need PostgreSQL
```

For frontend work with hot reload:

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173, proxies /api to the backend
```

## Running the checks

CI runs exactly these. Run them before opening a pull request.

```bash
ruff check backend
cd backend && pytest
cd frontend && npm run lint && npm test && npm run build
```

The production-like smoke test catches settings that only break under
`DJANGO_ENV=production`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod-like.yml up -d --build
curl -i http://localhost:8080/api/health/      # 200
curl -i http://localhost:8080/api/docs         # 404, docs are off in production
docker compose down
```

## Things worth knowing before you change code

**Every query must be scoped to a household.** Selectors and services take
`household` as a required keyword-only argument, so forgetting it raises
`TypeError` instead of quietly returning another household's data. Please keep
it that way rather than reaching for an unscoped manager.

Cross-household ids answer **404, not 403** — a 403 would confirm the id
exists. `assets_app/tests.py` has isolation tests covering every endpoint; if
you add an endpoint, add its isolation test too.

Dependencies are pinned. `requirements.in` holds direct backend dependencies
and `requirements.txt` the resolved versions; `requirements-dev.in` keeps the
test and lint toolchain out of the production image. Refresh with `pip-compile`
rather than editing the `.txt` files by hand.

Migrations are never run automatically on container start. Run them explicitly.

## Pull requests

- One logical change per pull request.
- Explain **why** in the description, not just what.
- Include tests for behaviour changes.
- Make sure CI is green.

## Reporting bugs

Open an issue with the steps to reproduce, what you expected, and what
happened. For anything security related, see [SECURITY.md](SECURITY.md) —
please do not open a public issue.
