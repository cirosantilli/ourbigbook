const assert = require('assert');
const util = require('util');

const cirodown = require('cirodown')

const convert_opts = {
  body_only: true,
  //show_ast: true,
  //show_parse: true,
  //show_tokens: true,
  //show_tokenize: true,
};

function assert_convert_ast_func(input_string, expected_ast_output_subset, options={}) {
  if (!('extra_convert_opts' in options)) {
    options.extra_convert_opts = {};
  }
  if (!('toplevel' in options)) {
    options.toplevel = false;
  }
  const extra_returns = {};
  const new_convert_opts = Object.assign({}, convert_opts);
  Object.assign(new_convert_opts, options.extra_convert_opts);
  if (options.toplevel) {
    new_convert_opts.body_only = false;
  }
  cirodown.convert(input_string, new_convert_opts, extra_returns);
  const has_subset_extra_returns = {fail_reason: ''};
  let is_subset;
  let content;
  if (options.toplevel) {
    content = extra_returns.ast;
    is_subset = ast_has_subset(content, expected_ast_output_subset, has_subset_extra_returns);
  } else {
    content = extra_returns.ast.args.content;
    is_subset = ast_arg_has_subset(content, expected_ast_output_subset, has_subset_extra_returns);
  }
  if (!is_subset || extra_returns.errors.length !== 0) {
    console.error('tokens:');
    console.error(JSON.stringify(extra_returns.tokens, null, 2));
    console.error();
    console.error('ast output:');
    console.error(JSON.stringify(content, null, 2));
    console.error();
    console.error('ast expect:');
    console.error(JSON.stringify(expected_ast_output_subset, null, 2));
    console.error();
    if (!is_subset) {
      console.error('failure reason:');
      console.error(has_subset_extra_returns.fail_reason);
      console.error();
    }
    for (const error of extra_returns.errors) {
      console.error(error.toString());
    }
    console.error('input ' + util.inspect(input_string));
    assert.strictEqual(extra_returns.errors.length, 0);
    assert.ok(is_subset);
  }
}

function assert_convert_func(input_string, expected_output) {
  const extra_returns = {};
  const output = cirodown.convert(input_string, convert_opts, extra_returns);
  if (output !== expected_output || extra_returns.errors.length !== 0) {
    console.error('tokens:');
    console.error(JSON.stringify(extra_returns.tokens, null, 2));
    console.error();
    console.error('ast:');
    console.error(JSON.stringify(extra_returns.ast, null, 2));
    console.error();
    for (const error of extra_returns.errors) {
      console.error(error.toString());
    }
    console.error('input ' + util.inspect(input_string));
    console.error('output ' + util.inspect(output));
    console.error('expect ' + util.inspect(expected_output));
    assert.strictEqual(extra_returns.errors.length, 0);
    assert.strictEqual(output, expected_output);
  }
}

function assert_error_func(input_string, line, column) {
  let extra_returns = {};
  let output = cirodown.convert(input_string, convert_opts, extra_returns);
  assert.ok(extra_returns.errors.length >= 1);
  let error = extra_returns.errors[0];
  assert.strictEqual(error.line, line);
  assert.strictEqual(error.column, column);
}

/** For stuff that is hard to predict the exact output of, which is most of the HTML,
 * we can check just that a certain key subset of the AST is present.
 *
 * This tests just the input parse to AST, but not the output generation from the AST.
 *
 * This function automaticlaly only considers the content argument of the
 * toplevel node for further convenience.
 */
function assert_convert_ast(description, input_string, expected_ast_output_subset, extra_convert_opts) {
  it(description, ()=>{assert_convert_ast_func(input_string, expected_ast_output_subset, extra_convert_opts);});
}

function assert_convert(description, input, output) {
  it(description, ()=>{assert_convert_func(input, output);});
}

function assert_error(description, input, line, column) {
  it(description, ()=>{assert_error_func(input, line, column);});
}

/** For stuff that is hard to predict the exact output of, just check the
 * exit status at least. */
function assert_no_error(description, input) {
  it(description, ()=>{
    let extra_returns = {};
    cirodown.convert(input, convert_opts, extra_returns);
    assert.strictEqual(extra_returns.errors.length, 0);
  });
}

/** Determine if a given Ast argument has a subset.
 *
 * For each lement of the array, only the subset of each object is checked.
 *
 * @param {Array[AstNode]} unmodified array of AstNode as output by convert
 * @param {Array[Object]} lightweight AstNode notation containing only built-in JavaScript objects
 *        such as dict, array and string, to make writing tests a bit less verbose.
 * @return {Bool} true iff ast_subset is a subset of this node
 */
