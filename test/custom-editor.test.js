const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const customEditors = manifest.contributes && manifest.contributes.customEditors;

assert.ok(Array.isArray(customEditors), 'the manifest must contribute a custom editor');
assert.deepStrictEqual(customEditors[0], {
	viewType: 'har-auto-analyzer.editor',
	displayName: 'HAR Auto Analyzer',
	priority: 'default',
	selector: [{ filenamePattern: '*.har' }]
});

assert.ok(
	manifest.activationEvents.includes('onCustomEditor:har-auto-analyzer.editor'),
	'the extension must activate when VS Code opens the custom editor'
);

const registrations = [];
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
assert.strictEqual(registrations[0].viewType, 'har-auto-analyzer.editor');
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
		onDidReceiveMessage() {}
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
