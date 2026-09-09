const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const script = fs.readFileSync(path.resolve(__dirname, '..', 'media/script.js'), 'utf8');
const markup = fs.readFileSync(path.resolve(__dirname, '..', 'media/analyzer.html'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '..', 'media/style.css'), 'utf8');

function createJQueryStub() {
	const chain = {
		addClass() { return chain; },
		append() { return chain; },
		appendTo() { return chain; },
		attr() { return chain; },
		clone() { return chain; },
		empty() { return chain; },
		first() { return chain; },
		find() { return chain; },
		hasClass() { return false; },
		hide() { return chain; },
		ready() { return chain; },
		removeClass() { return chain; },
		show() { return chain; },
		text() { return chain; },
		val() { return ''; },
		on() { return chain; },
		off() { return chain; },
		toggleClass() { return chain; }
	};
	return () => chain;
}

const context = {
	acquireVsCodeApi() { return { postMessage() {} }; },
	atob(value) { return Buffer.from(value, 'base64').toString('binary'); },
	console,
	document: {},
	fetch() { throw new Error('fetch should not run in this unit test'); },
	window: { addEventListener() {} },
	$: createJQueryStub(),
	setTimeout
};
vm.createContext(context);
vm.runInContext(script, context);

assert.strictEqual(context.getProtocolGroup('http://example.test/path'), 'http');
assert.strictEqual(context.getProtocolGroup('wss://example.test/socket'), 'websocket');
assert.strictEqual(context.getHttpVersionGroup({ request: { httpVersion: 'HTTP/2' } }), 'http2');
assert.strictEqual(context.getHttpVersionGroup({ request: { httpVersion: 'HTTP/1.1' } }), 'http1');
assert.strictEqual(context.getMethodGroup('GET'), 'GET');
assert.strictEqual(context.getMethodGroup('POST'), 'POST');
assert.strictEqual(context.getMethodGroup('PUT'), 'PUT');
assert.strictEqual(context.getMethodGroup('DELETE'), 'DELETE');
assert.strictEqual(context.getMethodGroup('PATCH'), 'PATCH');
assert.strictEqual(context.getMethodGroup('HEAD'), 'HEAD');
assert.strictEqual(context.getMethodGroup('OPTIONS'), 'OPTIONS');
assert.strictEqual(context.getMethodGroup('CONNECT'), 'CONNECT');
assert.strictEqual(context.getMethodGroup('TRACE'), 'TRACE');
assert.strictEqual(context.getMethodGroup('PROPFIND'), 'other');
assert.strictEqual(context.getStatusGroup(404), '4xx');
assert.strictEqual(context.getContentGroup('application/problem+json'), 'json');
assert.strictEqual(context.getContentGroup('image/png'), 'image');
assert.strictEqual(context.getContentGroup('video/mp4'), 'media');
assert.strictEqual(context.getContentGroup('text/plain'), 'text');

const application = context.getApplicationInfo({ _app: { id: 'com.example.app', name: 'Example' } });
assert.strictEqual(application.key, 'com.example.app');
assert.strictEqual(application.label, 'Example');
const unlabeledApplication = context.getApplicationInfo({});
assert.strictEqual(unlabeledApplication.key, '__none__');
assert.strictEqual(unlabeledApplication.label, '未标注');

assert.strictEqual(context.matchesSearchText('api.example.test/users', 'example', 'contains'), true);
assert.strictEqual(context.matchesSearchText('api.example.test/users', 'example', 'startsWith'), false);
assert.strictEqual(context.matchesSearchText('api.example.test/users', 'api.', 'startsWith'), true);
assert.strictEqual(context.matchesFilterGroups({ protocol: 'https', content: 'json' }, {
	protocol: ['http', 'https'],
	content: ['json']
}), true);
assert.strictEqual(context.matchesFilterGroups({ protocol: 'https', content: 'xml' }, {
	protocol: ['http', 'https'],
	content: ['json']
}), false);
assert.strictEqual(context.clampInspectorWidth(100, 1200), 280);
assert.strictEqual(context.clampInspectorWidth(700, 1200), 700);
assert.strictEqual(context.clampInspectorWidth(1100, 1200), 920);

assert.ok(markup.indexOf('class="toolbar-controls"') < markup.indexOf('class="quick-filters"'));
assert.ok(markup.includes('data-filter="DELETE">DELETE</button>'));
assert.ok(markup.includes('data-filter="PATCH">PATCH</button>'));
assert.ok(markup.includes('data-filter="HEAD">HEAD</button>'));
assert.ok(markup.includes('data-filter="OPTIONS">OPTIONS</button>'));
assert.ok(markup.includes('data-filter="CONNECT">CONNECT</button>'));
assert.ok(markup.includes('data-filter="TRACE">TRACE</button>'));
assert.ok(markup.includes('data-filter="other">其他</button>'));
assert.ok(!markup.includes('>XX</button>'));
assert.match(styles, /\.search-box\s*\{[\s\S]*?overflow:\s*hidden;/);
assert.match(styles, /\.search-box input\.search\s*\{[\s\S]*?background:\s*transparent;/);
