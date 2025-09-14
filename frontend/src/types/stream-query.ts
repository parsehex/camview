export interface StreamQuery {
	id: string;
	name: string;
	prompt: string;
	responseType: 'string' | 'array';
	think: boolean;
	frameCount: number;
	cameraId: number;
}

export interface QueryExecutionResult {
	thoughts?: string;
	value: string | string[];
	rawResponse: string;
	timestamp: number;
	images?: string[];
}

export interface QueryExecutionParams {
	prompt: string;
	cameraId: number;
	responseType: 'string' | 'array';
	think: boolean;
	frameCount: number;
}

// Utility functions for managing queries in localStorage
export const StreamQueryUtils = {
	getQueriesForCamera(cameraId: number): StreamQuery[] {
		const key = `streamQueries-${cameraId}`;
		const stored = localStorage.getItem(key);
		return stored ? JSON.parse(stored) : [];
	},

	saveQueriesForCamera(cameraId: number, queries: StreamQuery[]): void {
		const key = `streamQueries-${cameraId}`;
		localStorage.setItem(key, JSON.stringify(queries));
	},

	addQuery(
		cameraId: number,
		query: Omit<StreamQuery, 'id' | 'cameraId'>
	): StreamQuery {
		const queries = this.getQueriesForCamera(cameraId);
		const newQuery: StreamQuery = {
			...query,
			id: crypto.randomUUID(),
			cameraId,
		};
		queries.push(newQuery);
		this.saveQueriesForCamera(cameraId, queries);
		return newQuery;
	},

	updateQuery(
		cameraId: number,
		queryId: string,
		updates: Partial<Omit<StreamQuery, 'id' | 'cameraId'>>
	): StreamQuery | null {
		const queries = this.getQueriesForCamera(cameraId);
		const index = queries.findIndex((q) => q.id === queryId);
		if (index === -1) return null;

		queries[index] = { ...queries[index], ...updates };
		this.saveQueriesForCamera(cameraId, queries);
		return queries[index];
	},

	deleteQuery(cameraId: number, queryId: string): boolean {
		const queries = this.getQueriesForCamera(cameraId);
		const filtered = queries.filter((q) => q.id !== queryId);
		if (filtered.length === queries.length) return false;

		this.saveQueriesForCamera(cameraId, filtered);
		return true;
	},

	getQuery(cameraId: number, queryId: string): StreamQuery | null {
		const queries = this.getQueriesForCamera(cameraId);
		return queries.find((q) => q.id === queryId) || null;
	},
};
