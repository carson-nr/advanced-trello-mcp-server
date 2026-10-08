import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrelloCredentials } from '../types/common.js';
import { fetchWithRetry } from '../utils/api.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Register all Cards API tools
 * Based on https://developer.atlassian.com/cloud/trello/rest/api-group-cards/
 */
export function registerCardsTools(server: McpServer, credentials: TrelloCredentials) {
	// POST /cards - Create a new card
	server.tool(
		'create-card',
		{
			name: z.string().describe('Name of the card'),
			description: z.string().optional().describe('Description of the card'),
			listId: z.string().describe('ID of the list to create the card in'),
			due: z
				.string()
				.optional()
				.describe(
					'Due date in ISO 8601 format (e.g. 2025-03-12 or 2025-03-12T18:30:00.000Z). Per Trello API docs. Optional.'
				),
			start: z.string().optional().describe('Start date in ISO 8601 format. Optional.'),
		},
		async ({ name, description, listId, due, start }) => {
			try {
				const body: Record<string, unknown> = {
					name,
					desc: description || '',
					idList: listId,
					pos: 'bottom',
				};
				if (due) body.due = due;
				if (start) body.start = start;

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards?key=${credentials.apiKey}&token=${credentials.apiToken}`,
					{
						method: 'POST',
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
							text: JSON.stringify(data),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /cards - Create multiple cards
	server.tool(
		'create-cards',
		{
			cards: z.array(
				z.object({
					name: z.string().describe('Name of the card'),
					description: z.string().optional().describe('Description of the card'),
					listId: z.string().describe('ID of the list to create the card in'),
					due: z.string().optional().describe('Due date in ISO 8601. Optional.'),
					start: z.string().optional().describe('Start date in ISO 8601. Optional.'),
				})
			),
		},
		async ({ cards }) => {
			try {
				const results = await Promise.all(
					cards.map(async (card) => {
						const body: Record<string, unknown> = {
							name: card.name,
							desc: card.description || '',
							idList: card.listId,
							pos: 'bottom',
						};
						if (card.due) body.due = card.due;
						if (card.start) body.start = card.start;

						const response = await fetchWithRetry(
							`https://api.trello.com/1/cards?key=${credentials.apiKey}&token=${credentials.apiToken}`,
							{
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify(body),
							}
						);
						return await response.json();
					})
				);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(results),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating cards: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /cards/{id} - Update a card (description, name, or both)
	server.tool(
		'update-card',
		{
			cardId: z.string().describe('ID of the card to update'),
			description: z.string().optional().describe('New description for the card (replaces existing). Use empty string to clear.'),
			name: z.string().optional().describe('New name/title for the card'),
			due: z.string().optional().describe('Due date in ISO 8601 format (e.g. 2025-03-12 or 2025-03-12T18:30:00.000Z)'),
			start: z.string().optional().describe('Start date in ISO 8601 format'),
			dueComplete: z.boolean().optional().describe('Whether the due date is marked complete'),
			idLabels: z.string().optional().describe('Comma-separated list of label IDs to set on the card'),
			idMembers: z.string().optional().describe('Comma-separated list of member IDs to assign to the card'),
			pos: z.union([z.string(), z.number()]).optional().describe('Position in the list (e.g. "top", "bottom", or a number)'),
			closed: z.boolean().optional().describe('Close (archive) or reopen the card'),
		},
		async ({ cardId, description, name, due, start, dueComplete, idLabels, idMembers, pos, closed }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const body: Record<string, unknown> = {};
				if (description !== undefined) body.desc = description;
				if (name !== undefined) body.name = name;
				if (due !== undefined) body.due = due;
				if (start !== undefined) body.start = start;
				if (dueComplete !== undefined) body.dueComplete = dueComplete;
				if (idLabels !== undefined) body.idLabels = idLabels;
				if (idMembers !== undefined) body.idMembers = idMembers;
				if (pos !== undefined) body.pos = pos;
				if (closed !== undefined) body.closed = closed;

				if (Object.keys(body).length === 0) {
					return {
						content: [
							{
								type: 'text',
								text: 'At least one update parameter must be provided',
							},
						],
						isError: true,
					};
				}

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}?key=${credentials.apiKey}&token=${credentials.apiToken}`,
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
							text: JSON.stringify(data),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error updating card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /cards/{id}/idList - Move card to another list
	server.tool(
		'move-card',
		{
			cardId: z.string().describe('ID of the card to move'),
			listId: z.string().describe('ID of the destination list'),
			position: z.string().optional().describe('Position in the list (e.g. "top", "bottom")'),
		},
		async ({ cardId, listId, position = 'bottom' }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}?key=${credentials.apiKey}&token=${credentials.apiToken}`,
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							idList: listId,
							pos: position,
						}),
					}
				);
				const data = await response.json();
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error moving card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /cards - Move multiple cards
	server.tool(
		'move-cards',
		{
			cards: z.array(
				z.object({
					cardId: z.string().describe('ID of the card to move'),
					listId: z.string().describe('ID of the destination list'),
					position: z.string().optional().describe('Position in the list (e.g. "top", "bottom")'),
				})
			),
		},
		async ({ cards }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const results = await Promise.all(
					cards.map(async (card) => {
						const response = await fetchWithRetry(
							`https://api.trello.com/1/cards/${card.cardId}?key=${credentials.apiKey}&token=${credentials.apiToken}`,
							{
								method: 'PUT',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify({
									idList: card.listId,
									pos: card.position || 'bottom',
								}),
							}
						);
						return await response.json();
					})
				);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(results),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error moving cards: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /cards/{id}/actions/comments - Add comment to card
	server.tool(
		'add-comment',
		{
			cardId: z.string().describe('ID of the card to comment on'),
			text: z.string().describe('Comment text'),
		},
		async ({ cardId, text }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/actions/comments?key=${credentials.apiKey}&token=${credentials.apiToken}`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							text,
						}),
					}
				);
				const data = await response.json();
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error adding comment: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /cards/{id}/actions/comments - Add multiple comments
	server.tool(
		'add-comments',
		{
			comments: z.array(
				z.object({
					cardId: z.string().describe('ID of the card to comment on'),
					text: z.string().describe('Comment text'),
				})
			),
		},
		async ({ comments }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const results = await Promise.all(
					comments.map(async (comment) => {
						const response = await fetchWithRetry(
							`https://api.trello.com/1/cards/${comment.cardId}/actions/comments?key=${credentials.apiKey}&token=${credentials.apiToken}`,
							{
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify({
									text: comment.text,
								}),
							}
						);
						return await response.json();
					})
				);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(results),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error adding comments: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /boards/{boardId}/cards → filter by idShort
	server.tool(
		'get-card-by-short-id',
		{
			boardId: z.string().describe('ID of the board to search'),
			shortId: z.number().describe('The numeric short ID of the card (the ### in the {PREFIX}-### card name)'),
		},
		async ({ boardId, shortId }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [{ type: 'text' as const, text: 'Trello API credentials are not configured' }],
						isError: true,
					};
				}

				const url = new URL(`https://api.trello.com/1/boards/${boardId}/cards`);
				url.searchParams.append('key', credentials.apiKey);
				url.searchParams.append('token', credentials.apiToken);
				url.searchParams.append('fields', 'id,idShort,name,shortLink,shortUrl,url,desc,idList,labels,closed');
				url.searchParams.append('filter', 'all');

				const response = await fetchWithRetry(url.toString());
				const cards = await response.json();

				const match = cards.find((c: any) => c.idShort === shortId);

				if (!match) {
					return {
						content: [{ type: 'text' as const, text: `No card found with idShort ${shortId} on board ${boardId}` }],
						isError: true,
					};
				}

				return {
					content: [{ type: 'text' as const, text: JSON.stringify(match) }],
				};
			} catch (error) {
				return {
					content: [{ type: 'text' as const, text: `Error looking up card by short ID: ${error}` }],
					isError: true,
				};
			}
		}
	);

	// GET /lists/{id}/cards - Get tickets by list (alias for get-list-cards)
	server.tool(
		'get-tickets-by-list',
		{
			listId: z.string().describe('ID of the list to get tickets from'),
			limit: z.number().optional().describe('Maximum number of cards to return'),
		},
		async ({ listId, limit }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const url = new URL(`https://api.trello.com/1/lists/${listId}/cards`);
				url.searchParams.append('key', credentials.apiKey);
				url.searchParams.append('token', credentials.apiToken);
				if (limit) url.searchParams.append('limit', limit.toString());

				const response = await fetchWithRetry(url.toString());
				const data = await response.json();
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting tickets by list: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /cards/{id}/closed - Archive a card
	server.tool(
		'archive-card',
		{
			cardId: z.string().describe('ID of the card to archive'),
		},
		async ({ cardId }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}?key=${credentials.apiKey}&token=${credentials.apiToken}`,
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							closed: true,
						}),
					}
				);
				const data = await response.json();
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error archiving card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /cards - Archive multiple cards
	server.tool(
		'archive-cards',
		{
			cardIds: z.array(z.string()).describe('IDs of the cards to archive'),
		},
		async ({ cardIds }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return {
						content: [
							{
								type: 'text',
								text: 'Trello API credentials are not configured',
							},
						],
						isError: true,
					};
				}

				const results = await Promise.all(
					cardIds.map(async (cardId) => {
						const response = await fetchWithRetry(
							`https://api.trello.com/1/cards/${cardId}?key=${credentials.apiKey}&token=${credentials.apiToken}`,
							{
								method: 'PUT',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify({
									closed: true,
								}),
							}
						);
						return await response.json();
					})
				);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(results),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error archiving cards: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /cards/{id}/attachments - List card attachments
	server.tool(
		'get-card-attachments',
		{
			cardId: z.string().describe('ID of the card to get attachments from'),
		},
		async ({ cardId }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return { content: [{ type: 'text' as const, text: 'Trello API credentials are not configured' }], isError: true };
				}

				const url = new URL(`https://api.trello.com/1/cards/${cardId}/attachments`);
				url.searchParams.append('key', credentials.apiKey);
				url.searchParams.append('token', credentials.apiToken);

				const response = await fetchWithRetry(url.toString());
				const attachments = await response.json();

				// Also fetch comments to map attachments to comments
				const actionsUrl = new URL(`https://api.trello.com/1/cards/${cardId}/actions`);
				actionsUrl.searchParams.append('key', credentials.apiKey);
				actionsUrl.searchParams.append('token', credentials.apiToken);
				actionsUrl.searchParams.append('filter', 'commentCard');

				const actionsResponse = await fetchWithRetry(actionsUrl.toString());
				const comments = await actionsResponse.json();

				// Map attachment URLs mentioned in comments
				const attachmentCommentMap: Record<string, string> = {};
				for (const comment of comments) {
					const text: string = comment.data?.text || '';
					for (const att of attachments) {
						if (text.includes(att.name) || text.includes(att.id)) {
							attachmentCommentMap[att.id] = text;
						}
					}
				}

				const summary = attachments.map((att: any) => ({
					id: att.id,
					name: att.name,
					mimeType: att.mimeType,
					bytes: att.bytes,
					date: att.date,
					isUpload: att.isUpload,
					url: att.url,
					commentContext: attachmentCommentMap[att.id] || null,
				}));

				return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
			} catch (error) {
				return { content: [{ type: 'text' as const, text: `Error getting attachments: ${error}` }], isError: true };
			}
		}
	);

	// Download all image attachments from a card to a local folder
	server.tool(
		'download-card-attachments',
		{
			cardId: z.string().describe('ID of the card to download attachments from'),
			savePath: z.string().describe('Local directory path to save attachments to'),
			imagesOnly: z.boolean().optional().describe('Only download image files (default: true)'),
		},
		async ({ cardId, savePath, imagesOnly = true }) => {
			try {
				if (!credentials.apiKey || !credentials.apiToken) {
					return { content: [{ type: 'text' as const, text: 'Trello API credentials are not configured' }], isError: true };
				}

				// Fetch card info
				const cardUrl = new URL(`https://api.trello.com/1/cards/${cardId}`);
				cardUrl.searchParams.append('key', credentials.apiKey);
				cardUrl.searchParams.append('token', credentials.apiToken);
				cardUrl.searchParams.append('fields', 'name,desc,shortUrl');
				const cardResponse = await fetchWithRetry(cardUrl.toString());
				const card = await cardResponse.json();

				// Fetch attachments
				const attUrl = new URL(`https://api.trello.com/1/cards/${cardId}/attachments`);
				attUrl.searchParams.append('key', credentials.apiKey);
				attUrl.searchParams.append('token', credentials.apiToken);
				const attResponse = await fetchWithRetry(attUrl.toString());
				const attachments = await attResponse.json();

				// Fetch comments for context
				const actionsUrl = new URL(`https://api.trello.com/1/cards/${cardId}/actions`);
				actionsUrl.searchParams.append('key', credentials.apiKey);
				actionsUrl.searchParams.append('token', credentials.apiToken);
				actionsUrl.searchParams.append('filter', 'commentCard');
				const actionsResponse = await fetchWithRetry(actionsUrl.toString());
				const comments = await actionsResponse.json();

				// Filter to images if needed
				const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
				const filtered = imagesOnly
					? attachments.filter((a: any) => a.mimeType && IMAGE_MIMES.includes(a.mimeType))
					: attachments;

				if (filtered.length === 0) {
					return { content: [{ type: 'text' as const, text: `No ${imagesOnly ? 'image ' : ''}attachments found on card "${card.name}"` }] };
				}

				// Ensure output directory
				await fs.mkdir(savePath, { recursive: true });

				// Download each attachment
				const manifest: Array<{
					file: string;
					originalName: string;
					mimeType: string;
					bytes: number;
					date: string;
					commentContext: string | null;
				}> = [];

				// OAuth header for Trello file downloads (query params return 401)
				const authHeader = `OAuth oauth_consumer_key="${credentials.apiKey}", oauth_token="${credentials.apiToken}"`;

				for (let i = 0; i < filtered.length; i++) {
					const att = filtered[i];

					const fileResponse = await fetchWithRetry(att.url, {
						headers: { 'Authorization': authHeader },
					});
					const buffer = Buffer.from(await fileResponse.arrayBuffer());

					// Sanitize filename: {index}-{original_name}
					const baseName = att.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, '_');
					const fileName = `${String(i + 1).padStart(2, '0')}-${baseName}`;
					const filePath = path.join(savePath, fileName);

					await fs.writeFile(filePath, buffer);

					// Find comment context
					let commentContext: string | null = null;
					for (const comment of comments) {
						const text: string = comment.data?.text || '';
						if (text.includes(att.name) || text.includes(att.id)) {
							commentContext = text;
							break;
						}
					}

					manifest.push({
						file: fileName,
						originalName: att.name,
						mimeType: att.mimeType,
						bytes: buffer.length,
						date: att.date,
						commentContext,
					});
				}

				// Write manifest
				const manifestData = {
					card: { id: cardId, name: card.name, description: card.desc, url: card.shortUrl },
					downloadedAt: new Date().toISOString(),
					files: manifest,
				};
				await fs.writeFile(
					path.join(savePath, '_manifest.json'),
					JSON.stringify(manifestData, null, 2),
					'utf-8'
				);

				return {
					content: [{
						type: 'text' as const,
						text: JSON.stringify({
							savedTo: savePath,
							card: card.name,
							filesDownloaded: manifest.length,
							files: manifest.map(m => ({ file: m.file, mimeType: m.mimeType, bytes: m.bytes, commentContext: m.commentContext })),
						}, null, 2),
					}],
				};
			} catch (error) {
				return { content: [{ type: 'text' as const, text: `Error downloading attachments: ${error}` }], isError: true };
			}
		}
	);

	// GET /cards/{id} - Get a single card
	server.tool(
		'get-card',
		{
			cardId: z.string().describe('ID of the card'),
			fields: z.string().optional().describe('Comma-separated list of fields to include. Default: "id,idShort,name,desc,url,closed,idList,labels,due,start,dueComplete,idMembers,pos"'),
		},
		async (params) => {
			try {
				const fields = params.fields || 'id,idShort,name,desc,url,closed,idList,labels,due,start,dueComplete,idMembers,pos';

				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					fields,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${params.cardId}?${queryParams}`
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
							text: `Error getting card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /cards - Copy a card
	server.tool(
		'copy-card',
		{
			idCardSource: z.string().describe('ID of the card to copy from'),
			idList: z.string().describe('ID of the list to create the copy in'),
			keepFromSource: z.string().optional().describe('What to copy from the source card. Default: "all"'),
		},
		async (params) => {
			try {
				const keepFromSource = params.keepFromSource || 'all';

				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					idCardSource: params.idCardSource,
					idList: params.idList,
					keepFromSource,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards?${queryParams}`,
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
							text: `Error copying card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// DELETE /cards/{id} - Permanently delete a card
	server.tool(
		'delete-card',
		{
			cardId: z.string().describe('ID of the card to permanently delete'),
		},
		async ({ cardId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}?${queryParams}`,
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
							text: `Error deleting card: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /search - Search for cards
	server.tool(
		'search',
		{
			query: z.string().describe('Search query text'),
			idBoards: z.string().optional().describe('Comma-separated list of board IDs to scope the search'),
			modelTypes: z.string().optional().describe('Types of models to search. Default: "cards"'),
			card_fields: z.string().optional().describe('Comma-separated list of card fields to return'),
			cards_limit: z.number().optional().describe('Maximum number of cards to return'),
		},
		async (params) => {
			try {
				const modelTypes = params.modelTypes || 'cards';

				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					query: params.query,
					modelTypes,
				});

				if (params.idBoards) queryParams.append('idBoards', params.idBoards);
				if (params.card_fields) queryParams.append('card_fields', params.card_fields);
				if (params.cards_limit !== undefined) queryParams.append('cards_limit', String(params.cards_limit));

				const response = await fetchWithRetry(
					`https://api.trello.com/1/search?${queryParams}`
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
							text: `Error searching: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// POST /cards/{id}/attachments - Add a URL attachment to a card
	server.tool(
		'add-attachment',
		{
			cardId: z.string().describe('ID of the card'),
			url: z.string().describe('URL to attach'),
			name: z.string().optional().describe('Display name for the attachment'),
		},
		async (params) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					url: params.url,
				});

				if (params.name) queryParams.append('name', params.name);

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${params.cardId}/attachments?${queryParams}`,
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
							text: `Error adding attachment: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// DELETE /cards/{id}/attachments/{idAttachment} - Delete an attachment
	server.tool(
		'delete-attachment',
		{
			cardId: z.string().describe('ID of the card'),
			attachmentId: z.string().describe('ID of the attachment to delete'),
		},
		async ({ cardId, attachmentId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/attachments/${attachmentId}?${queryParams}`,
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
							text: `Error deleting attachment: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET /cards/{id}/actions?filter=commentCard - Get comments on a card
	server.tool(
		'get-card-comments',
		{
			cardId: z.string().describe('ID of the card'),
		},
		async ({ cardId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					filter: 'commentCard',
					fields: 'id,type,date,data,memberCreator',
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/actions?${queryParams}`
				);
				const data = await response.json();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								comments: data,
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
							text: `Error getting card comments: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PUT /cards/{id}/actions/{idAction}/comments - Update a comment
	server.tool(
		'update-comment',
		{
			cardId: z.string().describe('ID of the card'),
			actionId: z.string().describe('ID of the comment action to update'),
			text: z.string().describe('New comment text'),
		},
		async ({ cardId, actionId, text }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
					value: text,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/actions/${actionId}/comments?${queryParams}`,
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
							text: `Error updating comment: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// DELETE /cards/{id}/actions/{idAction}/comments - Delete a comment
	server.tool(
		'delete-comment',
		{
			cardId: z.string().describe('ID of the card'),
			actionId: z.string().describe('ID of the comment action to delete'),
		},
		async ({ cardId, actionId }) => {
			try {
				const queryParams = new URLSearchParams({
					key: credentials.apiKey,
					token: credentials.apiToken,
				});

				const response = await fetchWithRetry(
					`https://api.trello.com/1/cards/${cardId}/actions/${actionId}/comments?${queryParams}`,
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
							text: `Error deleting comment: ${error}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}

 