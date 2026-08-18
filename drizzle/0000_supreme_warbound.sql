CREATE TABLE `cut` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_tags` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `timeline_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`prev_hash` text,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `membership` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`permission_level` text NOT NULL,
	`process_scope` text,
	`granted_by` text NOT NULL,
	`granted_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`revoked_by` text,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `membership_state` (
	`membership_id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`permission_level` text NOT NULL,
	`process_scope` text,
	`granted_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE TABLE `person` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`account_type` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `person_email_unique` ON `person` (`email`);--> statement-breakpoint
CREATE TABLE `representation` (
	`id` text PRIMARY KEY NOT NULL,
	`cut_id` text NOT NULL,
	`type` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`cut_id`) REFERENCES `cut`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `representation_current_version` (
	`representation_id` text PRIMARY KEY NOT NULL,
	`latest_version_id` text NOT NULL,
	`approved_version_id` text
);
--> statement-breakpoint
CREATE TABLE `review` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`result` text NOT NULL,
	`comment` text,
	`reviewed_at` integer NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seal` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`hash` text NOT NULL,
	`sealed_by` text NOT NULL,
	`sealed_at` integer NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sealed_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `share_link` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`target_cut_ids` text NOT NULL,
	`permission_level` text NOT NULL,
	`claimed_person_id` text,
	`expires_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`claimed_person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_link_token_hash_unique` ON `share_link` (`token_hash`);--> statement-breakpoint
CREATE TABLE `submission` (
	`id` text PRIMARY KEY NOT NULL,
	`cut_id` text NOT NULL,
	`representation_id` text NOT NULL,
	`process_step` text NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`cut_id`) REFERENCES `cut`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`representation_id`) REFERENCES `representation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `timeline` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`season` text NOT NULL,
	`episode` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `timeline_band_view` (
	`timeline_item_id` text PRIMARY KEY NOT NULL,
	`timeline_id` text NOT NULL,
	`item_type` text NOT NULL,
	`sort_order` integer NOT NULL,
	`offset_frames` integer NOT NULL,
	`width_frames` integer NOT NULL,
	`process_status` text
);
--> statement-breakpoint
CREATE TABLE `timeline_item` (
	`id` text PRIMARY KEY NOT NULL,
	`timeline_id` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer NOT NULL,
	`width_frames` integer,
	FOREIGN KEY (`timeline_id`) REFERENCES `timeline`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `title` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `title_representation_type` (
	`title_id` text NOT NULL,
	`type` text NOT NULL,
	PRIMARY KEY(`title_id`, `type`),
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `version` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`seq` integer NOT NULL,
	`file_ref` text NOT NULL,
	`proxy_ref` text,
	`artifact_metadata` text,
	`derived_from_version_id` text,
	`derived_from_relation` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submission`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`derived_from_version_id`) REFERENCES `version`(`id`) ON UPDATE no action ON DELETE no action
);
