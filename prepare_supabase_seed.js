const fs = require("fs");
const vm = require("vm");

const htmlPath = "urvi-prototype.html";
const csvPath = "/Users/kadimagomedov/Downloads/Telegram Desktop/avito_mahachkala_free_next50_2026-06-04.csv";
const outSqlPath = "supabase_seed_listings.sql";
const outJsonPath = "supabase_seed_listings.json";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(value);
      value = "";
    } else if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (ch !== "\r") {
      value += ch;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h.replace(/^\uFEFF/, ""), r[i] || ""])));
}

function extractCurrentItems(html) {
  const match = html.match(/const items=(\[.*?\]);\nlet cat=/s);
  if (!match) throw new Error("Cannot find current items array");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`items = ${match[1]}`, context);
  return context.items;
}

function inferArea(location) {
  const value = (location || "").replace(/^р-н\s+/i, "").trim();
  return value || "Махачкала";
}

function inferCategory(row) {
  const text = `${row.category || ""} ${row.url || ""} ${row.title || ""}`.toLowerCase();
  if (text.includes("mebel") || text.includes("диван") || text.includes("шкаф") || text.includes("стол") || text.includes("кресл")) return ["Мебель", "Мебель и интерьер", "🛋️"];
  if (text.includes("kosh") || text.includes("zhivot") || text.includes("кот") || text.includes("кош") || text.includes("собак") || text.includes("крол")) return ["Животные", row.category || "Животные", "🐾"];
  if (text.includes("bytovaya_tehnika") || text.includes("elektr") || text.includes("техник") || text.includes("заряд") || text.includes("машин")) return ["Техника", row.category || "Техника", "🧺"];
  if (text.includes("det") || text.includes("igrush") || text.includes("дет") || text.includes("реб")) return ["Детям", row.category || "Товары для детей и игрушки", "🧸"];
  if (text.includes("odezhda") || text.includes("obuv") || text.includes("одеж") || text.includes("туф") || text.includes("кроссов") || text.includes("размер")) return ["Одежда", row.category || "Одежда, обувь, аксессуары", "👟"];
  if (text.includes("rasteniya") || text.includes("растен") || text.includes("алоэ") || text.includes("дров")) return ["Растения", row.category || "Растения", "🌿"];
  if (text.includes("knigi") || text.includes("книга")) return ["Разное", row.category || "Книги и журналы", "📚"];
  return ["Разное", row.category || "Разное", "📦"];
}

function splitPhotos(value) {
  return (value || "")
    .split(/[\n|;,]+/)
    .map((x) => x.trim())
    .filter((x) => /^https?:\/\//.test(x));
}

function normalizeCurrent(item, index) {
  return {
    source: "prototype",
    source_item_id: item.url.match(/_(\d+)(?:\?|$)/)?.[1] || null,
    t: item.t || "Без названия",
    url: item.url,
    cat: item.cat || "Разное",
    rcat: item.rcat || item.cat || "Разное",
    e: item.e || "📦",
    area: item.area || "Махачкала",
    ago: item.ago || "",
    description: item.desc || "",
    photos: item.photos || [],
    pc: item.pc || String((item.photos || []).length || ""),
    seller: item.seller || "Пользователь",
    stype: item.stype || "Частное лицо",
    rate: item.rate || "",
    views: item.views || "",
    phone: item.phone || "",
    sort_order: index,
    raw_data: item,
  };
}

function normalizeCsv(row, index) {
  const [cat, rcat, e] = inferCategory(row);
  const photos = splitPhotos(row.photo_urls);
  return {
    source: "csv_avito_2026_06_04",
    source_item_id: row.item_id || null,
    t: row.title || "Без названия",
    url: row.url,
    cat,
    rcat,
    e,
    area: inferArea(row.location || row.address_from_detail),
    ago: row.published_from_detail || row.published_from_search || "",
    description: row.description || "",
    photos,
    pc: row.photo_count || (photos.length ? String(photos.length) : ""),
    seller: row.seller_name || "Пользователь",
    stype: row.seller_type || "Частное лицо",
    rate: row.seller_rating || "",
    views: row.views_from_detail || "",
    phone: "",
    sort_order: 1000 + index,
    raw_data: row,
  };
}

function sqlString(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  return `array[${values.map(sqlString).join(",")}]::text[]`;
}

function rowSql(row) {
  return `(${[
    sqlString(row.source),
    sqlString(row.source_item_id),
    sqlString(row.t),
    sqlString(row.url),
    sqlString(row.cat),
    sqlString(row.rcat),
    sqlString(row.e),
    sqlString(row.area),
    sqlString(row.ago),
    sqlString(row.description),
    sqlArray(row.photos),
    sqlString(row.pc),
    sqlString(row.seller),
    sqlString(row.stype),
    sqlString(row.rate),
    sqlString(row.views),
    sqlString(row.phone),
    row.sort_order,
    sqlString(JSON.stringify(row.raw_data)),
  ].join(",")})`;
}

const html = fs.readFileSync(htmlPath, "utf8");
const current = extractCurrentItems(html).map(normalizeCurrent);
const csv = parseCsv(fs.readFileSync(csvPath, "utf8")).map(normalizeCsv);

const byUrl = new Map();
[...current, ...csv].forEach((item) => {
  if (!item.url || byUrl.has(item.url)) return;
  byUrl.set(item.url, item);
});
const rows = [...byUrl.values()];

const sql = `delete from public.listings;\n\ninsert into public.listings (\n  source, source_item_id, t, url, cat, rcat, e, area, ago, description, photos,\n  pc, seller, stype, rate, views, phone, sort_order, raw_data\n)\nvalues\n${rows.map(rowSql).join(",\n")}\non conflict (url) do update set\n  source = excluded.source,\n  source_item_id = excluded.source_item_id,\n  t = excluded.t,\n  cat = excluded.cat,\n  rcat = excluded.rcat,\n  e = excluded.e,\n  area = excluded.area,\n  ago = excluded.ago,\n  description = excluded.description,\n  photos = excluded.photos,\n  pc = excluded.pc,\n  seller = excluded.seller,\n  stype = excluded.stype,\n  rate = excluded.rate,\n  views = excluded.views,\n  phone = excluded.phone,\n  sort_order = excluded.sort_order,\n  raw_data = excluded.raw_data,\n  updated_at = now();\n`;

fs.writeFileSync(outSqlPath, sql);
fs.writeFileSync(outJsonPath, JSON.stringify(rows, null, 2));
console.log(JSON.stringify({
  current: current.length,
  csv: csv.length,
  deduped: rows.length,
  output: outSqlPath,
  json: outJsonPath,
}, null, 2));
