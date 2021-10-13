// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MarkdownFormula } from './markdown-formula';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// print info to terminal
	console.log('markdown-formula is now active!');

	// register calculate command
	const disposable = vscode.commands.registerCommand('extension.calculate', function () {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		// if editor found
		if (editor) {
			const documentText = editor.document.getText();

			// get the configuration
			let precisionRounding = vscode.workspace.getConfiguration('markdown-formula')['precisionRounding'];
			let includeTableHeaderInCellNumaration = vscode.workspace.getConfiguration('markdown-formula')['includeTableHeaderInCellNumaration'];

			// get the markdown formulas and evaluated results
			let content = MarkdownFormula(documentText, precisionRounding, includeTableHeaderInCellNumaration);
			console.log(content);
			
			// replace all the detected formulas with the calculated values
			editor.edit(editBuilder => {
				content.forEach(item => {
					let start = new vscode.Position(item.locations[0], item.locations[1]);
					let end   = new vscode.Position(item.locations[0], item.locations[1]+item.locations[2]);

					// replace the lines in between
					editBuilder.replace(new vscode.Range(start, end), item.data);
				})
			}).then(undefined, err => {
				console.error(err);
			});
		}
	});

	context.subscriptions.push(disposable);

	// run on save
	let calculateOnSave = vscode.workspace.getConfiguration('markdown-formula')['calculateOnSave'];
	if(calculateOnSave) {
		context.subscriptions.push(vscode.workspace.onWillSaveTextDocument((td) => {
			vscode.commands.executeCommand('extension.calculate')
		}));
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
