import React, { useEffect, useMemo, useRef, useState } from "react";
import { products as seedProducts } from "./data/products";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const brandLogo = "/assets/brand/decorbeats-logo.svg";

const emptyForm = {
  id: "",
  sku: "",
  name: "",
  category: "",
  material: "",
  quantity: 0,
  unitCost: "",
  mrp: "",
  b2b: "",
  notes: "",
  driveUrl: "",
  imageUrl: ""
};

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

function toProduct(raw, index = 0) {
  const quantity = Number(raw.quantity ?? 0);
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
    imageUrl: raw.imageUrl ?? raw.image_url ?? "",
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
  if (product?.imageUrl) {
    return (
      <div className={`product-image-shell ${compact ? "compact" : ""}`}>
        <img className="product-image" src={product.imageUrl} alt={product.name} loading="lazy" />
      </div>
    );
  }

  return (
    <div className={`product-image-shell product-image-fallback ${compact ? "compact" : ""}`}>
      <span>{product?.category ?? "Decorbeats"}</span>
      <strong>{product?.material ?? "Crafted collection"}</strong>
      <small>{product?.driveUrl ? "Drive folder linked" : "Image coming soon"}</small>
    </div>
  );
}

function ProductThumb({ product }) {
  if (product?.imageUrl) {
    return (
      <div className="product-thumb">
        <img className="product-thumb-image" src={product.imageUrl} alt={product.name} loading="lazy" />
      </div>
    );
  }

  return (
    <div className="product-thumb product-thumb-fallback">
      <span>{product?.category?.slice(0, 1) || "D"}</span>
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

function AuthPanel({ email, setEmail, authBusy, userEmail, onSignIn, onSignOut }) {
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
          <button type="button" className="primary-button" disabled={authBusy} onClick={onSignIn}>
            {authBusy ? "Sending..." : "Send magic link"}
          </button>
        </div>
      )}
    </section>
  );
}

function ImportPanel({ importBusy, onFileChange }) {
  return (
    <section className="panel-card admin-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Bulk Import</p>
          <h3>Refresh inventory from CSV</h3>
        </div>
      </div>
      <p className="support-copy">Use the same spreadsheet format to refresh stock and update matching SKUs in one pass.</p>
      <label className="upload-button">
        {importBusy ? "Importing..." : "Choose inventory CSV"}
        <input type="file" accept=".csv,text/csv" onChange={onFileChange} disabled={importBusy} />
      </label>
    </section>
  );
}

function ProductForm({ form, setForm, onSubmit, onReset, uploadBusy, saveBusy, onFileChange }) {
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

      <div className="form-grid">
        <label>
          SKU
          <input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} required />
        </label>
        <label>
          Product name
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label>
          Category
          <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
        </label>
        <label>
          Material
          <input value={form.material} onChange={(event) => setForm((current) => ({ ...current, material: event.target.value }))} />
        </label>
        <label>
          Quantity
          <input type="number" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
        </label>
        <label>
          MRP
          <input type="number" value={form.mrp} onChange={(event) => setForm((current) => ({ ...current, mrp: event.target.value }))} />
        </label>
        <label>
          Unit cost
          <input type="number" value={form.unitCost} onChange={(event) => setForm((current) => ({ ...current, unitCost: event.target.value }))} />
        </label>
        <label>
          B2B price
          <input type="number" value={form.b2b} onChange={(event) => setForm((current) => ({ ...current, b2b: event.target.value }))} />
        </label>
        <label className="span-2">
          Drive folder URL
          <input value={form.driveUrl} onChange={(event) => setForm((current) => ({ ...current, driveUrl: event.target.value }))} />
        </label>
        <label className="span-2">
          Image URL
          <input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} />
        </label>
        <label className="span-2">
          Notes
          <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </label>
      </div>

      <div className="cta-row">
        <label className="upload-button secondary">
          {uploadBusy ? "Uploading..." : "Upload image"}
          <input type="file" accept="image/*" onChange={onFileChange} disabled={uploadBusy} />
        </label>
        <button type="submit" className="primary-button" disabled={saveBusy}>
          {saveBusy ? "Saving..." : form.id ? "Update product" : "Create product"}
        </button>
      </div>
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
  onInlineImageReplace,
  imageBusy,
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
          onImageReplace={onInlineImageReplace}
          imageBusy={imageBusy}
          saveBusy={saveBusy}
          inline
        />
      ) : null}
    </article>
  );
}

