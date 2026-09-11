const assert = require('assert');
const path = require('path');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = require('vscode');
// const myExtension = require('../extension');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('opens HAR files with the custom editor', async function () {
		this.timeout(15000);
		const harUri = vscode.Uri.file(path.resolve(__dirname, '../../media/example.har'));
		const viewType = 'har-editor.editor';
		const isMatchingTab = tab => tab && tab.input instanceof vscode.TabInputCustom
			&& tab.input.viewType === viewType
			&& tab.input.uri.toString() === harUri.toString();
		const findMatchingTab = () => vscode.window.tabGroups.all
			.flatMap(group => group.tabs)
			.find(isMatchingTab);
		await vscode.commands.executeCommand('vscode.openWith', harUri, viewType);
		const deadline = Date.now() + 15000;
		let tab;
		while (!tab && Date.now() < deadline) {
			tab = findMatchingTab();
			if (!tab) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}
		assert.ok(tab, 'the HAR custom editor tab should be open');
		assert.strictEqual(tab.input.viewType, viewType);
		assert.strictEqual(tab.input.uri.toString(), harUri.toString());
		await vscode.window.tabGroups.close(tab);
	});
});