function ast_arg_has_subset(arg, subset, extra_returns) {
  if (arg.length !== subset.length) {
    extra_returns.fail_reason = `arg.length !== subset.length ${arg.length} ${subset.length}`;
    return false;
  }
  for (let i = 0; i < arg.length; i++) {
    if (!ast_has_subset(arg[i], subset[i], extra_returns))
      return false;
  }
  return true;
}

/** See: ast_arg_has_subset. */
function ast_has_subset(ast, ast_subset, extra_returns) {
  for (const ast_subset_prop_name in ast_subset) {
    if (!(ast_subset_prop_name in ast)) {
      extra_returns.fail_reason = `!(ast_subset_prop_name in ast: ${ast_subset_prop_name} ${ast_subset_prop_name}`;
      return false
    }
    const ast_prop = ast[ast_subset_prop_name];
    const ast_subset_prop = ast_subset[ast_subset_prop_name];
    if (ast_subset_prop_name === 'args') {
      for (const ast_subset_arg_name in ast_subset_prop) {
        if (!(ast_subset_arg_name in ast_prop)) {
          extra_returns.fail_reason = `!(ast_subset_arg_name in ast_prop): ${ast_subset_prop_name} ${ast_subset_arg_name}`;
          return false;
        }
        if (!ast_arg_has_subset(ast_prop[ast_subset_arg_name], ast_subset_prop[ast_subset_arg_name], extra_returns))
          return false;
      }
    } else {
      if (ast_prop !== ast_subset_prop) {
        extra_returns.fail_reason = `ast_prop !== ast_subset_prop: '${ast_subset_prop_name}' '${ast_prop}' '${ast_subset_prop}'`;
        return false;
      }
    }
  }
  return true;
}

/** Shortcut to create node with a 'content' argument for ast_arg_has_subset.
 *
 * @param {Array} the argument named content, which is very common across macros.
 *                If undefined, don't add a content argument at all.
 */
function a(macro_name, content, extra_args={}, extra_props={}) {
  let args = extra_args;
  if (content !== undefined) {
    args.content = content;
  }
  return Object.assign({
    'macro_name': macro_name,
    'args': args,
  }, extra_props);
}

/** Shortcut to create plaintext nodes for ast_arg_has_subset, we have too many of those. */
function t(text) { return {'macro_name': 'plaintext', 'text': text}; }

// Paragraphs.
assert_convert_ast('one paragraph implicit', 'ab\n',
  [a('p', [t('ab')])],
);
assert_convert_ast('one paragraph explicit', '\\p[ab]\n',
  [a('p', [t('ab')])],
);
assert_convert_ast('two paragraphs', 'p1\n\np2\n',
  [
    a('p', [t('p1')]),
    a('p', [t('p2')]),
  ]
);
assert_convert_ast('three paragraphs',
  'p1\n\np2\n\np3\n',
  [
    a('p', [t('p1')]),
    a('p', [t('p2')]),
    a('p', [t('p3')]),
  ]
);
assert_error('paragraph three newlines', 'p1\n\n\np2\n', 3, 1);

// List.
const l_with_explicit_ul_expect = [
  a('p', [t('ab')]),
  a('ul', [
    a('l', [t('cd')]),
    a('l', [t('ef')]),
  ]),
  a('p', [t('gh')]),
];
assert_convert_ast('l with explicit ul and no extra spaces',
  `ab

\\ul[\\l[cd]\\l[ef]]

gh
`,
  l_with_explicit_ul_expect
);
assert_convert_ast('l with implicit ul sane',
  `ab

\\l[cd]
\\l[ef]

gh
`,
  l_with_explicit_ul_expect
);
assert_convert_ast('l with implicit ul insane',
  `ab

* cd
* ef

gh
`,
  l_with_explicit_ul_expect
);
assert_convert_ast('l with explicit ul and extra spaces',
  `ab

\\ul[
\\l[cd]\u0020
\u0020\t\u0020
\\l[ef]
]

gh
`,
  l_with_explicit_ul_expect
);
assert_convert_ast('ordered list',
  `ab

\\ol[
\\l[cd]
\\l[ef]
]

gh
`,
[
  a('p', [t('ab')]),
  a('ol', [
    a('l', [t('cd')]),
    a('l', [t('ef')]),
  ]),
  a('p', [t('gh')]),
]
);
assert_convert_ast('list with paragraph sane',
  `\\l[
aa

bb
]
`,
  [
    a('ul', [
      a('l', [
        a('p', [t('aa')]),
        a('p', [t('bb\n')]),
      ]),
    ]),
  ]
)
assert_convert_ast('list with paragraph insane',
  `* aa

  bb
`,
  [
    a('ul', [
      a('l', [
        a('p', [t('aa')]),
        a('p', [t('bb')]),
      ]),
    ]),
  ]
)
assert_convert_ast('list with multiline paragraph insane',
  `* aa

  bb
  cc
`,
  [
    a('ul', [
      a('l', [
        a('p', [t('aa')]),
        a('p', [t('bb\ncc')]),
      ]),
    ]),
  ]
)
// https://github.com/cirosantilli/cirodown/issues/54
assert_convert_ast('insane list with literal no error',
  `* aa

  \`\`
  bb
  cc
  \`\`
`,
  [
    a('ul', [
      a('l', [
        a('p', [t('aa')]),
        a('C', [t('bb\ncc\n')]),
      ]),
    ]),
  ]
)
assert_error('insane list with literal with error',
  `* aa

  \`\`
  bb
cc
  \`\`
`,
  4, 1
)
assert_convert_ast('insane list with literal with double newline is not an error',
  `* aa

  \`\`
  bb

  cc
  \`\`
`,
  [
    a('ul', [
      a('l', [
        a('p', [t('aa')]),
        a('C', [t('bb\n\ncc\n')]),
      ]),
    ]),
  ]
)
// https://github.com/cirosantilli/cirodown/issues/53
assert_convert_ast('insane list with element with newline separated arguments',
  `* aa

  \`\`
  bb
  \`\`
  {id=cc}
`,
  [
    a('ul', [
      a('l', [
        a('p', [t('aa')]),
        a('C', [t('bb\n')], {'id': [t('cc')]}),
      ]),
    ]),
  ]
)
assert_convert_ast('nested list insane',
  `* aa
  * bb
`,
  [
    a('ul', [
      a('l', [
        t('aa'),
        a('ul', [
          a('l', [
            t('bb')
          ]),
        ]),
      ]),
    ]),
  ]
)
assert_convert_ast('escape insane list',
  '\\* a',
  [a('p', [t('* a')])],
)

