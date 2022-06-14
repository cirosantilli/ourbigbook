const front = require('../front/js')

async function getArticle(req, res, options={}) {
  const { includeIssues } = options
  const slug = validateParam(req.query, 'id')
  const sequelize = req.app.get('sequelize')
  const article = await sequelize.models.Article.getArticle({ includeIssues, sequelize, slug })
  if (!article) {
    throw new ValidationError(
      [`Article slug not found: "${slug}"`],
      404,
    )
  }
  return article
}

// https://stackoverflow.com/questions/14382725/how-to-get-the-correct-ip-address-of-a-client-into-a-node-socket-io-app-hosted-o/14382990#14382990
// Works on Heroku 2021.
function getClientIp(req) {
  return req.header('x-forwarded-for')
}

// When this class is thrown and would blows up on toplevel, we catch it instead
// and gracefully return the specified error to the client instead of doing a 500.
class ValidationError extends Error {
  constructor(errors, status) {
    super();
    this.errors = errors
    if (status === undefined) {
      status = 422
    }
    this.status = status
  }
}

function validatePositiveInteger(s) {
  const i = Number(s)
  let ok = s !== '' && Number.isInteger(i) && i >= 0
  return [i, ok]
}

function validateTrueOrFalse(tf) {
  const ok = (tf === true || tf === false)
  return [tf, ok]
}

function validateTruthy(s) {
  return [s, !!s]
}

function validate(inputString, validator, prop) {
  if (validator == undefined) {
    validator = validateTruthy
  }
  let [val, ok] = validator(inputString)
  if (ok) {
    return val
  } else {
    throw new ValidationError(
      { [prop]: [`validator ${validator.name} failed on ${prop} = "${inputString}"`] },
      422,
    )
  }
}

function validateParam(obj, prop, validator, defaultValue) {
  let param = obj[prop]
  if (typeof param === 'undefined') {
    return defaultValue
  } else {
    return validate(param, validator, prop)
  }
}

function validateParamMandatory(obj, prop, validator, defaultValue) {
  return validate(obj[prop], validator, prop)
}

module.exports = {
  getArticle,
  getClientIp,
  ValidationError,
  validatePositiveInteger,
  validate,
  validateParamMandatory,
  validateParam,
  validateTrueOrFalse,
}
