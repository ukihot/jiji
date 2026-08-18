CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`assignee_id` text,
	`due_at` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`assignee_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
