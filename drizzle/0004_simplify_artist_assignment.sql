CREATE TABLE `work_assignment_next` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`assignee_id` text NOT NULL,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`assignee_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `work_assignment_next` (`id`, `target_type`, `target_id`, `assignee_id`, `assigned_at`)
SELECT `id`, `target_type`, `target_id`, `assignee_id`, `assigned_at` FROM `work_assignment`;
--> statement-breakpoint
DROP TABLE `work_assignment`;
--> statement-breakpoint
ALTER TABLE `work_assignment_next` RENAME TO `work_assignment`;
--> statement-breakpoint
CREATE UNIQUE INDEX `work_assignment_target_unique` ON `work_assignment` (`target_type`, `target_id`);