// Table.
const tr_with_explicit_table_expect = [
  a('p', [t('ab')]),
  a('table', [
    a('tr', [
      a('th', [t('cd')]),
      a('th', [t('ef')]),
    ]),
    a('tr', [
      a('td', [t('00')]),
      a('td', [t('01')]),
    ]),
    a('tr', [
      a('td', [t('10')]),
      a('td', [t('11')]),
    ]),
  ]),
  a('p', [t('gh')]),
];
assert_convert_ast('tr with explicit table',
  `ab

\\table[
\\tr[
\\th[cd]
\\th[ef]
]
\\tr[
\\td[00]
\\td[01]
]
\\tr[
\\td[10]
\\td[11]
]
]

gh
`,
  tr_with_explicit_table_expect
);
assert_convert_ast('tr with implicit table',
  `ab

\\tr[
\\th[cd]
\\th[ef]
]
\\tr[
\\td[00]
\\td[01]
]
\\tr[
\\td[10]
\\td[11]
]

gh
`,
  tr_with_explicit_table_expect
);
assert_convert_ast('auto_parent consecutive implicit tr and l',
  `\\tr[\\td[ab]]
\\l[cd]
`,
[
  a('p', [
    a('table', [
      a('tr', [
        a('td', [t('ab')]),
      ]),
    ]),
    a('ul', [
      a('l', [t('cd')]),
    ]),
  ]),
]
);
// TODO html test
//assert_convert('table with id has caption',
//  `\\table{id=ab}[
//\\tr[
//\\td[00]
//\\td[01]
//]
//]
//`,
//  `<div class="table-container" id="ab">
//<div class="table-caption">Table 1</div>
//<table>
//<tr>
//<td>00</td>
//<td>01</td>
//</tr>
//</table>
//</div>
//`
//);

// Images.
assert_convert_ast('image simple',
  `ab

\\Image[cd]

gh
`,
[
  a('p', [t('ab')]),
  a('Image', undefined, {src: [t('cd')]}),
  a('p', [t('gh')]),
]
);
assert_convert_ast('image title',
  `\\Image[ab]{title=c d}`,
[
  a('Image', undefined, {
    src: [t('ab')],
    title: [t('c d')],
  }),
]
);
assert_error('image with unknown provider',
  `\\Image[ab]{provider=reserved_undefined}`,
  1, 11
);
// TODO inner property test
//assert_convert_ast('image without id does not increment image count',
//  `\\Image[ab]
//\\Image[cd]{id=ef}
//`,
//  `<figure>
//<img src="ab">
//</figure>
//<figure id="ef">
//<a href="#ef"><img src="cd"></a>
//<figcaption>Image 1</figcaption>
//</figure>
//`
//)

// Escapes.
assert_convert_ast('escape backslash',            'a\\\\b\n', [a('p', [t('a\\b')])]);
assert_convert_ast('escape left square bracket',  'a\\[b\n',  [a('p', [t('a[b')])]);
assert_convert_ast('escape right square bracket', 'a\\]b\n',  [a('p', [t('a]b')])]);
assert_convert_ast('escape left curly brace',     'a\\{b\n',  [a('p', [t('a{b')])]);
assert_convert_ast('escape right curly brace',    'a\\}b\n',  [a('p', [t('a}b')])]);

