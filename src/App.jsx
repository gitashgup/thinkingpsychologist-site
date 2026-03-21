import React, { useEffect, useMemo, useRef, useState } from "react";
import { products as seedProducts } from "./data/products";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const brandLogo = "/assets/brand/decorbeats-logo.svg";
const WHATSAPP_NUMBER = "919XXXXXXXXX";
const PRODUCT_STORAGE_BUCKET = "products";
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const BULK_WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hi, I would like to enquire about a bulk gifting order for Decorbeats."
)}`;
const ANNOUNCEMENTS = [
  "✦ Summer Sale — Up to 30% off selected items",
  "✦ Bulk orders welcome · 50 to 400+ units",
  "✦ Handcrafted in India · Shipped across the country",
  "✦ WhatsApp us for custom gifting solutions",
  "✦ New arrivals added weekly"
];
const TICKER_MESSAGES = [
  { text: "𝄞  DECORBEATS — WHERE EVERY GIFT FINDS ITS RHYTHM  𝄞", action: null },
  { text: "🚚  SAME-DAY DELIVERY ACROSS BANGALORE — ORDER BEFORE 2PM", action: "collection" },
  { text: "✦  BRASS NEVER LIES. NEITHER DOES OUR CRAFTSMANSHIP.", action: null },
  { text: "📦  OVERNIGHT TO MUMBAI · CHENNAI · PUNE · HYDERABAD VIA AMAZON", action: "collection" },
  { text: "🎁  50 TO 400 UNITS — BULK GIFTING IS OUR FORTE", action: "whatsapp" },
  { text: "✦  SAND-BLASTED. HAND-FINISHED. MADE TO BE REMEMBERED.", action: null },
  { text: "𝄞  THE BEAT OF GOOD GIFTING — DECORBEATS STUDIO", action: null },
  { text: "⭐  CUSTOM CORPORATE GIFTING — TELL US YOUR OCCASION", action: null },
  { text: "✦  ARTISANAL DECOR · GIFTED WITH LOVE · SINCE INDIA BEGAN CELEBRATING", action: null }
];
const INQUIRY_SYSTEM_PROMPT = `You are a data extraction assistant for Decorbeats, an Indian gifting and decor business. Extract structured information from this sales inquiry transcript. Return ONLY a valid JSON object, no explanation, no markdown.

