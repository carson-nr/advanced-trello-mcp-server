import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrelloCredentials } from '../types/common.js';
import { fetchWithRetry } from '../utils/api.js';

/**
 * Register all Boards API tools
 */
export function registerBoardsTools(server: McpServer, credentials: TrelloCredentials) {
	// GET /members/me/boards - Get all boards with optimized parameters
	server.tool(
		'get-boards',
		{
			fields: z.string().optional().describe('Comma-separated list of fields to include (e.g., "id,name,url"). Default: "id,name,url,closed,starred"'),
			filter: z.string().optional().describe('Filter boards by type: "open", "closed", "starred", "all". Default: "open"'),
			limit: z.number().min(1).max(100).optional().describe('Maximum number of boards to return (1-100). Default: 50'),
			organization: z.boolean().optional().describe('Include organization boards. Default: true'),
			lists: z.string().optional().describe('Include lists: "open", "closed", "all", "none". Default: "none"'),
		},
		async (params) => {
			try {
				// Default parameters to reduce response size
				const fields = params.fields || 'id,name,url,closed,starred';
				const filter = params.filter || 'open';
				const limit = params.limit || 50;
				const organization = params.organization !== false;
				const lists = params.lists || 'none';

				// Build query parameters
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields: fields,
					filter: filter,
					lists: lists,
				});

				// Add organization parameter if needed
				if (organization) {
					queryParams.append('organization', 'true');
				}

				const response = await fetchWithRetry(
					`https://api.trello.com/1/members/me/boards?${queryParams}`
				);
				const data = await response.json();

				// Apply client-side limit if needed
				const limitedData = Array.isArray(data) ? data.slice(0, limit) : data;

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								boards: limitedData,
								count: Array.isArray(limitedData) ? limitedData.length : 0,
								parameters_used: {
									fields,
									filter,
									limit,
									organization,
									lists
								},
								note: 'Use fields parameter to customize response size. Available fields: id,name,desc,closed,starred,url,shortUrl,prefs,dateLastActivity,idOrganization'
							}, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting boards: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /boards - Create a new board
	server.tool(
		'create-board',
		{
			name: z.string().describe('Name of the board'),
			desc: z.string().optional().describe('Description of the board'),
			idOrganization: z.string().optional().describe('ID of the workspace/organization to create the board in'),
			defaultLists: z.boolean().optional().describe('Create default Trello lists (To Do, Doing, Done). Default: false'),
		},
		async (params) => {
			try {
				const defaultLists = params.defaultLists ?? false;

				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					name: params.name,
					defaultLists: String(defaultLists),
				});

				if (params.desc) queryParams.append('desc', params.desc);
				if (params.idOrganization) queryParams.append('idOrganization', params.idOrganization);

				const response = await fetchWithRetry(
					`https://api.trello.com/1/boards?${queryParams}`,
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
							text: `Error creating board: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /boards/{id} - Get board details
	server.tool(
		'get-board',
		{
			boardId: z.string().describe('ID of the board'),
			fields: z.string().optional().describe('Comma-separated list of fields to include. Default: "id,name,desc,url,closed,dateLastActivity,idOrganization,prefs"'),
		},
		async (params) => {
			try {
				const fields = params.fields || 'id,name,desc,url,closed,dateLastActivity,idOrganization,prefs';

				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/boards/${params.boardId}?${queryParams}`
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
							text: `Error getting board: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /boards/{id} - Update board properties
	server.tool(
		'update-board',
		{
			boardId: z.string().describe('ID of the board to update'),
			name: z.string().optional().describe('New name for the board'),
			desc: z.string().optional().describe('New description for the board'),
			closed: z.boolean().optional().describe('Close (archive) or reopen the board'),
		},
		async (params) => {
			try {
				const body: Record<string, unknown> = {};
				if (params.name !== undefined) body.name = params.name;
				if (params.desc !== undefined) body.desc = params.desc;
				if (params.closed !== undefined) body.closed = params.closed;

				if (Object.keys(body).length === 0) {
					return {
						content: [
							{
								type: 'text',
								text: 'At least one of name, desc, or closed must be provided',
							},
						],
						isError: true,
					};
				}

				const response = await fetchWithRetry(
					`https://api.trello.com/1/boards/${params.boardId}?key=${credentials.apiKey}&token=${credentials.apiToken}`,
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(body),
					}
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
							text: `Error updating board: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /boards/{id}/labels - Get board labels
	server.tool(
		'get-board-labels',
		{
			boardId: z.string().describe('ID of the board'),
		},
		async ({ boardId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields: 'id,name,color,uses',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/boards/${boardId}/labels?${queryParams}`
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								labels: data,
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
							text: `Error getting board labels: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /boards/{id}/cards - Get all cards on a board
	server.tool(
		'get-board-cards',
		{
			boardId: z.string().describe('ID of the board'),
			fields: z.string().optional().describe('Comma-separated list of card fields. Default: "id,idShort,name,desc,url,closed,idList,labels,due,idMembers"'),
			filter: z.string().optional().describe('Filter cards: "visible", "closed", "all", "none". Default: "visible"'),
		},
		async (params) => {
			try {
				const fields = params.fields || 'id,idShort,name,desc,url,closed,idList,labels,due,idMembers';
				const filter = params.filter || 'visible';

				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields,
					filter,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/boards/${params.boardId}/cards?${queryParams}`
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								cards: data,
								count: Array.isArray(data) ? data.length : 0,
								parameters_used: { fields, filter },
							}, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting board cards: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /boards/{id}/members - Get board members
	server.tool(
		'get-board-members',
		{
			boardId: z.string().describe('ID of the board'),
		},
		async ({ boardId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields: 'id,fullName,username,initials',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/boards/${boardId}/members?${queryParams}`
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
							text: `Error getting board members: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);
} 