<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { parse } from 'partial-json';
import type { StreamQuery, QueryExecutionResult, QueryExecutionParams } from '@/types/stream-query';
import { StreamQueryUtils } from '@/types/stream-query';

const props = defineProps<{
	cameraId: number;
}>();

const queries = ref<StreamQuery[]>([]);
const selectedQuery = ref<StreamQuery | null>(null);
const isEditing = ref(false);
const isQuerying = ref(false);
const executionResult = ref<QueryExecutionResult | null>(null);
const showResults = ref(false);

// Form fields for editing
const editName = ref('');
const editPrompt = ref('');
const editResponseType = ref<'string' | 'array'>('string');
const editThink = ref(false);

// Load queries on mount
onMounted(() => {
	loadQueries();
});

const loadQueries = () => {
	queries.value = StreamQueryUtils.getQueriesForCamera(props.cameraId);
};

const startNewQuery = () => {
	selectedQuery.value = null;
	isEditing.value = true;
	editName.value = '';
	editPrompt.value = '';
	editResponseType.value = 'string';
	editThink.value = false;
};

const editExistingQuery = (query: StreamQuery) => {
	selectedQuery.value = query;
	isEditing.value = true;
	editName.value = query.name;
	editPrompt.value = query.prompt;
	editResponseType.value = query.responseType;
	editThink.value = query.think;
};

const saveQuery = () => {
	if (!editName.value.trim() || !editPrompt.value.trim()) {
		alert('Name and prompt are required');
		return;
	}

	const queryData = {
		name: editName.value.trim(),
		prompt: editPrompt.value.trim(),
		responseType: editResponseType.value,
		think: editThink.value
	};

	if (selectedQuery.value) {
		// Update existing query
		StreamQueryUtils.updateQuery(props.cameraId, selectedQuery.value.id, queryData);
	} else {
		// Create new query
		StreamQueryUtils.addQuery(props.cameraId, queryData);
	}

	isEditing.value = false;
	loadQueries();
};

const cancelEdit = () => {
	isEditing.value = false;
};

const deleteQuery = (queryId: string) => {
	if (confirm('Are you sure you want to delete this query?')) {
		StreamQueryUtils.deleteQuery(props.cameraId, queryId);
		loadQueries();
	}
};

const runQuery = async (query: StreamQuery) => {
	isQuerying.value = true;
	executionResult.value = null;
	showResults.value = true;

	try {
		const response = await fetch('http://localhost:3000/api/ollama/query', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt: query.prompt,
				cameraId: props.cameraId,
				responseType: query.responseType,
				think: query.think
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Backend error: ${errorText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Failed to get response reader.');
		}

		const decoder = new TextDecoder();
		let result = '';
		let isFirstLine = true;
		let imageData = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true });

			if (isFirstLine) {
				const lines = (result + chunk).split('\n');
				if (lines.length > 1) {
					imageData = lines[0];
					result = lines.slice(1).join('\n');
					isFirstLine = false;
				} else {
					result += chunk;
				}
			} else {
				result += chunk;
			}

			// Try to parse partial JSON
			try {
				const parsed = parse(result);
				if (parsed && typeof parsed === 'object') {
					executionResult.value = {
						thoughts: parsed.thoughts,
						value: parsed.value,
						rawResponse: result,
						timestamp: Date.now(),
						image: imageData
					};
				}
			} catch (e) {
				// Continue accumulating if JSON is incomplete
			}
		}

		// Final parse attempt for complete JSON
		try {
			const parsed = JSON.parse(result);
			executionResult.value = {
				thoughts: parsed.thoughts,
				value: parsed.value,
				rawResponse: result,
				timestamp: Date.now(),
				image: imageData
			};
		} catch (e) {
			// Fallback to raw response if not JSON
			executionResult.value = {
				thoughts: undefined,
				value: result,
				rawResponse: result,
				timestamp: Date.now(),
				image: imageData
			};
		}
	} catch (error: any) {
		console.error('Error running query:', error);
		executionResult.value = {
			thoughts: undefined,
			value: `Error: ${error.message}`,
			rawResponse: error.message,
			timestamp: Date.now(),
			image: undefined
		};
	} finally {
		isQuerying.value = false;
	}
};

