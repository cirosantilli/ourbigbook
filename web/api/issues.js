const ourbigbook = require('ourbigbook')

const router = require('express').Router()

const auth = require('../auth')
const config = require('../front/config')
const { cant } = require('../front/cant')
const front = require('../front/js')
const routes = require('../front/routes')
const { convertIssue, convertComment } = require('../convert')
const lib = require('./lib')
const { getArticle, ValidationError, validateParam, isPositiveInteger } = lib

function issueCommentEmailBody({
  body,
  childUrl,
  settingsUrl,
  whatChild,
  whatParent,
  whatParentUnsub,
  unsubThisUrl,
}) {
  const htmlArr = [`<p><a href="${childUrl}">${childUrl}</a></p>`]
  let textBody
  if (body) {
    htmlArr.push(`<p><pre>${ourbigbook.html_escape_content(body)}<pre></p>`)
    textBody = `\n${body}`
  } else {
    textBody = ''
  }
  htmlArr.push(
    `<p>A new ${whatChild} has been created on a ${whatParent} that you follow</a>!</p>`,
    `<p>To unsubscribe from this ${whatParent} click the <a href="${unsubThisUrl}">unsubscribe button on the ${whatParentUnsub} page.</p>`,
    `<p>To unsubscribe from all ${config.appName} emails <a href="${settingsUrl}">change the email settings on your profile page</a>.</p>`,
  )
  return {
    html: htmlArr.join(''),
    text: `${childUrl}
${textBody}
A new ${whatChild} has been created on an ${whatParent} that you follow!

To unsubscribe from this ${whatParent} click the unsubscribe button on the ${whatParentUnsub} page: ${unsubThisUrl}

To unsubscribe from all ${config.appName} emails change the email settings on your profile page: ${settingsUrl}
`,
  }
}

function oneMinuteAgo() {
  return new Date(new Date - 1000 * 60)
}

function oneHourAgo() {
  return new Date(new Date - 1000 * 60 * 60)
}

// Get issues for an article.
// TODO: make article optional, generalize this more as a general find issues function.
router.get('/', auth.optional, async function(req, res, next) {
  try {
    const sequelize = req.app.get('sequelize')
    const opts = {
      includeIssues: true,
      includeIssuesOrder: lib.getOrder(req),
    }
    const number = lib.validateParam(req.params, 'number', {
      typecast: front.typecastInteger,
      validators: [front.isPositiveInteger],
      defaultValue: undefined,
    })
    if (number !== undefined) {
      opts.includeIssuesNumber = number
    }
    const [article, loggedInUser] = await Promise.all([
      getArticle(req, res, opts),
      req.payload ? sequelize.models.User.findByPk(req.payload.id) : null,
    ])
    return res.json({
      issues: await Promise.all(article.issues.map(issue => issue.toJson(loggedInUser)))
    })
  } catch(error) {
    next(error);
  }
})

function getIssueParams(req, res) {
  return {
    number: lib.validateParam(req.params, 'number', {
      typecast: front.typecastInteger,
      validators: [front.isPositiveInteger],
    }),
    slug: validateParam(req.query, 'id'),
  }
}

async function getIssue(req, res, options={}) {
  const { includeComments } = options
  const sequelize = req.app.get('sequelize')
  const { slug, number } = getIssueParams(req, res)
  const issue = await sequelize.models.Issue.getIssue({
    includeComments,
    includeArticle: true,
    number,
    order: lib.getOrder(req),
    sequelize,
    slug,
  })
  if (!issue) {
    throw new ValidationError(
      [`issue not found: article slug: "${slug}" issue number: ${number}`],
      404,
    )
  }
  return issue
}

