<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { parse } from 'partial-json';
import type { StreamQuery, QueryExecutionResult, QueryExecutionParams } from '@/types/stream-query';
import { StreamQueryUtils } from '@/types/stream-query';

const props = defineProps<{
	cameraId: number | string;
	isStreaming: boolean;
	captureFrames: (count?: number) => Promise<string[]>;
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
const editFrameCount = ref(1);

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
	editFrameCount.value = 1;
};

const editExistingQuery = (query: StreamQuery) => {
	selectedQuery.value = query;
	isEditing.value = true;
	editName.value = query.name;
	editPrompt.value = query.prompt;
	editResponseType.value = query.responseType;
	editThink.value = query.think;
	editFrameCount.value = query.frameCount;
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
		think: editThink.value,
		frameCount: editFrameCount.value
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
				think: query.think,
				frameCount: query.frameCount,
				imagesFromFrontend: props.isStreaming ? await props.captureFrames(query.frameCount) : undefined,
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
		let imageData: string[] = [];

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true });

			if (isFirstLine) {
				const lines = (result + chunk).split('\n');
				// Find the first non-image line (lines that don't start with 'data:image/')
				const firstNonImageIndex = lines.findIndex(line => !line.startsWith('data:image/'));

				if (firstNonImageIndex > 0) {
					// Collect all image lines
					imageData = lines.slice(0, firstNonImageIndex).filter(line => line.startsWith('data:image/'));
					result = lines.slice(firstNonImageIndex).join('\n');
					isFirstLine = false;
				} else if (firstNonImageIndex === -1 && lines.length > 0) {
					// All lines are images, continue collecting
					imageData = lines.filter(line => line.startsWith('data:image/'));
					result = '';
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
						images: imageData
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
				images: imageData
			};
		} catch (e) {
			// Fallback to raw response if not JSON
			executionResult.value = {
				thoughts: undefined,
				value: result,
				rawResponse: result,
				timestamp: Date.now(),
				images: imageData
			};
		}
	} catch (error: any) {
		console.error('Error running query:', error);
		executionResult.value = {
			thoughts: undefined,
			value: `Error: ${error.message}`,
			rawResponse: error.message,
			timestamp: Date.now(),
			images: undefined
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
	<div class="p-4">
		<!-- Query List View -->
		<div v-if="!isEditing">
			<div class="flex justify-between items-center mb-4">
				<h3>Saved Queries</h3>
				<button @click="startNewQuery"
					class="bg-green-600 text-white border-none px-4 py-2 rounded cursor-pointer hover:bg-green-700">+ New
					Query</button>
			</div>
			<div v-if="queries.length === 0" class="text-center p-8 text-gray-600">
				<p>No queries saved yet. Create your first query to get started.</p>
			</div>
			<div v-else>
				<div v-for="query in queries" :key="query.id"
					class="flex justify-between items-center p-4 border border-gray-300 rounded mb-2 bg-white">
					<div class="query-info">
						<h4 class="mb-2 text-gray-800">{{ query.name }}</h4>
						<p class="mb-2 text-gray-600 text-sm">{{ query.prompt.slice(0, 100) }}{{ query.prompt.length > 100 ? '...' :
							'' }}</p>
						<div class="flex gap-2 text-xs">
							<span class="bg-gray-200 px-2 py-1 rounded-sm">{{ query.responseType }}</span>
							<span v-if="query.think" class="bg-green-100 text-green-800 px-2 py-1 rounded-sm">+ thoughts</span>
						</div>
					</div>
					<div class="flex gap-2">
						<button @click="runQuery(query)" :disabled="isQuerying"
							class="px-2.5 py-1.5 border-none rounded-sm cursor-pointer text-xs bg-blue-600 text-white disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-blue-700">
							{{ isQuerying ? 'Running...' : 'Run' }} </button>
						<button @click="editExistingQuery(query)"
							class="px-2.5 py-1.5 border-none rounded-sm cursor-pointer text-xs bg-yellow-400 text-gray-900 hover:bg-yellow-500">Edit</button>
						<button @click="deleteQuery(query.id)"
							class="px-2.5 py-1.5 border-none rounded-sm cursor-pointer text-xs bg-red-600 text-white hover:bg-red-700">Delete</button>
					</div>
				</div>
			</div>
		</div>
		<!-- Query Editor -->
		<div v-else class="p-4 border border-gray-300 rounded bg-white">
			<h3>{{ selectedQuery ? 'Edit Query' : 'Create New Query' }}</h3>
			<div class="mb-4">
				<label for="query-name" class="block mb-2 font-bold">Name:</label>
				<input id="query-name" v-model="editName" placeholder="Descriptive name for this query" type="text"
					class="w-full p-2 border border-gray-300 rounded text-base" />
			</div>
			<div class="mb-4">
				<label for="query-prompt" class="block mb-2 font-bold">Prompt:</label>
				<textarea id="query-prompt" v-model="editPrompt"
					placeholder="What information do you want to extract from the stream?" rows="4"
					class="w-full p-2 border border-gray-300 rounded text-base"></textarea>
			</div>
			<div class="mb-4">
				<label for="response-type" class="block mb-2 font-bold">Response Type:</label>
				<select id="response-type" v-model="editResponseType"
					class="w-full p-2 border border-gray-300 rounded text-base">
					<option value="string">String</option>
					<option value="array">Array</option>
				</select>
			</div>
			<div class="mb-4">
				<label class="flex items-center gap-2 font-normal">
					<input type="checkbox" v-model="editThink" /> Include reasoning (thoughts) </label>
			</div>
			<div class="mb-4">
				<label for="frame-count" class="block mb-2 font-bold">Number of Frames:</label>
				<input id="frame-count" v-model.number="editFrameCount" type="number" min="1" max="10"
					class="w-full p-2 border border-gray-300 rounded text-base" />
			</div>
			<div class="flex gap-2 justify-end">
				<button @click="saveQuery"
					class="px-4 py-2 border-none rounded cursor-pointer bg-green-600 text-white hover:bg-green-700">Save</button>
				<button @click="cancelEdit"
					class="px-4 py-2 border-none rounded cursor-pointer bg-gray-600 text-white hover:bg-gray-700">Cancel</button>
			</div>
		</div>
		<!-- Results Panel -->
		<div v-if="showResults && executionResult" class="mt-4 p-4 border border-gray-300 rounded bg-gray-100">
			<h4>Query Results</h4>
			<div v-if="executionResult.images && executionResult.images.length > 0" class="mb-4">
				<h5 class="mb-2 text-gray-700">Frames ({{ executionResult.images.length }}):</h5>
				<div class="flex flex-wrap gap-2 mt-2">
					<img v-for="(image, index) in executionResult.images" :key="index" :src="image"
						:alt="`Queried Frame ${index + 1}`" :title="`Frame ${index + 1}`"
						class="max-w-[40%] h-auto border border-gray-200 rounded flex-none w-[30%]" />
				</div>
			</div>
			<div v-if="executionResult.thoughts" class="mb-4">
				<h5 class="mb-2 text-gray-700">Reasoning:</h5>
				<div class="p-2 bg-white border border-gray-200 rounded whitespace-pre-wrap">{{ executionResult.thoughts }}
				</div>
			</div>
			<div class="mb-4">
				<h5 class="mb-2 text-gray-700">Result:</h5>
				<div class="p-2 bg-white border border-gray-200 rounded whitespace-pre-wrap">{{
					formatValue(executionResult.value) }}</div>
			</div>
			<!-- <div class="raw-section" v-if="executionResult.rawResponse">
				<h5>Raw Response:</h5>
				<pre class="raw-content">{{ executionResult.rawResponse }}</pre>
			</div> -->
		</div>
	</div>
</template>