const formatValue = (value: string | string[]): string => {
	if (Array.isArray(value)) {
		return value.join('\n');
	}
	return value;
};
</script>
<template>
	<div class="stream-query-manager">
		<!-- Query List View -->
		<div v-if="!isEditing" class="query-list-view">
			<div class="header">
				<h3>Saved Queries</h3>
				<button @click="startNewQuery" class="new-query-btn">+ New Query</button>
			</div>
			<div v-if="queries.length === 0" class="empty-state">
				<p>No queries saved yet. Create your first query to get started.</p>
			</div>
			<div v-else class="queries-list">
				<div v-for="query in queries" :key="query.id" class="query-item">
					<div class="query-info">
						<h4>{{ query.name }}</h4>
						<p class="query-preview">{{ query.prompt.slice(0, 100) }}{{ query.prompt.length > 100 ? '...' : '' }}</p>
						<div class="query-meta">
							<span class="response-type">{{ query.responseType }}</span>
							<span v-if="query.think" class="think-flag">+ thoughts</span>
						</div>
					</div>
					<div class="query-actions">
						<button @click="runQuery(query)" :disabled="isQuerying" class="run-btn"> {{ isQuerying ? 'Running...' :
							'Run' }} </button>
						<button @click="editExistingQuery(query)" class="edit-btn">Edit</button>
						<button @click="deleteQuery(query.id)" class="delete-btn">Delete</button>
					</div>
				</div>
			</div>
		</div>
		<!-- Query Editor -->
		<div v-else class="query-editor">
			<h3>{{ selectedQuery ? 'Edit Query' : 'Create New Query' }}</h3>
			<div class="form-group">
				<label for="query-name">Name:</label>
				<input id="query-name" v-model="editName" placeholder="Descriptive name for this query" type="text" />
			</div>
			<div class="form-group">
				<label for="query-prompt">Prompt:</label>
				<textarea id="query-prompt" v-model="editPrompt"
					placeholder="What information do you want to extract from the stream?" rows="4"></textarea>
			</div>
			<div class="form-group">
				<label for="response-type">Response Type:</label>
				<select id="response-type" v-model="editResponseType">
					<option value="string">String</option>
					<option value="array">Array</option>
				</select>
			</div>
			<div class="form-group">
				<label class="checkbox-label">
					<input type="checkbox" v-model="editThink" /> Include reasoning (thoughts) </label>
			</div>
			<div class="editor-actions">
				<button @click="saveQuery" class="save-btn">Save</button>
				<button @click="cancelEdit" class="cancel-btn">Cancel</button>
			</div>
		</div>
		<!-- Results Panel -->
		<div v-if="showResults && executionResult" class="results-panel">
			<h4>Query Results</h4>
			<div v-if="executionResult.image" class="image-section">
				<img :src="executionResult.image" alt="Queried Image" title="The queried image" class="query-image" />
			</div>
			<div v-if="executionResult.thoughts" class="thoughts-section">
				<h5>Reasoning:</h5>
				<div class="thoughts-content">{{ executionResult.thoughts }}</div>
			</div>
			<div class="value-section">
				<h5>Result:</h5>
				<div class="value-content">{{ formatValue(executionResult.value) }}</div>
			</div>
			<!-- <div class="raw-section" v-if="executionResult.rawResponse">
				<h5>Raw Response:</h5>
				<pre class="raw-content">{{ executionResult.rawResponse }}</pre>
			</div> -->
		</div>
	</div>
</template>
<style scoped>
.stream-query-manager {
	padding: 1rem;
}

.header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 1rem;
}

