ALTER TABLE `person` ADD COLUMN `relay_enabled` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE `relay_storage_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text,
	`region` text,
	`bucket_or_container` text NOT NULL,
	`prefix` text NOT NULL,
	`auth_ref` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relay_registration` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`storage_connection_id` text NOT NULL,
	`browser_instance_id` text NOT NULL,
	`display_name` text NOT NULL,
	`registered_by` text NOT NULL,
	`allowed_root_key` text NOT NULL,
	`writable` integer DEFAULT false NOT NULL,
	`last_heartbeat_at` integer,
	`last_error_code` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`storage_connection_id`) REFERENCES `relay_storage_connection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registered_by`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relay_registration_title_browser_unique` ON `relay_registration` (`title_id`, `browser_instance_id`);
--> statement-breakpoint
CREATE INDEX `relay_registration_title_heartbeat_idx` ON `relay_registration` (`title_id`, `last_heartbeat_at` DESC);
--> statement-breakpoint
CREATE TABLE `relay_transfer_job` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`storage_connection_id` text NOT NULL,
	`source_object_key` text NOT NULL,
	`target_relative_path` text NOT NULL,
	`expected_size` integer NOT NULL,
	`expected_sha256` text NOT NULL,
	`state` text NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`lease_until` integer,
	`leased_relay_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`storage_connection_id`) REFERENCES `relay_storage_connection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leased_relay_id`) REFERENCES `relay_registration`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `relay_transfer_job_dispatch_idx` ON `relay_transfer_job` (`storage_connection_id`, `state`, `lease_until`, `created_at`);
--> statement-breakpoint
CREATE TABLE `relay_transfer_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`relay_id` text NOT NULL,
	`lease_token` text NOT NULL,
	`result` text NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `relay_transfer_job`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relay_id`) REFERENCES `relay_registration`(`id`) ON UPDATE no action ON DELETE no action
);
