---
name: example-skill
version: 0.1.0
description: >
  Replace this with one or two sentences describing exactly when the router
  should activate this skill. Be specific about the user intent and the
  expected output — vague descriptions cause routing misfires.
languages: [en, ko, ja, th]
default_language: en
tenant_scope: global
visibility: public
category: uncategorized
requires_project_context: false
triggers:
  - intent: example-intent
  - keywords_en: [example, sample, demo]
  - keywords_ko: [예제, 샘플, 데모]
  - keywords_ja: [例, サンプル, デモ]
  - keywords_th: [ตัวอย่าง, แซมเปิล, เดโม]
output_schema:
  type: object
  properties:
    message: { type: string }
  required: [message]
---

# Example Skill

> This is the **template** skill. Copy this entire `_template/` folder to
> `core/<your-skill-name>/` and edit every section. Do not import from
> `_template/` at runtime — the skill loader skips folders prefixed with `_`.

When this skill is active, describe in plain prose what the model should do
with the user's message. The router has already decided this skill is the
right one — do not re-litigate the decision here. Focus on **how** to extract
parameters that match `output_schema`.

## Guidelines

- Keep instructions imperative and short. Each bullet is one rule.
- Refuse silently (return `success: false`) when required context is missing
  rather than guessing.
- Never invent IDs or dates. Pull them from `context` or ask a follow-up.
- Stay inside the skill's stated scope. If the user's message belongs to a
  different skill, return `{ success: false, handoff: '<other-skill>' }`.

## Examples

*(Default language — English. See `i18n/*.md` for localized examples.)*

- "Send the example payload" → `{ message: "example payload" }`
- "Demo this for me" → `{ message: "demo" }`

## Notes for skill authors

- Bump `version` on every behavior change. Patch = wording, minor = new
  optional field, major = `output_schema` change.
- When you add a new language, list it in `languages` AND create the matching
  `i18n/<lang>.md` overlay. The loader will fall back to `default_language`
  for missing overlays, but the router prompt only advertises declared
  languages.
- If your skill needs to call other skills, list them in `depends_on` so the
  loader can resolve the dependency graph at boot.
