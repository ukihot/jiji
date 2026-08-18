DROP TABLE IF EXISTS `task`;
--> statement-breakpoint
CREATE TABLE `work_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`assignee_id` text NOT NULL,
	`project_position` text NOT NULL,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`assignee_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_assignment_target_unique` ON `work_assignment` (`target_type`, `target_id`);
