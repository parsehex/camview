import ollama from 'ollama'

async function main() {
	const imagePath = './cat.jpg'
	const response = await ollama.generate({
		model: 'llava',
		prompt: 'describe this image:',
		images: [imagePath],
		stream: true,
	})
	for await (const part of response) {
		process.stdout.write(part.response)
	}
}

main().catch(console.error)