// Create a new issue.
router.post('/', auth.required, async function(req, res, next) {
  try {
    const sequelize = req.app.get('sequelize')
    const slug = validateParam(req.query, 'id')
    const [
      article,
      issueCountByLoggedInUser,
      issueCountByLoggedInUserLastMinute,
      issueCountByLoggedInUserLastHour,
      lastIssue,
      loggedInUser
    ] = await Promise.all([
      getArticle(req, res),
      sequelize.models.Issue.count({ where: { authorId: req.payload.id } }),
      sequelize.models.Issue.count({ where: {
        authorId: req.payload.id,
        createdAt: { [sequelize.Sequelize.Op.gt]: oneMinuteAgo() }
      }}),
      sequelize.models.Issue.count({ where: {
        authorId: req.payload.id,
        createdAt: { [sequelize.Sequelize.Op.gt]: oneHourAgo() }
      }}),
      sequelize.models.Issue.findOne({
        order: [['number', 'DESC']],
        include: [{
          model: sequelize.models.Article,
          as: 'article',
          where: { slug },
        }]
      }),
      sequelize.models.User.findByPk(req.payload.id),
    ])
    const errs = []
    let err = front.hasReachedMaxItemCount(loggedInUser, issueCountByLoggedInUser, 'issues')
    if (err) { errs.push(err) }
    if (!config.isTest && !loggedInUser.admin) {
      if (issueCountByLoggedInUserLastMinute > loggedInUser.maxIssuesPerMinute) {
        errs.push(`maximum number of new issues per minute reached: ${loggedInUser.maxIssuesPerMinute}`)
      }
      if (issueCountByLoggedInUserLastHour > loggedInUser.maxIssuesPerHour) {
        errs.push(`maximum number of new issues per hour reached: ${loggedInUser.maxIssuesPerHour}`)
      }
    }
    if (errs.length) { throw new ValidationError(errs, 403) }
    const body = lib.validateParam(req, 'body')
    const issueData = lib.validateParam(body, 'issue')
    const bodySource = lib.validateParam(issueData, 'bodySource', {
      validators: [ front.isString ],
      defaultValue: ''
    })
    lib.validateBodySize(loggedInUser, bodySource)
    const titleSource = lib.validateParam(issueData, 'titleSource', {
      validators: [front.isString, front.isTruthy]
    })
    const issue = await convertIssue({
      article,
      bodySource,
      number: lastIssue ? lastIssue.number + 1 : 1,
      sequelize,
      titleSource,
      user: loggedInUser
    })
    issue.author = loggedInUser
    const [issueJson, followers] = await Promise.all([
      issue.toJson(loggedInUser),
      article.getFollowers(),
    ])
    for (const follower of followers) {
      if (loggedInUser.id !== follower.id) {
        if (
          follower.id !== loggedInUser.id &&
          follower.emailNotifications
        ) {
          const emailBody = issueCommentEmailBody({
            body: issue.bodySource,
            childUrl: `${routes.host(req)}${routes.issue(article.slug, issue.number)}`,
            settingsUrl: `${routes.host(req)}${routes.userEdit(loggedInUser.username)}`,
            whatParent: 'article',
            whatParentUnsub: 'article discussions',
            whatChild: 'discussion',
            unsubThisUrl: `${routes.host(req)}${routes.issues(article.slug)}`,
          })
          lib.sendEmail(Object.assign({
            to: follower.email,
            fromName: loggedInUser.displayName,
            subject: `[${article.slug}#${issue.number}] ${issue.titleSource}`,
          }, emailBody))
        }
      }
    }
    res.json({ issue: issueJson })
  } catch(error) {
    next(error);
  }
})

// Update issue.
router.put('/:number', auth.required, async function(req, res, next) {
  try {
    const sequelize = req.app.get('sequelize')
    const [issue, loggedInUser] = await Promise.all([
      getIssue(req, res),
      sequelize.models.User.findByPk(req.payload.id),
    ])
    const article = issue.article
    if (cant.editIssue(loggedInUser, issue)) {
      return res.sendStatus(403)
    }
    const body = lib.validateParam(req, 'body')
    const issueData = lib.validateParam(body, 'issue')
    const bodySource = lib.validateParam(issueData, 'bodySource', {
      validators: [front.isString],
      defaultValue: undefined,
    })
    if (bodySource !== undefined) {
      lib.validateBodySize(loggedInUser, bodySource)
    }
    const titleSource = lib.validateParam(issueData, 'titleSource', {
      validators: [front.isString, front.isTruthy],
      defaultValue: undefined,
    })
    const newIssue = await convertIssue({
      article,
      bodySource,
      issue,
      sequelize,
      titleSource,
      user: loggedInUser,
    })
    newIssue.author = loggedInUser
    res.json({ issue: await newIssue.toJson(loggedInUser) })
  } catch(error) {
    next(error);
  }
})