Fields to extract:
{
  "customer_name": string or null,
  "customer_phone": string or null,
  "source": "phone" | "whatsapp" | "walkin",
  "occasion": string or null,
  "required_by_date": string or null,
  "budget_per_unit": number or null,
  "total_budget": number or null,
  "notes": string or null,
  "products": [
    {
      "product_name": string,
      "quantity_requested": number or null,
      "quoted_price": number or null
    }
  ]
}`;

const emptyForm = {
  id: "",
  name: "",
  category: "Decor",
  material: "Metal",
  quantity: 0,
  mrp: "",
  b2b: "",
  notes: "",
  imageUrl: ""
};

const categoryOptions = ["Bell", "Bowl", "Box", "Decor", "Diya", "Jars", "Misc", "Planter", "Plate", "Tree", "Urli", "Wall Decor"];
const materialOptions = ["Brass", "Metal", "Ceramic", "Wood", "Glass", "Clay", "Mixed", "Other"];

const materialSkuCodes = {
  Brass: "BR",
  Metal: "MT",
  Ceramic: "CR",
  Wood: "WD",
  Glass: "GL",
  Clay: "CL",
  Mixed: "MX",
  Other: "OT"
};

const categorySkuCodes = {
  Bell: "BELL",
  Bowl: "BOWL",
  Box: "BOX",
  Decor: "DECOR",
  Diya: "DIYA",
  Jars: "JARS",
  Misc: "MISC",
  Planter: "PLANT",
  Plate: "PLATE",
  Tree: "TREE",
  Urli: "URLI",
  "Wall Decor": "WALL"
};

const emptyInquiryDraft = {
  customer_name: "",
  customer_phone: "",
  source: "phone",
  occasion: "",
  required_by_date: "",
  budget_per_unit: "",
  total_budget: "",
  notes: "",
  products: [{ product_name: "", matched_sku: "", quantity_requested: "", quoted_price: "" }]
};

const inquiryStatusOrder = ["new", "quoted", "converted", "lost"];

function toInquiry(raw) {
  return {
    id: raw.id,
    createdAt: raw.created_at,
    customerName: safeText(raw.customer_name, "Unnamed inquiry"),
    customerPhone: safeText(raw.customer_phone),
    source: safeText(raw.source, "phone"),
    occasion: safeText(raw.occasion),
    requiredByDate: safeText(raw.required_by_date),
    budgetPerUnit: raw.budget_per_unit,
    totalBudget: raw.total_budget,
    status: safeText(raw.status, "new").toLowerCase(),
    rawTranscript: safeText(raw.raw_transcript),
    notes: safeText(raw.notes),
    items: Array.isArray(raw.inquiry_items)
      ? raw.inquiry_items.map((item) => ({
          id: item.id,
          productSku: safeText(item.product_sku),
          productName: safeText(item.product_name),
          quantityRequested: Number(item.quantity_requested ?? 0),
          quotedPrice: item.quoted_price
        }))
      : []
  };
}

function formatInquiryStatus(status) {
  const normalized = safeText(status, "new").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function createEmptyInquiryDraft() {
  return JSON.parse(JSON.stringify(emptyInquiryDraft));
}

function normalizeInquiryDraft(payload, products = []) {
  const normalizedProducts = Array.isArray(payload?.products) && payload.products.length ? payload.products : emptyInquiryDraft.products;
  return {
    customer_name: safeText(payload?.customer_name),
    customer_phone: safeText(payload?.customer_phone),
    source: ["phone", "whatsapp", "walkin"].includes(safeText(payload?.source).toLowerCase())
      ? safeText(payload?.source).toLowerCase()
      : "phone",
    occasion: safeText(payload?.occasion),
    required_by_date: safeText(payload?.required_by_date),
    budget_per_unit: payload?.budget_per_unit ?? "",
    total_budget: payload?.total_budget ?? "",
    notes: safeText(payload?.notes),
    products: normalizedProducts.map((item) => {
      const productName = safeText(item?.product_name);
      const matched = findMatchingProduct(products, productName);
      return {
        product_name: productName,
        matched_sku: matched?.sku ?? "",
        quantity_requested: item?.quantity_requested ?? "",
        quoted_price: item?.quoted_price ?? ""
      };
    })
  };
}

function scoreProductMatch(product, query) {
  if (!query) {
    return 0;
  }
  const normalizedQuery = query.toLowerCase();
  const name = safeText(product.name).toLowerCase();
  const sku = safeText(product.sku).toLowerCase();
  if (name === normalizedQuery || sku === normalizedQuery) {
    return 100;
  }
  let score = 0;
  if (name.includes(normalizedQuery)) {
    score += 70;
  }
  if (normalizedQuery.includes(name) && name) {
    score += 35;
  }
  if (sku.includes(normalizedQuery) || normalizedQuery.includes(sku)) {
    score += 45;
  }
  normalizedQuery.split(/\s+/).forEach((token) => {
    if (token && name.includes(token)) {
      score += 8;
    }
  });
  return score;
}

function findMatchingProduct(products, query) {
  if (!query) {
    return null;
  }
  let best = null;
  let bestScore = 0;
  products.forEach((product) => {
    const score = scoreProductMatch(product, query);
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  });
  return bestScore >= 40 ? best : null;
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" fill="currentColor" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.5 5A3.5 3.5 0 0 0 2 8.5v6A3.5 3.5 0 0 0 5.5 18H7v3l3.18-3H18.5A3.5 3.5 0 0 0 22 14.5v-6A3.5 3.5 0 0 0 18.5 5h-13Zm2.5 5h8v2H8v-2Zm0-3h6v2H8V7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V22h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.07A7 7 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 1 0 10 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3 2.5 19.5A1.2 1.2 0 0 0 3.55 21h16.9a1.2 1.2 0 0 0 1.05-1.5L12 3Zm-1 6h2v5h-2V9Zm0 7h2v2h-2v-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m19.14 12.94.04-.94-.04-.94 2.02-1.58a.7.7 0 0 0 .17-.9l-1.91-3.3a.7.7 0 0 0-.85-.3l-2.39.96a7.65 7.65 0 0 0-1.62-.94L14.2 2.4a.7.7 0 0 0-.69-.56h-3.02a.7.7 0 0 0-.69.56L9.44 5a7.65 7.65 0 0 0-1.62.94l-2.39-.96a.7.7 0 0 0-.85.3L2.67 8.58a.7.7 0 0 0 .17.9l2.02 1.58-.04.94.04.94-2.02 1.58a.7.7 0 0 0-.17.9l1.91 3.3a.7.7 0 0 0 .85.3l2.39-.96c.5.38 1.05.7 1.62.94l.36 2.6a.7.7 0 0 0 .69.56h3.02a.7.7 0 0 0 .69-.56l.36-2.6c.57-.24 1.12-.56 1.62-.94l2.39.96a.7.7 0 0 0 .85-.3l1.91-3.3a.7.7 0 0 0-.17-.9l-2.02-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.5 4a6.5 6.5 0 1 0 4.06 11.58l4.43 4.42 1.41-1.41-4.42-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function parseNumber(value) {
  const cleaned = String(value ?? "")
    .replace(/[^0-9.]/g, "")
    .trim();
  if (!cleaned) {
    return null;
  }
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function safeText(value, fallback = "") {
  return String(value ?? "").trim() || fallback;
}

function normalizeUrl(value) {
  const url = safeText(value);
  if (!url || url === "[URL]") {
    return "";
  }
  return url;
}

function normalizeImageUrls(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeUrl).filter(Boolean);
  }
  if (typeof value === "string") {
    const normalized = normalizeUrl(value);
    return normalized ? [normalized] : [];
  }
  return [];
}

function sanitizeStorageSegment(value, fallback = "draft") {
  const cleaned = safeText(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function getFileExtension(fileName) {
  const extension = safeText(fileName).split(".").pop()?.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return extension || "jpg";
}

function buildProductImagePath(sku, fileName) {
  return `${sanitizeStorageSegment(sku)}/${Date.now()}.${getFileExtension(fileName)}`;
}

function getNextSku(products, material, category) {
  const materialCode = materialSkuCodes[material] || "OT";
  const categoryCode = categorySkuCodes[category] || "MISC";
  const prefix = `DB-${materialCode}-${categoryCode}-`;
  const nextNumber =
    products.reduce((highest, product) => {
      if (!safeText(product.sku).startsWith(prefix)) {
        return highest;
      }
      const parsed = Number.parseInt(product.sku.slice(prefix.length), 10);
      return Number.isNaN(parsed) ? highest : Math.max(highest, parsed);
    }, 0) + 1;
  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

function getProductImages(product) {
  const urls = normalizeImageUrls(product?.imageUrls);
  if (urls.length) {
    return urls;
  }
  const fallback = normalizeUrl(product?.imageUrl);
  return fallback ? [fallback] : [];
}

function getPrimaryImage(product) {
  return getProductImages(product)[0] ?? "";
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function formatCurrency(value) {
  if (value == null || value === "") {
    return "Not set";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value));
}

function hasDisplayValue(value) {
  if (value == null) {
    return false;
  }
  const normalized = String(value).trim();
  if (normalized === "" || normalized === "Not set") {
    return false;
  }
  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isNaN(parsed) ? true : parsed !== 0;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 8a3 3 0 1 0-2.82-4H12a3 3 0 0 0 .18 1l-5.1 2.95a3 3 0 1 0 0 8.1l5.1 2.95A3 3 0 1 0 13 18a3 3 0 0 0-.18 1l-5.1-2.95a3 3 0 0 0 0-2.1L12.82 11A3 3 0 0 0 15 12a3 3 0 1 0 0-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4.5 7.8 6H5.5A2.5 2.5 0 0 0 3 8.5v9A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 18.5 6h-2.3L15 4.5H9Zm3 12.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4Zm0-1.8a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12.04 3.5a8.47 8.47 0 0 0-7.28 12.8L3.5 20.5l4.33-1.23A8.47 8.47 0 1 0 12.04 3.5Zm0 1.9a6.57 6.57 0 0 1 5.64 9.93l-.18.29.74 2.56-2.63-.7-.28.17a6.57 6.57 0 1 1-3.29-12.15Zm-3.1 3.43c-.17 0-.43.06-.66.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.02 2.59.12.17 1.76 2.82 4.35 3.84 2.14.84 2.6.67 3.06.6.46-.08 1.48-.6 1.69-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29-.25-.12-1.48-.73-1.71-.81-.23-.08-.39-.12-.56.12-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.06-.39-2.03-1.26-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.1-.52.11-.11.25-.29.37-.44.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.47-.4-.4-.56-.4h-.48Z"
        fill="currentColor"
      />
    </svg>
  );
}

function toProduct(raw, index = 0) {
  const quantity = Number(raw.quantity ?? 0);
  const imageUrls = normalizeImageUrls(raw.imageUrls ?? raw.image_urls);
  const primaryImage = imageUrls[0] ?? normalizeUrl(raw.imageUrl ?? raw.image_url);
  return {
    id: raw.id ?? index + 1,
    slug: raw.slug ?? slugify(`${raw.sku}-${raw.name}`),
    sku: raw.sku ?? "",
    name: raw.name ?? "",
    category: raw.category ?? "Uncategorized",
    material: raw.material ?? "Unspecified",
    quantity,
    stockStatus: quantity <= 0 ? "Out of stock" : quantity <= 10 ? "Low stock" : "In stock",
    driveUrl: raw.driveUrl ?? raw.drive_url ?? "",
    imageUrl: primaryImage,
    imageUrls,
    notes: raw.notes ?? "",
    archivedAt: raw.archivedAt ?? raw.archived_at ?? null,
    pricing: {
      unitCost: raw.pricing?.unitCost ?? raw.unit_cost ?? null,
      mrp: raw.pricing?.mrp ?? raw.mrp ?? null,
      b2b: raw.pricing?.b2b ?? raw.b2b_price ?? null
    }
  };
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function normalizeCsvKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCsvValue(row, ...keys) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const match = entries.find(([header]) => normalizeCsvKey(header) === key);
    if (match) {
      return match[1];
    }
  }
  return "";
}

function mapCsvRowToPayload(row) {
  const sku = safeText(row.SKU);
  const name = safeText(row["Product Name"]);
  if (!sku || !name) {
    return null;
  }

  return {
    sku,
    slug: slugify(`${sku}-${name}`),
    name,
    category: safeText(row.Category, "Uncategorized"),
    material: safeText(row.Material, "Unspecified"),
    quantity: Math.trunc(parseNumber(row.Quantity) ?? 0),
    unit_cost: parseNumber(row["Unit Cost"]),
    mrp: parseNumber(row.MRP),
    b2b_price: parseNumber(row["B2B Price"]),
    notes: safeText(row.Notes),
    drive_url: normalizeUrl(row["Column 1"]),
    image_url: normalizeUrl(row["Product Image URL"])
  };
}

function mapSettingsCsvRowToPayload(row) {
  const sku = safeText(getCsvValue(row, "sku"));
  const name = safeText(getCsvValue(row, "name", "product_name"));
  if (!sku || !name) {
    return null;
  }

  return {
    sku,
    slug: slugify(`${sku}-${name}`),
    name,
    category: safeText(getCsvValue(row, "category"), "Uncategorized"),
    material: safeText(getCsvValue(row, "material"), "Unspecified"),
    quantity: Math.trunc(parseNumber(getCsvValue(row, "stock", "quantity")) ?? 0),
    mrp: parseNumber(getCsvValue(row, "mrp")),
    b2b_price: parseNumber(getCsvValue(row, "b2b_price", "b2b")),
    notes: safeText(getCsvValue(row, "description", "notes"))
  };
}

function dedupePayloadBySku(rows) {
  const uniqueBySku = new Map();
  let duplicates = 0;

  rows.forEach((row) => {
    if (uniqueBySku.has(row.sku)) {
      duplicates += 1;
    }
    uniqueBySku.set(row.sku, row);
  });

  return {
    rows: Array.from(uniqueBySku.values()),
    duplicates
  };
}

function ProductImage({ product, compact = false }) {
  const primaryImage = getPrimaryImage(product);
  if (primaryImage) {
    return (
      <div className={`product-image-shell ${compact ? "compact" : ""}`}>
        <img className="product-image" src={primaryImage} alt={product.name} loading="lazy" />
      </div>
    );
  }

  return (
    <div className={`product-image-shell product-image-fallback ${compact ? "compact" : ""}`}>
      <img src={brandLogo} alt="Decorbeats" className="product-placeholder-logo" loading="lazy" />
      <strong>{product?.name ?? "Decorbeats"}</strong>
      <small>{product?.driveUrl ? "Drive folder linked" : "Image coming soon"}</small>
    </div>
  );
}

function ProductThumb({ product }) {
  const primaryImage = getPrimaryImage(product);
  if (primaryImage) {
    return (
      <div className="product-thumb">
        <img className="product-thumb-image" src={primaryImage} alt={product.name} loading="lazy" />
      </div>
    );
  }

  return (
    <div className="product-thumb product-thumb-fallback">
      <img src={brandLogo} alt="Decorbeats" className="product-thumb-logo" loading="lazy" />
    </div>
  );
}

function LandingView({ onAdmin, onCustomer }) {
  return (
    <section className="landing-shell">
      <div className="landing-card">
        <img src={brandLogo} alt="Decorbeats" className="landing-logo" />
        <h1>Welcome to the World of Gifting</h1>
        <p className="landing-tagline">Inventory, product sharing, and gifting collections in one clean mobile workspace.</p>
        <div className="landing-actions">
          <button type="button" className="primary-button" onClick={onAdmin}>
            Admin
          </button>
          <button type="button" className="ghost-button" onClick={onCustomer}>
            Customer
          </button>
        </div>
      </div>
    </section>
  );
}

function ScreenHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="screen-header">
      <div className="brand-lockup compact-lockup">
        <img src={brandLogo} alt="Decorbeats" className="brand-logo small" />
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {subtitle ? <p className="screen-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="screen-header-action">{action}</div> : null}
    </header>
  );
}

function StatusStrip({ statusMessage, items = [] }) {
  return (
    <section className="status-strip panel-card">
      <p className="status-copy">{statusMessage}</p>
      {items.length ? (
        <div className="mini-stats">
          {items.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StatStrip({ items }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="stat-strip" aria-label="Inventory highlights">
      {items.map((item) => (
        <article key={item.label} className={item.emphasis ? "stat-chip emphasis" : "stat-chip"}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}

function ControlBar({ search, setSearch, categoryFilter, setCategoryFilter, categories }) {
  return (
    <section className="panel-card control-bar">
      <input
        className="search-input"
        type="search"
        placeholder="Search by product, SKU, material, or category"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="filter-pills">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={category === categoryFilter ? "filter-pill active" : "filter-pill"}
            onClick={() => setCategoryFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </section>
  );
}

function AuthPanel({ email, setEmail, password, setPassword, authBusy, userEmail, onSignIn, onSignOut }) {
  return (
    <section className="panel-card admin-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin Access</p>
          <h3>{userEmail ? "Studio access unlocked" : "Sign in to manage inventory"}</h3>
        </div>
        {userEmail ? (
          <button type="button" className="ghost-button" onClick={onSignOut}>
            Sign out
          </button>
        ) : null}
      </div>
      {userEmail ? (
        <p className="support-copy">You can now add products, update stock, archive items, and upload images.</p>
      ) : (
        <div className="auth-row">
          <input
            className="search-input"
            type="email"
            placeholder="admin-email@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="search-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="button" className="primary-button" disabled={authBusy} onClick={onSignIn}>
            {authBusy ? "Signing in..." : "Sign In"}
          </button>
        </div>
      )}
    </section>
  );
}

function ImportPanel({ importBusy, previewRows, previewFileName, previewCount, onFileChange, onConfirm, onClearPreview }) {
  return (
    <section className="panel-card admin-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">CSV Import</p>
          <h3>Import Products from CSV</h3>
        </div>
      </div>
      <p className="support-copy">
        Upload a CSV with columns for `sku`, `name`, `category`, `material`, `mrp`, `stock`, `b2b_price`, and
        `description`.
      </p>
      <label className="import-dropzone">
        <strong>{importBusy ? "Preparing import..." : "Tap to upload CSV"}</strong>
        <span>We’ll preview the first 5 rows before anything is imported.</span>
        <input type="file" accept=".csv,text/csv" onChange={onFileChange} disabled={importBusy} />
      </label>
      {previewRows.length ? (
        <div className="import-preview">
          <div className="section-head">
            <div>
              <p className="eyebrow">Preview</p>
              <h3>{previewFileName}</h3>
            </div>
            <div className="user-badge">{previewCount} row(s) ready</div>
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Material</th>
                  <th>MRP</th>
                  <th>Stock</th>
                  <th>B2B</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${row.sku}-${index}`}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.material}</td>
                    <td>{row.mrp ?? "-"}</td>
                    <td>{row.quantity}</td>
                    <td>{row.b2b_price ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="detail-edit-actions">
            <button type="button" className="primary-button detail-save-button" disabled={importBusy} onClick={onConfirm}>
              {importBusy ? "Importing..." : "Confirm Import"}
            </button>
            <button type="button" className="detail-cancel-link" onClick={onClearPreview}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AccountCard({ userEmail, onSignOut }) {
  return (
    <section className="panel-card admin-card settings-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Account</p>
          <h3>Signed-in admin</h3>
        </div>
      </div>
      <p className="support-copy">{userEmail || "No signed-in email"}</p>
      <button type="button" className="ghost-button settings-button" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}

function AppInfoCard({ lastSyncLabel }) {
  return (
    <section className="panel-card admin-card settings-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">App Info</p>
          <h3>Decorbeats Studio</h3>
        </div>
      </div>
      <p className="support-copy">Last sync: {lastSyncLabel}</p>
    </section>
  );
}

function InquiryStatusFilters({ activeStatus, onChange }) {
  const filters = ["all", ...inquiryStatusOrder];

  return (
    <div className="inquiry-status-row" aria-label="Filter inquiries by status">
      {filters.map((status) => (
        <button
          key={status}
          type="button"
          className={activeStatus === status ? "inquiry-status-pill active" : "inquiry-status-pill"}
          onClick={() => onChange(status)}
        >
          {status === "all" ? "All" : formatInquiryStatus(status)}
        </button>
      ))}
    </div>
  );
}

function InquiryCard({ inquiry, expanded, onToggle, onStatusUpdate, busy }) {
  const requestedUnits = inquiry.items.reduce((sum, item) => sum + Number(item.quantityRequested || 0), 0);
  const productsMentioned = inquiry.items.map((item) => item.productName || item.productSku).filter(Boolean).join(", ");
  const nextStatus = inquiryStatusOrder[inquiryStatusOrder.indexOf(inquiry.status) + 1] ?? null;

  return (
    <article className={expanded ? "inquiry-card expanded" : "inquiry-card"}>
      <button type="button" className="inquiry-card-main" onClick={() => onToggle(inquiry.id)}>
        <div className="inquiry-card-top">
          <div>
            <p className="inquiry-customer-name">{inquiry.customerName}</p>
            <p className="inquiry-products-line">{productsMentioned || "No products added yet"}</p>
          </div>
          <span className={`inquiry-status-badge ${inquiry.status}`}>{formatInquiryStatus(inquiry.status)}</span>
        </div>
        <div className="inquiry-card-meta">
          <span>{requestedUnits ? `${requestedUnits} units` : "Quantity not set"}</span>
          {inquiry.occasion ? <span>{inquiry.occasion}</span> : null}
          {inquiry.requiredByDate ? <span>{inquiry.requiredByDate}</span> : null}
        </div>
      </button>

      {expanded ? (
        <div className="inquiry-card-detail">
          <div className="inquiry-detail-grid">
            <div>
              <span>Customer</span>
              <strong>{inquiry.customerName}</strong>
            </div>
            {inquiry.customerPhone ? (
              <div>
                <span>Phone</span>
                <strong>{inquiry.customerPhone}</strong>
              </div>
            ) : null}
            <div>
              <span>Source</span>
              <strong>{inquiry.source}</strong>
            </div>
            {inquiry.occasion ? (
              <div>
                <span>Occasion</span>
                <strong>{inquiry.occasion}</strong>
              </div>
            ) : null}
            {inquiry.requiredByDate ? (
              <div>
                <span>Required by</span>
                <strong>{inquiry.requiredByDate}</strong>
              </div>
            ) : null}
          </div>
          {inquiry.items.length ? (
            <ul className="inquiry-item-list">
              {inquiry.items.map((item) => (
                <li key={item.id || `${item.productSku}-${item.productName}`}>
                  <strong>{item.productName || item.productSku || "Product"}</strong>
                  <span>{item.quantityRequested || 0} requested</span>
                </li>
              ))}
            </ul>
          ) : null}
          {inquiry.notes ? <p className="detail-note">{inquiry.notes}</p> : null}
          <div className="inquiry-card-actions">
            <button
              type="button"
              className="ghost-button"
              disabled={busy || !nextStatus}
              onClick={() => nextStatus && onStatusUpdate(inquiry, nextStatus)}
            >
              {nextStatus ? `Mark as ${formatInquiryStatus(nextStatus)}` : "Status complete"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function InquiriesScreen({
  inquiries,
  statusFilter,
  setStatusFilter,
  expandedInquiryId,
  onToggleInquiry,
  onStatusUpdate,
  onNewInquiry,
  busy
}) {
  return (
    <section className="stack-grid">
      <button type="button" className="primary-button inquiry-log-button" onClick={onNewInquiry}>
        <MicIcon />
        <span>Log New Inquiry</span>
      </button>
      <InquiryStatusFilters activeStatus={statusFilter} onChange={setStatusFilter} />
      <section className="inquiry-list">
        {inquiries.length ? (
          inquiries.map((inquiry) => (
            <InquiryCard
              key={inquiry.id}
              inquiry={inquiry}
              expanded={expandedInquiryId === inquiry.id}
              onToggle={onToggleInquiry}
              onStatusUpdate={onStatusUpdate}
              busy={busy}
            />
          ))
        ) : (
          <div className="panel-card empty-state">
            <p className="eyebrow">No inquiries yet</p>
            <h3>Your customer requests will appear here.</h3>
          </div>
        )}
      </section>
    </section>
  );
}

function InquiryRecorderModal({
  open,
  supportsSpeechRecognition,
  products,
  isListening,
  transcript,
  manualTranscript,
  setManualTranscript,
  step,
  draft,
  setDraft,
  errorMessage,
  busy,
  onStartListening,
  onStopAndProcess,
  onCancel,
  onBack,
  onSave,
  onProductNameChange,
  onProductFieldChange,
  onAddProductRow,
  onRemoveProductRow
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="inquiry-modal-overlay" onClick={onCancel}>
      <div className="inquiry-modal" onClick={(event) => event.stopPropagation()}>
        {step === "record" ? (
          <div className="inquiry-modal-body">
            <div className="section-head">
              <div>
                <p className="eyebrow">New Inquiry</p>
                <h3>Capture inquiry details</h3>
              </div>
            </div>
            {supportsSpeechRecognition ? (
              <>
                <button
                  type="button"
                  className={isListening ? "mic-record-button active" : "mic-record-button"}
                  onClick={onStartListening}
                >
                  <MicIcon />
                </button>
                <p className="support-copy inquiry-recorder-copy">
                  {isListening ? "Listening in English (India)..." : "Tap the mic to start recording."}
                </p>
                <div className="transcript-box">{transcript || "Live transcript will appear here as you speak."}</div>
              </>
            ) : (
              <>
                <label className="inquiry-textarea-label">
                  Type your inquiry here
                  <textarea
                    rows="9"
                    value={manualTranscript}
                    onChange={(event) => setManualTranscript(event.target.value)}
                    placeholder="Capture the customer inquiry details here..."
                  />
                </label>
              </>
            )}
            {errorMessage ? <p className="inline-upload-error">{errorMessage}</p> : null}
            <div className="detail-edit-actions">
              <button type="button" className="primary-button detail-save-button" disabled={busy} onClick={onStopAndProcess}>
                Done
              </button>
              <button type="button" className="detail-cancel-link" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {step === "extracting" ? (
          <div className="inquiry-modal-body inquiry-loading-state">
            <div className="spinner-ring" />
            <p>Extracting details...</p>
          </div>
        ) : null}

        {step === "confirm" ? (
          <form
            className="inquiry-modal-body inquiry-confirm-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div className="section-head">
              <div>
                <p className="eyebrow">Confirm Inquiry</p>
                <h3>Review before saving</h3>
              </div>
            </div>
            {errorMessage ? <p className="inline-upload-error">{errorMessage}</p> : null}
            <label>
              Customer name
              <input
                value={draft.customer_name}
                onChange={(event) => setDraft((current) => ({ ...current, customer_name: event.target.value }))}
              />
            </label>
            <label>
              Customer phone
              <input
                value={draft.customer_phone}
                onChange={(event) => setDraft((current) => ({ ...current, customer_phone: event.target.value }))}
              />
            </label>
            <label>
              Source
              <select
                value={draft.source}
                onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
              >
                <option value="phone">Phone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="walkin">Walk-in</option>
              </select>
            </label>
            <label>
              Occasion
              <input
                value={draft.occasion}
                onChange={(event) => setDraft((current) => ({ ...current, occasion: event.target.value }))}
              />
            </label>
            <label>
              Required by date
              <input
                value={draft.required_by_date}
                onChange={(event) => setDraft((current) => ({ ...current, required_by_date: event.target.value }))}
              />
            </label>
            <label>
              Budget per unit
              <div className="rupee-field">
                <span>₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.budget_per_unit}
                  onChange={(event) => setDraft((current) => ({ ...current, budget_per_unit: event.target.value }))}
                />
              </div>
            </label>
            <label>
              Total budget
              <div className="rupee-field">
                <span>₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.total_budget}
                  onChange={(event) => setDraft((current) => ({ ...current, total_budget: event.target.value }))}
                />
              </div>
            </label>
            <label className="span-2">
              Notes
              <textarea
                rows="4"
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <div className="inquiry-products-editor span-2">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Products</p>
                  <h3>Items requested</h3>
                </div>
                <button type="button" className="ghost-button" onClick={onAddProductRow}>
                  Add item
                </button>
              </div>
              <div className="inquiry-product-editor-list">
                {draft.products.map((item, index) => (
                  <div key={`draft-item-${index}`} className="inquiry-product-editor-card">
                    <label>
                      Product name
                      <input
                        value={item.product_name}
                        onChange={(event) => onProductNameChange(index, event.target.value)}
                      />
                    </label>
                    {item.matched_sku ? <span className="matched-sku-badge">{item.matched_sku}</span> : null}
                    <div className="inquiry-inline-fields">
                      <label>
                        Quantity
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.quantity_requested}
                          onChange={(event) => onProductFieldChange(index, "quantity_requested", event.target.value)}
                        />
                      </label>
                      <label>
                        Quoted price
                        <div className="rupee-field">
                          <span>₹</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={item.quoted_price}
                            onChange={(event) => onProductFieldChange(index, "quoted_price", event.target.value)}
                          />
                        </div>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="detail-cancel-link"
                      onClick={() => onRemoveProductRow(index)}
                      disabled={draft.products.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="detail-edit-actions">
              <button type="submit" className="primary-button detail-save-button" disabled={busy}>
                {busy ? "Saving..." : "Save Inquiry"}
              </button>
              <button type="button" className="detail-cancel-link" onClick={onBack}>
                Back
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function CustomerPreviewBanner({ onBack }) {
  return (
    <div className="customer-preview-banner">
      <span>You're previewing the customer view — </span>
      <button type="button" onClick={onBack}>
        Back to Admin
      </button>
    </div>
  );
}

function AnnouncementBar() {
  const items = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS];

  return (
    <section className="announcement-bar" aria-label="Store announcements">
      <div className="announcement-track">
        {items.map((message, index) => (
          <span key={`${message}-${index}`} className="announcement-item">
            {message}
          </span>
        ))}
      </div>
    </section>
  );
}

function CustomerHeader({ scrolled, tickerMessage, tickerAction, tickerVisible, onSearchTap, onTickerAction }) {
  const tickerClassName = scrolled && tickerVisible ? "customer-header-ticker visible" : "customer-header-ticker";
  return (
    <header className={scrolled ? "customer-header scrolled" : "customer-header"}>
      <img src={brandLogo} alt="Decorbeats" className="customer-header-logo" />
      {tickerAction ? (
        <button
          type="button"
          className={`${tickerClassName} customer-header-ticker-button`}
          aria-hidden={!scrolled}
          onClick={() => onTickerAction(tickerAction)}
        >
          <span>{tickerMessage}</span>
        </button>
      ) : (
        <div className={tickerClassName} aria-hidden={!scrolled}>
          <span>{tickerMessage}</span>
        </div>
      )}
      <button type="button" className="customer-header-search" aria-label="Search products" onClick={onSearchTap}>
        <SearchIcon />
      </button>
    </header>
  );
}

function CustomerHero({ featuredProduct, onShop }) {
  const heroImage = getPrimaryImage(featuredProduct);
  return (
    <section
      className="customer-hero desktop-reveal"
      style={
        heroImage
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(245, 237, 227, 0.72), rgba(236, 224, 210, 0.92)), url(${heroImage})`
            }
          : undefined
      }
    >
      <div className="customer-hero-copy">
        <p className="eyebrow">Decorbeats</p>
        <h1>
          <span>Handcrafted</span>
          <span>for every celebration.</span>
        </h1>
        <p>Brass, metal & artisanal decor - made in India, gifted with love.</p>
        <div className="customer-hero-actions">
          <button type="button" className="primary-button customer-hero-cta" onClick={onShop}>
            Shop the Collection
          </button>
          <a className="customer-hero-link" href={BULK_WHATSAPP_LINK} target="_blank" rel="noreferrer">
            Enquire for bulk orders →
          </a>
        </div>
      </div>
      <div className="customer-hero-media" aria-hidden="true">
        {heroImage ? <img src={heroImage} alt={featuredProduct?.name || "Decorbeats collection"} loading="lazy" /> : null}
      </div>
      <div className="customer-scroll-indicator" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}

function TrustStrip({ productCount }) {
  const items = [
    "Handcrafted in India",
    "Bulk orders welcome",
    `${productCount}+ products`,
    "WhatsApp enquiry in minutes"
  ];

  return (
    <section className="trust-strip desktop-reveal" aria-label="Decorbeats trust markers">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </section>
  );
}

function FeaturedCategoriesRow({ products, onSelectCategory, onShop }) {
  const featuredCategories = ["Bowl", "Diya", "Wall Decor", "Box"];
  const tiles = featuredCategories
    .map((category) => {
      const match = products.find((product) => product.category === category && getPrimaryImage(product));
      return {
        category,
        image: match ? getPrimaryImage(match) : "",
        label: category
      };
    })
    .filter((item) => item.image);

  if (!tiles.length) {
    return null;
  }

  return (
    <section className="featured-categories desktop-reveal">
      {tiles.map((tile) => (
        <button
          key={tile.category}
          type="button"
          className="featured-category-tile"
          onClick={() => {
            onSelectCategory(tile.category);
            onShop();
          }}
        >
          <img src={tile.image} alt={tile.label} loading="lazy" />
          <span>{tile.label}</span>
        </button>
      ))}
    </section>
  );
}

function EditorialSection() {
  return (
    <section className="editorial-section desktop-reveal">
      <div className="editorial-media">
        <div className="editorial-placeholder" aria-hidden="true">
          <img src={brandLogo} alt="" className="editorial-watermark" loading="lazy" />
        </div>
      </div>
      <div className="editorial-copy">
        <p className="eyebrow">Decorbeats Studio</p>
        <h2>Gifting, reimagined.</h2>
        <p>Thoughtfully crafted brass, metal and artisanal decor pieces for celebrations, events and elevated gifting.</p>
        <p>Designed to feel personal, finished by hand, and ready for meaningful moments across homes and occasions.</p>
        <p>From intimate gifting to large-format corporate orders, each piece is made to carry warmth and story.</p>
        <a className="customer-whatsapp-button editorial-whatsapp" href={BULK_WHATSAPP_LINK} target="_blank" rel="noreferrer">
          <WhatsAppIcon />
          <span>Enquire on WhatsApp</span>
        </a>
      </div>
    </section>
  );
}

function CustomerCategoryBar({ categories, categoryFilter, setCategoryFilter }) {
  return (
    <section className="customer-category-row" aria-label="Browse categories">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={category === categoryFilter ? "customer-category-chip active" : "customer-category-chip"}
          onClick={() => setCategoryFilter(category)}
        >
          {category}
        </button>
      ))}
    </section>
  );
}

function CustomerProductCard({ product, onSelect }) {
  const showLowStock = product.quantity > 0 && product.quantity <= 5;
  const primaryImage = getPrimaryImage(product);
  return (
    <button type="button" className="customer-product-card desktop-reveal" onClick={() => onSelect(product)}>
      <div className="customer-product-image-wrap">
        {primaryImage ? (
          <img className="customer-product-image" src={primaryImage} alt={product.name} loading="lazy" />
        ) : (
          <div className="customer-product-image customer-product-fallback">
            <img src={brandLogo} alt="Decorbeats" className="customer-placeholder-logo" loading="lazy" />
          </div>
        )}
        <span className="customer-card-hover-text">View Details</span>
      </div>
      <div className="customer-product-copy">
        <h3>{product.name}</h3>
        <p className="customer-product-category">{product.category}</p>
        {hasDisplayValue(product.pricing.mrp) ? <p className="customer-price">{formatCurrency(product.pricing.mrp)}</p> : null}
        {showLowStock ? <span className="customer-low-stock">Low stock</span> : null}
      </div>
    </button>
  );
}

function CustomerSheet({ product, onClose, onShare }) {
  const [closing, setClosing] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const closeTimerRef = useRef(null);
  const dragStateRef = useRef({ startY: 0, deltaY: 0, dragging: false });

  useEffect(() => {
    setClosing(false);
    setDragOffset(0);
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [product?.id]);

  if (!product) {
    return (
      <div className="customer-sheet-overlay" aria-hidden="true">
        <aside className="customer-sheet" />
      </div>
    );
  }

  const whatsappMessage = encodeURIComponent(
    `Hi, I'm interested in ${product.name} (SKU: ${product.sku}). Is it available?`
  );
  const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`;
  const showDescription = product.notes && product.notes.trim() !== product.name.trim();
  const occasionLine = showDescription ? product.notes.trim() : "";
  const dismissSheet = () => {
    if (closing) {
      return;
    }
    setClosing(true);
    setDragOffset(0);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, 300);
  };
  const resetDrag = () => {
    dragStateRef.current = { startY: 0, deltaY: 0, dragging: false };
    setDragOffset(0);
  };
  const sheetStyle =
    dragOffset > 0
      ? {
          transform: `translateY(${dragOffset}px)`,
          transition: "none"
        }
      : undefined;

  return (
    <div className={closing ? "customer-sheet-overlay open closing" : "customer-sheet-overlay open"} onClick={dismissSheet}>
      <aside
        className={closing ? "customer-sheet open closing" : "customer-sheet open"}
        style={sheetStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="customer-sheet-handle-zone"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (!touch) {
              return;
            }
            dragStateRef.current = {
              startY: touch.clientY,
              deltaY: 0,
              dragging: true
            };
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            const state = dragStateRef.current;
            if (!touch || !state.dragging) {
              return;
            }
            const deltaY = touch.clientY - state.startY;
            state.deltaY = deltaY;
            if (deltaY > 0) {
              setDragOffset(deltaY);
            } else {
              setDragOffset(0);
            }
          }}
          onTouchEnd={(event) => {
            const state = dragStateRef.current;
            if (!state.dragging) {
              return;
            }
            if (state.deltaY > 80) {
              dismissSheet();
            } else {
              resetDrag();
            }
          }}
          onTouchCancel={resetDrag}
        >
          <button type="button" className="customer-sheet-handle" aria-label="Close product details" onClick={dismissSheet} />
        </div>
        <CustomerImageCarousel product={product} />
        <div className="customer-sheet-copy">
          <h2>{product.name}</h2>
          {hasDisplayValue(product.pricing.mrp) ? <p className="customer-sheet-price">{formatCurrency(product.pricing.mrp)}</p> : null}
          {occasionLine ? <p className="customer-sheet-occasion">{occasionLine}</p> : null}
          <p className="customer-sheet-meta">
            {product.category} · {product.material}
          </p>
          <a className="customer-whatsapp-button" href={whatsappLink} target="_blank" rel="noreferrer">
            <WhatsAppIcon />
            <span>Enquire on WhatsApp</span>
          </a>
          <button type="button" className="customer-share-link" onClick={() => onShare(product)}>
            Share
          </button>
        </div>
      </aside>
    </div>
  );
}

function CustomerFooter({ onAdmin, showAdminLink = true }) {
  return (
    <footer className="customer-footer">
      <div className="customer-footer-main">
        <div className="customer-footer-brand">
          <img src={brandLogo} alt="Decorbeats" className="customer-footer-logo" />
          <p>Artisanal decor, gifted with love.</p>
        </div>
        <div className="customer-footer-cta">
          <p>For bulk orders of 50+ units, contact us directly on WhatsApp</p>
          <a className="customer-whatsapp-button footer-whatsapp" href={BULK_WHATSAPP_LINK} target="_blank" rel="noreferrer">
            <WhatsAppIcon />
            <span>WhatsApp</span>
          </a>
        </div>
        <div className="customer-footer-owner">
          {showAdminLink ? (
            <button type="button" className="customer-admin-link" onClick={onAdmin}>
              Are you the owner? Sign in →
            </button>
          ) : null}
        </div>
      </div>
      <div className="customer-footer-bottom">© 2025 Decorbeats. Artisanal décor, gifted with love.</div>
    </footer>
  );
}

function ProductMediaManager({ product, busy, errorMessage, onAddImages, onDeleteImage, onSetCoverImage }) {
  const fileInputRef = useRef(null);
  const images = getProductImages(product);

  return (
    <div className="media-manager">
      <div className="media-strip">
        {images.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            className={index === 0 ? "media-thumb active" : "media-thumb"}
            onClick={() => onSetCoverImage(product, url)}
          >
            <img src={url} alt={`${product.name} ${index + 1}`} loading="lazy" />
            <span className="media-thumb-label">{index === 0 ? "Cover" : `#${index + 1}`}</span>
            <span
              className="media-delete"
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteImage(product, url);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteImage(product, url);
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
        <button type="button" className="media-add-tile" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          <span>+</span>
          <small>{busy ? "Uploading..." : "Add"}</small>
        </button>
      </div>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) {
            onAddImages(product, files);
          }
          event.target.value = "";
        }}
      />
      {errorMessage ? <p className="inline-upload-error">{errorMessage}</p> : null}
    </div>
  );
}

function CustomerImageCarousel({ product }) {
  const images = getProductImages(product);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [product?.id]);

  if (!images.length) {
    return (
      <div className="customer-sheet-image-wrap">
        <div className="customer-sheet-image customer-product-fallback">
          <img src={brandLogo} alt="Decorbeats" className="customer-placeholder-logo" loading="lazy" />
        </div>
      </div>
    );
  }

  const hasCarousel = images.length > 1;

  return (
    <div className="customer-carousel">
      <div
        className="customer-sheet-image-wrap"
        onTouchStart={(event) => {
          touchStartRef.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartRef.current == null) {
            return;
          }
          const endX = event.changedTouches[0]?.clientX ?? touchStartRef.current;
          const delta = endX - touchStartRef.current;
          if (Math.abs(delta) > 40 && hasCarousel) {
            setActiveIndex((current) => {
              if (delta < 0) {
                return Math.min(current + 1, images.length - 1);
              }
              return Math.max(current - 1, 0);
            });
          }
          touchStartRef.current = null;
        }}
      >
        <div className="customer-carousel-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="customer-carousel-slide">
              <img className="customer-sheet-image" src={url} alt={`${product.name} ${index + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
      {hasCarousel ? (
        <>
          <div className="customer-carousel-count">
            {activeIndex + 1}/{images.length}
          </div>
          <div className="customer-carousel-thumbs">
            {images.map((url, index) => (
              <button
                key={`${url}-thumb-${index}`}
                type="button"
                className={index === activeIndex ? "customer-carousel-thumb active" : "customer-carousel-thumb"}
                onClick={() => setActiveIndex(index)}
              >
                <img src={url} alt={`${product.name} thumbnail ${index + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ProductForm({ form, setForm, generatedSku, onSubmit, onReset, uploadBusy, saveBusy, onFileChange }) {
  return (
    <form className="panel-card admin-card" onSubmit={onSubmit}>
      <div className="section-head">
        <div>
          <p className="eyebrow">Product Studio</p>
          <h3>{form.id ? "Edit selected product" : "Add a new product"}</h3>
        </div>
        <button type="button" className="ghost-button" onClick={onReset}>
          Clear
        </button>
      </div>

      <div className="sku-preview-badge">SKU will be: {generatedSku}</div>

      <label className="product-photo-dropzone">
        <CameraIcon />
        <strong>{uploadBusy ? "Uploading..." : "Tap to add product photo"}</strong>
        <span>{form.imageUrl ? "Photo added. You can tap again to replace it." : "Add the product photo first."}</span>
        {form.imageUrl ? <img src={form.imageUrl} alt="Product preview" className="product-photo-preview" /> : null}
        <input type="file" accept="image/*" onChange={onFileChange} disabled={uploadBusy} />
      </label>

      <div className="form-grid">
        <label className="span-2">
          What is it?
          <input
            value={form.name}
            placeholder="e.g. 4 Metal Bowls with Tray Yellow"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </label>
        <label>
          What type?
          <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          What material?
          <select value={form.material} onChange={(event) => setForm((current) => ({ ...current, material: event.target.value }))}>
            {materialOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          How many do you have?
          <input
            type="number"
            placeholder="How many in stock right now?"
            value={form.quantity}
            onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
          />
        </label>
        <label>
          What's the selling price?
          <div className="rupee-field">
            <span>₹</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Selling price per unit"
              value={form.mrp}
              onChange={(event) => setForm((current) => ({ ...current, mrp: event.target.value }))}
            />
          </div>
        </label>
        <label>
          Wholesale price?
          <div className="rupee-field">
            <span>₹</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Wholesale price (optional)"
              value={form.b2b}
              onChange={(event) => setForm((current) => ({ ...current, b2b: event.target.value }))}
            />
          </div>
        </label>
        <label className="span-2">
          Any notes?
          <textarea
            rows="4"
            placeholder="Any details customers should know?"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>
      </div>

      <button type="submit" className="primary-button product-submit-button" disabled={saveBusy}>
        {saveBusy ? "Saving..." : form.id ? "Update product" : "Add Product"}
      </button>
    </form>
  );
}

function ArchivePanel({ product, onArchive, onRestore, archiveBusy }) {
  if (!product) {
    return null;
  }

  return (
    <section className="panel-card admin-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Product Status</p>
          <h3>{product.archivedAt ? "Archived product" : "Archive this product"}</h3>
        </div>
      </div>
      <p className="support-copy">
        {product.archivedAt
          ? "This product is hidden from the live catalog but can be restored at any time."
          : "Archive removes the product from normal views without deleting its data."}
      </p>
      <button
        type="button"
        className={product.archivedAt ? "ghost-button" : "danger-button"}
        disabled={archiveBusy}
        onClick={() => (product.archivedAt ? onRestore(product) : onArchive(product))}
      >
        {archiveBusy ? "Updating..." : product.archivedAt ? "Restore product" : "Archive product"}
      </button>
    </section>
  );
}

function ProductCard({
  product,
  customerMode,
  expanded,
  canManage,
  onSelect,
  onEdit,
  onShare,
  onArchiveToggle,
  onInlineEdit,
  onInlineAddImages,
  onInlineDeleteImage,
  onInlineSetCoverImage,
  imageBusy,
  uploadError,
  saveBusy,
  archivedVisible = false
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stockTone = product.quantity <= 0 ? "danger" : product.quantity <= 5 ? "warn" : "ok";

  return (
    <article className={`product-card ${product.archivedAt ? "archived" : ""} ${expanded ? "expanded" : ""}`}>
      <div className="product-card-row" onClick={() => onSelect(product)}>
        <ProductThumb product={product} />
        <div className="product-card-body product-card-body-row">
          <div className="product-card-meta">
            <div className="product-card-top-row">
              <span className="sku-chip">{product.sku}</span>
              {!customerMode ? (
                <div className="card-menu-wrap">
                  <button
                    type="button"
                    className="card-menu-button"
                    aria-label={`More actions for ${product.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen((value) => !value);
                    }}
                  >
                    &#8230;
                  </button>
                  {menuOpen ? (
                    <div
                      className="card-menu"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(product);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onShare(product);
                        }}
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          if (!product.archivedAt) {
                            const shouldArchive = window.confirm("Archive this product? It will be hidden from all views.");
                            if (!shouldArchive) {
                              return;
                            }
                          }
                          onArchiveToggle(product, !product.archivedAt);
                        }}
                      >
                        {product.archivedAt ? "Restore" : "Archive"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <h3>{product.name}</h3>
            <p className="product-meta">{product.category}</p>
          </div>
          <div className={`stock-count-badge ${stockTone}`}>
            {product.archivedAt && archivedVisible ? "Archived" : `${product.quantity} in stock`}
          </div>
        </div>
      </div>
      {expanded ? (
        <DetailPanel
          product={product}
          customerMode={customerMode}
          canManage={canManage}
          onEdit={onInlineEdit}
          onShare={onShare}
          onAddImages={onInlineAddImages}
          onDeleteImage={onInlineDeleteImage}
          onSetCoverImage={onInlineSetCoverImage}
          imageBusy={imageBusy}
          uploadError={uploadError}
          saveBusy={saveBusy}
          inline
        />
      ) : null}
    </article>
  );
}

function DetailPanel({
  product,
  customerMode,
  canManage,
  onEdit,
  onShare,
  onAddImages,
  onDeleteImage,
  onSetCoverImage,
  imageBusy,
  uploadError,
  saveBusy,
  inline = false
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    mrp: "",
    b2b: "",
    quantity: "",
    notes: ""
  });
  useEffect(() => {
    if (!product) {
      return;
    }
    setDraft({
      name: product.name ?? "",
      mrp: product.pricing.mrp ?? "",
      b2b: product.pricing.b2b ?? "",
      quantity: product.quantity ?? 0,
      notes: product.notes ?? ""
    });
    setEditing(false);
  }, [product]);

  if (!product) {
    return (
      <aside className={inline ? "detail-panel detail-panel-inline panel-card" : "detail-panel panel-card"}>
        <div className="detail-empty">
          <p className="eyebrow">Selection</p>
          <h3>Choose a product to see full details.</h3>
        </div>
      </aside>
    );
  }

  return (
    <aside className={inline ? "detail-panel detail-panel-inline panel-card" : "detail-panel panel-card"}>
      <div className="detail-image-wrap">
        <ProductImage product={product} />
        {canManage && !customerMode ? (
          <>
            <span className="detail-image-hint">{imageBusy ? "Updating gallery..." : "Tap a thumbnail to set cover image"}</span>
            <ProductMediaManager
              product={product}
              busy={imageBusy}
              errorMessage={uploadError}
              onAddImages={onAddImages}
              onDeleteImage={onDeleteImage}
              onSetCoverImage={onSetCoverImage}
            />
          </>
        ) : null}
      </div>
      <div className="section-head">
        <div>
          <h3>{product.name}</h3>
        </div>
      </div>
      {!editing ? (
        <>
          <div className="detail-grid">
            <div>
              <span>SKU</span>
              <strong>{product.sku}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{product.category}</strong>
            </div>
            <div>
              <span>Material</span>
              <strong>{product.material}</strong>
            </div>
            <div className="detail-quantity-block">
              <span>Quantity</span>
              <div className="detail-quantity-row">
                <strong>{product.quantity}</strong>
                <span
                  className={`stock-count-badge ${
                    product.quantity <= 0 ? "danger" : product.quantity <= 5 ? "warn" : "ok"
                  }`}
                >
                  {product.quantity <= 0 ? "Out of stock" : product.quantity <= 5 ? "Low stock" : "In stock"}
                </span>
              </div>
            </div>
            {hasDisplayValue(product.pricing.mrp) ? (
              <div>
                <span>MRP</span>
                <strong>{formatCurrency(product.pricing.mrp)}</strong>
              </div>
            ) : null}
            {hasDisplayValue(product.pricing.b2b) ? (
              <div>
                <span>B2B</span>
                <strong>{formatCurrency(product.pricing.b2b)}</strong>
              </div>
            ) : null}
          </div>
          {product.notes && product.notes.trim() !== product.name.trim() ? <p className="detail-note">{product.notes}</p> : null}
          {canManage && !customerMode ? (
            <div className="detail-actions detail-actions-inline">
              <button type="button" className="ghost-button detail-action-button" onClick={() => setEditing(true)}>
                Edit Product
              </button>
              <button type="button" className="primary-button detail-action-button detail-share-button" onClick={() => onShare(product)}>
                <ShareIcon />
                <span>Share</span>
              </button>
            </div>
          ) : (
            <div className="detail-actions detail-actions-inline">
              <button type="button" className="primary-button detail-action-button detail-share-button" onClick={() => onShare(product)}>
                <ShareIcon />
                <span>Share</span>
              </button>
            </div>
          )}
        </>
      ) : null}
      {editing && canManage && !customerMode ? (
        <form
          className="detail-edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const didSave = await onEdit(product, draft);
            if (didSave !== false) {
              setEditing(false);
            }
          }}
        >
          <label>
            Name
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div>
            <span>MRP</span>
            <input
              type="number"
              inputMode="decimal"
              value={draft.mrp}
              onChange={(event) => setDraft((current) => ({ ...current, mrp: event.target.value }))}
            />
          </div>
          <div>
            <span>B2B price</span>
            <input
              type="number"
              inputMode="decimal"
              value={draft.b2b}
              onChange={(event) => setDraft((current) => ({ ...current, b2b: event.target.value }))}
            />
          </div>
          <label>
            Quantity
            <input
              type="number"
              inputMode="numeric"
              value={draft.quantity}
              onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))}
            />
          </label>
          <label className="span-2">
            Description
            <textarea rows="4" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="detail-edit-actions">
            <button type="submit" className="primary-button detail-save-button" disabled={saveBusy}>
              {saveBusy ? "Saving..." : "Save"}
            </button>
            <button type="button" className="detail-cancel-link" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </aside>
  );
}

function CatalogSection({
  products,
  customerMode,
  selectedId,
  canManage,
  onSelect,
  onEdit,
  onShare,
  onArchiveToggle,
  onInlineEdit,
  onInlineAddImages,
  onInlineDeleteImage,
  onInlineSetCoverImage,
  imageBusy,
  uploadError,
  saveBusy,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  categories,
  archivedVisible = false
}) {
  return (
    <>
      <ControlBar
        search={search}
        setSearch={setSearch}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories}
      />
      <main className="content-grid">
        <section className="catalog-grid">
          {products.length ? (
            products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                customerMode={customerMode}
                expanded={selectedId === product.id}
                canManage={canManage}
                onSelect={onSelect}
                onEdit={onEdit}
                onShare={onShare}
                onArchiveToggle={onArchiveToggle}
                onInlineEdit={onInlineEdit}
                onInlineAddImages={onInlineAddImages}
                onInlineDeleteImage={onInlineDeleteImage}
                onInlineSetCoverImage={onInlineSetCoverImage}
                imageBusy={imageBusy}
                uploadError={uploadError}
                saveBusy={saveBusy}
                archivedVisible={archivedVisible}
              />
            ))
          ) : (
            <div className="panel-card empty-state">
              <p className="eyebrow">Nothing here</p>
              <h3>No products match this view.</h3>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function BottomNav({ activeTab, setActiveTab, lowStockCount }) {
  const items = [
    { id: "products", label: "Products", icon: <GridIcon /> },
    { id: "inquiries", label: "Inquiries", icon: <ChatIcon /> },
    { id: "low-stock", label: "Low Stock", icon: <WarningIcon />, badge: lowStockCount },
    { id: "settings", label: "Settings", icon: <GearIcon /> }
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button
        type="button"
        className={activeTab === "products" ? "nav-item active" : "nav-item"}
        onClick={() => setActiveTab("products")}
      >
        <span className="nav-icon">{items[0].icon}</span>
        <span>Products</span>
      </button>

      <button
        type="button"
        className={activeTab === "inquiries" ? "nav-item active" : "nav-item"}
        onClick={() => setActiveTab("inquiries")}
      >
        <span className="nav-icon">
          {items[1].icon}
        </span>
        <span>Inquiries</span>
      </button>

      <button
        type="button"
        className={activeTab === "low-stock" ? "nav-item active" : "nav-item"}
        onClick={() => setActiveTab("low-stock")}
      >
        <span className="nav-icon nav-icon-alert">
          {items[2].icon}
          {lowStockCount ? <small>{lowStockCount}</small> : null}
        </span>
        <span>Low Stock</span>
      </button>

      <button
        type="button"
        className={activeTab === "settings" ? "nav-item active" : "nav-item"}
        onClick={() => setActiveTab("settings")}
      >
        <span className="nav-icon">{items[3].icon}</span>
        <span>Settings</span>
      </button>
    </nav>
  );
}

export default function App() {
  const [products, setProducts] = useState(seedProducts.map(toProduct));
  const [inquiries, setInquiries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedInquiryId, setExpandedInquiryId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState("all");
  const [statusMessage, setStatusMessage] = useState(
    isSupabaseConfigured
      ? "Supabase is connected. Sign in to manage products, import stock, and upload imagery."
      : "Supabase env vars are not set yet, so the app is running with your local seed inventory."
  );
  const [form, setForm] = useState(emptyForm);
  const [saveBusy, setSaveBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [inquiryBusy, setInquiryBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [showArchived, setShowArchived] = useState(false);
  const [publicScreen, setPublicScreen] = useState("customer");
  const [activeTab, setActiveTab] = useState("products");
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState([]);
  const [csvPreviewPayload, setCsvPreviewPayload] = useState([]);
  const [csvPreviewFileName, setCsvPreviewFileName] = useState("");
  const [customerHeaderElevated, setCustomerHeaderElevated] = useState(false);
  const [headerTickerIndex, setHeaderTickerIndex] = useState(0);
  const [headerTickerVisible, setHeaderTickerVisible] = useState(true);
  const [previewCustomerView, setPreviewCustomerView] = useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryModalStep, setInquiryModalStep] = useState("record");
  const [inquiryTranscript, setInquiryTranscript] = useState("");
  const [manualInquiryTranscript, setManualInquiryTranscript] = useState("");
  const [inquiryDraft, setInquiryDraft] = useState(createEmptyInquiryDraft());
  const [inquiryModalError, setInquiryModalError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const productGridRef = useRef(null);
  const customerSearchRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechSupported =
    typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) {
          setSession(data.session ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthReady(true);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthReady(true);
    });

    async function loadProducts() {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (cancelled) {
        return;
      }
      if (error) {
        setStatusMessage("Supabase is configured, but product data could not be loaded.");
        return;
      }
      if (data?.length) {
        const nextProducts = data.map(toProduct);
        setProducts(nextProducts);
        setSelectedId(null);
        setLastSyncAt(new Date().toISOString());
        setStatusMessage(`Loaded ${nextProducts.length} products from Supabase.`);
      } else {
        setProducts([]);
        setSelectedId(null);
        setLastSyncAt(new Date().toISOString());
        setStatusMessage("Supabase is connected. Add products manually or import your CSV.");
      }
    }

    async function loadInquiries() {
      const { data, error } = await supabase
        .from("inquiries")
        .select("*, inquiry_items(*)")
        .order("created_at", { ascending: false });

      if (cancelled || error) {
        return;
      }

      setInquiries((data ?? []).map(toInquiry));
    }

    loadProducts();
    loadInquiries();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const userEmail = session?.user?.email ?? "";
  const canManage = Boolean(userEmail) || !isSupabaseConfigured;
  const adminActive = Boolean(userEmail) || !isSupabaseConfigured;

  useEffect(() => {
    if (adminActive) {
      setPublicScreen("customer");
      setActiveTab("products");
    }
  }, [adminActive]);

  useEffect(() => {
    setUploadError("");
  }, [selectedId]);

  useEffect(() => {
    if (!adminActive) {
      setPreviewCustomerView(false);
    }
  }, [adminActive]);

  useEffect(() => {
    if (adminActive) {
      return undefined;
    }

    function handleScroll() {
      if (window.innerWidth >= 768) {
        setCustomerHeaderElevated(window.scrollY > 50);
        return;
      }

      setCustomerHeaderElevated(window.scrollY > 8);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [adminActive]);

  useEffect(() => {
    if (adminActive || !customerHeaderElevated) {
      setHeaderTickerVisible(true);
      return undefined;
    }

    let cycleTimeoutId = null;
    let swapTimeoutId = null;

    const scheduleNext = () => {
      cycleTimeoutId = window.setTimeout(() => {
        setHeaderTickerVisible(false);
        swapTimeoutId = window.setTimeout(() => {
          setHeaderTickerIndex((current) => (current + 1) % TICKER_MESSAGES.length);
          setHeaderTickerVisible(true);
          scheduleNext();
        }, 300);
      }, 3500);
    };

    scheduleNext();

    return () => {
      if (cycleTimeoutId) {
        window.clearTimeout(cycleTimeoutId);
      }
      if (swapTimeoutId) {
        window.clearTimeout(swapTimeoutId);
      }
    };
  }, [adminActive, customerHeaderElevated]);

  const customerCatalog = useMemo(() => products.filter((product) => !product.archivedAt), [products]);
  const adminCatalog = useMemo(() => products.filter((product) => showArchived || !product.archivedAt), [products, showArchived]);
  const lowStockCatalog = useMemo(() => adminCatalog.filter((product) => product.quantity <= 10), [adminCatalog]);

  const currentCatalog = useMemo(() => {
    if (!adminActive) {
      return customerCatalog;
    }
    if (activeTab === "low-stock") {
      return lowStockCatalog;
    }
    return adminCatalog;
  }, [activeTab, adminActive, adminCatalog, customerCatalog, lowStockCatalog]);

  const categories = useMemo(() => {
    return [
      "All",
      ...new Set(
        currentCatalog
          .map((product) => product.category)
          .filter(Boolean)
          .sort((left, right) => left.localeCompare(right))
      )
    ];
  }, [currentCatalog]);

  const filteredProducts = useMemo(() => {
    return currentCatalog.filter((product) => {
      const haystack = [product.name, product.sku, product.category, product.material].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, currentCatalog, search]);

  const filteredInquiries = useMemo(() => {
    const statusFiltered =
      inquiryStatusFilter === "all" ? inquiries : inquiries.filter((inquiry) => inquiry.status === inquiryStatusFilter);
    return [...statusFiltered].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }, [inquiries, inquiryStatusFilter]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 768) {
      return undefined;
    }

    const nodes = Array.from(document.querySelectorAll(".desktop-reveal"));
    if (!nodes.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [adminActive, previewCustomerView, filteredProducts.length, categoryFilter]);

  const selectedProduct =
    filteredProducts.find((product) => product.id === selectedId) ||
    currentCatalog.find((product) => product.id === selectedId) ||
    products.find((product) => product.id === selectedId) ||
    null;

  const stats = useMemo(() => {
    return {
      totalProducts: products.filter((product) => !product.archivedAt).length,
      totalUnits: products.filter((product) => !product.archivedAt).reduce((sum, product) => sum + Number(product.quantity || 0), 0),
      lowStock: products.filter((product) => !product.archivedAt && product.stockStatus === "Low stock").length,
      withImages: products.filter((product) => !product.archivedAt && getProductImages(product).length).length
    };
  }, [products]);

  function populateForm(product) {
    setForm({
      id: product.id,
      name: product.name,
      category: product.category,
      material: product.material,
      quantity: product.quantity,
      mrp: product.pricing.mrp ?? "",
      b2b: product.pricing.b2b ?? "",
      notes: product.notes ?? "",
      imageUrl: product.imageUrl ?? ""
    });
  }

  function handleProductSelect(product) {
    setSelectedId((current) => (current === product.id ? null : product.id));
    if (adminActive) {
      populateForm(product);
    }
  }

  function handleEditProduct(product) {
    handleProductSelect(product);
    setActiveTab("add");
  }

  function handleNewInquiry() {
    setInquiryModalOpen(true);
    setInquiryModalStep("record");
    setInquiryTranscript("");
    setManualInquiryTranscript("");
    setInquiryDraft(createEmptyInquiryDraft());
    setInquiryModalError("");
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  function syncInquiryProductMatch(index, nextName) {
    const matched = findMatchingProduct(products, nextName);
    setInquiryDraft((current) => {
      const nextProducts = [...current.products];
      nextProducts[index] = {
        ...nextProducts[index],
        product_name: nextName,
        matched_sku: matched?.sku ?? ""
      };
      return { ...current, products: nextProducts };
    });
  }

  function updateInquiryProductField(index, field, value) {
    setInquiryDraft((current) => {
      const nextProducts = [...current.products];
      nextProducts[index] = { ...nextProducts[index], [field]: value };
      return { ...current, products: nextProducts };
    });
  }

  function addInquiryProductRow() {
    setInquiryDraft((current) => ({
      ...current,
      products: [...current.products, { product_name: "", matched_sku: "", quantity_requested: "", quoted_price: "" }]
    }));
  }

  function removeInquiryProductRow(index) {
    setInquiryDraft((current) => ({
      ...current,
      products:
        current.products.length > 1 ? current.products.filter((_, currentIndex) => currentIndex !== index) : current.products
    }));
  }

  function resetInquiryModal() {
    setInquiryModalOpen(false);
    setInquiryModalStep("record");
    setInquiryTranscript("");
    setManualInquiryTranscript("");
    setInquiryDraft(createEmptyInquiryDraft());
    setInquiryModalError("");
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  function startInquiryListening() {
    if (!speechSupported) {
      return;
    }

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }
      setInquiryTranscript(`${finalText} ${interimText}`.trim());
    };
    recognition.onerror = (event) => {
      console.log("Speech recognition failed:", event);
      setInquiryModalError("Voice capture stopped. You can continue by typing the inquiry.");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setInquiryModalError("");
    setIsListening(true);
  }

  async function extractInquiryWithOpenAI(transcriptText) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INQUIRY_SYSTEM_PROMPT },
          { role: "user", content: transcriptText }
        ]
      })
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(errorPayload?.error?.message || "OpenAI request failed.");
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }
    return JSON.parse(content);
  }

  async function processInquiryTranscript() {
    const rawTranscript = speechSupported ? inquiryTranscript.trim() : manualInquiryTranscript.trim();
    if (!rawTranscript) {
      setInquiryModalError("Add a transcript before continuing.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInquiryModalStep("extracting");
    setInquiryModalError("");

    try {
      if (!OPENAI_API_KEY) {
        throw new Error("Missing OpenAI API key.");
      }
      const extracted = await extractInquiryWithOpenAI(rawTranscript);
      setInquiryDraft(normalizeInquiryDraft(extracted, products));
      setInquiryModalStep("confirm");
    } catch (error) {
      console.log("Inquiry extraction failed:", error);
      setInquiryModalError("Could not process automatically. Please fill in details manually.");
      setInquiryDraft(createEmptyInquiryDraft());
      setInquiryModalStep("confirm");
    }
  }

  async function saveInquiry() {
    const transcriptText = speechSupported ? inquiryTranscript.trim() : manualInquiryTranscript.trim();
    setInquiryBusy(true);
    setInquiryModalError("");
    try {
      const inquiryPayload = {
        customer_name: safeText(inquiryDraft.customer_name) || null,
        customer_phone: safeText(inquiryDraft.customer_phone) || null,
        source: safeText(inquiryDraft.source, "phone"),
        occasion: safeText(inquiryDraft.occasion) || null,
        required_by_date: safeText(inquiryDraft.required_by_date) || null,
        budget_per_unit: inquiryDraft.budget_per_unit === "" ? null : Number(inquiryDraft.budget_per_unit),
        total_budget: inquiryDraft.total_budget === "" ? null : Number(inquiryDraft.total_budget),
        notes: safeText(inquiryDraft.notes) || null,
        raw_transcript: transcriptText || null,
        status: "new"
      };

      let savedInquiry;
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from("inquiries").insert(inquiryPayload).select().single();
        if (error) {
          throw error;
        }

        const itemsPayload = inquiryDraft.products
          .filter((item) => safeText(item.product_name))
          .map((item) => ({
            inquiry_id: data.id,
            product_sku: safeText(item.matched_sku) || null,
            product_name: safeText(item.product_name),
            quantity_requested: item.quantity_requested === "" ? null : Number(item.quantity_requested),
            quoted_price: item.quoted_price === "" ? null : Number(item.quoted_price)
          }));

        let items = [];
        if (itemsPayload.length) {
          const { data: insertedItems, error: itemsError } = await supabase.from("inquiry_items").insert(itemsPayload).select();
          if (itemsError) {
            throw itemsError;
          }
          items = insertedItems ?? [];
        }

        savedInquiry = toInquiry({ ...data, inquiry_items: items });
      } else {
        savedInquiry = toInquiry({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...inquiryPayload,
          inquiry_items: inquiryDraft.products
            .filter((item) => safeText(item.product_name))
            .map((item) => ({
              id: crypto.randomUUID(),
              product_sku: safeText(item.matched_sku) || null,
              product_name: safeText(item.product_name),
              quantity_requested: item.quantity_requested === "" ? null : Number(item.quantity_requested),
              quoted_price: item.quoted_price === "" ? null : Number(item.quoted_price)
            }))
        });
      }

      setInquiries((current) => [savedInquiry, ...current]);
      setExpandedInquiryId(savedInquiry.id);
      setStatusMessage("Inquiry saved ✓");
      resetInquiryModal();
    } catch (error) {
      console.log("Inquiry save failed:", error);
      setInquiryModalError(error?.message || "Could not save this inquiry.");
      setInquiryModalStep("confirm");
    } finally {
      setInquiryBusy(false);
    }
  }

  function handleScrollToCollection() {
    productGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleFocusCustomerSearch() {
    customerSearchRef.current?.focus();
    customerSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleDetailEdit(product, draft) {
    if (!canManage) {
      setStatusMessage("Sign in first to edit products.");
      return;
    }

    const payload = {
      name: draft.name,
      slug: slugify(`${product.sku}-${draft.name}`),
      quantity: Number(draft.quantity || 0),
      mrp: draft.mrp === "" ? null : Number(draft.mrp),
      b2b_price: draft.b2b === "" ? null : Number(draft.b2b),
      notes: draft.notes
    };

    setSaveBusy(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from("products").update(payload).eq("id", product.id).select().single();
        if (error) {
          throw error;
        }
        const normalized = toProduct(data);
        setProducts((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
        setSelectedId(normalized.id);
        populateForm(normalized);
        setLastSyncAt(new Date().toISOString());
        setStatusMessage(`${normalized.name} updated.`);
      } else {
        setProducts((current) =>
          current.map((item) =>
            item.id === product.id
              ? toProduct({
                  ...item,
                  ...payload,
                  b2b_price: payload.b2b_price,
                  mrp: payload.mrp
                })
              : item
          )
        );
        setStatusMessage(`${draft.name} updated locally.`);
      }
      return true;
    } catch (error) {
      setStatusMessage(error.message || "Could not update this product.");
      return false;
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleShareProduct(product) {
    const message = [
      product.name,
      `SKU: ${product.sku}`,
      `Stock: ${product.quantity}`,
      product.imageUrl ? `Image: ${product.imageUrl}` : null
    ]
      .filter(Boolean)
      .join("\n");
    const shareData = {
      title: product.name,
      text: message
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      }
      setStatusMessage(`${product.name} details ready to share.`);
    } catch (error) {
      if (error?.name !== "AbortError") {
        setStatusMessage("Could not share this product right now.");
      }
    }
  }

  async function persistProductImages(product, nextImageUrls) {
    const cleaned = nextImageUrls.map(normalizeUrl).filter(Boolean);
    const primaryImage = cleaned[0] ?? null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("products")
        .update({ image_urls: cleaned, image_url: primaryImage })
        .eq("id", product.id)
        .select()
        .single();
      if (error) {
        throw error;
      }
      const normalized = toProduct(data);
      setProducts((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
      setSelectedId(normalized.id);
      populateForm(normalized);
      setLastSyncAt(new Date().toISOString());
      return normalized;
    }

    const normalized = toProduct({
      ...product,
      image_urls: cleaned,
      image_url: primaryImage
    });
    setProducts((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
    return normalized;
  }

  async function handleAddDetailImages(product, files) {
    if (!canManage) {
      setStatusMessage("Sign in first to manage product photos.");
      return;
    }

    setUploadBusy(true);
    setUploadError("");
    try {
      if (isSupabaseConfigured) {
        const uploadedUrls = [];
        for (const file of files) {
          const path = buildProductImagePath(product.sku, file.name);
          const { error: storageError } = await supabase.storage.from(PRODUCT_STORAGE_BUCKET).upload(path, file, { upsert: false });
          if (storageError) {
            throw storageError;
          }
          const { data: publicUrlData } = supabase.storage.from(PRODUCT_STORAGE_BUCKET).getPublicUrl(path);
          uploadedUrls.push(publicUrlData.publicUrl);
        }
        await persistProductImages(product, [...getProductImages(product), ...uploadedUrls]);
        setStatusMessage(uploadedUrls.length === 1 ? "Image added to gallery." : `${uploadedUrls.length} images added to gallery.`);
      } else {
        const localUrls = files.map((file) => URL.createObjectURL(file));
        await persistProductImages(product, [...getProductImages(product), ...localUrls]);
        setStatusMessage(localUrls.length === 1 ? "Image added locally." : `${localUrls.length} images added locally.`);
      }
    } catch (error) {
      console.log("Supabase upload failed:", error);
      const message = error?.message || "Could not update this gallery.";
      setUploadError(`Upload failed: ${message}`);
      setStatusMessage(`Upload failed: ${message}`);
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleDeleteDetailImage(product, imageUrlToRemove) {
    if (!canManage) {
      return;
    }

    const nextImages = getProductImages(product).filter((url) => url !== imageUrlToRemove);
    setUploadBusy(true);
    setUploadError("");
    try {
      await persistProductImages(product, nextImages);
      setStatusMessage("Image removed from gallery.");
    } catch (error) {
      setStatusMessage(error.message || "Could not remove this image.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleSetCoverImage(product, imageUrlToPromote) {
    if (!canManage) {
      return;
    }

    const images = getProductImages(product);
    const nextImages = [imageUrlToPromote, ...images.filter((url) => url !== imageUrlToPromote)];
    setUploadBusy(true);
    setUploadError("");
    try {
      await persistProductImages(product, nextImages);
      setStatusMessage("Cover image updated.");
    } catch (error) {
      setStatusMessage(error.message || "Could not update the cover image.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleSignIn() {
    if (!isSupabaseConfigured || !authEmail || !authPassword) {
      return;
    }

    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
      });
      if (error) {
        throw error;
      }
      setStatusMessage(`Signed in as ${authEmail}.`);
      setAuthPassword("");
    } catch (error) {
      setStatusMessage(error.message || "Could not sign in.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (!isSupabaseConfigured) {
      return;
    }
    await supabase.auth.signOut();
    setForm(emptyForm);
    setPublicScreen("customer");
    setSelectedId(null);
    setStatusMessage("Signed out. Customer browsing stays available, while editing is locked.");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canManage) {
      setStatusMessage("Sign in first to create or update products.");
      return;
    }

    setSaveBusy(true);

    const payload = {
      sku: generatedSku,
      slug: slugify(`${generatedSku}-${form.name}`),
      name: form.name,
      category: form.category || "Uncategorized",
      material: form.material || "Unspecified",
      quantity: Number(form.quantity || 0),
      mrp: form.mrp === "" ? null : Number(form.mrp),
      b2b_price: form.b2b === "" ? null : Number(form.b2b),
      notes: form.notes,
      image_url: form.imageUrl,
      image_urls: normalizeUrl(form.imageUrl) ? [normalizeUrl(form.imageUrl)] : []
    };

    try {
      if (isSupabaseConfigured) {
        const query = form.id
          ? supabase
              .from("products")
              .update({ ...payload, sku: selectedProduct?.sku || generatedSku })
              .eq("id", form.id)
              .select()
              .single()
          : supabase.from("products").insert(payload).select().single();

        const { data, error } = await query;
        if (error) {
          throw error;
        }

        const normalized = toProduct(data);
        setProducts((current) => {
          const exists = current.some((product) => product.id === normalized.id);
          return exists ? current.map((product) => (product.id === normalized.id ? normalized : product)) : [normalized, ...current];
        });
        setSelectedId(normalized.id);
        setLastSyncAt(new Date().toISOString());
        setStatusMessage(form.id ? `${normalized.name} updated.` : "Product added ✓");
      } else {
        const normalized = toProduct({
          id: form.id || Date.now(),
          ...(form.id ? { ...payload, sku: selectedProduct?.sku || generatedSku } : payload)
        });
        setProducts((current) => {
          const exists = current.some((product) => product.id === normalized.id);
          return exists ? current.map((product) => (product.id === normalized.id ? normalized : product)) : [normalized, ...current];
        });
        setSelectedId(normalized.id);
        setStatusMessage(form.id ? `${normalized.name} updated locally.` : "Product added ✓");
      }

      setForm(emptyForm);
      if (!form.id) {
        setSelectedId(null);
      }
      setActiveTab("products");
    } catch (error) {
      setStatusMessage(error.message || "Could not save the product.");
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!isSupabaseConfigured) {
      setStatusMessage("Photo upload needs Supabase Storage configured.");
      return;
    }

    if (!canManage) {
      setStatusMessage("Sign in first to upload product photos.");
      return;
    }

    setUploadBusy(true);
    setUploadError("");
    try {
      const path = buildProductImagePath(generatedSku || "draft", file.name);
      const { error: storageError } = await supabase.storage.from(PRODUCT_STORAGE_BUCKET).upload(path, file, { upsert: true });
      if (storageError) {
        throw storageError;
      }

      const { data } = supabase.storage.from(PRODUCT_STORAGE_BUCKET).getPublicUrl(path);
      setForm((current) => ({ ...current, imageUrl: data.publicUrl }));
      setStatusMessage("Image uploaded. Save the product to store it.");
    } catch (error) {
      console.log("Supabase upload failed:", error);
      const message = error?.message || "Image upload failed.";
      setUploadError(`Upload failed: ${message}`);
      setStatusMessage(`Upload failed: ${message}`);
    } finally {
      setUploadBusy(false);
      event.target.value = "";
    }
  }

  async function handleCsvImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!isSupabaseConfigured) {
      setStatusMessage("CSV import needs Supabase configured.");
      return;
    }

    if (!canManage) {
      setStatusMessage("Sign in first to import inventory.");
      return;
    }

    setImportBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const mappedRows = rows.map(mapSettingsCsvRowToPayload).filter(Boolean);
      const { rows: payload, duplicates } = dedupePayloadBySku(mappedRows);

      if (!payload.length) {
        setStatusMessage("No usable inventory rows were found in that CSV.");
        return;
      }
      setCsvPreviewPayload(payload);
      setCsvPreviewRows(payload.slice(0, 5));
      setCsvPreviewFileName(file.name);
      setStatusMessage(
        duplicates
          ? `Preview ready. ${payload.length} unique SKU rows found and ${duplicates} duplicate row(s) were merged.`
          : `Preview ready for ${payload.length} rows from ${file.name}.`
      );
    } catch (error) {
      setStatusMessage(error.message || "CSV import failed.");
    } finally {
      setImportBusy(false);
      event.target.value = "";
    }
  }

  async function handleConfirmCsvImport() {
    if (!csvPreviewPayload.length) {
      return;
    }

    setImportBusy(true);
    try {
      const { error } = await supabase.from("products").upsert(csvPreviewPayload, { onConflict: "sku" });
      if (error) {
        throw error;
      }

      const { data: refreshed, error: refreshError } = await supabase.from("products").select("*").order("name");
      if (refreshError) {
        throw refreshError;
      }

      const normalized = (refreshed ?? []).map(toProduct);
      setProducts(normalized);
      setSelectedId(null);
      setLastSyncAt(new Date().toISOString());
      setStatusMessage(`Imported ${csvPreviewPayload.length} rows from ${csvPreviewFileName}.`);
      setCsvPreviewPayload([]);
      setCsvPreviewRows([]);
      setCsvPreviewFileName("");
    } catch (error) {
      setStatusMessage(error.message || "CSV import failed.");
    } finally {
      setImportBusy(false);
    }
  }

  function handleClearCsvPreview() {
    setCsvPreviewPayload([]);
    setCsvPreviewRows([]);
    setCsvPreviewFileName("");
    setStatusMessage("CSV preview cleared.");
  }

  async function handleArchiveToggle(product, archived) {
    if (!canManage) {
      setStatusMessage("Sign in first to archive or restore products.");
      return;
    }

    setArchiveBusy(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from("products")
          .update({ archived_at: archived ? new Date().toISOString() : null })
          .eq("id", product.id)
          .select()
          .single();
        if (error) {
          throw error;
        }

        const normalized = toProduct(data);
        setProducts((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
        setSelectedId(normalized.id);
        setLastSyncAt(new Date().toISOString());
        setStatusMessage(archived ? `${product.name} archived.` : `${product.name} restored.`);
      } else {
        setProducts((current) =>
          current.map((item) =>
            item.id === product.id ? { ...item, archivedAt: archived ? new Date().toISOString() : null } : item
          )
        );
        setStatusMessage(archived ? `${product.name} archived locally.` : `${product.name} restored locally.`);
      }
    } catch (error) {
      setStatusMessage(error.message || "Could not update archive status.");
    } finally {
      setArchiveBusy(false);
    }
  }

  async function handleInquiryStatusUpdate(inquiry, nextStatus) {
    setInquiryBusy(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from("inquiries")
          .update({ status: nextStatus })
          .eq("id", inquiry.id)
          .select("*, inquiry_items(*)")
          .single();
        if (error) {
          throw error;
        }
        const normalized = toInquiry(data);
        setInquiries((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
      } else {
        setInquiries((current) => current.map((item) => (item.id === inquiry.id ? { ...item, status: nextStatus } : item)));
      }
      setStatusMessage(`${inquiry.customerName} moved to ${formatInquiryStatus(nextStatus)}.`);
    } catch (error) {
      setStatusMessage(error.message || "Could not update inquiry status.");
    } finally {
      setInquiryBusy(false);
    }
  }

  useEffect(() => {
    setCategoryFilter("All");
    setSearch("");
  }, [activeTab, publicScreen]);

  const statsItems = [
    { label: "Products", value: stats.totalProducts },
    { label: "Units", value: stats.totalUnits },
    { label: "Low stock", value: stats.lowStock, emphasis: stats.lowStock > 0 },
    { label: "With photos", value: stats.withImages }
  ];

  const lastSyncLabel = lastSyncAt
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(lastSyncAt))
    : "Not synced yet";

  const featuredCustomerProduct = customerCatalog.find((product) => getProductImages(product).length) || customerCatalog[0] || null;
  const generatedSku = form.id ? selectedProduct?.sku || "" : getNextSku(products, form.material, form.category);
  const activeTicker = TICKER_MESSAGES[headerTickerIndex];

  function handleTickerAction(action) {
    if (action === "collection") {
      handleScrollToCollection();
      return;
    }
    if (action === "whatsapp" && typeof window !== "undefined") {
      window.open(BULK_WHATSAPP_LINK, "_blank", "noopener,noreferrer");
    }
  }

  if (!authReady) {
    return (
      <div className="app-shell">
        <div className="screen-shell">
          <StatusStrip statusMessage="Restoring your session..." />
        </div>
      </div>
    );
  }

  const rootElement = !adminActive && publicScreen === "admin-auth" ? (
    <div className="app-shell">
      <div className="screen-shell">
        <ScreenHeader
          eyebrow="Decorbeats"
          title="Admin sign in"
          subtitle="Sign in with your admin email and password to unlock inventory management."
          action={
            <button type="button" className="ghost-button" onClick={() => setPublicScreen("customer")}>
              Back
            </button>
          }
        />
        <StatusStrip statusMessage={statusMessage} />
        <AuthPanel
          email={authEmail}
          setEmail={setAuthEmail}
          password={authPassword}
          setPassword={setAuthPassword}
          authBusy={authBusy}
          userEmail={userEmail}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      </div>
    </div>
  ) : !adminActive || previewCustomerView ? (
    <div className="customer-page">
      <AnnouncementBar />
      <CustomerHeader
        scrolled={customerHeaderElevated}
        tickerMessage={activeTicker.text}
        tickerAction={activeTicker.action}
        tickerVisible={headerTickerVisible}
        onSearchTap={handleFocusCustomerSearch}
        onTickerAction={handleTickerAction}
      />
      <main className="customer-main">
        {adminActive && previewCustomerView ? <CustomerPreviewBanner onBack={() => {
          setPreviewCustomerView(false);
          setActiveTab("products");
        }} /> : null}
        <CustomerHero featuredProduct={featuredCustomerProduct} onShop={handleScrollToCollection} />
        <TrustStrip productCount={stats.totalProducts} />
        <section className="customer-catalog-shell" ref={productGridRef}>
          <div className="customer-collections-head desktop-reveal">
            <div>
              <p className="eyebrow">Collections</p>
              <h2>Browse the Collection</h2>
            </div>
          </div>
          <div className="customer-filter-bar">
            <CustomerCategoryBar categories={categories} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />
            <div className="customer-search-row">
              <input
                ref={customerSearchRef}
                className="customer-search-input"
                type="search"
                placeholder="Search the collection"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <FeaturedCategoriesRow
            products={customerCatalog}
            onSelectCategory={setCategoryFilter}
            onShop={handleScrollToCollection}
          />
          <EditorialSection />
          <section className="customer-product-grid">
            {filteredProducts.map((product) => (
              <CustomerProductCard key={product.id} product={product} onSelect={handleProductSelect} />
            ))}
          </section>
        </section>
        <CustomerFooter onAdmin={() => setPublicScreen("admin-auth")} showAdminLink={!adminActive} />
      </main>
      <CustomerSheet product={selectedProduct} onClose={() => setSelectedId(null)} onShare={handleShareProduct} />
    </div>
  ) : (
    <div className="app-shell app-shell-admin">
      <div className="screen-shell admin-shell">
        <ScreenHeader
          eyebrow="Decorbeats Admin"
          title={
            activeTab === "products"
              ? "Products"
              : activeTab === "inquiries"
                ? "Inquiries"
              : activeTab === "add"
                ? "Add or edit"
                : activeTab === "low-stock"
                  ? "Low stock"
                  : "Settings"
          }
          subtitle={
            activeTab === "products"
              ? "Browse and edit the full catalog."
              : activeTab === "inquiries"
                ? "Track customer requests, quotes, and conversions."
              : activeTab === "add"
                ? "Create products, update details, and add imagery."
                : activeTab === "low-stock"
                  ? "Focus on products that need replenishment."
                  : "Import stock, manage archive visibility, and control access."
          }
          action={<div className="user-badge">{userEmail ? `Signed in: ${userEmail}` : "Local admin mode"}</div>}
        />

        {activeTab === "products" ? (
          <>
            <button type="button" className="primary-button quick-add-button" onClick={() => setActiveTab("add")}>
              Add Product
            </button>
            <StatusStrip statusMessage={statusMessage} />
            <StatStrip items={statsItems} />
            <CatalogSection
              products={filteredProducts}
              customerMode={false}
              selectedId={selectedId}
              canManage={canManage}
              onSelect={handleProductSelect}
              onEdit={handleEditProduct}
              onShare={handleShareProduct}
              onArchiveToggle={handleArchiveToggle}
              onInlineEdit={handleDetailEdit}
              onInlineAddImages={handleAddDetailImages}
              onInlineDeleteImage={handleDeleteDetailImage}
              onInlineSetCoverImage={handleSetCoverImage}
              imageBusy={uploadBusy}
              uploadError={uploadError}
              saveBusy={saveBusy}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              categories={categories}
              archivedVisible={showArchived}
            />
          </>
        ) : null}

        {activeTab === "inquiries" ? (
          <>
            <StatusStrip statusMessage={statusMessage} />
            <InquiriesScreen
              inquiries={filteredInquiries}
              statusFilter={inquiryStatusFilter}
              setStatusFilter={setInquiryStatusFilter}
              expandedInquiryId={expandedInquiryId}
              onToggleInquiry={(id) => setExpandedInquiryId((current) => (current === id ? null : id))}
              onStatusUpdate={handleInquiryStatusUpdate}
              onNewInquiry={handleNewInquiry}
              busy={inquiryBusy}
            />
          </>
        ) : null}

        {activeTab === "add" ? (
          <section className="stack-grid">
            <StatusStrip statusMessage={statusMessage} />
            <ProductForm
              form={form}
              setForm={setForm}
              generatedSku={generatedSku}
              onSubmit={handleSubmit}
              onReset={() => setForm(emptyForm)}
              uploadBusy={uploadBusy}
              saveBusy={saveBusy}
              onFileChange={handleFileChange}
            />
            <ArchivePanel
              product={selectedProduct}
              archiveBusy={archiveBusy}
              onArchive={(product) => handleArchiveToggle(product, true)}
              onRestore={(product) => handleArchiveToggle(product, false)}
            />
            <DetailPanel
              product={selectedProduct}
              customerMode={false}
              canManage={canManage}
              onEdit={handleDetailEdit}
              onShare={handleShareProduct}
              onAddImages={handleAddDetailImages}
              onDeleteImage={handleDeleteDetailImage}
              onSetCoverImage={handleSetCoverImage}
              imageBusy={uploadBusy}
              uploadError={uploadError}
              saveBusy={saveBusy}
            />
          </section>
        ) : null}

        {activeTab === "low-stock" ? (
          <>
            <StatusStrip
              statusMessage={statusMessage}
              items={[
                { label: "Low stock items", value: lowStockCatalog.filter((product) => !product.archivedAt || showArchived).length },
                { label: "Archived shown", value: showArchived ? "Yes" : "No" }
              ]}
            />
            <CatalogSection
              products={filteredProducts}
              customerMode={false}
              selectedId={selectedId}
              canManage={canManage}
              onSelect={handleProductSelect}
              onEdit={handleEditProduct}
              onShare={handleShareProduct}
              onArchiveToggle={handleArchiveToggle}
              onInlineEdit={handleDetailEdit}
              onInlineAddImages={handleAddDetailImages}
              onInlineDeleteImage={handleDeleteDetailImage}
              onInlineSetCoverImage={handleSetCoverImage}
              imageBusy={uploadBusy}
              uploadError={uploadError}
              saveBusy={saveBusy}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              categories={categories}
              archivedVisible={showArchived}
            />
          </>
        ) : null}

        {activeTab === "settings" ? (
          <section className="stack-grid">
            <StatusStrip statusMessage={statusMessage} />
            <section className="panel-card admin-card settings-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Catalog</p>
                  <h3>Add Product</h3>
                </div>
              </div>
              <p className="support-copy">Jump into the product editor to create a new SKU or update an existing one.</p>
              <button type="button" className="primary-button settings-button" onClick={() => setActiveTab("add")}>
                Open Product Studio
              </button>
            </section>
            <ImportPanel
              importBusy={importBusy}
              previewRows={csvPreviewRows}
              previewFileName={csvPreviewFileName}
              previewCount={csvPreviewPayload.length}
              onFileChange={handleCsvImport}
              onConfirm={handleConfirmCsvImport}
              onClearPreview={handleClearCsvPreview}
            />
            <AccountCard userEmail={userEmail} onSignOut={handleSignOut} />
            <section className="panel-card admin-card settings-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Preview</p>
                  <h3>Customer View</h3>
                </div>
              </div>
              <p className="support-copy">See the storefront exactly as a customer sees it without signing out.</p>
              <button
                type="button"
                className="ghost-button settings-button"
                onClick={() => {
                  setPreviewCustomerView(true);
                  setSelectedId(null);
                }}
              >
                Customer View
              </button>
            </section>
            <AppInfoCard lastSyncLabel={lastSyncLabel} />
          </section>
        ) : null}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} lowStockCount={stats.lowStock} />
      <InquiryRecorderModal
        open={inquiryModalOpen}
        supportsSpeechRecognition={speechSupported}
        products={products}
        isListening={isListening}
        transcript={inquiryTranscript}
        manualTranscript={manualInquiryTranscript}
        setManualTranscript={setManualInquiryTranscript}
        step={inquiryModalStep}
        draft={inquiryDraft}
        setDraft={setInquiryDraft}
        errorMessage={inquiryModalError}
        busy={inquiryBusy}
        onStartListening={startInquiryListening}
        onStopAndProcess={processInquiryTranscript}
        onCancel={resetInquiryModal}
        onBack={() => setInquiryModalStep("record")}
        onSave={saveInquiry}
        onProductNameChange={syncInquiryProductMatch}
        onProductFieldChange={updateInquiryProductField}
        onAddProductRow={addInquiryProductRow}
        onRemoveProductRow={removeInquiryProductRow}
      />
    </div>
  );

  return rootElement;
}
