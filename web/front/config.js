const ourbigbook_nodejs_front = require('ourbigbook/nodejs_front')

let isProduction;

if (process.env.NEXT_PUBLIC_NODE_ENV === undefined) {
  isProduction = process.env.NODE_ENV === 'production'
} else {
  isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
}

const API_PATH_COMPONENT = 'api'
const escapeUsername = 'go'

let databaseUrl
if (process.env.NODE_ENV === 'test') {
  databaseUrl = process.env.DATABASE_URL_TEST
} else {
  databaseUrl = process.env.DATABASE_URL
}

module.exports = {
  apiPath: '/' + API_PATH_COMPONENT,
  convertOptions: {
    body_only: true,
    html_x_extension: false,
    magic_leading_at: false,
    path_sep: '/',
  },
  // Reserved username to have URLs like /username/my-article and /view/editor/my-article.
  escapeUsername,
  aboutHref: "https://cirosantilli.com/ourbigbook-com",
  appName: `OurBigBook.com`,
  buttonActiveClass: 'active',
  defaultProfileImage: `https://static.productionready.io/images/smiley-cyrus.jpg`,
  articleLimit: 20,
  defaultUserScoreTitle: 'Sum of likes of all articles authored by user',
  /** @type {boolean | 'blocking'} */
  fallback: 'blocking',
  googleAnalyticsId: 'UA-47867706-4',
  // Default isProduction check. Affetcs all aspects of the application unless
  // they are individually overridden, including:
  // * is Next.js server dev or prod?
  // * use SQLite or PostgreSQL?
  // * in browser effects, e.g. show Google Analytics or not?
  isProduction,
  // Overrides isProduction for the "is Next.js server dev or prod?" only.
  isProductionNext: process.env.NODE_ENV_NEXT_SERVER_ONLY === undefined ?
    (isProduction) :
    (process.env.NODE_ENV_NEXT_SERVER_ONLY === 'production'),
  secret: isProduction ? process.env.SECRET : 'secret',
  port: process.env.PORT || 3000,
  postgres: ourbigbook_nodejs_front.postgres,
  reservedUsernames: new Set([
    API_PATH_COMPONENT,
    escapeUsername,
  ]),
  revalidate: 10,
  usernameMinLength: 3,
  usernameMaxLength: 40,
  verbose: process.env.VERBOSE,

  // Used by sequelize-cli as well as our source code.
  development: {
    dialect: 'sqlite',
    logging: true,
    storage: 'db.sqlite3',
  },
  production: Object.assign({
    url:
      databaseUrl ||
      'postgres://ourbigbook_user:a@localhost:5432/ourbigbook',
    logging: true,
  }, ourbigbook_nodejs_front.sequelize_postgres_opts)
}
