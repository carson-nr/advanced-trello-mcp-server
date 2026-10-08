import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrelloCredentials } from '../types/common.js';
import { fetchWithRetry } from '../utils/api.js';

/**
 * Register all Checklists API tools
 */
export function registerChecklistsTools(server: McpServer, credentials: TrelloCredentials) {
	// GET /cards/{id}/checklists - Get checklists on a card
	server.tool(
		'get-checklists',
		{
			cardId: z.string().describe('ID of the card'),
		},
		async ({ cardId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					checkItems: 'all',
					checkItem_fields: 'id,name,state,pos',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/checklists?${queryParams}`
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								checklists: data,
								count: Array.isArray(data) ? data.length : 0,
							}, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting checklists: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /cards/{id}/checklists - Create a checklist on a card
	server.tool(
		'create-checklist',
		{
			cardId: z.string().describe('ID of the card'),
			name: z.string().describe('Name of the checklist'),
		},
		async ({ cardId, name }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					name,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/checklists?${queryParams}`,
					{ method: 'POST' }
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating checklist: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /checklists/{id}/checkItems - Add an item to a checklist
	server.tool(
		'add-checkitem',
		{
			checklistId: z.string().describe('ID of the checklist'),
			name: z.string().describe('Name of the check item'),
			checked: z.boolean().optional().describe('Whether the item starts checked'),
			pos: z.union([z.string(), z.number()]).optional().describe('Position in the checklist (e.g. "top", "bottom", or a number)'),
		},
		async (params) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					name: params.name,
				});

				if (params.checked !== undefined) queryParams.append('checked', String(params.checked));
				if (params.pos !== undefined) queryParams.append('pos', String(params.pos));

				const response = await fetchWithRetry(
					`https://api.trello.com/1/checklists/${params.checklistId}/checkItems?${queryParams}`,
					{ method: 'POST' }
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error adding check item: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /cards/{idCard}/checkItem/{idCheckItem} - Update a check item
	server.tool(
		'update-checkitem',
		{
			cardId: z.string().describe('ID of the card containing the check item'),
			checkItemId: z.string().describe('ID of the check item to update'),
			name: z.string().optional().describe('New name for the check item'),
			state: z.enum(['complete', 'incomplete']).optional().describe('Check item state'),
			pos: z.union([z.string(), z.number()]).optional().describe('Position in the checklist'),
		},
		async (params) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
				});

				if (params.name !== undefined) queryParams.append('name', params.name);
				if (params.state !== undefined) queryParams.append('state', params.state);
				if (params.pos !== undefined) queryParams.append('pos', String(params.pos));

				if (!params.name && !params.state && params.pos === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: 'At least one of name, state, or pos must be provided',
							},
						],
						isError: true,
					};
				}

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${params.cardId}/checkItem/${params.checkItemId}?${queryParams}`,
					{ method: 'PUT' }
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error updating check item: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// DELETE /checklists/{id}/checkItems/{idCheckItem} - Delete a check item
	server.tool(
		'delete-checkitem',
		{
			checklistId: z.string().describe('ID of the checklist'),
			checkItemId: z.string().describe('ID of the check item to delete'),
		},
		async ({ checklistId, checkItemId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/checklists/${checklistId}/checkItems/${checkItemId}?${queryParams}`,
					{ method: 'DELETE' }
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting check item: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
