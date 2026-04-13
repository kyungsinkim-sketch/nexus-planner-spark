# Brain Skill Template

This folder is the **starting point for any new core skill**. The runtime
loader skips folders prefixed with `_`, so nothing here is invoked at
runtime — it exists purely to be copied.

## How to create a new skill

1. Copy this entire folder to `../core/<your-skill-name>/`.
   ```bash
   cp -r supabase/functions/brain-process/skills/_template \
         supabase/functions/brain-process/skills/core/create-todo
   ```

2. Open `core/<your-skill-name>/SKILL.md` and edit:
   - `name` — must match the folder name (kebab-case, globally unique).
   - `version` — start at `0.1.0` while iterating, bump to `1.0.0` when
     the `output_schema` is frozen.
   - `description` — what the router-LLM reads to decide activation. Be
     specific and short. Vague descriptions cause routing misfires.
   - `triggers` — keyword hints per language. Optional but useful for
     deterministic routing.
   - `output_schema` — JSON Schema your handler will receive in `params`.

3. Rename `handler.ts.example` to `handler.ts` and implement `execute()`.
   Remember: the `_runtime/types.ts` module ships in Phase 2; until then
   the inline type declarations in the example are the contract.

4. Localize. For every language listed in `languages`, edit the matching
   `i18n/<lang>.md` overlay. Use the same headings as `SKILL.md` —
   `## Guidelines`, `## Examples`, etc. The loader merges overlays on top
   of the default-language body.

5. (Optional) Drop fixtures, prompts, or datasets into `resources/`. They
   are mounted read-only at `context.resources` (Phase 2).

6. Verify the manifest exported from `handler.ts` matches the `name` and
   `version` in `SKILL.md`. The boot-time loader rejects mismatches.

## What this template does NOT include

- A real implementation. The `execute()` function in `handler.ts.example`
  echoes its input — replace it with your actual logic.
- Tests. The runtime test harness lands with Phase 2; stub your tests
  next to the handler in a `__tests__/` folder so they're easy to find.
- Tenant overrides. Tenant-scoped skills live in the `tenant_skills` DB
  table, not on disk. See `_spec/SKILL_FORMAT.md §8` for the resolution
  order.

## Reference

- Full specification: [`../_spec/SKILL_FORMAT.md`](../_spec/SKILL_FORMAT.md)
- Anthropic Agent Skills (upstream inspiration): https://github.com/anthropics/skills
