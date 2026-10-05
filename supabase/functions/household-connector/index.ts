// Household connector: lets a Claude chat add recipes, places and prices to the app.
//
// It's a small MCP server ("custom connector" in Claude). Deploy it as a Supabase Edge
// Function named `household-connector` with "Verify JWT" turned OFF, then add this URL as a
// custom connector in Claude:
//
//   https://<project-ref>.supabase.co/functions/v1/household-connector/<household key>
//
// The household key in the URL is the same one at the end of your app link, so only someone
// with your link can use it. The tools add recipes, buckets, places and prices, and can rename an
// ingredient (to fix a typo) — nothing else is changed or deleted. Saves use the same versioned `save_household` function as the app, so
// it can't overwrite a change made on a phone at the same moment.
//
// Single file, no imports, so it can be pasted into the Supabase dashboard editor.

type Json = Record<string, any>;
type Env = { url: string; apiKey: string };
const UNITS = ['g', 'kg', 'ml', 'L', 'each'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'other'];
const PLACE_KINDS = ['restaurant', 'bar', 'cafe', 'takeaway', 'other'];
const SERVER = { name: 'household', version: '1.1.0' };

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isFinite(n) && n > 0 ? n : undefined; };
const unitOf = (u: unknown) => { const s = String(u ?? '').trim(); const hit = UNITS.find(x => x.toLowerCase() === s.toLowerCase()); return hit ?? (/^(unit|units|item|items|ea|x)$/i.test(s) ? 'each' : undefined); };
const safeLink = (s: unknown) => { const t = String(s ?? '').trim(); if (!t) return ''; return /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? '' : 'https://' + t; };
/** Reuse the existing spelling of a tag ("quick" → "Quick"), adding new ones to the list. */
const tagsFor = (wanted: unknown, list: string[]) => {
  const out: string[] = [];
  for (const raw of Array.isArray(wanted) ? wanted : []) {
    const t = String(raw ?? '').trim();
    if (!t) continue;
    const existing = list.find(x => norm(x) === norm(t));
    if (!existing) list.push(t);
    const v = existing ?? t;
    if (!out.some(x => norm(x) === norm(v))) out.push(v);
  }
  return out;
};

// ── Database (through the same functions the app uses) ───────────────────

async function rpc(env: Env, fn: string, body: Json) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: env.apiKey };
  if (env.apiKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + env.apiKey; // legacy JWT keys
  const res = await fetch(env.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Database ' + fn + ' failed (' + res.status + '): ' + (await res.text()).slice(0, 200));
  return res.json();
}

async function load(env: Env, key: string): Promise<{ data: Json; version: number } | null> {
  const rows = await rpc(env, 'get_household', { p_key: key });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row ? { data: row.data ?? {}, version: row.version } : null;
}

/** A tool's answer when it found nothing to change (so nothing is saved). */
type Unchanged = { unchanged: string };
const unchanged = (msg: string): Unchanged => ({ unchanged: msg });

/** Load, change, save — retrying if a phone saved in between. Returns the change's message. */
async function change(env: Env, key: string, apply: (d: Json) => string | Unchanged): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await load(env, key);
    if (!cur) throw new Error('This connector link has the wrong household key.');
    const d = cur.data;
    for (const k of ['recipes', 'prices', 'staples', 'recipeTags', 'places', 'placeTags', 'buckets']) if (!Array.isArray(d[k])) d[k] = [];
    const message = apply(d);
    if (typeof message !== 'string') return message.unchanged;
    const saved = await rpc(env, 'save_household', { p_key: key, p_data: d, p_expected: cur.version });
    if (typeof saved === 'number') { await announce(env, key, saved); return message; }
  }
  throw new Error('The household kept changing while saving — please try again.');
}

/** Tell open copies of the app to refresh (best effort; they also catch up when reopened). */
async function announce(env: Env, key: string, version: number) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('household:' + key));
    const topic = 'household-' + Array.from(new Uint8Array(buf).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
    await fetch(env.url.replace(/\/$/, '') + '/realtime/v1/api/broadcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.apiKey },
      body: JSON.stringify({ messages: [{ topic, event: 'saved', payload: { version }, private: false }] }),
    });
  } catch { /* the app catches up on its own */ }
}

