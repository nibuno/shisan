# ER図

家庭資産管理システムのデータモデル

```mermaid
erDiagram
    Owner {
        int id PK
        string name
    }

    Category {
        int id PK
        string name
    }

    Asset {
        int id PK
        int owner_id FK
        int category_id FK
        string name
        string purpose
    }

    BalanceSnapshot {
        int id PK
        int asset_id FK
        date month
        decimal balance
    }

    Owner ||--o{ Asset : owns
    Category ||--o{ Asset : categorizes
    Asset ||--o{ BalanceSnapshot : tracks
```

## テーブル説明

| テーブル | 説明 |
|---------|------|
| Owner | 名義人（サンプル太郎、サンプル花子） |
| Category | 資産カテゴリ（現金/銀行/NISA/iDeCo） |
| Asset | 各口座・資産（SBIネット銀行、ゆうちょ銀行等） |
| BalanceSnapshot | 月次の残高記録 |
