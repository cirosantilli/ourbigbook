// Contains exports that should only be visible from Node.js but not browser.

const cirodown = require('cirodown');
const path = require('path');

const ENCODING = 'utf8';
exports.ENCODING = ENCODING;

const PACKAGE_NAME = 'cirodown';
exports.PACKAGE_NAME = PACKAGE_NAME;

// https://stackoverflow.com/questions/10111163/in-node-js-how-can-i-get-the-path-of-a-module-i-have-loaded-via-require-that-is
const PACKAGE_PATH = path.dirname(require.resolve(path.join(PACKAGE_NAME, 'package.json')));
exports.PACKAGE_PATH = PACKAGE_PATH;

const DIST_PATH = path.join(PACKAGE_PATH, 'dist');
exports.DIST_PATH = DIST_PATH;

const DIST_CSS_BASENAME = PACKAGE_NAME + '.css';
exports.DIST_CSS_BASENAME = DIST_CSS_BASENAME;

const DIST_CSS_PATH = path.join(DIST_PATH, DIST_CSS_BASENAME);
exports.DIST_CSS_PATH = DIST_CSS_PATH;

const DIST_JS_BASENAME = PACKAGE_NAME + '_runtime.js';
exports.DIST_JS_BASENAME = DIST_JS_BASENAME;

const DIST_JS_PATH = path.join(DIST_PATH, DIST_JS_BASENAME);
exports.DIST_JS_PATH = DIST_JS_PATH;

const PACKAGE_NODE_MODULES_PATH = path.join(PACKAGE_PATH, 'node_modules');
exports.PACKAGE_NODE_MODULES_PATH = PACKAGE_NODE_MODULES_PATH;

const PACKAGE_PACKAGE_JSON_PATH = path.join(PACKAGE_PATH, 'package.json');
exports.PACKAGE_PACKAGE_JSON_PATH = PACKAGE_PACKAGE_JSON_PATH;

const GITIGNORE_PATH = path.join(PACKAGE_PATH, 'gitignore');
exports.GITIGNORE_PATH = GITIGNORE_PATH;

const PACKAGE_SASS_BASENAME = PACKAGE_NAME + '.scss';
exports.PACKAGE_SASS_BASENAME = PACKAGE_SASS_BASENAME;

class ZeroFileProvider extends cirodown.FileProvider {
  get(path) { return {toplevel_scope_cut_length: 0}; }
}
exports.ZeroFileProvider = ZeroFileProvider;