function DetailPanel({ product, customerMode, canManage, onEdit, onShare, onImageReplace, imageBusy, saveBusy, inline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    mrp: "",
    b2b: "",
    quantity: "",
    notes: ""
  });
  const fileInputRef = useRef(null);

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
        <button
          type="button"
          className={canManage && !customerMode ? "detail-image-button editable" : "detail-image-button"}
          onClick={() => {
            if (canManage && !customerMode) {
              fileInputRef.current?.click();
            }
          }}
        >
          <ProductImage product={product} />
          {canManage && !customerMode ? (
            <>
              <span className="detail-image-camera">
                <CameraIcon />
              </span>
              <span className="detail-image-hint">{imageBusy ? "Uploading..." : "Tap to replace photo"}</span>
            </>
          ) : null}
        </button>
        {canManage && !customerMode ? (
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImageReplace(product, file);
              }
              event.target.value = "";
            }}
          />
        ) : null}
      </div>
      <div className="section-head">
        <div>
          <h3>{product.name}</h3>
        </div>
        <span className={`stock-pill ${product.stockStatus !== "In stock" ? "warn" : ""}`}>{product.stockStatus}</span>
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
          {product.notes ? <p className="detail-note">{product.notes}</p> : null}
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
      <div className="detail-links">
        {product.imageUrl ? (
          <a className="ghost-button" href={product.imageUrl} target="_blank" rel="noreferrer">
            Open image
          </a>
        ) : null}
        {product.driveUrl ? (
          <a className="ghost-button" href={product.driveUrl} target="_blank" rel="noreferrer">
            Open Drive folder
          </a>
        ) : null}
      </div>
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
  onInlineImageReplace,
  imageBusy,
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
                onInlineImageReplace={onInlineImageReplace}
                imageBusy={imageBusy}
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
        className={activeTab === "low-stock" ? "nav-item active" : "nav-item"}
        onClick={() => setActiveTab("low-stock")}
      >
        <span className="nav-icon nav-icon-alert">
          {items[1].icon}
          {lowStockCount ? <small>{lowStockCount}</small> : null}
        </span>
        <span>Low Stock</span>
      </button>

      <button
        type="button"
        className={activeTab === "settings" ? "nav-item active" : "nav-item"}
        onClick={() => setActiveTab("settings")}
      >
        <span className="nav-icon">{items[2].icon}</span>
        <span>Settings</span>
      </button>

      <button
        type="button"
        className={activeTab === "add" ? "nav-item nav-item-add active" : "nav-item nav-item-add"}
        onClick={() => setActiveTab("add")}
        aria-label="Add"
      >
        <span className="nav-fab">
          <PlusIcon />
        </span>
        <span>Add</span>
      </button>
    </nav>
  );
}

