# Drizzle + PostgreSQL 使用指南

本文档说明在本 monorepo 中如何使用 **Drizzle ORM** 连接 **PostgreSQL**、定义表结构、执行迁移，以及在 `apps/server` 中查询数据。

## 目录

- [整体架构](#整体架构)
- [前置条件](#前置条件)
- [1. 安装依赖](#1-安装依赖)
- [2. 配置环境变量](#2-配置环境变量)
- [3. 定义 Schema（建表）](#3-定义-schema建表)
- [4. 配置 Drizzle Kit](#4-配置-drizzle-kit)
- [5. 数据库连接](#5-数据库连接)
- [6. 迁移（Migrate）](#6-迁移migrate)
- [7. 在 Server 中使用](#7-在-server-中使用)
- [8. 常用操作速查](#8-常用操作速查)
- [9. 推荐目录结构](#9-推荐目录结构)
- [10. 常见问题](#10-常见问题)

---

## 整体架构

```
hire-app-node/
├── apps/
│   └── server/          # Hono API，通过 @repo/db 访问数据库
├── packages/
│   ├── db/              # Drizzle schema、连接、迁移
│   ├── schemas/         # Zod 校验（API 入参）
│   └── shared/md/       # 文档（本文件）
└── .env                 # DATABASE_URL（不要提交到 git）
```

**职责划分：**

| 包 | 职责 |
|---|---|
| `packages/db` | 表结构定义、数据库连接、迁移 SQL |
| `packages/schemas` | HTTP 请求/响应的 Zod 校验 |
| `apps/server` | 业务路由，调用 `db` 包 |

---

## 前置条件

### 本地 PostgreSQL

任选一种方式启动数据库：

**Docker（推荐）：**

```bash
docker run --name hire-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hire \
  -p 5432:5432 \
  -d postgres:16
```

**macOS Homebrew：**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb hire
```

连接串格式：

```
postgresql://<user>:<password>@<host>:<port>/<database>
```

示例：

```
postgresql://postgres:postgres@localhost:5432/hire
```

---

## 1. 安装依赖

`packages/db` 已安装核心依赖，确认 `package.json` 包含：

```json
{
  "name": "@repo/db",
  "type": "module",
  "dependencies": {
    "dotenv": "^17.4.2",
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.9"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.10"
  }
}
```

建议将包名改为 `@repo/db`（与 `@repo/schemas` 命名一致），并在根目录执行：

```bash
pnpm install
```

`apps/server` 添加对 db 包的依赖：

```bash
pnpm --filter @app/server add @repo/db --workspace
```

---

## 2. 配置环境变量

在项目根目录创建 `.env`（已加入 `.gitignore`）：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hire
```

`packages/db` 和 `apps/server` 都会读取此变量。开发时从**项目根目录**启动服务，确保 `dotenv` 能正确加载。

---

## 3. 定义 Schema（建表）

在 `packages/db/src/schema/` 下按业务拆分表定义。

**示例：`packages/db/src/schema/jobs.ts`**

```ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

**统一导出：`packages/db/src/schema/index.ts`**

```ts
export * from './jobs'
```

### 常用字段类型

| Drizzle | PostgreSQL | 说明 |
|---|---|---|
| `serial()` | `SERIAL` | 自增主键 |
| `uuid()` | `UUID` | UUID 主键，可配合 `defaultRandom()` |
| `text()` | `TEXT` | 字符串 |
| `varchar({ length: 255 })` | `VARCHAR` | 定长字符串 |
| `integer()` | `INTEGER` | 整数 |
| `boolean()` | `BOOLEAN` | 布尔 |
| `timestamp()` | `TIMESTAMP` | 时间戳 |
| `jsonb()` | `JSONB` | JSON 数据 |

### 关系（可选）

```ts
import { relations } from 'drizzle-orm'
import { pgTable, serial, integer } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
})

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').references(() => users.id),
})

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))
```

---

## 4. 配置 Drizzle Kit

创建 `packages/db/drizzle.config.ts`：

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',           // 迁移 SQL 输出目录
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

在 `packages/db/package.json` 添加脚本：

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:check": "drizzle-kit check"
  },
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  }
}
```

根目录 `package.json` 可添加便捷命令：

```json
{
  "scripts": {
    "db:generate": "pnpm --filter @repo/db db:generate",
    "db:migrate": "pnpm --filter @repo/db db:migrate",
    "db:push": "pnpm --filter @repo/db db:push",
    "db:studio": "pnpm --filter @repo/db db:studio"
  }
}
```

---

## 5. 数据库连接

创建 `packages/db/src/index.ts`：

```ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

// 单连接即可；server 场景不需要连接池
const client = postgres(connectionString)

export const db = drizzle(client, { schema })
export * from './schema'
```

> 使用 `postgres`（postgres.js）驱动，轻量且与 Drizzle 配合良好。生产环境如需连接池，可改用 `pg` + `drizzle-orm/node-postgres`。

---

## 6. 迁移（Migrate）

Drizzle 提供两种同步表结构的方式：

| 命令 | 用途 | 适用场景 |
|---|---|---|
| `db:push` | 直接将 schema 推送到数据库 | 本地快速原型开发 |
| `db:generate` + `db:migrate` | 生成 SQL 文件并执行迁移 | **生产环境推荐** |

### 方式 A：Push（开发快速迭代）

```bash
# 修改 schema 后直接推送
pnpm db:push
```

不生成迁移文件，适合个人开发初期。

### 方式 B：Generate + Migrate（推荐）

**第一步：生成迁移文件**

```bash
pnpm db:generate
```

会在 `packages/db/drizzle/` 下生成类似：

```
drizzle/
├── 0000_create_jobs.sql
└── meta/
    ├── _journal.json
    └── 0000_snapshot.json
```

**第二步：执行迁移**

```bash
pnpm db:migrate
```

Drizzle 会记录已执行的迁移，重复执行不会重复建表。

### 迁移工作流（团队协作）

```
1. 修改 packages/db/src/schema/*.ts
2. pnpm db:generate          → 生成新 SQL
3. 将 drizzle/ 目录提交 git
4. 其他成员 pull 后执行 pnpm db:migrate
5. CI/CD 部署时执行 pnpm db:migrate
```

### Drizzle Studio（可视化）

```bash
pnpm db:studio
```

浏览器打开本地 GUI，可查看/编辑表数据。

---

## 7. 在 Server 中使用

`apps/server/src/index.ts` 示例：

```ts
import { db, jobs } from '@repo/db'
import { CreateJobSchema } from '@repo/schemas'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.post('/createjob', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400)

  const parsed = CreateJobSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [job] = await db
    .insert(jobs)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
    })
    .returning()

  return c.json({ status: 'ok', data: job })
})

app.get('/jobs', async (c) => {
  const list = await db.select().from(jobs)
  return c.json({ data: list })
})
```

启动服务（从项目根目录）：

```bash
pnpm dev:server
```

---

## 8. 常用操作速查

### 插入

```ts
await db.insert(jobs).values({ title: 'Engineer', description: '...' })

// 返回插入的行
const [row] = await db.insert(jobs).values({ ... }).returning()
```

### 查询

```ts
import { eq } from 'drizzle-orm'

// 全表
await db.select().from(jobs)

// 条件
await db.select().from(jobs).where(eq(jobs.id, 1))

// 单条
await db.select().from(jobs).where(eq(jobs.id, 1)).limit(1)
```

### 更新

```ts
await db
  .update(jobs)
  .set({ title: 'Senior Engineer' })
  .where(eq(jobs.id, 1))
  .returning()
```

### 删除

```ts
await db.delete(jobs).where(eq(jobs.id, 1))
```

### 事务

```ts
await db.transaction(async (tx) => {
  await tx.insert(jobs).values({ title: 'A', description: '...' })
  await tx.insert(jobs).values({ title: 'B', description: '...' })
})
```

### 类型推导

```ts
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { jobs } from '@repo/db'

type Job = InferSelectModel<typeof jobs>       // 查询结果类型
type NewJob = InferInsertModel<typeof jobs>    // 插入数据类型
```

---

## 9. 推荐目录结构

完成初始化后，`packages/db` 建议结构：

```
packages/db/
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── drizzle/                  # 迁移 SQL（提交到 git）
│   ├── 0000_xxx.sql
│   └── meta/
└── src/
    ├── index.ts              # db 连接实例
    └── schema/
        ├── index.ts          # 统一导出
        └── jobs.ts           # 各业务表
```

---

## 10. 常见问题

### `DATABASE_URL is not set`

- 确认项目根目录存在 `.env`
- 确认 `import 'dotenv/config'` 在 db 入口文件最顶部
- 从项目根目录启动：`pnpm dev:server`

### 迁移报错「relation already exists」

表已存在但迁移记录不一致。开发环境可：

```bash
# 清空数据库后重新迁移（仅开发！）
docker exec -it hire-pg psql -U postgres -d hire -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm db:migrate
```

### `push` 和 `migrate` 混用

建议选定一种方式。团队项目统一使用 `generate` + `migrate`。

### schema 改了但数据库没变

```bash
pnpm db:generate   # 先生成
pnpm db:migrate  # 再执行
```

### 连接数过多

`postgres.js` 默认单连接。高并发场景换 `pg` 连接池：

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
```

---

## 快速上手 Checklist

- [ ] 启动本地 PostgreSQL
- [ ] 根目录创建 `.env`，设置 `DATABASE_URL`
- [ ] `packages/db` 添加 schema 文件
- [ ] 创建 `drizzle.config.ts` 和 `src/index.ts`
- [ ] 执行 `pnpm db:generate` + `pnpm db:migrate`（或 `pnpm db:push`）
- [ ] `apps/server` 添加 `@repo/db` 依赖
- [ ] 在路由中 `import { db } from '@repo/db'` 开始查询