async function validateFollow(req, res, user, article, create) {
  if (!article) {
    throw new ValidationError(
      ['Article not found'],
      404,
    )
  }
  let msg
  if (create) {
    msg = cant.followArticle(user, article)
  } else {
    msg = cant.unfollowArticle(user, article)
  }
  if (msg) {
    throw new ValidationError([msg], 403)
  }
  if (await user.hasFollowedIssue(article) === create) {
    throw new ValidationError(
      [`User '${user.username}' ${create ? 'already follows' : 'does not follow'} issue '${article.number}'`],
      403,
    )
  }
}

// Follow an issue
router.post('/:number/follow', auth.required, async function(req, res, next) {
  try {
    const [article, loggedInUser] = await Promise.all([
      getIssue(req, res),
      req.app.get('sequelize').models.User.findByPk(req.payload.id),
    ])
    await validateFollow(req, res, loggedInUser, article, true)
    await loggedInUser.addIssueFollowSideEffects(article)
    const newArticle = await lib.getArticle(req, res)
    return res.json({ article: await newArticle.toJson(loggedInUser) })
  } catch(error) {
    next(error);
  }
})

// Unfollow an issue
router.delete('/:number/follow', auth.required, async function(req, res, next) {
  try {
    const [article, loggedInUser] = await Promise.all([
      getIssue(req, res),
      req.app.get('sequelize').models.User.findByPk(req.payload.id),
    ])
    await validateFollow(req, res, loggedInUser, article, false)
    await loggedInUser.removeIssueFollowSideEffects(article)
    const newArticle = await lib.getArticle(req, res)
    return res.json({ article: await newArticle.toJson(loggedInUser) })
  } catch(error) {
    next(error);
  }
})

async function validateLike(req, res, user, article, isLike) {
  if (!article) {
    throw new ValidationError(
      ['Article not found'],
      404,
    )
  }
  let msg
  if (isLike) {
    msg = cant.likeArticle(user, article)
  } else {
    msg = cant.unlikeArticle(user, article)
  }
  if (msg) {
    throw new ValidationError([msg], 403)
  }
  if (await user.hasLikedIssue(article) === isLike) {
    throw new ValidationError(
      [`User '${user.username}' ${isLike ? 'already likes' : 'does not like'} issue '${article.number}'`],
      403,
    )
  }
}

// Like an issue
router.post('/:number/like', auth.required, async function(req, res, next) {
  try {
    const [article, loggedInUser] = await Promise.all([
      getIssue(req, res),
      req.app.get('sequelize').models.User.findByPk(req.payload.id),
    ])
    await validateLike(req, res, loggedInUser, article, true)
    await loggedInUser.addIssueLikeSideEffects(article)
    const newArticle = await lib.getArticle(req, res)
    return res.json({ article: await newArticle.toJson(loggedInUser) })
  } catch(error) {
    next(error);
  }
})

// Unlike an issue
router.delete('/:number/like', auth.required, async function(req, res, next) {
  try {
    const [article, loggedInUser] = await Promise.all([
      getIssue(req, res),
      req.app.get('sequelize').models.User.findByPk(req.payload.id),
    ])
    await validateLike(req, res, loggedInUser, article, false)
    await loggedInUser.removeIssueLikeSideEffects(article)
    const newArticle = await lib.getArticle(req, res)
    return res.json({ article: await newArticle.toJson(loggedInUser) })
  } catch(error) {
    next(error);
  }
})

// Get issues's comments.
router.get('/:number/comments', auth.optional, async function(req, res, next) {
  try {
    const [issue, loggedInUser] = await Promise.all([
      getIssue(req, res, { includeComments: true }),
      req.payload ? req.app.get('sequelize').models.User.findByPk(req.payload.id) : null,
    ])
    return res.json({
      comments: await Promise.all(issue.comments.map(comment => comment.toJson(loggedInUser)))
    })
  } catch(error) {
    next(error);
  }
})