// ── Tools ─────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_household_summary',
    description: 'What is already in the household app: recipe and place names, existing tags, and known ingredient names with their saved prices. Call this first so you reuse existing ingredient and tag names and avoid duplicates.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_recipe',
    description: 'Add a recipe (a meal you plan) or a mini recipe (a sauce, dressing or garnish used inside a bucket — set mini: true). Amounts must already be for 2 people and the method already brief. Ingredient units must be one of g, kg, ml, L, each. Mark salt, pepper, oils, dried herbs/spices and similar as staple (no amount). Optionally include what a pack costs to buy (e.g. 500 g for 4.50) — saved only if that ingredient has no price yet.',
    inputSchema: {
      type: 'object',
      required: ['name', 'ingredients'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        meals: { type: 'array', items: { type: 'string', enum: MEALS }, description: 'Which meals it suits.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Short tags, reusing existing ones where they fit (e.g. Quick, Vegetarian).' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object', required: ['name'], additionalProperties: false,
            properties: {
              name: { type: 'string', description: 'Plain ingredient name, reusing existing names (e.g. "Garlic", not "2 cloves garlic, crushed").' },
              qty: { type: 'number', description: 'Amount used for 2 people.' },
              unit: { type: 'string', enum: UNITS },
              staple: { type: 'boolean', description: 'Pantry staple used without measuring (salt, pepper, oil, spices).' },
              buy: {
                type: 'object', additionalProperties: false, required: ['price'],
                properties: { qty: { type: 'number' }, unit: { type: 'string', enum: UNITS }, price: { type: 'number', description: 'AUD' } },
                description: 'What you pay for a pack, e.g. {qty: 500, unit: "g", price: 4.5}.',
              },
            },
          },
        },
        buckets: {
          type: 'array', description: 'Existing buckets this recipe draws from, e.g. [{name: "Vegetables", count: 2}] for "any 2 veg". Add the bucket first if it does not exist.',
          items: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string' }, count: { type: 'number', description: 'How many items from the bucket (default: the bucket’s usual number per meal, or 1).' } } },
        },
        mini: { type: 'boolean', description: 'True for a mini recipe (sauce, dressing, garnish, side): not planned as a meal on its own, but picked from a bucket.' },
        bucket: { type: 'string', description: 'For a mini recipe: the existing bucket to add it to as an option (e.g. "Sauces").' },
        method: { type: 'string', description: 'Brief numbered steps, one per line.' },
        link: { type: 'string', description: 'Where the recipe came from, if known.' },
      },
    },
  },
  {
    name: 'add_place',
    description: 'Add a restaurant, bar, café or takeaway to the Places page.',
    inputSchema: {
      type: 'object', required: ['name'], additionalProperties: false,
      properties: {
        name: { type: 'string' },
        kind: { type: 'string', enum: PLACE_KINDS },
        suburb: { type: 'string' },
        cost: { type: 'number', description: 'Typical cost per person in AUD.' },
        tags: { type: 'array', items: { type: 'string' } },
        link: { type: 'string', description: 'Website or booking page.' },
        notes: { type: 'string', description: 'One short line, e.g. what to order or whether to book.' },
        been: { type: 'boolean', description: 'True if they have already been; false for want to try.' },
      },
    },
  },
  {
    name: 'add_bucket',
    description: 'Add a bucket: a group of interchangeable options a recipe draws from, picked when the meal is planned (e.g. "Vegetables": Broccoli, Zucchini, Capsicum). If a bucket with that name exists, the new items are added to it. An item can be an existing mini recipe (give its name and mini_recipe: true).',
    inputSchema: {
      type: 'object', required: ['name', 'items'], additionalProperties: false,
      properties: {
        name: { type: 'string' },
        per_meal: { type: 'number', description: 'How many items a meal usually uses (default 1).' },
        items: {
          type: 'array',
          items: {
            type: 'object', required: ['name'], additionalProperties: false,
            properties: {
              name: { type: 'string', description: 'Plain ingredient name, or the exact name of a mini recipe.' },
              qty: { type: 'number', description: 'Amount used per meal for 2 people.' },
              unit: { type: 'string', enum: UNITS },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags within this bucket, e.g. Greens, Root veg.' },
              mini_recipe: { type: 'boolean', description: 'True if this item is an existing mini recipe.' },
            },
          },
        },
      },
    },
  },
  {
    name: 'link_bucket',
    description: 'Make an existing recipe draw from an existing bucket (e.g. Stir-fry uses 2 from Vegetables), or change how many it uses. count 0 unlinks it.',
    inputSchema: {
      type: 'object', required: ['recipe', 'bucket'], additionalProperties: false,
      properties: { recipe: { type: 'string' }, bucket: { type: 'string' }, count: { type: 'number', description: 'How many items from the bucket (default: the bucket’s usual number per meal, or 1). 0 removes the link.' } },
    },
  },
  {
    name: 'rename_ingredient',
    description: 'Fix an ingredient name everywhere it is used (recipes, buckets, prices, staples, pantry, shopping list), e.g. a typo "Parprkia" → "Paprika". If the new name already exists, the two are merged and the existing price is kept.',
    inputSchema: {
      type: 'object', required: ['from', 'to'], additionalProperties: false,
      properties: { from: { type: 'string', description: 'The name as it is now.' }, to: { type: 'string', description: 'The correct name.' } },
    },
  },
  {
    name: 'save_prices',
    description: 'Save or update what ingredients cost to buy (shared by all recipes and the shopping list), e.g. after looking up supermarket prices.',
    inputSchema: {
      type: 'object', required: ['items'], additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object', required: ['name', 'price'], additionalProperties: false,
            properties: { name: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string', enum: UNITS }, price: { type: 'number', description: 'AUD' } },
          },
        },
      },
    },
  },
];

