import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrelloCredentials } from '../types/common.js';
import { fetchWithRetry } from '../utils/api.js';

/**
 * Register all Organizations/Workspaces API tools
 */
export function registerOrganizationsTools(server: McpServer, credentials: TrelloCredentials) {
	// GET /members/me/organizations - List workspaces for the current user
	server.tool(
		'get-organizations',
		{},
		async () => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields: 'id,name,displayName,desc,url,website',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/members/me/organizations?${queryParams}`
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								organizations: data,
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
							text: `Error getting organizations: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /organizations - Create a new workspace
	server.tool(
		'create-organization',
		{
			displayName: z.string().describe('Display name of the workspace'),
			desc: z.string().optional().describe('Description of the workspace'),
			name: z.string().optional().describe('URL slug name for the workspace'),
			website: z.string().optional().describe('Website URL for the workspace'),
		},
		async (params) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					displayName: params.displayName,
				});

				if (params.desc) queryParams.append('desc', params.desc);
				if (params.name) queryParams.append('name', params.name);
				if (params.website) queryParams.append('website', params.website);

				const response = await fetchWithRetry(
					`https://api.trello.com/1/organizations?${queryParams}`,
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
							text: `Error creating organization: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /organizations/{id}/boards - List boards in a workspace
	server.tool(
		'get-organization-boards',
		{
			organizationId: z.string().describe('ID of the workspace/organization'),
		},
		async ({ organizationId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields: 'id,name,url,closed,starred,dateLastActivity',
					filter: 'open',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/organizations/${organizationId}/boards?${queryParams}`
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								boards: data,
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
							text: `Error getting organization boards: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /organizations/{id}/members - List workspace members
	server.tool(
		'get-organization-members',
		{
			organizationId: z.string().describe('ID of the workspace/organization'),
		},
		async ({ organizationId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields: 'id,fullName,username,initials,memberType',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/organizations/${organizationId}/members?${queryParams}`
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								members: data,
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
							text: `Error getting organization members: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