//// HTML Escapes.
// TODO html or subfunction test
//assert_convert_ast('html escapes',
//  '\\a[ab&<>"\'cd][ef&<>"\'gh]\n',
//  '<a href="ab&amp;&lt;&gt;&quot;&#039;cd">ef&amp;&lt;&gt;"\'gh</a>\n'
//);

// Positional arguments.
// Has no content argument.
assert_convert_ast('p with no content argument', '\\p\n', [a('p')]);
assert_convert_ast('table with no content argument', '\\table\n', [a('table')]);
// Has empty content argument.
assert_convert_ast('p with empty content argument', '\\p[]\n', [a('p', [])]);

// Named arguments.
assert_convert_ast('p with id before', '\\p{id=ab}[cd]\n',
  [a('p', [t('cd')], {'id': [t('ab')]})]);
assert_convert_ast('p with id after', '\\p[cd]{id=ab}\n',
  [a('p', [t('cd')], {'id': [t('ab')]})]);

// Newline after close.
assert_convert_ast('text after block element',
  `a

\\C[
b
c
]
d

e
`,
[
  a('p', [t('a')]),
  a('p', [
    a('C', [t('b\nc\n')]),
    t('\nd'),
  ]),
  a('p', [t('e')]),
]
);
assert_convert_ast('macro after block element',
  `a

\\C[
b
c
]
\\c[d]

e
`,
[
  a('p', [t('a')]),
  a('p', [
    a('C', [t('b\nc\n')]),
    t('\n'),
    a('c', [t('d')]),
  ]),
  a('p', [t('e')]),
]
);

// Literal arguments.
assert_convert_ast('literal argument code inline',
  '\\c[[\\ab[cd]{ef}]]\n',
  [a('p', [a('c', [t('\\ab[cd]{ef}')])])],
);
assert_convert_ast('literal argument code block',
  `a

\\C[[
\\[]{}
\\[]{}
]]

d
`,
[
  a('p', [t('a')]),
  a('C', [t('\\[]{}\n\\[]{}\n')]),
  a('p', [t('d')]),
],
);
assert_convert_ast('non-literal argument leading newline gets removed',
  `\\p[
a
b
]
`,
  [a('p', [t('a\nb\n')])],
);
assert_convert_ast('literal argument leading newline gets removed',
  `\\p[[
a
b
]]
`,
  [a('p', [t('a\nb\n')])],
);
assert_convert_ast('literal argument leading newline gets removed but not the second one',
  `\\p[[

a
b
]]
`,
  [a('p', [t('\na\nb\n')])],
);
assert_convert_ast('literal agument escape leading open no escape',
  '\\c[[\\ab]]\n',
  [a('p', [a('c', [t('\\ab')])])],
);
assert_convert_ast('literal agument escape leading open one backslash',
  '\\c[[\\[ab]]\n',
  [a('p', [a('c', [t('[ab')])])],
);
assert_convert_ast('literal agument escape leading open two backslashes',
  '\\c[[\\\\[ab]]\n',
  [a('p', [a('c', [t('\\[ab')])])],
);
assert_convert_ast('literal agument escape trailing close no escape',
  '\\c[[\\]]\n',
  [a('p', [a('c', [t('\\')])])],
);
assert_convert_ast('literal agument escape trailing one backslash',
  '\\c[[\\]]]\n',
  [a('p', [a('c', [t(']')])])],
);
assert_convert_ast('literal agument escape trailing two backslashes',
  '\\c[[\\\\]]]\n',
  [a('p', [a('c', [t('\\]')])])],
);

// Newline between arguments.
const newline_between_arguments_expect = [
  a('C', [t('ab\n')], {id: [t('cd')]}),
];
assert_convert_ast('not literal argument with argument after newline',
  `\\C[
ab
]
{id=cd}
`,
  newline_between_arguments_expect
);
assert_convert_ast('yes literal argument with argument after newline',
  `\\C[[
ab
]]
{id=cd}
`,
  newline_between_arguments_expect
);
assert_convert_ast('yes insane literal argument with argument after newline',
  `\`\`
ab
\`\`
{id=cd}
`,
  newline_between_arguments_expect
);