const priceText = (p: Json) => (p.qty === 1 && p.unit === 'each' ? '' : p.qty + ' ' + (p.unit === 'each' ? 'unit' + (p.qty === 1 ? '' : 's') : p.unit) + ' for ') + '$' + Number(p.price).toFixed(2);

function summary(d: Json) {
  const recipes = (d.recipes ?? []) as Json[];
  const names = new Map<string, string>();
  for (const r of recipes) for (const g of r.ingredients ?? []) if (g?.name && !names.has(norm(g.name))) names.set(norm(g.name), g.name);
  for (const p of d.prices ?? []) if (p?.name && !names.has(norm(p.name))) names.set(norm(p.name), p.name);
  const prices = new Map(((d.prices ?? []) as Json[]).map(p => [norm(p.name), p]));
  const staples = new Set(((d.staples ?? []) as string[]).map(norm));
  return {
    recipes: recipes.filter(r => !r.mini).map(r => r.name + ((r.buckets ?? []) as Json[]).map(u => {
      const b = ((d.buckets ?? []) as Json[]).find(x => x.id === u.bucket);
      return b ? ` [${u.count} from ${b.name}]` : '';
    }).join('')),
    mini_recipes: recipes.filter(r => r.mini).map(r => r.name),
    buckets: ((d.buckets ?? []) as Json[]).map(b => b.name + ': ' + (b.items ?? []).map((i: Json) => i.name).join(', ')),
    places: ((d.places ?? []) as Json[]).map(p => p.name),
    recipe_tags: d.recipeTags ?? [],
    place_tags: d.placeTags ?? [],
    ingredients: [...names.values()].sort((a, b) => a.localeCompare(b)).map(n => {
      const p = prices.get(norm(n));
      return n + (staples.has(norm(n)) ? ' (staple)' : '') + (p ? ' — ' + priceText(p) : '');
    }),
  };
}

/** Link a recipe to a bucket by name. Returns a note for the reply. */
function useBucket(d: Json, recipe: Json, bucketName: unknown, count: unknown): string {
  const want = String(bucketName ?? '').trim();
  const b = ((d.buckets ?? []) as Json[]).find(x => norm(x.name) === norm(want));
  if (!b) return `There's no “${want}” bucket yet.`;
  const n = count === 0 || count === '0' ? 0 : Math.round(num(count) ?? b.perMeal ?? 1);
  const uses = (recipe.buckets ?? []).filter((u: Json) => u.bucket !== b.id);
  if (n > 0) uses.push({ bucket: b.id, count: n });
  if (uses.length) recipe.buckets = uses; else delete recipe.buckets;
  return n > 0 ? `uses ${n} from ${b.name}` : `no longer uses ${b.name}`;
}

