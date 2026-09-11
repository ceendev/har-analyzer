const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const customEditors = manifest.contributes && manifest.contributes.customEditors;
const readme = fs.readFileSync(path.resolve(__dirname, '..', 'README.md'), 'utf8');
const icon = fs.readFileSync(path.resolve(__dirname, '..', 'resources', 'har-editor-icon.png'));

assert.strictEqual(`${manifest.publisher}.${manifest.name}`, 'yeceen.har-editor');
assert.strictEqual(manifest.displayName, 'Har Editor');
assert.strictEqual(
	manifest.description,
	'A visual HAR workspace for VS Code with automatic file opening, fast request filtering, resizable tables, and split request/response inspection.'
);
assert.strictEqual(manifest.repository.url, 'https://github.com/ceendev/har-editor');
assert.strictEqual(manifest.icon, 'resources/har-editor-icon.png');
assert.ok(
	readme.includes('not affiliated with, endorsed by, or published by Matt Foulks'),
	'the Marketplace README must state the independent publisher relationship prominently'
);
assert.strictEqual(icon.readUInt32BE(16), 128, 'Marketplace icon width must be 128px');
assert.strictEqual(icon.readUInt32BE(20), 128, 'Marketplace icon height must be 128px');
assert.strictEqual(fs.existsSync(path.resolve(__dirname, '..', 'demo.gif')), false, 'upstream demo must not be packaged');

assert.ok(Array.isArray(customEditors), 'the manifest must contribute a custom editor');
assert.deepStrictEqual(customEditors[0], {
	viewType: 'har-editor.editor',
	displayName: 'Har Editor',
	priority: 'default',
	selector: [{ filenamePattern: '*.har' }]
});

assert.ok(
	manifest.activationEvents.includes('onCustomEditor:har-editor.editor'),
	'the extension must activate when VS Code opens the custom editor'
);

const registrations = [];
const copiedTexts = [];
const webviewMessages = [];
const vscode = {
	commands: {
		registerCommand() {
			return { dispose() {} };
		}
	},
	window: {
		registerCustomEditorProvider(viewType, provider, options) {
			registrations.push({ viewType, provider, options });
			return { dispose() {} };
		}
	},
	env: {
		clipboard: {
			writeText(text) {
				copiedTexts.push(text);
				return Promise.resolve();
			}
		}
	},
	workspace: {},
	Uri: {
		joinPath(uri, ...parts) {
			const fsPath = path.posix.resolve(uri.fsPath, ...parts);
			return {
				scheme: uri.scheme,
				fsPath,
				toString() { return `${uri.scheme}://${fsPath}`; }
			};
		}
	}
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
	if (request === 'vscode') {
		return vscode;
	}
	return originalLoad.call(this, request, parent, isMain);
};

let extension;
try {
	extension = require('../extension');
	extension.activate({ subscriptions: [] });
} finally {
	Module._load = originalLoad;
}

assert.strictEqual(registrations.length, 1, 'activation must register one custom editor');
assert.strictEqual(registrations[0].viewType, 'har-editor.editor');
assert.strictEqual(registrations[0].options.supportsMultipleEditorsPerDocument, false);
assert.strictEqual(registrations[0].options.webviewOptions.retainContextWhenHidden, true);
assert.strictEqual(typeof registrations[0].provider.openCustomDocument, 'function');
assert.strictEqual(typeof registrations[0].provider.resolveCustomEditor, 'function');

const extensionUri = { scheme: 'file', fsPath: '/extension' };
const harUri = {
	scheme: 'file',
	fsPath: '/workspace/large.har',
	toString() { return 'file:///workspace/large.har'; }
};
const document = extension.createHarDocument(harUri);

assert.strictEqual(document.uri, harUri);
assert.strictEqual(document.sourceUri, harUri, 'HAR files should be fetched directly by the webview');

const panel = {
	webview: {
		options: undefined,
		html: '',
		asWebviewUri(uri) {
			return { toString() { return `webview:${uri.toString()}`; } };
		},
		postMessage(message) {
			webviewMessages.push(message);
			return Promise.resolve(true);
		},
		onDidReceiveMessage(handler) {
			this.messageHandler = handler;
		}
	}
};

extension.renderHarEditor(panel, document, {
	extensionUri,
	subscriptions: [],
	markup: '<main>analyzer</main>'
});

assert.strictEqual(panel.webview.options.localResourceRoots.length, 2);
assert.strictEqual(panel.webview.options.localResourceRoots[1].scheme, 'file');
assert.strictEqual(panel.webview.options.localResourceRoots[1].fsPath, '/workspace');
assert.ok(panel.webview.html.includes('webview:file:///workspace/large.har'));

(async function testCopyRequestURLMessage() {
	assert.strictEqual(typeof panel.webview.messageHandler, 'function');
	await panel.webview.messageHandler({
		action: 'copyRequestUrl',
		text: 'https://example.test/long/path?a=1',
		clientX: 320,
		clientY: 96
	});
	assert.deepStrictEqual(copiedTexts, ['https://example.test/long/path?a=1']);
	assert.deepStrictEqual(webviewMessages, [{
		command: 'copyRequestUrlResult',
		success: true,
		clientX: 320,
		clientY: 96
	}]);
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