// Create a new comment.
router.post('/:number/comments', auth.required, async function(req, res, next) {
  try {
    const { slug, number } = getIssueParams(req, res)
    const sequelize = req.app.get('sequelize')
    const [
      commentCountByLoggedInUser,
      commentCountByLoggedInUserLastMinute,
      commentCountByLoggedInUserLastHour,
      issue,
      lastComment,
      loggedInUser
    ] = await Promise.all([
      sequelize.models.Comment.count({ where: { authorId: req.payload.id } }),
      sequelize.models.Comment.count({ where: {
        authorId: req.payload.id,
        createdAt: { [sequelize.Sequelize.Op.gt]: oneMinuteAgo() }
      }}),
      sequelize.models.Comment.count({ where: {
        authorId: req.payload.id,
        createdAt: { [sequelize.Sequelize.Op.gt]: oneHourAgo() }
      }}),
      getIssue(req, res),
      sequelize.models.Comment.findOne({
        order: [['number', 'DESC']],
        include: [{
          model: sequelize.models.Issue,
          as: 'issue',
          where: { number },
          include: [{
            model: sequelize.models.Article,
            as: 'article',
            where: { slug },
          }],
        }]
      }),
      sequelize.models.User.findByPk(req.payload.id),
    ])
    const errs = []
    let err = front.hasReachedMaxItemCount(loggedInUser, commentCountByLoggedInUser, 'comments')
    if (err) { errs.push(err) }
    if (!config.isTest && !loggedInUser.admin) {
      if (commentCountByLoggedInUserLastMinute > loggedInUser.maxIssuesPerMinute) {
        errs.push(`maximum number of new comments per minute reached: ${loggedInUser.maxIssuesPerMinute}`)
      }
      if (commentCountByLoggedInUserLastHour > loggedInUser.maxIssuesPerHour) {
        errs.push(`maximum number of new comments per hour reached: ${loggedInUser.maxIssuesPerHour}`)
      }
    }
    if (errs.length) { throw new ValidationError(errs, 403) }
    const body = lib.validateParam(req, 'body')
    const commentData = lib.validateParam(body, 'comment')
    const source = lib.validateParam(commentData, 'source', {
      validators: [front.isString],
    })
    lib.validateBodySize(loggedInUser, source)
    const comment = await convertComment({
      issue,
      number: lastComment ? lastComment.number + 1 : 1,
      sequelize,
      source,
      user: loggedInUser,
    })
    comment.author = loggedInUser
    const article = issue.article
    const [commentJson, followers] = await Promise.all([
      comment.toJson(loggedInUser),
      issue.getFollowers(),
    ])
    for (const follower of followers) {
      if (loggedInUser.id !== follower.id) {
        const whatParent = 'discussion'
        const emailBody = issueCommentEmailBody({
          body: comment.source,
          childUrl: `${routes.host(req)}${routes.issueComment(article.slug, issue.number, comment.number)}`,
          settingsUrl: `${routes.host(req)}${routes.userEdit(loggedInUser.username)}`,
          whatParent,
          whatParentUnsub: whatParent,
          whatChild: 'comment',
          unsubThisUrl: `${routes.host(req)}${routes.issueComments(article.slug, issue.number)}`,
        })
        if (
          follower.id !== loggedInUser.id &&
          follower.emailNotifications
        ) {
          lib.sendEmail(Object.assign({
            to: follower.email,
            fromName: loggedInUser.displayName,
            subject: `[${article.slug}#${issue.number}] ${issue.titleSource}`,
          }, emailBody))
        }
      }
    }
    res.json({ comment: commentJson })
  } catch(error) {
    next(error);
  }
})

// Delete a comment
router.delete('/:issueNumber/comments/:commentNumber', auth.required, async function(req, res, next) {
  try {
    const sequelize = req.app.get('sequelize')
    const commentNumber = lib.validateParam(req.params, 'commentNumber', {
      typecast: front.typecastInteger,
      validators: [front.isPositiveInteger],
    })
    const issueNumber = lib.validateParam(req.params, 'issueNumber', {
      typecast: front.typecastInteger,
      validators: [front.isPositiveInteger],
    })
    const [comment, loggedInUser] = await Promise.all([
      sequelize.models.Comment.findOne({
        where: {
          number: commentNumber,
        },
        include: [
          {
            model: sequelize.models.Issue,
            as: 'issue',
            where: { number: issueNumber },
            required: true,
            include: [
              {
                model: sequelize.models.Article,
                as: 'article',
                where: { slug: validateParam(req.query, 'id') },
                required: true,
              }
            ],
          },
          {
            model: sequelize.models.User,
            as: 'author',
          },
        ],
      }),
      sequelize.models.User.findByPk(req.payload.id),
    ])
    if (!comment) {
      res.sendStatus(404)
    } else {
      if (cant.deleteComment(loggedInUser, comment)) {
        res.sendStatus(403)
      } else {
        await comment.destroySideEffects()
        res.sendStatus(204)
      }
    }
  } catch(error) {
    next(error);
  }
})

module.exports = router
