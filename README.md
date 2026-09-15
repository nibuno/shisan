# 家庭資産管理システム

月別資産状況をグラフで可視化する家計簿アプリ。

## 技術スタック

- **バックエンド**: Django 5.x + Django Ninja（REST API）
- **フロントエンド**: React 18 + TypeScript + Vite + Recharts
- **DB**: PostgreSQL（開発環境はDocker Compose）

## セットアップ

```bash
git clone https://github.com/nibuno/shisan.git
cd shisan
```

### バックエンド

```bash
cd backend

# 仮想環境を作成（推奨）
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係をインストール
pip install -r requirements.txt

# PostgreSQL を起動
cd ..
docker compose up -d db
cd backend

# 開発用DBは Docker の PostgreSQL です。
# コンテナ内は 5432、ホスト側はローカルPostgreSQLとの衝突を避けるため 15432 に公開します。
# 既定値: DATABASE_URL=postgresql://shisan:shisan@localhost:15432/shisan

# DB マイグレーション（初期カテゴリも自動投入）
python manage.py migrate

# ログインユーザーを作成
python manage.py createsuperuser

# 世帯を作成してユーザーを所属させる（初期カテゴリも自動投入）
# 世帯に属さないユーザーはログインできてもデータに到達できません。
python manage.py create_household --name "わが家" --username <createsuperuserで作った名前>

# 開発サーバー起動（port 8000）
python manage.py runserver
```

Backend の pytest も同じ Docker PostgreSQL を使います。`docker compose up -d db` を起動した状態で実行してください。

APIドキュメント: http://localhost:8000/api/docs

本番環境ではAPIドキュメントとOpenAPI schemaは公開されません。

### フロントエンド

```bash
cd frontend

# 依存関係をインストール
npm install

# 開発サーバー起動（port 5173）
npm run dev
```

ブラウザ: http://localhost:5173

## 認証と世帯

Web UI と API はログイン必須です。データは**世帯（Household）単位で分離**されており、
ユーザーは所属する世帯のデータしか読み書きできません。世帯に属さないユーザーは
ログインできても全 API が 403 になるため、`create_household` で必ず所属させてください。

夫婦などで 1 つの家計を共有する場合は、同じ世帯に複数ユーザーを所属させます。

新規登録 API（`POST /api/auth/signup/`）は既定で無効です。インターネットに公開された
セルフホスト環境で誰でも登録できてしまうのを避けるためで、有効にする場合は
`ALLOW_SIGNUP=True` を設定してください。

開発環境では `createsuperuser` と `create_household` で作成したユーザーでログインします。

Frontend は session cookie と CSRF token を使って API にアクセスします。Vite 開発サーバー経由では `/api` が backend に proxy されます。

## 依存関係と監査

Backend は `backend/requirements.in` に直接依存を書き、`backend/requirements.txt` に解決済みバージョンを固定します。test と lint の道具は `backend/requirements-dev.in` / `backend/requirements-dev.txt` に分けており、本番 Docker image には入りません。開発時は両方を install してください。Django は LTS の 5.2 系に固定します。依存を更新する場合:

```bash
python -m pip install pip-tools
python -m piptools compile --upgrade --no-emit-index-url --strip-extras backend/requirements.in -o backend/requirements.txt
python -m piptools compile --upgrade --no-emit-index-url --strip-extras backend/requirements-dev.in -o backend/requirements-dev.txt
python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
```

脆弱性監査:

```bash
python -m pip install pip-audit
python -m pip_audit -r backend/requirements.txt

cd frontend
npm run audit
```

Frontend は `package-lock.json` を commit し、通常は `npm ci` で再現性を保ちます。`npm audit fix` は patch/minor の範囲で適用し、major 更新が必要な場合は build と動作確認を分けて実施します。

## 本番設定

本番では環境変数で設定を明示してください。

