# Re-Be.io Brain Skill Format — Specification v1.0

> Status: **DRAFT / Phase 1** — specification only. No existing Brain actions
> have been migrated yet. This document defines the contract that new skills
> will follow and that the `brain-process` Edge Function will load.

## 1. Why

The current `brain-process/index.ts` hard-codes every Brain AI capability
(create_todo, create_event, create_important_note, etc.) inside one monolith.
Adding a new capability means touching core code, rewriting the system prompt,
and re-testing every path.

This spec adopts the open
[Agent Skills format](https://github.com/agentskills) maintained by Anthropic,
adapted for Re-Be.io's two constraints:

1. **Multilingual content** — Re-Be.io serves Korean, English, Japanese, and
   Thai users from day one. Skill instructions and examples must be available
   in all four languages.
2. **Multi-tenant resolution** — Re-Be.io is planned to host multiple
   organizations (my.re-be.io). Each tenant can ship its own private skills or
   override a shared one, without forking the code.

## 2. Vocabulary

| Term | Meaning |
| --- | --- |
| **Skill** | A self-contained folder describing one Brain capability |
| **Core skill** | A skill checked into the repo, available to every tenant |
| **Tenant skill** | A skill scoped to a single tenant, stored in the DB |
| **Override** | A tenant skill that replaces a core skill of the same `name` |
| **Handler** | The TypeScript function that executes the skill at runtime |
| **Manifest** | The parsed YAML frontmatter of `SKILL.md` |

## 3. Directory layout

```
supabase/functions/brain-process/skills/
├── _spec/
│   └── SKILL_FORMAT.md         # ← this file
├── _template/                  # Copy this folder to start a new skill
│   ├── SKILL.md
│   ├── handler.ts.example
│   ├── i18n/
│   │   ├── ko.md
│   │   ├── ja.md
│   │   └── th.md
│   └── resources/
└── core/                       # Actual shipped skills (Phase 2+)
    ├── create-todo/
    ├── create-event/
    └── ...
```

Tenant skills do **not** live on disk. They are stored in the
`tenant_skills` table (introduced in Phase 2) and loaded at request time.

## 4. Skill folder contract

A skill folder MUST contain a `SKILL.md` file. It MAY contain a
`handler.ts`, an `i18n/` folder with language overlays, and a `resources/`
folder with supporting data.

```
skills/core/create-todo/
├── SKILL.md              # required — English default + frontmatter
├── handler.ts            # required if the skill executes an action
├── i18n/                 # optional — per-language overlays
│   ├── ko.md
│   ├── ja.md
│   └── th.md
└── resources/            # optional — templates, data, prompts
    └── examples.json
```

## 5. `SKILL.md` format

```markdown
---
name: create-todo
version: 1.0.0
description: >
  Extract actionable tasks from a user message and create them in the current
  project. Use when the user describes a concrete action with an assignee
  and/or due date.
languages: [en, ko, ja, th]
default_language: en
tenant_scope: global
visibility: public
category: project-management
requires_project_context: true
triggers:
  - intent: actionable-task
  - keywords_en: [todo, task, remind, assign, by tomorrow]
  - keywords_ko: [할일, 해줘, 맡겨, 까지, 내일까지]
  - keywords_ja: [タスク, やって, お願い, までに]
  - keywords_th: [งาน, ทำให้, มอบหมาย, ภายใน]
output_schema:
  type: object
  properties:
    title:       { type: string }
    assigneeIds: { type: array, items: { type: string } }
    dueDate:     { type: string, format: date }
    projectId:   { type: string }
  required: [title, projectId]
---

# Create Todo

When this skill is active, extract one or more TODO items from the user's
message and emit them in `output_schema` shape.

## Guidelines
- If the assignee is ambiguous, ask a follow-up question instead of guessing.
- Never create a TODO for vague aspirations ("열심히 해보자" / "let's try hard").
- Always scope to the current `projectId`.

## Examples
*(Default language — English. See `i18n/*.md` for localized examples.)*
- "Have Mina finish thumbnails by Friday" → `{ title: "Finalize thumbnails", assigneeIds: [mina.id], dueDate: "<friday>" }`
- "I'll handle it by Monday" → `{ title: "<context>", assigneeIds: [currentUser.id], dueDate: "<monday>" }`
```

### 5.1 Required frontmatter fields

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string (kebab-case) | Globally unique within a tenant scope |
| `version` | semver | Bump on any behavior change |
| `description` | string | Used by the router-LLM to decide activation — be specific |
| `languages` | array | Supported languages (must include `default_language`) |
| `default_language` | enum `en\|ko\|ja\|th` | Fallback when user's language has no overlay |
| `tenant_scope` | enum `global\|tenant` | `global` = ships in repo, `tenant` = DB-stored |
| `visibility` | enum `public\|private` | `private` skills are hidden from other tenants |

### 5.2 Optional frontmatter fields

| Field | Type | Notes |
| --- | --- | --- |
| `category` | string | Free-form tag for UI grouping |
| `requires_project_context` | boolean | Router will not activate if false and no project is active |
| `triggers` | object | Hints for the router (intents/keywords per language) |
| `output_schema` | JSON Schema | Contract for `handler.ts` output |
| `depends_on` | array | Other skill `name`s this skill can call |
| `feature_flag` | string | Gate for A/B rollout |

## 6. Multilingual convention

Skill instructions live in the default language inside `SKILL.md`. For every
additional language in `languages`, create `i18n/<lang>.md` with the SAME
headings (`## Guidelines`, `## Examples`, etc.). The loader merges overlays on
top of the default at runtime, so translators only localize what's different.

Language codes: `en`, `ko`, `ja`, `th` (ISO 639-1).

Missing overlay → fall back to `default_language`. Router chooses the overlay
based on `currentUser.language`.

### 6.1 `i18n/ko.md` example

```markdown
## Guidelines
- 담당자가 모호하면 추측하지 말고 되묻습니다.
- "열심히 해보자" 같은 막연한 다짐은 TODO로 만들지 않습니다.
- 항상 현재 `projectId` 안에서만 생성합니다.

## Examples
- "민지한테 썸네일 금요일까지 뽑아달라고 해" →
  `{ title: "썸네일 작업", assigneeIds: [민지.id], dueDate: "<금요일>" }`
- "이거 내가 월요일까지 할게" →
  `{ title: "<맥락>", assigneeIds: [currentUser.id], dueDate: "<월요일>" }`
```

## 7. `handler.ts` contract

```ts
import type { SkillContext, SkillResult } from '../../_runtime/types.ts';

export const manifest = {
  name: 'create-todo',
  version: '1.0.0',
} as const;

export async function execute(
  params: Record<string, unknown>,
  context: SkillContext,
): Promise<SkillResult> {
  // 1. Validate params against output_schema
  // 2. Perform the action (DB insert, API call, etc.)
  // 3. Return { success, data, userMessage }
}
```

`SkillContext` provides:
- `supabase` — already-authenticated service-role client
- `user` — `{ id, tenantId, language }`
- `project` — active project or null
- `room` — active chat room or null
- `t(key)` — translator bound to `user.language`

Handlers MUST be pure w.r.t. their inputs, idempotent where possible, and
return a `SkillResult` even on failure. No `throw` for expected errors —
return `{ success: false, userMessage }`.

## 8. Multi-tenant resolution

When the router resolves a skill by `name`, it checks in order:

1. Tenant override in `tenant_skills` where `tenant_id = currentTenant`
2. Shared tenant library in `tenant_skills` where `visibility = public`
3. Core skill on disk in `skills/core/<name>/`

First match wins. A tenant cannot override another tenant's private skill.

The `tenant_skills` table (Phase 2) schema will look like:

```sql
create table tenant_skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  version text not null,
  manifest jsonb not null,    -- parsed SKILL.md frontmatter
  body_md text not null,      -- SKILL.md body
  i18n jsonb,                 -- { ko: "...", ja: "...", th: "..." }
  handler_module text,        -- reference to a registered TS module
  visibility text not null check (visibility in ('public','private')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, name)
);
```

Storage for large resources (templates, datasets) goes to a Supabase Storage
bucket `tenant-skills/<tenant_id>/<skill-name>/`.

## 9. Versioning and compatibility

- `version` is semver. Patch = text-only fix, minor = new field or example,
  major = `output_schema` change.
- Handlers MUST remain compatible with the latest minor of the same major.
- The router refuses to activate a skill whose `version` major is newer than
  the runtime's supported version.

## 10. Loading lifecycle (Phase 2 preview)

```
request
  → detectLanguage(user)
  → loadSkillsForTenant(tenantId)         # disk + DB, merge
  → filterByContext(projectId, roomType)  # requires_project_context etc.
  → buildRouterPrompt(skillManifests)     # name + description + triggers
  → callRouterLLM(userMessage)            # returns skill name + params
  → loadHandler(skillName)
  → execute(params, context)
  → persist(action_log)
```

Only the manifest (name + description + triggers) of each skill is sent to
the router LLM. Full instructions are injected only for the skill(s) the
router activates — keeping the prompt small.

## 11. Security considerations

- A `visibility: private` skill MUST never be leaked across tenants — neither
  in router prompts nor in completion logs.
- Tenant handlers run in the same Edge Function process as core handlers.
  Until we have sandboxing, tenant-authored JS is NOT allowed — tenants can
  only ship declarative skills (prompt + schema) that reuse core handlers.
- A tenant skill whose `handler_module` references a non-core module is
  rejected at load time.

## 12. Open questions

- **Credit/cost accounting**: how do we bill tenants per-skill-invocation?
- **Translation source of truth**: Crowdin, DB, or PR-based?
- **Hot reload**: should DB-stored tenant skills cache for N seconds?
- **Deprecation**: how do we sunset a skill without breaking in-flight jobs?

These are tracked in the roadmap but not blocking Phase 1.

---

*Owner: Chloe / Re-Be.io. Last updated: Phase 1 bootstrap.*
