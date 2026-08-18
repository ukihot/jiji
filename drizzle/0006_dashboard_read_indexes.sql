CREATE INDEX `timeline_title_episode_idx` ON `timeline` (`title_id`, `episode`);
--> statement-breakpoint
CREATE INDEX `timeline_item_timeline_type_sort_idx` ON `timeline_item` (`timeline_id`, `type`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `representation_cut_sort_idx` ON `representation` (`cut_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `work_assignment_assignee_target_idx` ON `work_assignment` (`assignee_id`, `target_type`, `target_id`);
--> statement-breakpoint
CREATE INDEX `event_created_at_idx` ON `event` (`created_at` DESC);
