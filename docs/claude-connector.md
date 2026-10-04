# Adding recipes and places from a Claude chat

A Claude Project with the **Household connector** adds things straight into the app: paste a
recipe link or text, or a place name, and it appears on the Recipes or Places page.

The connector (`supabase/functions/household-connector/index.ts`) can only **add** recipes and
places and **save ingredient prices**. It can't delete or change anything else. It's protected by
your household key, the same one at the end of your app link.

---

## 1. Put the connector live in Supabase (once)

1. Open your project at **supabase.com/dashboard** → **Edge Functions** (left menu).
2. **Deploy a new function** → **Via Editor**.
3. Name it exactly `household-connector`.
4. Delete the sample code, paste in the whole of `index.ts`, then **Deploy**.
5. Open the function's settings and turn **off** "Enforce JWT verification" (it may be called
   "Verify JWT"). Save. *(Claude doesn't send a Supabase login; your household key protects it instead.)*

Your connector URL is:

```
https://<project-ref>.supabase.co/functions/v1/household-connector/<household key>
```

`<project-ref>` is the start of your Supabase URL; `<household key>` is the part after `#` in
your app link. Keep this URL private, like the app link.

**If adding fails with a database error:** in **Edge Functions → Secrets**, add
`HOUSEHOLD_API_KEY` = your publishable key (the `sb_publishable_…` one), then try again.

## 2. Add it to Claude (once)

1. In Claude: **Settings → Connectors → Add custom connector**.
2. Name: `Household`. URL: the connector URL above. Add.

## 3. Make the Project (once)

1. **Projects → New project**, call it `Household`.
2. Paste the instructions below into the project's **Instructions**.
3. In a chat in that project, open the tools menu and make sure **Household** and **Web search**
   are turned on.

Then just paste a recipe link, recipe text or a place name into a chat in that project.

---

## Project instructions (copy everything below)

```
You add things to Ella & Jackson's household app (Sydney, Australia) using the Household connector. Whatever I paste, work out whether it's a recipe or a place, add it, then reply in one to three short lines saying what you added and anything I should check. Don't repeat the whole recipe back.

Always call get_household_summary first, so you reuse existing ingredient names, tags and spellings and don't add duplicates. If it's already there, say so.

RECIPES (a link, a screenshot or pasted text)
- If it's a link, read the page. Use only the recipe itself.
- Scale everything to serve 2 people.
- Ingredients: plain names only, matching existing names from the summary where they fit (e.g. "Garlic", "Brown onion", "Chicken thighs"), not "2 cloves garlic, crushed".
- Amounts must use g, kg, ml, L or each. Convert cups, tablespoons and teaspoons to g or ml. Count whole things (onions, lemons, eggs, capsicums) as each. Garlic is counted in bulbs (1 clove is about 0.1 each).
- Mark as staple, with no amount: salt, pepper, cooking oils, vinegars, soy sauce, dried herbs and spices, stock cubes, sugar, flour.
- Method: very brief. At most 6 to 8 numbered steps, one short line each, written for someone who can cook. Include key temperatures and times.
- Meals: breakfast, lunch, dinner and/or other. Tags: reuse existing tags where they fit; add "Quick" if it takes 30 minutes or less.
- Include the original link.
- Don't add prices unless I ask.

PLACES (a name, maybe with a suburb, or a link)
- Search the web to find the right place, in Sydney unless I say otherwise. If there are two likely matches, ask which one.
- Fill in: type (restaurant, bar, cafe, takeaway or other), suburb, typical cost per person in AUD, website or booking link, and a one-line note (e.g. what it's known for, or "book ahead").
- Tags: reuse existing tags where they fit.
- Mark it as been only if I say we've been; otherwise it's want to try.

If you can't tell what I've pasted, ask one short question.
```