// Links.
assert_convert_ast('link simple',
  'a \\a[http://example.com][example link] b\n',
  [
    a('p', [
      t('a '),
      a('a', [t('example link')], {'href': [t('http://example.com')]}),
      t(' b'),
    ]),
  ]
);
assert_convert_ast('link auto sane',
  'a \\a[http://example.com] b\n',
  [
    a('p', [
      t('a '),
      a('a', undefined, {'href': [t('http://example.com')]}),
      t(' b'),
    ]),
  ]
);
assert_convert_ast('link auto insane space start and end',
  'a http://example.com b\n',
  [
    a('p', [
      t('a '),
      a('a', undefined, {'href': [t('http://example.com')]}),
      t(' b'),
    ]),
  ]
);
assert_convert_ast('link auto insane start end document',
  'http://example.com',
  [a('p', [a('a', undefined, {'href': [t('http://example.com')]})])],
);
assert_convert_ast('link auto insane start end square brackets',
  '\\p[http://example.com]\n',
  [a('p', [a('a', undefined, {'href': [t('http://example.com')]})])],
);
assert_convert_ast('link auto insane start end literal square brackets',
  '\\[http://example.com\\]\n',
  [a('p', [t('[http://example.com]')])],
);
assert_convert_ast('link auto insane start end named argument',
  '\\Image[aaa.jpg]{description=http://example.com}\n',
  [a('Image', undefined, {
    description: [a('a', undefined, {'href': [t('http://example.com')]})],
    src: [t('aaa.jpg')],
  })],
);
assert_convert_ast('link auto insane start end named argument',
  '\\Image[aaa.jpg]{source=http://example.com}\n',
  [a('Image', undefined, {
    source: [t('http://example.com')],
    src: [t('aaa.jpg')],
  })],
);
assert_convert_ast('link auto insane newline',
  `a

http://example.com

b
`,
  [
    a('p', [t('a')]),
    a('p', [a('a', undefined, {'href': [t('http://example.com')]})]),
    a('p', [t('b')]),
  ]
);
assert_convert_ast('link insane with custom body no newline',
  'http://example.com[aa]',
  [
    a('p', [
      a('a', [t('aa')], {'href': [t('http://example.com')]}),
    ]),
  ]
);
assert_convert_ast('link insane with custom body with newline',
  'http://example.com\n[aa]',
  [
    a('p', [
      a('a', [t('aa')], {'href': [t('http://example.com')]}),
    ]),
  ]
);
assert_convert_ast('link auto end in space',
  `a http://example.com b`,
  [
    a('p', [
      t('a '),
      a('a', undefined, {'href': [t('http://example.com')]}),
      t(' b'),
    ])
  ]
);
assert_convert_ast('link auto end in square bracket',
  `\\p[a http://example.com]`,
  [
    a('p', [
      t('a '),
      a('a', undefined, {'href': [t('http://example.com')]}),
    ])
  ]
);
assert_convert_ast('link auto containing escapes',
  `\\p[a http://example.com\\]a\\}b\\\\c\\ d]`,
  [
    a('p', [
      t('a '),
      a('a', undefined, {'href': [t('http://example.com]a}b\\c d')]}),
    ])
  ]
);
assert_convert_ast('link with multiple paragraphs',
  '\\a[http://example.com][aaa\n\nbbb]\n',
  [
    a('p', [
      a(
        'a',
        [
          a('p', [t('aaa')]),
          a('p', [t('bbb')]),
        ],
        {'href': [t('http://example.com')]},
      ),
    ]),
  ]
);