function addRecipe(d: Json, a: Json): string | Unchanged {
  const name = String(a.name ?? '').trim();
  if (!name) throw new Error('A recipe needs a name.');
  if ((d.recipes as Json[]).some(r => norm(r.name) === norm(name))) return unchanged(`“${name}” is already in the app, so nothing was added.`);
  const ingredients: Json[] = [], kept: string[] = [], priced: string[] = [];
  for (const g of Array.isArray(a.ingredients) ? a.ingredients : []) {
    const gname = String(g?.name ?? '').trim();
    if (!gname) continue;
    if (g.staple) {
      ingredients.push({ name: gname });
      if (!(d.staples as string[]).some(s => norm(s) === norm(gname))) d.staples.push(gname);
    } else {
      const q = num(g.qty), u = unitOf(g.unit);
      ingredients.push(q && u ? { name: gname, qty: q, unit: u } : { name: gname });
    }
    const price = num(g.buy?.price);
    if (price !== undefined) {
      if ((d.prices as Json[]).some(p => norm(p.name) === norm(gname))) kept.push(gname);
      else {
        const bq = num(g.buy.qty), bu = unitOf(g.buy.unit);
        d.prices.push({ name: gname, qty: bq && bu ? bq : 1, unit: bq && bu ? bu : 'each', price });
        priced.push(gname);
      }
    }
  }
  const recipe: Json = {
    id: uid(), name, ingredients,
    meals: (Array.isArray(a.meals) ? a.meals : ['dinner']).filter((m: string) => MEALS.includes(m)),
  };
  if (!recipe.meals.length) recipe.meals = ['dinner'];
  const tags = tagsFor(a.tags, d.recipeTags);
  if (tags.length) recipe.tags = tags;
  if (String(a.method ?? '').trim()) recipe.method = String(a.method).trim();
  if (safeLink(a.link)) recipe.link = safeLink(a.link);
  const links: string[] = [], noBucket: string[] = [];
  if (!a.mini) for (const u of Array.isArray(a.buckets) ? a.buckets : []) {
    const note = useBucket(d, recipe, u?.name, u?.count);
    (note.startsWith('uses') ? links : noBucket).push(note);
  }
  let where = links.length ? ` (${links.join(', ')})` : '';
  if (noBucket.length) where += '. ' + noBucket.join(' ') + ' Add it with add_bucket, then link it with link_bucket';
  if (a.mini) {
    recipe.mini = true;
    const want = String(a.bucket ?? '').trim();
    if (want) {
      const b = ((d.buckets ?? []) as Json[]).find(x => norm(x.name) === norm(want));
      if (b) { (b.items ??= []).push({ name, recipe: recipe.id }); where = ` and to the ${b.name} bucket`; }
      else where = `. There's no “${want}” bucket, so add it to one in the app`;
    }
  }
  d.recipes.push(recipe);
  return `Added ${a.mini ? 'mini recipe ' : ''}“${name}” with ${ingredients.length} ingredients${where}.` +
    (priced.length ? ` Saved prices for ${priced.join(', ')}.` : '') +
    (kept.length ? ` Kept the existing prices for ${kept.join(', ')}.` : '');
}

function addPlace(d: Json, a: Json): string | Unchanged {
  const name = String(a.name ?? '').trim();
  if (!name) throw new Error('A place needs a name.');
  if ((d.places as Json[]).some(p => norm(p.name) === norm(name))) return unchanged(`“${name}” is already in Places, so nothing was added.`);
  const place: Json = { id: uid(), name, kind: PLACE_KINDS.includes(a.kind) ? a.kind : 'restaurant', been: !!a.been };
  if (String(a.suburb ?? '').trim()) place.suburb = String(a.suburb).trim();
  const cost = num(a.cost); if (cost !== undefined) place.cost = cost;
  const tags = tagsFor(a.tags, d.placeTags); if (tags.length) place.tags = tags;
  if (safeLink(a.link)) place.link = safeLink(a.link);
  if (String(a.notes ?? '').trim()) place.notes = String(a.notes).trim();
  d.places.push(place);
  return `Added “${name}” to Places.`;
}

function savePrices(d: Json, a: Json): string | Unchanged {
  const done: string[] = [];
  for (const it of Array.isArray(a.items) ? a.items : []) {
    const name = String(it?.name ?? '').trim(), price = num(it?.price);
    if (!name || price === undefined) continue;
    const q = num(it.qty), u = unitOf(it.unit);
    const i = (d.prices as Json[]).findIndex(p => norm(p.name) === norm(name));
    const had = i >= 0 ? d.prices[i] : null;
    const p = { name: had?.name ?? name, qty: q && u ? q : had?.qty ?? 1, unit: q && u ? u : had?.unit ?? 'each', price };
    if (i >= 0) d.prices[i] = p; else d.prices.push(p);
    done.push(p.name + ' (' + priceText(p) + ')');
  }
  return done.length ? 'Saved prices: ' + done.join('; ') + '.' : unchanged('No prices to save.');
}