export default function App() {
  const [products, setProducts] = useState(seedProducts.map(toProduct));
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusMessage, setStatusMessage] = useState(
    isSupabaseConfigured
      ? "Supabase is connected. Sign in to manage products, import stock, and upload imagery."
      : "Supabase env vars are not set yet, so the app is running with your local seed inventory."
  );
  const [form, setForm] = useState(emptyForm);
  const [saveBusy, setSaveBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [session, setSession] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [publicScreen, setPublicScreen] = useState("landing");
  const [activeTab, setActiveTab] = useState("products");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session ?? null);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
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
        setStatusMessage(`Loaded ${nextProducts.length} products from Supabase.`);
      } else {
        setProducts([]);
        setSelectedId(null);
        setStatusMessage("Supabase is connected. Add products manually or import your CSV.");
      }
    }

    loadProducts();

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
      setPublicScreen("landing");
      setActiveTab("products");
    }
  }, [adminActive]);

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
      withImages: products.filter((product) => !product.archivedAt && product.imageUrl).length
    };
  }, [products]);

  function populateForm(product) {
    setForm({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      material: product.material,
      quantity: product.quantity,
      unitCost: product.pricing.unitCost ?? "",
      mrp: product.pricing.mrp ?? "",
      b2b: product.pricing.b2b ?? "",
      notes: product.notes ?? "",
      driveUrl: product.driveUrl ?? "",
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

  async function handleReplaceDetailImage(product, file) {
    if (!canManage) {
      setStatusMessage("Sign in first to replace product photos.");
      return;
    }

    setUploadBusy(true);
    try {
      if (isSupabaseConfigured) {
        const extension = file.name.split(".").pop();
        const path = `${product.sku}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(path);
        const { data, error } = await supabase
          .from("products")
          .update({ image_url: publicUrlData.publicUrl })
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
        setStatusMessage("Product image updated.");
      } else {
        const imageUrl = URL.createObjectURL(file);
        setProducts((current) =>
          current.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  imageUrl
                }
              : item
          )
        );
        setStatusMessage("Product image updated locally.");
      }
    } catch (error) {
      setStatusMessage(error.message || "Could not replace this image.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleSignIn() {
    if (!isSupabaseConfigured || !authEmail) {
      return;
    }

    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) {
        throw error;
      }
      setStatusMessage(`Magic link sent to ${authEmail}. Use the newest email to sign in on this device.`);
    } catch (error) {
      setStatusMessage(error.message || "Could not send sign-in link.");
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
    setPublicScreen("landing");
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
      sku: form.sku,
      slug: slugify(`${form.sku}-${form.name}`),
      name: form.name,
      category: form.category || "Uncategorized",
      material: form.material || "Unspecified",
      quantity: Number(form.quantity || 0),
      unit_cost: form.unitCost === "" ? null : Number(form.unitCost),
      mrp: form.mrp === "" ? null : Number(form.mrp),
      b2b_price: form.b2b === "" ? null : Number(form.b2b),
      notes: form.notes,
      drive_url: form.driveUrl,
      image_url: form.imageUrl
    };

    try {
      if (isSupabaseConfigured) {
        const query = form.id
          ? supabase.from("products").update(payload).eq("id", form.id).select().single()
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
        setStatusMessage(`${normalized.name} saved to Supabase.`);
      } else {
        const normalized = toProduct({
          id: form.id || Date.now(),
          ...payload
        });
        setProducts((current) => {
          const exists = current.some((product) => product.id === normalized.id);
          return exists ? current.map((product) => (product.id === normalized.id ? normalized : product)) : [normalized, ...current];
        });
        setSelectedId(normalized.id);
        setStatusMessage(`${normalized.name} saved locally.`);
      }

      setForm(emptyForm);
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
    try {
      const extension = file.name.split(".").pop();
      const path = `${form.sku || "draft"}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((current) => ({ ...current, imageUrl: data.publicUrl }));
      setStatusMessage("Image uploaded. Save the product to store it.");
    } catch (error) {
      setStatusMessage(error.message || "Image upload failed.");
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
      const mappedRows = rows.map(mapCsvRowToPayload).filter(Boolean);
      const { rows: payload, duplicates } = dedupePayloadBySku(mappedRows);

      if (!payload.length) {
        setStatusMessage("No usable inventory rows were found in that CSV.");
        return;
      }

      const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
      if (error) {
        throw error;
      }

      const { data: refreshed, error: refreshError } = await supabase.from("products").select("*").order("name");
      if (refreshError) {
        throw refreshError;
      }

      const normalized = (refreshed ?? []).map(toProduct);
      setProducts(normalized);
      setSelectedId(normalized[0]?.id ?? null);
      setStatusMessage(
        duplicates
          ? `Imported ${payload.length} unique SKUs from ${file.name}. ${duplicates} duplicate SKU row(s) were merged.`
          : `Imported ${payload.length} rows from ${file.name}.`
      );
    } catch (error) {
      setStatusMessage(error.message || "CSV import failed.");
    } finally {
      setImportBusy(false);
      event.target.value = "";
    }
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

  const rootElement = !adminActive && publicScreen === "landing" ? (
    <div className="app-shell">
      <LandingView onAdmin={() => setPublicScreen("admin-auth")} onCustomer={() => setPublicScreen("customer")} />
    </div>
  ) : !adminActive && publicScreen === "admin-auth" ? (
    <div className="app-shell">
      <div className="screen-shell">
        <ScreenHeader
          eyebrow="Decorbeats"
          title="Admin sign in"
          subtitle="Use your approved admin email to unlock inventory management."
          action={
            <button type="button" className="ghost-button" onClick={() => setPublicScreen("landing")}>
              Back
            </button>
          }
        />
        <StatusStrip statusMessage={statusMessage} />
        <AuthPanel
          email={authEmail}
          setEmail={setAuthEmail}
          authBusy={authBusy}
          userEmail={userEmail}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      </div>
    </div>
  ) : !adminActive && publicScreen === "customer" ? (
    <div className="app-shell">
      <div className="screen-shell">
        <ScreenHeader
          eyebrow="Decorbeats Catalogue"
          title="Customer products"
          subtitle="Browse the current collection."
          action={
            <button type="button" className="ghost-button" onClick={() => setPublicScreen("landing")}>
              Back
            </button>
          }
        />
        <CatalogSection
          products={filteredProducts}
          customerMode
          onSelect={handleProductSelect}
          selectedId={selectedId}
          canManage={false}
          onEdit={() => {}}
          onShare={handleShareProduct}
          onArchiveToggle={() => {}}
          onInlineEdit={() => {}}
          onInlineImageReplace={() => {}}
          imageBusy={false}
          search={search}
          setSearch={setSearch}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
        />
      </div>
    </div>
  ) : (
    <div className="app-shell app-shell-admin">
      <div className="screen-shell admin-shell">
        <ScreenHeader
          eyebrow="Decorbeats Admin"
          title={
            activeTab === "products"
              ? "Products"
              : activeTab === "add"
                ? "Add or edit"
                : activeTab === "low-stock"
                  ? "Low stock"
                  : "Settings"
          }
          subtitle={
            activeTab === "products"
              ? "Browse and edit the full catalog."
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
              onInlineImageReplace={handleReplaceDetailImage}
              imageBusy={uploadBusy}
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

        {activeTab === "add" ? (
          <section className="stack-grid">
            <StatusStrip statusMessage={statusMessage} />
            <ProductForm
              form={form}
              setForm={setForm}
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
              onImageReplace={handleReplaceDetailImage}
              imageBusy={uploadBusy}
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
              onInlineImageReplace={handleReplaceDetailImage}
              imageBusy={uploadBusy}
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
            <StatusStrip statusMessage={statusMessage} items={statsItems} />
            <AuthPanel
              email={authEmail}
              setEmail={setAuthEmail}
              authBusy={authBusy}
              userEmail={userEmail}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
            <ImportPanel importBusy={importBusy} onFileChange={handleCsvImport} />
            <section className="panel-card admin-card settings-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Archive Visibility</p>
                  <h3>Show archived products in admin lists</h3>
                </div>
              </div>
              <p className="support-copy">Keep archived items hidden by default, or reveal them while restoring older products.</p>
              <button
                type="button"
                className={showArchived ? "filter-pill active" : "filter-pill"}
                onClick={() => setShowArchived((value) => !value)}
              >
                {showArchived ? "Hide archived products" : "Show archived products"}
              </button>
            </section>
          </section>
        ) : null}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} lowStockCount={stats.lowStock} />
    </div>
  );

  return rootElement;
}
