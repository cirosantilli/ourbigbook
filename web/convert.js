const lodash = require('lodash')

const ourbigbook = require('ourbigbook')
const {
  update_database_after_convert,
  remove_duplicates_sorted_array,
  SqliteDbProvider,
} = require('ourbigbook/nodejs_webpack_safe')
const ourbigbook_nodejs_webpack_safe = require('ourbigbook/nodejs_webpack_safe')

const { ValidationError } = require('./api/lib')
const { convertOptions } = require('./front/config')
const { modifyEditorInput } = require('./front/js')

// Subset of convertArticle for usage in issues and comments.
// This is a much simpler procedure as it does not alter the File/Article database.
async function convert({
  author,
  bodySource,
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
    path = `${ourbigbook.title_to_id(titleSource)}`
  }
  path += `.${ourbigbook.OURBIGBOOK_EXT}`
  const input_path = `${ourbigbook.AT_MENTION_CHAR}${author.username}/${path}`
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
      read_include: ourbigbook_nodejs_webpack_safe.read_include({
        exists: async (inpath) => {
          const suf = ourbigbook.Macro.HEADER_SCOPE_SEPARATOR + ourbigbook.INDEX_BASENAME_NOEXT
          let idid
          if (inpath.endsWith(suf)) {
            idid = inpath.slice(0, -suf.length)
          } else {
            idid = inpath
          }
          return (await sequelize.models.Id.count({ where: { idid }, transaction })) > 0
        },
        // Only needed for --embed-includes, which is not implemented on the dynamic website for now.
        read: (inpath) => '',
        path_sep: ourbigbook.Macro.HEADER_SCOPE_SEPARATOR,
        ext: '',
      }),
      ref_prefix: `${ourbigbook.AT_MENTION_CHAR}${author.username}`,
      render,
      split_headers: splitHeaders === undefined ? true : splitHeaders,
      web: true,
    }, convertOptions),
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
  const filePath = `${idid}.${ourbigbook.OURBIGBOOK_EXT}`
  if (forceNew && await sequelize.models.File.findOne({ where: { path: filePath }, transaction })) {
    throw new ValidationError(`Article already exists: ${idid}`)
  }
  await update_database_after_convert({
    authorId: author.id,
    bodySource,
    extra_returns,
    db_provider,
    sequelize,
    path: filePath,
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
    const file = await sequelize.models.File.findOne({ where: { path: filePath }, transaction })
    const articleArgs = []
    for (const outpath in extra_returns.rendered_outputs) {
      const rendered_output = extra_returns.rendered_outputs[outpath]
      articleArgs.push({
        fileId: file.id,
        render: rendered_output.full,
        slug: outpath.slice(ourbigbook.AT_MENTION_CHAR.length, -ourbigbook.HTML_EXT.length - 1),
        titleRender: rendered_output.title,
        titleSource: rendered_output.titleSource,
        titleSourceLine: rendered_output.titleSourceLocation.line,
        topicId: outpath.slice(
          ourbigbook.AT_MENTION_CHAR.length + author.username.length + 1,
          -ourbigbook.HTML_EXT.length - 1
        ),
      })
    }
    await sequelize.models.Article.bulkCreate(
      articleArgs,
      {
        updateOnDuplicate: ['titleRender', 'titleSource', 'titleSourceLine', 'render', 'topicId', 'updatedAt'],
        transaction
      }
    )
    // Find here because upsert not yet supported in SQLite.
    // https://stackoverflow.com/questions/29063232/how-to-get-the-id-of-an-inserted-or-updated-record-in-sequelize-upsert
    const articles = await sequelize.models.Article.findAll({
      where: { slug: articleArgs.map(arg => arg.slug) },
      include: {
        model: sequelize.models.File,
        as: 'file',
      },
      order: [['slug', 'ASC']],
      transaction,
    })
    await sequelize.models.Topic.updateTopics(articles, { newArticles: true, transaction })
    return articles
  } else {
    return []
  }
}

async function convertComment({ issue, number, sequelize, source, user }) {
  const { extra_returns } = await convert({
    author: user,
    bodySource: source,
    path: `${ourbigbook.INDEX_BASENAME_NOEXT}`,
    render: true,
    sequelize,
    splitHeaders: false,
    titleSource: undefined,
  })
  const outpath = `${ourbigbook.AT_MENTION_CHAR}${user.username}.${ourbigbook.HTML_EXT}`;
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
  const { extra_returns } = await convert({
    author: user,
    bodySource,
    path: `${ourbigbook.INDEX_BASENAME_NOEXT}`,
    render: true,
    sequelize,
    splitHeaders: false,
    titleSource,
  })
  const outpath = `${ourbigbook.AT_MENTION_CHAR}${user.username}.${ourbigbook.HTML_EXT}`;
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