// Cross references \x
assert_no_error('cross reference simple',
  `\\h[1][My header]

\\x[my-header][link body]
`
);
assert_no_error('cross reference auto default',
  `\\h[1][My header]

\\x[my-header]
`);
assert_no_error('cross reference full boolean style without value',
  `\\h[1][My header]

\\x[my-header]{full}
`,
  [
    a('h', undefined, {
      level: [t('1')],
      title: [t('abc')],
    }),
    a('p', [
      a('x', undefined, {
        full: [],
        href: [t('abc')],
      }),
    ]),
  ]
);
assert_convert_ast('cross reference full boolean style with value 0',
  `\\h[1][abc]

\\x[abc]{full=0}
`,
  [
    a('h', undefined, {
      level: [t('1')],
      title: [t('abc')],
    }),
    a('p', [
      a('x', undefined, {
        full: [t('0')],
        href: [t('abc')],
      }),
    ]),
  ]
);
assert_convert_ast('cross reference full boolean style with value 1',
  `\\h[1][abc]

\\x[abc]{full=1}
`,
  [
    a('h', undefined, {
      level: [t('1')],
      title: [t('abc')],
    }),
    a('p', [
      a('x', undefined, {
        full: [t('1')],
        href: [t('abc')],
      }),
    ]),
  ]
);
assert_error('cross reference full boolean style with invalid value 2',
  `\\h[1][abc]

\\x[abc]{full=2}
`, 3, 8);
assert_error('cross reference full boolean style with invalid value true',
  `\\h[1][abc]

\\x[abc]{full=true}
`, 3, 8);
assert_no_error('cross reference to image',
  `\\Image[ab]{id=cd}{title=ef}

\\x[cd]
`);
assert_no_error('cross reference without content nor target title style full',
  `\\Image[ab]{id=cd}

\\x[cd]
`);
assert_error('cross reference undefined', '\\x[ab]', 1, 3);
//// TODO failing https://github.com/cirosantilli/cirodown/issues/34
//assert_error('cross reference circular loop infinite recursion implicit body',
//  `\\h[1][\\x[h2]]{id=h1}
//
//\\h[2][\\x[h1]]{id=h2}
//`, 1, 1);
// This is fine because the content is explicitly given.
assert_convert_ast('cross reference circular loop infinite recursion explicit body',
  `\\h[1][\\x[h2][myh2]]{id=h1}

\\h[2][\\x[h1][myh1]]{id=h2}
`,
  // TODO
  [
    a('h', undefined, {
      level: [t('1')],
      title: [a('x', [t('myh2')], {'href': [t('h2')]})],
    }),
    a('h', undefined, {
      level: [t('2')],
      title: [a('x', [t('myh1')], {'href': [t('h1')]})],
    }),
  ]
);
assert_convert_ast('cross reference from image title before with x content without image id works',
  `= ab

\\Image[cd]{title=\\x[ab][cd]}
`,
  [
    a('h', undefined, {
      level: [t('1')],
      title: [t('ab')],
    }),
    a('Image', undefined, {
      src: [t('cd')],
      title: [a('x', [t('cd')], {'href': [t('ab')]})],
    }),
  ]
);
assert_convert_ast('cross reference from image title before without x content with image id works',
  `= ab

\\Image[cd]{title=\\x[ab]}{id=cd}
`,
  [
    a('h', undefined, {
      level: [t('1')],
      title: [t('ab')],
    }),
    a('Image', undefined, {
      id: [t('cd')],
      src: [t('cd')],
      title: [a('x', undefined, {'href': [t('ab')]})],
    }),
  ]
);
// https://cirosantilli.com/cirodown#x-within-title-restrictions
assert_error('cross reference from image title before without x content without image is an error',
  `= ab

\\Image[cd]{title=\\x[ab]}
`,
  3, 18
);
assert_convert_ast('cross reference from image title after with x content without image works',
  `= ab

\\Image[cd]{title=\\x[ef][gh]}

== ef
`,
  [
    a('h', undefined, {
      level: [t('1')],
      title: [t('ab')],
    }),
    a('Image', undefined, {
      src: [t('cd')],
      title: [a('x', [t('gh')], {'href': [t('ef')]})],
    }),
    a('h', undefined, {
      level: [t('2')],
      title: [t('ef')],
    }),
  ]
);
assert_convert_ast('cross reference from image title after without x content with image works',
  `= ab

\\Image[cd]{title=\\x[ef]}{id=gh}

== ef
`,
  [
    a('h', undefined, {
      level: [t('1')],
      title: [t('ab')],
    }),
    a('Image', undefined, {
      id: [t('gh')],
      src: [t('cd')],
      title: [a('x', undefined, {'href': [t('ef')]})],
    }),
    a('h', undefined, {
      level: [t('2')],
      title: [t('ef')],
    }),
  ]
);
// https://cirosantilli.com/cirodown#x-within-title-restrictions
assert_error('cross reference from image title after without x content without image is an error',
  `= ab

\\Image[cd]{title=\\x[ef]}

== ef
`,
  3, 18
);
//// https://github.com/cirosantilli/cirodown/issues/45
//assert_convert_ast('cross reference to plaintext id calculated from title',
//  `\\h[1][aa \`bb\` cc]
//
//\\x[aa-bb-cc]
//`,
//  // TODO
//  [
//    a('h', undefined, {
//      level: [t('1')],
//      title: [
//        t('aa '),
//        a('c', [t('bb')]),
//        t(' cc'),
//      ],
//    }),
//    a('p', [
//      a('x', undefined, { href: [t('aa-bb-cc')]}),
//    ]),
//  ]
//);

