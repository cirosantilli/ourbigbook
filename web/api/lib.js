async function getArticle(req, res) {
  if (req.query.id) {
    const article = await req.app.get('sequelize').models.Article.findOne({
      where: { slug: req.query.id },
      include: [{ model: req.app.get('sequelize').models.User, as: 'author' }]
    })
    if (!article) {
      throw new ValidationError(
        [`Article slug not found: "${req.query.id}"`],
        404,
      )
    }
    return article
  }
}
exports.getArticle = getArticle

class ValidationError extends Error {
  constructor(errors, status) {
    super();
    this.errors = errors
    this.status = status
  }
}
exports.ValidationError = ValidationError

function validatePositiveInteger(s) {
  const i = Number(s)
  let ok = s !== '' && Number.isInteger(i) && i >= 0
  return [i, ok]
}
exports.validatePositiveInteger = validatePositiveInteger

function validate(inputString, validator, prop) {
  let [val, ok] = validator(inputString)
  if (ok) {
    return val
  } else {
    throw new ValidationError(
      { [prop]: [`validator ${validator.name} failed on ${msg}"${param}"`] },
      422,
    )
  }
}
exports.validate = validate

function validateParam(obj, prop, validator, defaultValue) {
  let param = obj[prop]
  if (typeof param === 'undefined') {
    return defaultValue
  } else {
    return validate(param, validator, prop)
  }
}
exports.validateParam = validateParam
