<script lang="ts">
	import type { WorkspaceRole } from '$lib/core/workspace-role';
	import * as m from '$lib/paraglide/messages';
	import Button from '$lib/components/Button.svelte';
	import FormSelect from '$lib/components/FormSelect.svelte';

	type Person = {
		id: string;
		name: string;
		accountType: 'internal' | 'external';
		workspaceRole: WorkspaceRole | null;
	};

	let { persons }: { persons: Person[] } = $props();
	const ROLE_LABEL: Record<WorkspaceRole, () => string> = {
		owner: m.workspace_role_owner,
		admin: m.workspace_role_admin,
		member: m.workspace_role_member,
	};
</script>

<section class="border-border bg-surface mt-6 overflow-x-auto rounded-lg border">
	<h2 class="text-foreground border-border border-b px-4 py-3 text-sm font-semibold">
		{m.workspace_role_heading()}
	</h2>
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-border text-muted border-b text-left">
				<th class="px-4 py-2 font-medium">{m.label_name()}</th>
				<th class="px-4 py-2 font-medium">{m.label_workspace_role()}</th>
				<th class="px-4 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each persons.filter((person) => person.accountType === 'internal') as person (person.id)}
				<tr class="border-border border-b last:border-0">
					<td class="text-foreground px-4 py-2.5">{person.name}</td>
					<td class="px-4 py-2.5">
						{person.workspaceRole
							? ROLE_LABEL[person.workspaceRole]()
							: m.workspace_role_participant()}
					</td>
					<td class="px-4 py-2.5 text-right">
						{#if person.workspaceRole === 'owner'}
							<span class="text-muted text-xs">{m.workspace_role_owner()}</span>
						{:else}
							<form
								method="POST"
								action="?/updateWorkspaceRole"
								class="inline-flex items-center gap-1.5"
							>
								<input type="hidden" name="personId" value={person.id} />
								<FormSelect name="workspaceRole" compact>
									<option value="member" selected={person.workspaceRole !== 'admin'}
										>{m.workspace_role_member()}</option
									>
									<option value="admin" selected={person.workspaceRole === 'admin'}
										>{m.workspace_role_admin()}</option
									>
								</FormSelect>
								<Button type="submit" variant="outline">{m.action_update()}</Button>
							</form>
							{#if person.workspaceRole === 'admin'}
								<form method="POST" action="?/transferOwnership" class="ml-1 inline">
									<input type="hidden" name="personId" value={person.id} />
									<Button type="submit" variant="outline">{m.workspace_role_transfer()}</Button>
								</form>
							{/if}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