//// Headers.
// TODO inner ID property test
//assert_convert_ast('header simple',
//  '\\h[1][My header]\n',
//  `<h1 id="my-header"><a href="#my-header">1. My header</a></h1>\n`
//);
assert_convert_ast('header and implicit paragraphs',
  `\\h[1][My header 1]

My paragraph 1.

\\h[2][My header 2]

My paragraph 2.
`,
  [
    a('h', undefined, {level: [t('1')], title: [t('My header 1')]}),
    a('p', [t('My paragraph 1.')]),
    a('h', undefined, {level: [t('2')], title: [t('My header 2')]}),
    a('p', [t('My paragraph 2.')]),
  ]
);
const header_7_expect = [
  a('h', undefined, {level: [t('1')], title: [t('1')]}),
  a('h', undefined, {level: [t('2')], title: [t('2')]}),
  a('h', undefined, {level: [t('3')], title: [t('3')]}),
  a('h', undefined, {level: [t('4')], title: [t('4')]}),
  a('h', undefined, {level: [t('5')], title: [t('5')]}),
  a('h', undefined, {level: [t('6')], title: [t('6')]}),
  a('h', undefined, {level: [t('7')], title: [t('7')]}),
];
assert_convert_ast('header 7 sane',
  `\\h[1][1]

\\h[2][2]

\\h[3][3]

\\h[4][4]

\\h[5][5]

\\h[6][6]

\\h[7][7]
`,
  header_7_expect
);
// https://github.com/cirosantilli/cirodown/issues/32
assert_convert_ast('header 7 insane',
  `= 1

== 2

=== 3

==== 4

===== 5

====== 6

======= 7
`,
  header_7_expect
);
const header_id_new_line_expect =
  [a('h', undefined, {level: [t('1')], title: [t('aa')], id: [t('bb')]})];
assert_convert_ast('header id new line sane',
  '\\h[1][aa]\n{id=bb}',
  header_id_new_line_expect,
);
assert_convert_ast('header id new line insane no trailing elment',
  '= aa\n{id=bb}',
  header_id_new_line_expect,
);
// TODO id goes to code.
assert_convert_ast('header id new line insane trailing element',
  '= aa \\c[bb]\n{id=cc}',
  [a('h', undefined, {
      level: [t('1')],
      title: [
        t('aa '),
        a('c', [t('bb')]),
      ],
      id: [t('cc')],
  })],
);
assert_error('header must be an integer letters', '\\h[a][b]\n', 1, 3);
assert_error('header h2 must be an integer toc',
  `\\h[1][h1]

\\toc

\\h[][h2 1]

\\h[2][h2 2]

\\h[][h2 3]
`, 5, 3);
assert_error('header h1 must be an integer with ToC',
  `\\h[][h1]

\\toc
`, 1, 3);
assert_error('header must be an integer empty', '\\h[][b]\n', 1, 3);
assert_error('header must not be zero', '\\h[0][b]\n', 1, 3);
assert_error('header skip level is an error', '\\h[1][a]\n\n\\h[3][b]\n', 3, 3);

// Code.
assert_convert_ast('code inline sane',
  'a \\c[b c] d\n',
  [
    a('p', [
      t('a '),
      a('c', [t('b c')]),
      t(' d'),
    ]),
  ],
);
assert_convert_ast('code inline insane simple',
  'a `b c` d\n',
  [
    a('p', [
      t('a '),
      a('c', [t('b c')]),
      t(' d'),
    ]),
  ]
);
assert_convert_ast('code inline insane escape backtick',
  'a \\`b c\n',
  [a('p', [t('a `b c')])]
);
assert_convert_ast('code block sane',
  `a

\\C[[
b
c
]]

d
`,
[
  a('p', [t('a')]),
  a('C', [t('b\nc\n')]),
  a('p', [t('d')]),
]
);
assert_convert_ast('code block insane',
  `a

\`\`
b
c
\`\`

d
`,
[
  a('p', [t('a')]),
  a('C', [t('b\nc\n')]),
  a('p', [t('d')]),
]
);

// Math. Minimal testing since this is mostly factored out with code tests.
assert_convert_ast('math inline sane',
  '\\m[[\\sqrt{1 + 1}]]\n',
  [a('p', [a('m', [t('\\sqrt{1 + 1}')])])],
);
assert_convert_ast('math inline insane simple',
  '$\\sqrt{1 + 1}$\n',
  [a('p', [a('m', [t('\\sqrt{1 + 1}')])])],
);
assert_convert_ast('math inline escape dollar',
  'a \\$b c\n',
  [a('p', [t('a $b c')])],
);
assert_no_error('math block sane',
  '\\M[[\\sqrt{1 + 1}]]',
  [a('M', [t('\\sqrt{1 + 1}')])],
);
assert_no_error('math block insane',
  '$$\\sqrt{1 + 1}$$',
  [a('M', [t('\\sqrt{1 + 1}')])],
);
assert_error('math undefined macro', '\\m[[\\reserved_undefined]]', 1, 3);

