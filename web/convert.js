const lodash = require('lodash')

const ourbigbook = require('ourbigbook')
const {
  update_database_after_convert,
  remove_duplicates_sorted_array,
  SqliteDbProvider,
} = require('ourbigbook/nodejs_webpack_safe')
const ourbigbook_nodejs_webpack_safe = require('ourbigbook/nodejs_webpack_safe')

const { ValidationError } = require('./api/lib')
const { convertOptions, maxArticleTitleSize, read_include_web } = require('./front/config')
const { modifyEditorInput } = require('./front/js')
const routes = require('./front/routes')

// Subset of convertArticle for usage in issues and comments.
// This is a much simpler procedure as it does not alter the File/Article database.
async function convert({
  author,
  bodySource,
  convertOptionsExtra,
  path,
  render,
  sequelize,
  splitHeaders,
  titleSource,
  transaction,
}) {
  const db_provider = new SqliteDbProvider(sequelize)
  const extra_returns = {};
  bodySource = bodySource.replace(/\n+$/, '')
  const input = modifyEditorInput(titleSource, bodySource).new
  if (path === undefined) {
    path = titleSource ? ourbigbook.title_to_id(titleSource) : 'asdf'
  }
  const input_path = `${ourbigbook.AT_MENTION_CHAR}${author.username}/${path}.${ourbigbook.OURBIGBOOK_EXT}`
  await ourbigbook.convert(
    input,
    lodash.merge({
      db_provider,
      input_path,
      ourbigbook_json: {
        h: {
          splitDefault: false,
          splitDefaultNotToplevel: true,
        },
      },
      read_include: read_include_web(async (idid) => (await sequelize.models.Id.count({ where: { idid }, transaction })) > 0),
      ref_prefix: `${ourbigbook.AT_MENTION_CHAR}${author.username}`,
      render,
      split_headers: splitHeaders === undefined ? true : splitHeaders,
      web: true,
    }, convertOptions, convertOptionsExtra),
    extra_returns,
  )
  if (extra_returns.errors.length > 0) {
    const errsNoDupes = remove_duplicates_sorted_array(
      extra_returns.errors.map(e => e.toString()))
    throw new ValidationError(errsNoDupes)
  }
  return { db_provider, extra_returns, input_path }
}

// This does the type of stuff that OurBigBook CLI does for CLI
// around the conversion itself, i.e. setting up the database, saving output files
// but on the Web.
//
// This is how Articles should always be created and updated.
async function convertArticle({
  author,
  bodySource,
  forceNew,
  path,
  render,
  sequelize,
  titleSource,
  transaction,
}) {
  let articles
  await sequelize.transaction({ transaction }, async (transaction) => {
    if (render === undefined) {
      render = true
    }
    const { db_provider, extra_returns, input_path } = await convert({
      author,
      bodySource,
      forceNew,
      path,
      render,
      sequelize,
      titleSource,
      transaction,
    })
    const idid = extra_returns.context.header_tree.children[0].ast.id
    if (forceNew && await sequelize.models.File.findOne({ where: { path: input_path }, transaction })) {
      throw new ValidationError(`Article already exists: ${idid}`)
    }
    await update_database_after_convert({
      authorId: author.id,
      bodySource,
      extra_returns,
      db_provider,
      sequelize,
      path: input_path,
      render,
      titleSource,
      transaction,
    })
    if (render) {
      const check_db_errors = await ourbigbook_nodejs_webpack_safe.check_db(
        sequelize,
        [input_path],
        transaction
      )
      if (check_db_errors.length > 0) {
        throw new ValidationError(check_db_errors)
      }
      const file = await sequelize.models.File.findOne({ where: { path: input_path }, transaction })
      const articleArgs = []
      for (const outpath in extra_returns.rendered_outputs) {
        const rendered_output = extra_returns.rendered_outputs[outpath]
        articleArgs.push({
          fileId: file.id,
          render: rendered_output.full,
          slug: outpath.slice(ourbigbook.AT_MENTION_CHAR.length, -ourbigbook.HTML_EXT.length - 1),
          titleRender: rendered_output.title,
          titleSource: rendered_output.titleSource,
          titleSourceLine:
            rendered_output.titleSourceLocation
              ? rendered_output.titleSourceLocation.line
              // Can happen if user tries to add h1 to a document. TODO investigate further why.
              : undefined,
          topicId: outpath.slice(
            ourbigbook.AT_MENTION_CHAR.length + author.username.length + 1,
            -ourbigbook.HTML_EXT.length - 1
          ),
        })
        if (titleSource.length > maxArticleTitleSize) {
          throw new ValidationError(`Title source too long: ${titleSource.length} bytes, maximum: ${maxArticleTitleSize} bytes, title: ${titleSource}`)
        }
      }
      await sequelize.models.Article.bulkCreate(
        articleArgs,
        {
          updateOnDuplicate: [
            'titleRender',
            'titleSource',
            'titleSourceLine',
            'render',
            'topicId',
            'updatedAt',
          ],
          transaction,
          // Trying this to validate mas titleSource length here leads to another error.
          // validate: true,
          // individualHooks: true,
        }
      )
      // Find here because upsert not yet supported in SQLite.
      // https://stackoverflow.com/questions/29063232/how-to-get-the-id-of-an-inserted-or-updated-record-in-sequelize-upsert
      articles = await sequelize.models.Article.findAll({
        where: { slug: articleArgs.map(arg => arg.slug) },
        include: {
          model: sequelize.models.File,
          as: 'file',
        },
        order: [['slug', 'ASC']],
        transaction,
      })
      await sequelize.models.Topic.updateTopics(articles, { newArticles: true, transaction })
    } else {
      articles = []
    }
  })
  return articles
}