```bash
DJANGO_ENV=production
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=example.com
DATABASE_URL=postgresql://user:password@db.example.com:5432/shisan
CORS_ALLOWED_ORIGINS=https://example.com
CSRF_TRUSTED_ORIGINS=https://example.com
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

`DJANGO_ENV=production` では `DJANGO_SECRET_KEY` と `DATABASE_URL` が未設定だと起動に失敗します。HTTPS 配信を前提に、cookie の secure 設定を有効にしてください。

### Backend Docker image

Backend image は Python 3.13 の `slim-trixie` ベースです。Debian bookworm ではなく、2026年5月時点で新しいDebian 13系のtrixieタグを使います。

```bash
docker build -f backend/Dockerfile -t shisan-backend:dev backend
```

起動時は `DJANGO_SECRET_KEY`、`DATABASE_URL`、`DJANGO_ALLOWED_HOSTS` などを環境変数で渡してください。

### Docker Compose

Docker Compose では `web`、`backend`、`db` を起動します。`web` は Node 24 + Vite でbuildしたfrontendを nginx `stable-alpine3.23` で配信し、`/api/` を backend へproxyします。

```bash
docker compose up --build
```

初回またはmigration追加後:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py create_household --name "わが家" --username <ユーザー名>
```

Migration は web/backend container の起動時には自動実行しません。schema 変更は起動とは分け、ローカルでは上記の明示コマンド、本番/ECSでは backend image を使った one-off task で `python manage.py migrate` を実行します。

ヘルスチェック:

```bash
curl http://localhost:8080/api/health/
curl http://localhost:8080/api/health/db/
```

### Production-like smoke

ECSへ進める前に、ローカルでも `DJANGO_ENV=production` の起動条件を確認できます。ローカルはHTTP配信なので、`docker-compose.prod-like.yml` では cookie secure 設定だけ `False` にしています。本番HTTPSでは `SESSION_COOKIE_SECURE=True`、`CSRF_COOKIE_SECURE=True` にしてください。

```bash
docker compose -f docker-compose.yml -f docker-compose.prod-like.yml up -d --build db backend web
docker compose -f docker-compose.yml -f docker-compose.prod-like.yml exec -T backend python manage.py check
docker compose -f docker-compose.yml -f docker-compose.prod-like.yml exec -T backend python manage.py migrate --check
curl -i http://localhost:8080/api/health/
curl -i http://localhost:8080/api/docs
curl -i http://localhost:8080/api/openapi.json
```

ブラウザ: http://localhost:8080

## 初期データ投入例

バックエンドとフロントエンドを起動し、ログイン後のWeb UIから登録できます。開発時にAPIドキュメント（/api/docs）を使う場合も、ログイン済みsessionとCSRF tokenが必要です。

### 名義人を追加（POST /api/owners/）

```json
{ "name": "サンプル太郎" }
{ "name": "サンプル花子" }
```

### 資産を追加（POST /api/assets/）

```json
{
  "owner_id": 1,
  "category_id": 2,
  "name": "SBIネット銀行",
  "purpose": "生活費用"
}
```

### 月次残高を記録（POST /api/snapshots/）

```json
{
  "asset_id": 1,
  "month": "2026-01-01",
  "balance": "1500000"
}
```

## 画面構成

| ページ | URL | 説明 |
|-------|-----|------|
| ダッシュボード | `/` | 最新月の総資産・前月比・カテゴリ/名義人内訳 |
| 資産管理 | `/assets` | 資産の登録・編集・削除 |
| 残高入力 | `/snapshots` | 月次残高の記録・編集 |
| グラフ | `/charts` | 月別推移グラフ（6/12/24ヶ月選択） |

## ディレクトリ構成

```
shisan/
├── backend/              # Django プロジェクト
│   ├── config/           # 設定・URL
│   └── assets_app/       # メインアプリ
│       ├── models.py
│       ├── schemas.py
│       └── api/          # エンドポイント
├── frontend/             # React + Vite
│   └── src/
│       ├── pages/        # 各ページ
│       ├── components/   # 再利用コンポーネント
│       ├── api/          # APIクライアント
│       └── types/        # 型定義
└── docs/
    └── er-diagram.md
```
