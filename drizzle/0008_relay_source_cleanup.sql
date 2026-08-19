ALTER TABLE `relay_transfer_job` ADD COLUMN `delivered_size` integer;
--> statement-breakpoint
ALTER TABLE `relay_transfer_job` ADD COLUMN `delivered_sha256` text;
--> statement-breakpoint
ALTER TABLE `relay_transfer_job` ADD COLUMN `nas_verified_at` integer;
--> statement-breakpoint
ALTER TABLE `relay_transfer_job` ADD COLUMN `source_delete_state` text DEFAULT 'not_ready' NOT NULL;
--> statement-breakpoint
ALTER TABLE `relay_transfer_job` ADD COLUMN `source_deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `relay_transfer_job` ADD COLUMN `source_delete_retry_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `relay_transfer_job` ADD COLUMN `source_delete_last_error_code` text;
--> statement-breakpoint
ALTER TABLE `relay_transfer_attempt` ADD COLUMN `actual_size` integer;
--> statement-breakpoint
ALTER TABLE `relay_transfer_attempt` ADD COLUMN `actual_sha256` text;
--> statement-breakpoint
CREATE INDEX `relay_transfer_job_source_cleanup_idx` ON `relay_transfer_job` (`storage_connection_id`, `source_object_key`, `state`, `source_delete_state`);