async function convertComment({ issue, number, sequelize, source, user }) {
  const { extra_returns } = await convert({
    author: user,
    bodySource: source,
    convertOptionsExtra: {
      x_external_prefix: '../'.repeat((routes.issue(issue.issues.slug, number).match(/\//g) || []).length - 1),
    },
    render: true,
    sequelize,
    splitHeaders: false,
    titleSource: undefined,
  })
  const outpath = Object.keys(extra_returns.rendered_outputs)[0]
  return sequelize.models.Comment.create({
    issueId: issue.id,
    number,
    authorId: user.id,
    source,
    render: extra_returns.rendered_outputs[outpath].full,
  })
}

async function convertIssue({ article, bodySource, issue, number, sequelize, titleSource, user }) {
  if (issue) {
    if (bodySource === undefined) {
      bodySource = issue.bodySource
    } else {
      issue.bodySource = bodySource
    }
    if (titleSource === undefined) {
      titleSource = issue.titleSource
    } else {
      issue.titleSource = titleSource
    }
  }
  if (titleSource.length > maxArticleTitleSize) {
    //throw new ValidationError(`Title source too long: ${titleSource.length} bytes, maximum: ${maxArticleTitleSize} bytes, title: ${titleSource}`)
  }
  // We use routes here to achieve a path that matches the exact length of what the issue will render to,
  // so that the internal cross references will render with the correct number of ../
  const { extra_returns } = await convert({
    author: user,
    bodySource,
    convertOptionsExtra: {
      x_external_prefix: '../'.repeat((routes.issue(article.slug, number).match(/\//g) || []).length - 1),
    },
    render: true,
    sequelize,
    splitHeaders: false,
    titleSource,
  })
  const outpath = Object.keys(extra_returns.rendered_outputs)[0]
  const renders = extra_returns.rendered_outputs[outpath]
  const titleRender = renders.title
  const render = renders.full
  if (issue === undefined) {
    return sequelize.models.Issue.create({
      articleId: article.id,
      authorId: user.id,
      titleSource,
      bodySource,
      titleRender,
      render,
      number,
    })
  } else {
    issue.titleRender = titleRender
    issue.render = render
    return issue.save()
  }
}

module.exports = {
  convert,
  convertArticle,
  convertComment,
  convertIssue,
}