function addBucket(d: Json, a: Json): string | Unchanged {
  const name = String(a.name ?? '').trim();
  if (!name) throw new Error('A bucket needs a name.');
  if (!Array.isArray(d.buckets)) d.buckets = [];
  let b = (d.buckets as Json[]).find(x => norm(x.name) === norm(name));
  const isNew = !b;
  if (!b) {
    b = { id: uid(), name, items: [] };
    const per = num(a.per_meal); if (per) b.perMeal = Math.round(per);
    d.buckets.push(b);
  }
  b.items ??= [];
  const added: string[] = [], missing: string[] = [];
  for (const it of Array.isArray(a.items) ? a.items : []) {
    const iname = String(it?.name ?? '').trim();
    if (!iname || (b.items as Json[]).some(x => norm(x.name) === norm(iname))) continue;
    if (it.mini_recipe) {
      const mini = (d.recipes as Json[]).find(r => r.mini && norm(r.name) === norm(iname));
      if (!mini) { missing.push(iname); continue; }
      b.items.push({ name: mini.name, recipe: mini.id });
      added.push(mini.name);
      continue;
    }
    const item: Json = { name: iname };
    const q = num(it.qty), u = unitOf(it.unit);
    if (q && u) { item.qty = q; item.unit = u; }
    const tags = tagsFor(it.tags, b.tags ??= []);
    if (tags.length) item.tags = tags;
    if (!b.tags.length) delete b.tags;
    b.items.push(item);
    added.push(iname);
  }
  if (!isNew && !added.length) return unchanged(`The ${b.name} bucket already has all of those.` + (missing.length ? ` There's no mini recipe called ${missing.join(', ')}.` : ''));
  return (isNew ? `Added the ${b.name} bucket with ${added.length} items.` : `Added ${added.join(', ')} to the ${b.name} bucket.`) +
    (missing.length ? ` Skipped ${missing.join(', ')}: there's no mini recipe by that name yet.` : '');
}

function linkBucket(d: Json, a: Json): string | Unchanged {
  const r = (d.recipes as Json[]).find(x => !x.mini && norm(x.name) === norm(a.recipe));
  if (!r) throw new Error(`There's no recipe called “${String(a.recipe ?? '')}”.`);
  const before = JSON.stringify(r.buckets ?? []);
  const note = useBucket(d, r, a.bucket, a.count);
  if (note.startsWith('There')) throw new Error(note);
  if (JSON.stringify(r.buckets ?? []) === before) return unchanged(`${r.name} already ${note}.`);
  return `${r.name} now ${note}.`;
}

function renameIngredient(d: Json, a: Json): string | Unchanged {
  const from = String(a.from ?? '').trim(), to = String(a.to ?? '').trim();
  if (!from || !to) throw new Error('Give the name as it is now and the correct name.');
  if (from === to) return unchanged('Those are the same name.');
  const f = norm(from), t = norm(to);
  const known = (list: Json[]) => list.find(x => norm(x.name) === t)?.name;
  const target = known(d.prices) ?? known(d.pantry ?? []) ?? (d.staples as string[]).find(s => norm(s) === t) ?? to;
  let uses = 0;
  const fix = (x: Json) => { if (norm(x.name) === f && !x.recipe) { x.name = target; uses++; } };
  for (const r of d.recipes as Json[]) {
    (r.ingredients ?? []).forEach(fix);
    // If the recipe now lists it twice, keep the first.
    if (r.ingredients) r.ingredients = r.ingredients.filter((g: Json, i: number, all: Json[]) => norm(g.name) !== t || all.findIndex(h => norm(h.name) === t) === i);
  }
  for (const b of (d.buckets ?? []) as Json[]) {
    (b.items ?? []).forEach(fix);
    if (b.items) b.items = b.items.filter((g: Json, i: number, all: Json[]) => g.recipe || norm(g.name) !== t || all.findIndex(h => !h.recipe && norm(h.name) === t) === i);
  }
  const merge = (list: Json[]) => {
    const i = list.findIndex(x => norm(x.name) === f);
    if (i < 0) return list;
    uses++;
    if (list.some(x => norm(x.name) === t)) return list.filter((_, j) => j !== i); // keep the correct one
    list[i] = { ...list[i], name: target };
    return list;
  };
  d.prices = merge(d.prices);
  if (Array.isArray(d.pantry)) d.pantry = merge(d.pantry);
  if ((d.staples as string[]).some(s => norm(s) === f)) {
    uses++;
    d.staples = (d.staples as string[]).filter(s => norm(s) !== f);
    if (!(d.staples as string[]).some(s => norm(s) === t)) d.staples.push(target);
  }
  for (const week of Object.values(d.shopExtras ?? {}) as Json[][]) week.forEach(fix);
  for (const meal of Object.values(d.picks ?? {}) as Json[]) for (const id of Object.keys(meal)) meal[id] = meal[id].map((n: string) => norm(n) === f ? target : n);
  if (d.shopSections?.[f] && !d.shopSections[t]) d.shopSections[t] = d.shopSections[f];
  if (d.shopSections) delete d.shopSections[f];
  return uses ? `Renamed “${from}” to “${target}” in ${uses} place${uses === 1 ? '' : 's'}.` : unchanged(`Nothing is called “${from}”, so nothing changed.`);
}

