import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const CHARACTERISTIC_TYPES = [
  "biography",
  "virtue",
  "miracle",
  "patronage",
  "martyrdom",
  "canonization",
  "legacy",
  "other",
] as const;
export type CharacteristicType = (typeof CHARACTERISTIC_TYPES)[number];

export const REVIEW_STATUSES = ["needs_review", "reviewed"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PORTRAIT_FITS = ["cover", "contain"] as const;
export type PortraitFit = (typeof PORTRAIT_FITS)[number];

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

export const saints = sqliteTable(
  "saints",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    birthYear: integer("birth_year"),
    birthYearDisplay: text("birth_year_display").notNull().default(""),
    ageAtDeath: integer("age_at_death"),
    ageAtDeathDisplay: text("age_at_death_display").notNull().default(""),
    country: text("country").notNull().default(""),
    canonizationYear: integer("canonization_year"),
    isMartyr: integer("is_martyr", { mode: "boolean" }).notNull().default(false),
    reviewStatus: text("review_status", { enum: REVIEW_STATUSES })
      .notNull()
      .default("needs_review"),
    /** Relative to the data dir, e.g. `uploads/saints/<uuid>.jpg`. Never image bytes. */
    portraitPath: text("portrait_path"),
    /** Non-destructive crop: focal point (0–100 %) and zoom (1–3). */
    portraitFocalX: real("portrait_focal_x").notNull().default(50),
    portraitFocalY: real("portrait_focal_y").notNull().default(50),
    portraitZoom: real("portrait_zoom").notNull().default(1),
    portraitFit: text("portrait_fit", { enum: PORTRAIT_FITS }).notNull().default("cover"),
    /** Library ordering (preserves import order for round-trips). */
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("saints_sort_idx").on(t.sortOrder), index("saints_portrait_idx").on(t.portraitPath)],
);

export const characteristics = sqliteTable(
  "characteristics",
  {
    saintId: text("saint_id")
      .notNull()
      .references(() => saints.id, { onDelete: "cascade", onUpdate: "cascade" }),
    id: text("id").notNull(),
    text: text("text").notNull(),
    type: text("type", { enum: CHARACTERISTIC_TYPES }).notNull().default("other"),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.saintId, t.id] }),
    index("characteristics_order_idx").on(t.saintId, t.position),
  ],
);

export const saintCategories = sqliteTable(
  "saint_categories",
  {
    saintId: text("saint_id")
      .notNull()
      .references(() => saints.id, { onDelete: "cascade", onUpdate: "cascade" }),
    category: text("category").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.saintId, t.category] }), index("saint_categories_cat_idx").on(t.category)],
);

export const patronages = sqliteTable(
  "patronages",
  {
    saintId: text("saint_id")
      .notNull()
      .references(() => saints.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [primaryKey({ columns: [t.saintId, t.position] })],
);

export const sources = sqliteTable(
  "sources",
  {
    saintId: text("saint_id")
      .notNull()
      .references(() => saints.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [primaryKey({ columns: [t.saintId, t.position] })],
);

/** Metadata about processed portrait files on disk. Several saints may share one file (duplicates). */
export const portraits = sqliteTable("portraits", {
  path: text("path").primaryKey(),
  thumbPath: text("thumb_path").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: integer("bytes").notNull(),
  sourceFormat: text("source_format").notNull(),
  createdAt: timestamps.createdAt,
});

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("collections_position_idx").on(t.position)],
);

export const collectionSaints = sqliteTable(
  "collection_saints",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade", onUpdate: "cascade" }),
    saintId: text("saint_id")
      .notNull()
      .references(() => saints.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.saintId] }),
    index("collection_saints_order_idx").on(t.collectionId, t.position),
    index("collection_saints_saint_idx").on(t.saintId),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: timestamps.updatedAt,
});