// Include.
const include_opts = {extra_convert_opts: {
  html_single_page: true,
  read_include: function(input_path) {
    if (input_path === 'include-one-level-1') {
      return `\\h[1][cc]

dd
`
    } else if (input_path === 'include-one-level-2') {
      return `\\h[1][ee]

ff
`
    } else if (input_path === 'include-two-levels') {
      return `\\h[1][ee]

ff

\\h[2][gg]

hh
`
    } else {
      throw new Error(`unknown lnclude path: ${input_path}`);
    }
  },
}};
assert_convert_ast('include simple with paragraph',
  `\\h[1][aa]

bb

\\include[include-one-level-1]

\\include[include-one-level-2]
`,
  [
    a('h', undefined, {level: [t('1')], title: [t('aa')]}),
    a('p', [t('bb')]),
    a('h', undefined, {level: [t('2')], title: [t('cc')]}),
    a('p', [t('dd')]),
    a('h', undefined, {level: [t('2')], title: [t('ee')]}),
    a('p', [t('ff')]),
  ],
  include_opts
);
assert_convert_ast('include multilevel with paragraph',
  `\\h[1][aa]

bb

\\include[include-two-levels]

\\include[include-one-level-1]
`,
  [
    a('h', undefined, {level: [t('1')], title: [t('aa')]}),
    a('p', [t('bb')]),
    a('h', undefined, {level: [t('2')], title: [t('ee')]}),
    a('p', [t('ff')]),
    a('h', undefined, {level: [t('3')], title: [t('gg')]}),
    a('p', [t('hh')]),
    a('h', undefined, {level: [t('2')], title: [t('cc')]}),
    a('p', [t('dd')]),
  ],
  include_opts
);
// TODO failing https://github.com/cirosantilli/cirodown/issues/35
//assert_convert_ast('include simple no paragraph',
//  `\\h[1][aa]
//
//bb
//
//\\include[include-one-level-1]
//\\include[include-one-level-2]
//`,
//  [
//    a('h', undefined, {level: [t('1')], title: [t('aa')]}),
//    a('p', [t('bb')]),
//    a('h', undefined, {level: [t('2')], title: [t('cc')]}),
//    a('p', [t('dd')]),
//    a('h', undefined, {level: [t('2')], title: [t('ee')]}),
//    a('p', [t('ff')]),
//  ],
//  include_opts
//);
//assert_convert_ast('include multilevel no paragraph',
//  `\\h[1][aa]
//
//bb
//
//\\include[include-two-levels]
//\\include[include-one-level-1]
//`,
//  [
//    a('h', undefined, {level: [t('1')], title: [t('aa')]}),
//    a('p', [t('bb')]),
//    a('h', undefined, {level: [t('2')], title: [t('ee')]}),
//    a('p', [t('ff')]),
//    a('h', undefined, {level: [t('3')], title: [t('gg')]}),
//    a('p', [t('hh')]),
//    a('h', undefined, {level: [t('2')], title: [t('cc')]}),
//    a('p', [t('dd')]),
//  ],
//  include_opts
//);

// ID auto-gneration and macro counts.
assert_convert_ast('id autogeneration simple',
  '\\p[aa]\n',
  [a('p', [t('aa')], {}, {id: 'p-1'})],
);
// https://github.com/cirosantilli/cirodown/issues/4
assert_convert_ast('id autogeneration nested',
  '\\q[\\p[aa]]\n\n\\p[bb]\n',
  [
    a('q',[
      a('p', [t('aa')], {}, {id: 'p-1'})
      ], {}, {id: 'q-1'}
    ),
    a('p', [t('bb')], {}, {id: 'p-2'}),
  ],
);

// Toplevel.
assert_convert_ast('toplevel arguments',
  `{title=aaa}

bbb
`,
  a('toplevel', [a('p', [t('bbb')])], {'title': [t('aaa')]}),
  {toplevel: true}
);
assert_error('toplevel explicit content',
  `[]`, 1, 1,
);
// https://github.com/cirosantilli/cirodown/issues/10
assert_error('explicit toplevel macro',
  `\\toplevel`, 1, 1,
);

// Errors. Check that they return gracefully with the error line number,
// rather than blowing up an exception, or worse, not blowing up at all!
assert_error('backslash without macro', '\\ a', 1, 1);
assert_error('unknown macro', '\\reserved_undefined', 1, 1);
assert_error('too many positional arguments', '\\p[ab][cd]', 1, 7);
assert_error('unknown named macro argument', '\\c{reserved_undefined=abc}[]', 1, 4);
assert_error('named argument without =', '\\p{id ab}[cd]', 1, 6);
assert_error('missing mandatory positional argument href of a', '\\a', 1, 1);
assert_error('missing mandatory positional argument level of h', '\\h', 1, 1);
assert_error('stray open positional argument start', 'a[b\n', 1, 2);
assert_error('stray open named argument start', 'a{b\n', 1, 2);
assert_error('argument without close empty', '\\c[\n', 1, 3);
assert_error('argument without close nonempty', '\\c[ab\n', 1, 3);
assert_error('stray positional argument end', 'a]b', 1, 2);
assert_error('stray named argument end}', 'a}b', 1, 2);
assert_error('unterminated literal positional argument', '\\c[[\n', 1, 3);
assert_error('unterminated literal named argument', '\\c{{id=\n', 1, 3);
assert_error('unterminated insane inline code', '`\n', 1, 1);
