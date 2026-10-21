CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `characteristics` (
	`saint_id` text NOT NULL,
	`id` text NOT NULL,
	`text` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`saint_id`, `id`),
	FOREIGN KEY (`saint_id`) REFERENCES `saints`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `characteristics_order_idx` ON `characteristics` (`saint_id`,`position`);--> statement-breakpoint
CREATE TABLE `collection_saints` (
	`collection_id` text NOT NULL,
	`saint_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `saint_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`saint_id`) REFERENCES `saints`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_saints_order_idx` ON `collection_saints` (`collection_id`,`position`);--> statement-breakpoint
CREATE INDEX `collection_saints_saint_idx` ON `collection_saints` (`saint_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `collections_position_idx` ON `collections` (`position`);--> statement-breakpoint
CREATE TABLE `patronages` (
	`saint_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`saint_id`, `position`),
	FOREIGN KEY (`saint_id`) REFERENCES `saints`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `portraits` (
	`path` text PRIMARY KEY NOT NULL,
	`thumb_path` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`source_format` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saint_categories` (
	`saint_id` text NOT NULL,
	`category` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`saint_id`, `category`),
	FOREIGN KEY (`saint_id`) REFERENCES `saints`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saint_categories_cat_idx` ON `saint_categories` (`category`);--> statement-breakpoint
CREATE TABLE `saints` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birth_year` integer,
	`birth_year_display` text DEFAULT '' NOT NULL,
	`age_at_death` integer,
	`age_at_death_display` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`canonization_year` integer,
	`is_martyr` integer DEFAULT false NOT NULL,
	`review_status` text DEFAULT 'needs_review' NOT NULL,
	`portrait_path` text,
	`portrait_focal_x` real DEFAULT 50 NOT NULL,
	`portrait_focal_y` real DEFAULT 50 NOT NULL,
	`portrait_zoom` real DEFAULT 1 NOT NULL,
	`portrait_fit` text DEFAULT 'cover' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saints_sort_idx` ON `saints` (`sort_order`);--> statement-breakpoint
CREATE INDEX `saints_portrait_idx` ON `saints` (`portrait_path`);--> statement-breakpoint
CREATE TABLE `sources` (
	`saint_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`saint_id`, `position`),
	FOREIGN KEY (`saint_id`) REFERENCES `saints`(`id`) ON UPDATE cascade ON DELETE cascade
);
