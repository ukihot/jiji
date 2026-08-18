ALTER TABLE `person` ADD `workspace_role` text;
--> statement-breakpoint
UPDATE `person`
SET `workspace_role` = 'owner'
WHERE `id` = (
	SELECT `person_id` FROM `membership_state`
	WHERE `permission_level` = 'admin' AND `revoked_at` IS NULL
	ORDER BY `granted_at` ASC
	LIMIT 1
);
--> statement-breakpoint
UPDATE `person`
SET `workspace_role` = 'member'
WHERE `account_type` = 'internal' AND `workspace_role` IS NULL;
