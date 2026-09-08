const fs = require('fs');
const vscode = require('vscode');

const VIEW_TYPE = 'har-auto-analyzer.editor';

class HarCustomEditorProvider {
	constructor(context) {
		this.context = context;
	}

	openCustomDocument(uri) {
		return createHarDocument(uri);
	}

	async resolveCustomEditor(document, webviewPanel) {
		const markupPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'analyzer.html');
		const markup = await fs.promises.readFile(markupPath.fsPath, 'utf8');
		renderHarEditor(webviewPanel, document, {
			extensionUri: this.context.extensionUri,
			subscriptions: this.context.subscriptions,
			markup
		});
	}
}

function createHarDocument(uri) {
	return {
		uri,
		sourceUri: uri,
		dispose() {}
	};
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const provider = new HarCustomEditorProvider(context);
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
			supportsMultipleEditorsPerDocument: false,
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);

	const analyzeCommand = vscode.commands.registerCommand('har-auto-analyzer.analyze', async function () {
		if (vscode.window.activeTextEditor == null) {
			vscode.window.showErrorMessage('Open a HAR file before running Analyze.');
			return;
		}

		await vscode.commands.executeCommand(
			'vscode.openWith',
			vscode.window.activeTextEditor.document.uri,
			VIEW_TYPE
		);
	});

	context.subscriptions.push(analyzeCommand);
}

function deactivate() {}

function renderHarEditor(panel, document, context) {
	const cssPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css');
	const codiconsPath = vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css');
	const jqueryPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'jquery.min.js');
	const scriptPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'script.js');
	const harUri = panel.webview.asWebviewUri(document.sourceUri);
	const resourceRoots = [context.extensionUri, vscode.Uri.joinPath(document.sourceUri, '..')];

	panel.webview.options = {
		enableScripts: true,
		localResourceRoots: resourceRoots
	};
	panel.webview.html = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link rel="stylesheet" href="${panel.webview.asWebviewUri(cssPath)}">
			<link href="${panel.webview.asWebviewUri(codiconsPath)}" rel="stylesheet" />
		</head>
		<body>
			<script>window.harSource = ${JSON.stringify(harUri.toString())};</script>
			<script src="${panel.webview.asWebviewUri(jqueryPath)}"></script>
			<script src="${panel.webview.asWebviewUri(scriptPath)}"></script>
			${context.markup}
		</body>
		</html>`;

	panel.webview.onDidReceiveMessage(async message => {
		if (message.action === 'openNewTab') {
			const document = await vscode.workspace.openTextDocument({ content: message.text });
			await vscode.window.showTextDocument(document);
		}
	}, undefined, context.subscriptions);
}

module.exports = {
	activate,
	deactivate,
	HarCustomEditorProvider,
	createHarDocument,
	renderHarEditor
};
