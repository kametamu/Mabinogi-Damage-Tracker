# Mabinogi_Damage_Tracker.client

## Skill name localization mapping

Skill display names are generated from the server enum source of truth:
- Source: `../Mabinogi_Damage_Tracker.Server/skill_ids.cs`
- Generated files:
  - `src/localization/skills/en.json`
  - `src/localization/skills/ja.json`

After updating `skill_ids.cs`, regenerate mappings with:

```bash
npm run gen:skills
```

Edit Japanese translations in `src/localization/skills/ja.json` after generation.
