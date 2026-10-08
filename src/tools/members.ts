import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrelloCredentials } from '../types/common.js';
import { fetchWithRetry } from '../utils/api.js';

/**
 * Register all Members API tools
 */
export function registerMembersTools(server: McpServer, credentials: TrelloCredentials) {
	// GET /members/me - Get current authenticated user
	server.tool(
		'get-me',
		{},
		async () => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields: 'id,fullName,username,initials,email',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/members/me?${queryParams}`
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
							text: `Error getting current member: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /cards/{id}/idMembers - Add a member to a card
	server.tool(
		'add-member-to-card',
		{
			cardId: z.string().describe('ID of the card'),
			memberId: z.string().describe('ID of the member to add'),
		},
		async ({ cardId, memberId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					value: memberId,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/idMembers?${queryParams}`,
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
							text: `Error adding member to card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// DELETE /cards/{id}/idMembers/{idMember} - Remove a member from a card
	server.tool(
		'remove-member-from-card',
		{
			cardId: z.string().describe('ID of the card'),
			memberId: z.string().describe('ID of the member to remove'),
		},
		async ({ cardId, memberId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/idMembers/${memberId}?${queryParams}`,
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
							text: `Error removing member from card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
