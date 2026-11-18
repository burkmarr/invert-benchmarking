import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 8080);
const mimeTypes = new Map([
	['.css', 'text/css; charset=utf-8'],
	['.geojson', 'application/geo+json'],
	['.html', 'text/html; charset=utf-8'],
	['.js', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.mjs', 'text/javascript; charset=utf-8'],
	['.pmtiles', 'application/octet-stream'],
]);

const server = createServer(async (request, response) => {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		response.writeHead(405, { Allow: 'GET, HEAD' }).end();
		return;
	}

	try {
		const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host}`);
		const decodedPath = decodeURIComponent(requestUrl.pathname);
		const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
		const filePath = resolve(root, `.${requestedPath}`);
		const relativePath = relative(root, filePath);
		if (relativePath.startsWith('..') || relativePath.startsWith(sep)) {
			response.writeHead(403).end('Forbidden');
			return;
		}

		const fileInfo = await stat(filePath);
		if (!fileInfo.isFile()) {
			response.writeHead(404).end('Not found');
			return;
		}

		const headers = {
			'Accept-Ranges': 'bytes',
			'Content-Type': mimeTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
			'Cache-Control': extname(filePath).toLowerCase() === '.pmtiles'
				? 'public, max-age=3600'
				: 'no-cache',
			'X-Content-Type-Options': 'nosniff',
		};
		const rangeHeader = request.headers.range;
		let start = 0;
		let end = fileInfo.size - 1;
		let statusCode = 200;

		if (rangeHeader) {
			const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
			if (!match || (!match[1] && !match[2])) {
				response.writeHead(416, { 'Content-Range': `bytes */${fileInfo.size}` }).end();
				return;
			}

			if (!match[1]) {
				const suffixLength = Number(match[2]);
				start = Math.max(fileInfo.size - suffixLength, 0);
			} else {
				start = Number(match[1]);
				if (match[2]) end = Number(match[2]);
			}

			if (start >= fileInfo.size || start > end) {
				response.writeHead(416, { 'Content-Range': `bytes */${fileInfo.size}` }).end();
				return;
			}

			end = Math.min(end, fileInfo.size - 1);
			statusCode = 206;
			headers['Content-Range'] = `bytes ${start}-${end}/${fileInfo.size}`;
		}

		headers['Content-Length'] = String(Math.max(end - start + 1, 0));
		response.writeHead(statusCode, headers);
		if (request.method === 'HEAD') {
			response.end();
			return;
		}

		const stream = createReadStream(filePath, { start, end });
		stream.on('error', error => {
			console.error(`Failed to stream ${filePath}:`, error);
			if (!response.headersSent) response.writeHead(500);
			response.end();
		});
		stream.pipe(response);
	} catch (error) {
		if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
			response.writeHead(404).end('Not found');
			return;
		}
		console.error('Failed to serve request:', error);
		if (!response.headersSent) response.writeHead(500);
		response.end('Internal server error');
	}
});

server.listen(port, '127.0.0.1', () => {
	console.log(`LERN BHS at http://localhost:${port}`);
	console.log('PMTiles range requests are enabled for local development.');
});
