CREATE TABLE `production_blueprint` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`based_on_blueprint_id` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_blueprint_title_version_unique` ON `production_blueprint` (`title_id`, `version`);
--> statement-breakpoint
CREATE TABLE `process_node` (
	`id` text PRIMARY KEY NOT NULL,
	`blueprint_id` text NOT NULL,
	`capability_key` text NOT NULL,
	`representation_type` text,
	`kind` text NOT NULL,
	`required` integer NOT NULL,
	`sort_hint` integer NOT NULL,
	FOREIGN KEY (`blueprint_id`) REFERENCES `production_blueprint`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `process_edge` (
	`id` text PRIMARY KEY NOT NULL,
	`blueprint_id` text NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`relation` text NOT NULL,
	FOREIGN KEY (`blueprint_id`) REFERENCES `production_blueprint`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_node_id`) REFERENCES `process_node`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_node_id`) REFERENCES `process_node`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `studio_term` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`capability_key` text NOT NULL,
	`display_name` text NOT NULL,
	`aliases` text NOT NULL,
	`usage_note` text,
	`active_from_event_id` text NOT NULL,
	`retired_at` integer,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_gate` (
	`id` text PRIMARY KEY NOT NULL,
	`process_node_id` text NOT NULL,
	`gate_key` text NOT NULL,
	`reviewer_policy` text NOT NULL,
	`required` integer NOT NULL,
	FOREIGN KEY (`process_node_id`) REFERENCES `process_node`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gate_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`gate_id` text NOT NULL,
	`version_id` text NOT NULL,
	`version_hash` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`result` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`gate_id`) REFERENCES `review_gate`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `decision_capsule` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`decision_key` text NOT NULL,
	`decision_text` text NOT NULL,
	`status` text NOT NULL,
	`confirmed_by` text,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `decision_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`capsule_id` text NOT NULL,
	`version_id` text NOT NULL,
	`coverage` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`capsule_id`) REFERENCES `decision_capsule`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `version`(`id`) ON UPDATE no action ON DELETE no action
);
