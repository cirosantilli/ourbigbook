const ourbigbook = require('ourbigbook')
const {
  update_database_after_convert,
  remove_duplicates_sorted_array,
  SqliteFileProvider,
  SqliteIdProvider,
} = require('ourbigbook/nodejs_webpack_safe')
const ourbigbook_nodejs_webpack_safe = require('ourbigbook/nodejs_webpack_safe')

const { ValidationError } = require('./api/lib')
const { convertOptions, convertOptionsJson } = require('./front/config')
const { modifyEditorInput } = require('./front/js')

// This does the type of stuff that OurBigBook CLI does for CLI
// around the conversion itself, i.e. setting up the database, saving output files
// but on the Web.
//
// This is how Articles should always be created and updated.
async function convert({
  author,
  body,
  forceNew,
  path,
  render,
  sequelize,
  title,
  transaction,
}) {
  if (render === undefined) {
    render = true
  }
  const id_provider = new SqliteIdProvider(sequelize)
  const file_provider = new SqliteFileProvider(sequelize, id_provider);
  const extra_returns = {};
  body = body.replace(/\n+$/, '')
  const input = modifyEditorInput(title, body).new
  if (!path) {
    path = `${ourbigbook.title_to_id(title)}${ourbigbook.OURBIGBOOK_EXT}`
  }
  const input_path = `${ourbigbook.AT_MENTION_CHAR}${author.username}/${path}`
  await ourbigbook.convert(
    input,
    Object.assign({
      id_provider,
      file_provider,
      input_path,
      ourbigbook_json: Object.assign({
        h: {
          splitDefault: true,
          splitDefaultNotToplevel: true,
        },
      }, convertOptionsJson),
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
      split_headers: true,
    }, convertOptions),
    extra_returns,
  )
  if (extra_returns.errors.length > 0) {
    const errsNoDupes = remove_duplicates_sorted_array(
      extra_returns.errors.map(e => e.toString()))
    throw new ValidationError(errsNoDupes)
  }
  const idid = extra_returns.context.header_tree.children[0].ast.id
  const filePath = `${idid}${ourbigbook.OURBIGBOOK_EXT}`
  if (forceNew && await sequelize.models.File.findOne({ where: { path: filePath }, transaction })) {
    throw new ValidationError(`Article already exists: ${idid}`)
  }
  await update_database_after_convert({
    authorId: author.id,
    body,
    extra_returns,
    id_provider,
    sequelize,
    path: filePath,
    render,
    title,
    transaction,
  })
  const check_db_errors = await ourbigbook_nodejs_webpack_safe.check_db(
    sequelize,
    [input_path],
    transaction
  )
  if (check_db_errors.length > 0) {
    throw new ValidationError(check_db_errors)
  }
  if (render) {
    const file = await sequelize.models.File.findOne({ where: { path: filePath }, transaction })
    const articleArgs = []
    for (const outpath in extra_returns.rendered_outputs) {
      articleArgs.push({
        fileId: file.id,
        render: extra_returns.rendered_outputs[outpath].full,
        slug: outpath.slice(ourbigbook.AT_MENTION_CHAR.length, -ourbigbook.HTML_EXT.length - 1),
        title: extra_returns.rendered_outputs[outpath].title,
        topicId: outpath.slice(
          ourbigbook.AT_MENTION_CHAR.length + author.username.length + 1,
          -ourbigbook.HTML_EXT.length - 1
        ),
      })
    }
    await sequelize.models.Article.bulkCreate(
      articleArgs,
      { updateOnDuplicate: ['title', 'render', 'topicId', 'updatedAt'], transaction }
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
    })
    for (const article of articles) {
      article.file.author = author
    }
    return articles
  } else {
    return []
  }
}

module.exports = {
  convert,
}