async function callTool(env: Env, key: string, name: string, args: Json): Promise<string> {
  switch (name) {
    case 'get_household_summary': {
      const cur = await load(env, key);
      if (!cur) throw new Error('This connector link has the wrong household key.');
      return JSON.stringify(summary(cur.data), null, 1);
    }
    case 'add_recipe': return change(env, key, d => addRecipe(d, args));
    case 'add_place': return change(env, key, d => addPlace(d, args));
    case 'save_prices': return change(env, key, d => savePrices(d, args));
    case 'add_bucket': return change(env, key, d => addBucket(d, args));
    case 'link_bucket': return change(env, key, d => linkBucket(d, args));
    case 'rename_ingredient': return change(env, key, d => renameIngredient(d, args));
    default: throw new Error('Unknown tool: ' + name);
  }
}

// ── MCP over HTTP (JSON-RPC) ──────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, mcp-session-id, mcp-protocol-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { ...CORS, Allow: 'POST' } });

  const url = new URL(req.url);
  const key = decodeURIComponent(url.searchParams.get('key') ?? url.pathname.split('/').filter(Boolean).pop() ?? '');
  if (!/^[A-Za-z0-9_-]{16,}$/.test(key)) return json({ error: 'Add your household key to the end of the connector URL.' }, 401);

  let msg: any;
  try { msg = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
  const batch = Array.isArray(msg) ? msg : [msg];
  const replies: unknown[] = [];
  for (const m of batch) {
    const reply = await answer(env, key, m);
    if (reply) replies.push(reply);
  }
  if (!replies.length) return new Response(null, { status: 202, headers: CORS }); // notifications only
  return json(Array.isArray(msg) ? replies : replies[0]);
}

async function answer(env: Env, key: string, m: any): Promise<unknown> {
  if (!m || m.id === undefined || m.id === null) return null; // a notification: nothing to send back
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: m.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: m.id, error: { code, message } });
  try {
    switch (m.method) {
      case 'initialize':
        return ok({
          protocolVersion: m.params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: SERVER,
          instructions: 'Adds recipes, mini recipes, buckets, places and ingredient prices, and fixes misspelled ingredient names to Ella & Jackson\'s household app. Call get_household_summary before adding, to reuse names and avoid duplicates.',
        });
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        try {
          const text = await callTool(env, key, String(m.params?.name ?? ''), m.params?.arguments ?? {});
          return ok({ content: [{ type: 'text', text }] });
        } catch (e) {
          return ok({ content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true });
        }
      }
      default: return fail(-32601, 'Method not found: ' + m.method);
    }
  } catch (e) {
    return fail(-32603, e instanceof Error ? e.message : String(e));
  }
}

// Supabase runs this; tests import `handle` directly.
const deno = (globalThis as any).Deno;
if (deno?.serve) {
  const env: Env = {
    url: deno.env.get('SUPABASE_URL') ?? '',
    // The project's public (anon / publishable) key; set HOUSEHOLD_API_KEY to override.
    apiKey: deno.env.get('HOUSEHOLD_API_KEY') ?? deno.env.get('SUPABASE_ANON_KEY') ?? '',
  };
  deno.serve((req: Request) => handle(req, env));
}