.new-query-btn {
	background-color: #28a745;
	color: white;
	border: none;
	padding: 0.5rem 1rem;
	border-radius: 4px;
	cursor: pointer;
}

.new-query-btn:hover {
	background-color: #218838;
}

.empty-state {
	text-align: center;
	padding: 2rem;
	color: #666;
}

.query-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 1rem;
	border: 1px solid #ddd;
	border-radius: 4px;
	margin-bottom: 0.5rem;
	background-color: white;
}

.query-info h4 {
	margin: 0 0 0.5rem 0;
	color: #333;
}

.query-preview {
	margin: 0 0 0.5rem 0;
	color: #666;
	font-size: 0.9rem;
}

.query-meta {
	display: flex;
	gap: 0.5rem;
	font-size: 0.8rem;
}

.response-type {
	background-color: #e9ecef;
	padding: 0.2rem 0.5rem;
	border-radius: 3px;
}

.think-flag {
	background-color: #d4edda;
	color: #155724;
	padding: 0.2rem 0.5rem;
	border-radius: 3px;
}

.query-actions {
	display: flex;
	gap: 0.5rem;
}

.run-btn,
.edit-btn,
.delete-btn {
	padding: 0.3rem 0.6rem;
	border: none;
	border-radius: 3px;
	cursor: pointer;
	font-size: 0.8rem;
}

.run-btn {
	background-color: #007bff;
	color: white;
}

.run-btn:disabled {
	background-color: #6c757d;
	cursor: not-allowed;
}

.run-btn:hover:not(:disabled) {
	background-color: #0056b3;
}

.edit-btn {
	background-color: #ffc107;
	color: #212529;
}

.edit-btn:hover {
	background-color: #e0a800;
}

.delete-btn {
	background-color: #dc3545;
	color: white;
}

.delete-btn:hover {
	background-color: #c82333;
}

.query-editor {
	padding: 1rem;
	border: 1px solid #ddd;
	border-radius: 4px;
	background-color: white;
}

.form-group {
	margin-bottom: 1rem;
}

.form-group label {
	display: block;
	margin-bottom: 0.5rem;
	font-weight: bold;
}

.form-group input,
.form-group textarea,
.form-group select {
	width: 100%;
	padding: 0.5rem;
	border: 1px solid #ddd;
	border-radius: 4px;
	font-size: 1rem;
}

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-weight: normal;
}

.editor-actions {
	display: flex;
	gap: 0.5rem;
	justify-content: flex-end;
}

.save-btn,
.cancel-btn {
	padding: 0.5rem 1rem;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.save-btn {
	background-color: #28a745;
	color: white;
}

.save-btn:hover {
	background-color: #218838;
}

.cancel-btn {
	background-color: #6c757d;
	color: white;
}

.cancel-btn:hover {
	background-color: #5a6268;
}

.results-panel {
	margin-top: 1rem;
	padding: 1rem;
	border: 1px solid #ddd;
	border-radius: 4px;
	background-color: #f8f9fa;
}

.image-section {
	margin-bottom: 1rem;
}

.image-section h5 {
	margin: 0 0 0.5rem 0;
	color: #495057;
}

.query-image {
	max-width: 40%;
	height: auto;
	border: 1px solid #dee2e6;
	border-radius: 4px;
}

.thoughts-section,
.value-section,
.raw-section {
	margin-bottom: 1rem;
}

.thoughts-section h5,
.value-section h5,
.raw-section h5 {
	margin: 0 0 0.5rem 0;
	color: #495057;
}

.thoughts-content,
.value-content {
	padding: 0.5rem;
	background-color: white;
	border: 1px solid #dee2e6;
	border-radius: 4px;
	white-space: pre-wrap;
}

.raw-content {
	font-size: 0.8rem;
	padding: 0.5rem;
	background-color: white;
	border: 1px solid #dee2e6;
	border-radius: 4px;
	overflow-x: auto;
	white-space: pre-wrap;
}
</style>
