ALTER TABLE `relay_storage_connection` ADD `access_key_id` text;
--> statement-breakpoint
ALTER TABLE `relay_storage_connection` ADD `secret_access_key` text;
--> statement-breakpoint
DROP TABLE `relay_transfer_job`;
--> statement-breakpoint
CREATE TABLE `relay_transfer_job` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`storage_connection_id` text NOT NULL,
	`source_object_key` text NOT NULL,
	`target_relative_path` text NOT NULL,
	`expected_size` integer NOT NULL,
	`expected_sha256` text,
	`state` text NOT NULL,
	`delivered_size` integer,
	`delivered_sha256` text,
	`shared_folder_verified_at` integer,
	`source_delete_state` text DEFAULT 'not_ready' NOT NULL,
	`source_deleted_at` integer,
	`source_delete_retry_count` integer DEFAULT 0 NOT NULL,
	`source_delete_last_error_code` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`lease_until` integer,
	`leased_relay_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `title`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`storage_connection_id`) REFERENCES `relay_storage_connection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leased_relay_id`) REFERENCES `relay_registration`(`id`) ON UPDATE no action ON DELETE no action
);
