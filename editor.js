class CirodownEditor {
  constructor(root_elem, initial_content, monaco, cirodown, cirodown_runtime, options) {
    this.cirodown = cirodown
    this.cirodown_runtime = cirodown_runtime
    if (options === undefined) {
      options = {}
    }
    if (!('production' in options)) {
      options.production = true
    }
    if (!('modifyEditorInput' in options)) {
      options.modifyEditorInput = (old) => old
    }
    this.modifyEditorInput = options.modifyEditorInput
    if (!('onDidChangeModelContentCallback' in options)) {
      options.onDidChangeModelContentCallback = (editor) => {}
    }
    this.options = options

    // Create input and output elems.
    const input_elem = document.createElement('div');
    input_elem.classList.add('input');
    const output_elem = document.createElement('div');
    this.output_elem = output_elem
    output_elem.classList.add('output');
    output_elem.classList.add('cirodown');
    root_elem.innerHTML = '';
    root_elem.appendChild(input_elem);
    root_elem.appendChild(output_elem);

    monaco.languages.register({ id: 'cirodown' });
    // TODO replace with our own tokenizer output:
    // https://github.com/cirosantilli/cirodown/issues/106
    monaco.languages.setMonarchTokensProvider('cirodown', {
      macroName: /[a-zA-Z0-9_]+/,
      tokenizer: {
        root: [
          [/\\@macroName/, 'macro'],
          [/\\./, 'escape'],

          // Positional arguments.
          [/\[\[\[/, 'literalStart', 'argumentDelimLiteral2'],
          [/\[\[/, 'literalStart', 'argumentDelimLiteral'],
          [/[[\]}]/, 'argumentDelim'],

          // Named arguments.
          [/{{/, 'argumentDelim', 'argumentNameLiteral'],
          [/{/, 'argumentDelim', 'argumentName'],

          [/\$\$\$/, 'literalStart', 'insaneMath3'],
          [/\$\$/, 'literalStart', 'insaneMath2'],
          [/\$/, 'literalStart', 'insaneMath'],

          [/````/, 'literalStart', 'insaneCode4'],
          [/```/, 'literalStart', 'insaneCode3'],
          [/``/, 'literalStart', 'insaneCode2'],
          [/`/, 'literalStart', 'insaneCode'],

          [/^=+ .*/, 'insaneHeader'],

          // Insane list.
          [/^(  )*\*( |$)/, 'argumentDelim'],
          // Insane table.
          [/^(  )*\|\|( |$)/, 'argumentDelim'],
          [/^(  )*\|( |$)/, 'argumentDelim'],
        ],
        argumentDelimLiteral: [
          [/\]\]/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        argumentDelimLiteral2: [
          [/\]\]\]/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        argumentName: [
          [/@macroName/, 'argumentName'],
          [/=/, 'argumentDelim', '@pop'],
          [/}/, 'argumentDelim', '@pop'],
        ],
        // TODO find a way to make content literalInside.
        argumentNameLiteral: [
          [/@macroName/, 'argumentName'],
          [/=/, 'argumentDelim', '@pop'],
          [/}}/, 'argumentDelim', '@pop'],
        ],
        insaneCode: [
          [/`/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        insaneCode2: [
          [/``/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        insaneCode3: [
          [/```/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        insaneCode4: [
          [/````/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        insaneMath: [
          [/\$/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        insaneMath2: [
          [/\$\$/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
        insaneMath3: [
          [/\$\$\$/, 'literalStart', '@pop'],
          [/./, 'literalInside'],
        ],
      }
    });
    monaco.editor.defineTheme('vs-dark-cirodown', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'argumentDelim', foreground: 'FFFFFF', fontStyle: 'bold' },
        { token: 'argumentName', foreground: 'FFAAFF', fontStyle: 'bold'},
        { token: 'insaneHeader', foreground: 'FFFF00', fontStyle: 'bold' },
        { token: 'literalStart', foreground: 'FFFF00', fontStyle: 'bold' },
        { token: 'literalInside', foreground: 'FFFF88' },
        { token: 'macro', foreground: 'FF8800', fontStyle: 'bold' },
      ]
    });
    const editor = monaco.editor.create(
      input_elem,
      {
        // https://stackoverflow.com/questions/47017753/monaco-editor-dynamically-resizable
        automaticLayout: true,
        folding: false,
        language: 'cirodown',
        minimap: {enabled: false},
        scrollBeyondLastLine: false,
        theme: 'vs-dark-cirodown',
        wordWrap: 'on',
        value: initial_content,
      }
    );
    this.editor = editor
    editor.onDidChangeModelContent(async (e) => {
      options.onDidChangeModelContentCallback(editor)
      await this.convertInput();
    });
    editor.onDidScrollChange(e => {
      const range = editor.getVisibleRanges()[0];
      const lineNumber = range.startLineNumber
      // So that the title bar will show on dynamic website
      // when user scrolls to line 1.
      const block = lineNumber === 1 ? 'center' : 'start'
      this.scrollPreviewToSourceLine(lineNumber, block);
    });
    editor.onDidChangeCursorPosition(e => {
      this.scrollPreviewToSourceLine(e.position.lineNumber, 'center');
    });
    this.convertInput();
    this.cirodown_runtime(this.output_elem)
  }

  async convertInput() {
    let extra_returns = {};
    let ok = true
    try {
      this.output_elem.innerHTML = await this.cirodown.convert(
        this.modifyEditorInput(this.editor.getValue()),
        { body_only: true },
        extra_returns
      );
    } catch(e) {
      // TODO clearly notify user on UI that they found a Cirodown crash bug for the current input.
      console.error(e);
      ok = false
      if (!this.options.production) {
        // This shows proper stack traces in the console unlike what is shown on browser for some reason.
        //throw e
      }
    }
    if (ok) {
      // Rebind to newly generated elements.
      this.cirodown_runtime(this.output_elem);
      this.line_to_id = extra_returns.context.line_to_id;
    }
  }

  dispose() {
    this.editor.dispose()
  }

  getValue() { return this.editor.getValue() }

  scrollPreviewToSourceLine(line_number, block) {
    if (block === undefined) {
      block = 'center';
    }
    const id = this.line_to_id(line_number);
    if (
      // Possible on empty document.
      id !== ''
    ) {
      // TODO this would be awesome to make the element being targeted red,
      // but it loses editor focus  on new paragraphs (e.g. double newline,
      // making it unusable.
      // window.location.hash = id;
      document.getElementById(id).scrollIntoView({
        behavior: 'smooth',
        block: block,
      });
    };
  }

  async setModifyEditorInput(modifyEditorInput) {
    this.modifyEditorInput = modifyEditorInput
    await this.convertInput()
  }
}


if (typeof exports !== 'undefined') {
  exports.CirodownEditor = CirodownEditor;
}
