const url = require('url');

const { sendJsonHttp } = require('ourbigbook/web_api')

const router = require('express').Router()
const passport = require('passport')

const auth = require('../auth')
const lib = require('./lib')
const { cant } = require('../front/cant')
const front = require('../front/js')
const config = require('../front/config')
const routes = require('../front/routes')

async function authenticate(req, res, next, opts={}) {
  const { forceVerify } = opts
  passport.authenticate('local', { session: false }, async function(err, user, info) {
    if (err) {
      return next(err)
    }
    if (user) {
      if (user.verified || forceVerify) {
        user.token = user.generateJWT()
        verified = true
      } else {
        verified = false
      }
      return res.json({
        user: await user.toJson(user),
        verified,
      })
    } else {
      return res.status(422).json(info)
    }
  })(req, res, next)
}

// Preload user profile on routes with ':username'
router.param('username', function(req, res, next, username) {
  req.app.get('sequelize').models.User.findOne({ where: { username } })
    .then(function(user) {
      if (!user) {
        return res.sendStatus(404)
      }
      req.user = user
      return next()
    })
    .catch(next)
})

// Login to the website.
router.post('/login', async function(req, res, next) {
  try {
    const body = lib.validateParam(req, 'body')
    const user = lib.validateParam(body, 'user')
    const username = lib.validateParam(user, 'username')
    const password = lib.validateParam(user, 'password')
    await authenticate(req, res, next)
  } catch(error) {
    next(error);
  }
})

router.post('/reset-password-request', async function(req, res, next) {
  try {
    const body = lib.validateParam(req, 'body')
    const emailOrUsername = lib.validateParam(body,
      'emailOrUsername',
      { validators: [front.isString, front.isTruthy] }
    )
    await validateCaptcha(config, req, res)
    const sequelize = req.app.get('sequelize')
    const where = {}
    if (front.isEmail(emailOrUsername)) {
      where.email = emailOrUsername
    } else {
      where.username = emailOrUsername
    }
    const User = sequelize.models.User
    const user = await User.findOne({ where })
    if (!user)
      throw new lib.ValidationError([`email or username is not registered: ${emailOrUsername}`])
    if (!user.verified)
      throw new lib.ValidationError([`user is not verified, you must verify your account before you can reset your password`])
    const timeToWaitMs = getTimeToWaitForNextEmailMs(user)
    if (timeToWaitMs > 0) {
      throw new lib.ValidationError([`Email already registered but not verified. You can re-send a confirmation email in: ${lib.msToRoundedTime(timeToWaitMs)}`])
    }
    const verificationCode = User.generateVerificationCode()
    const resetPasswordUrl = `${routes.host(req)}${routes.resetPasswordUpdate()}?email=${encodeURIComponent(user.email)}&code=${verificationCode}`
    user.verificationCode = verificationCode
    user.verificationCodeN += 1
    user.verificationCodeSent = new Date()
    await Promise.all([
      user.saveSideEffects(),
      lib.sendEmail({
        to: user.email,
        subject: `Change your OurBigBook.com password`,
        html:
          `<p>Hello, ${user.displayName}!</p>` +
          `<p>Someone (hopefully you) requested a password reset for your account.</p>` +
          `<p>If that was you, please <a href="${resetPasswordUrl}">click this link to change your password</a>.</p>` +
          `<p>If it wasn't, you can safely ignore this email.</p>`
        ,
        text: `Hello, ${user.displayName}!

Someone (hopefully you) requested a password reset for your account.

If that was you, please click this link to change your password: ${resetPasswordUrl}

If it wasn't, you can safely ignore this email.
`,
      })
    ])
    res.sendStatus(200)
  } catch(error) {
    next(error);
  }
})

router.post('/reset-password', async function(req, res, next) {
  try {
    const body = lib.validateParam(req, 'body')
    const email = lib.validateParam(body,
      'email',
      { validators: [front.isString, front.isTruthy] }
    )
    const password = lib.validateParam(body,
      'password',
      { validators: [front.isString, front.isTruthy] }
    )
    const code = lib.validateParam(body,
      'code',
      { validators: [front.isString, front.isTruthy] }
    )
    const sequelize = req.app.get('sequelize')
    const User = sequelize.models.User
    const user = await User.findOne({ where: { email } })
    if (!user)
      throw new lib.ValidationError([`email not registered: ${email}`])
    if (code === user.verificationCode) {
      res.sendStatus(200)
      user.verificationCode = null
      user.verificationCodeN = 0
      User.setPassword(user, password)
      await user.saveSideEffects()
    } else {
      throw new lib.ValidationError(['verification code invalid. Please send a new one.'])
    }
  } catch(error) {
    next(error);
  }
})

router.get('/users', auth.optional, async function(req, res, next) {
  try {
    const sequelize = req.app.get('sequelize')
    const { User } = sequelize.models
    const [limit, offset] = lib.getLimitAndOffset(req, res)
    const [loggedInUser, {count: usersCount, rows: users}] = await Promise.all([
      req.payload ? User.findByPk(req.payload.id) : null,
      User.getUsers({
        // https://github.com/ourbigbook/ourbigbook/issues/260
        followedBy: req.query.followedBy,
        following: req.query.following,
        limit,
        offset,
        order: lib.getOrder(req, {
          allowedSorts: User.ALLOWED_SORTS,
          allowedSortsExtra: User.ALLOWED_SORTS_EXTRA,
        }),
        sequelize,
        username: req.query.username,
      }),
    ])
    return res.json({
      users: await Promise.all(users.map((user) => {
        return user.toJson(loggedInUser)
      })),
      usersCount,
    })
  } catch(error) {
    next(error);
  }
})

async function validateCaptcha(config, req, res) {
  if (config.useCaptcha) {
    const {data, status} = await sendJsonHttp(
      'POST',
      '/recaptcha/api/siteverify',
      {
        contentType: 'application/x-www-form-urlencoded',
        https: true,
        hostname: 'www.google.com',
        validateStatus: () => true,
        body: new url.URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: req.body.recaptchaToken,
        }).toString(),
      }
    )
    if (status !== 200) {
      return res.sendStatus(503)
    }
    if (!data.success) {
      console.error(`recaptcha error: ${data}`);
      throw new lib.ValidationError(['reCAPTCHA failed'])
    }
  }
}

function getTimeToWaitForNextEmailMs(user) {
  if (user.verificationCodeN === 0)
    return -1
  return (
    user.verificationCodeSent.getTime() +
    lib.MILLIS_PER_MINUTE * user.sequelize.models.User.verificationCodeNToTimeDeltaMinutes(user.verificationCodeN)
  ) - (new Date()).getTime()
}

// Create a new user.
router.post('/users', async function(req, res, next) {
  try {
    const body = lib.validateParam(req, 'body')
    const userPost = lib.validateParam(body, 'user')
    const username = lib.validateParam(userPost, 'username')
    const email = lib.validateParam(userPost, 'email')
    const password = lib.validateParam(userPost, 'password')
    const displayName = lib.validateParam(userPost, 'displayName', {
      validators: [front.isString, front.isTruthy],
      defaultValue: undefined,
    })
    await validateCaptcha(config, req, res)
    const sequelize = req.app.get('sequelize')
    const User = sequelize.models.User
    // We fetch the existing account by email.
    // https://github.com/ourbigbook/ourbigbook/issues/329
    const existingUser = await User.findOne({ where: { email }})
    let user
    let adminsPromise
    if (existingUser) {
      user = existingUser
      if (user.verified) {
        throw new lib.ValidationError([`email already taken: ${email}`])
      }
      // Re-send the email if enough time passed.
      const timeToWaitMs = getTimeToWaitForNextEmailMs(user)
      if (timeToWaitMs > 0) {
        throw new lib.ValidationError([`Email already registered but not verified. You can re-send a confirmation email in: ${lib.msToRoundedTime(timeToWaitMs)}`])
      }
      user.verificationCode = User.generateVerificationCode()
      user.verificationCodeN += 1
      adminsPromise = null
    } else {
      user = new (User)()
      // username is set only in this else.
      // https://github.com/ourbigbook/ourbigbook/issues/329
      user.username = username
      user.verificationCodeN = 1
      user.email = email
      user.ip = front.getClientIp(req)
      if (config.isTest) {
        // Authenticate all users automatically.
        user.verified = true
      }
      adminsPromise = User.findAll({ where: { admin: true }})
    }
    user.displayName = displayName
    User.setPassword(user, password)
    user.verificationCodeSent = new Date()
    const [, admins] = await Promise.all([
      user.saveSideEffects(),
      adminsPromise,
    ])
    if (config.isTest) {
      return authenticate(req, res, next, { forceVerify: true })
    }
    const verifyUrl = `${routes.host(req)}${routes.userVerify()}?email=${encodeURIComponent(user.email)}&code=${user.verificationCode}`
    const sendEmailsPromises = []
    sendEmailsPromises.push(lib.sendEmail({
      to: user.email,
      subject: `Verify your new OurBigBook.com account`,
      html:
        `<p>Welcome to OurBigBook.com, ${user.displayName}!</p>` +
        `<p>Please <a href="${verifyUrl}">click this link to verify your account</a>.</p>`
      ,
      text: `Welcome to OurBigBook.com, ${user.displayName}!

Please click this link to verify your account: ${verifyUrl}
`,
    }))
    const profileUrl = `${routes.host(req)}${routes.user(user.username)}`
    if (admins) {
      for (const admin of admins) {
        sendEmailsPromises.push(lib.sendEmail({
          to: admin.email,
          subject: `A new user signed up: ${user.displayName} (@${user.username}, ${user.email})!`,
          html: `<p><a href="${profileUrl}">${profileUrl}</a></p><p>Another step towards world domination is taken!</p>`,
          text: `${profileUrl}

Another step towards world domination is taken!
`,
        }))
      }
    }
    await Promise.all(sendEmailsPromises)
    return res.json({ user: await user.toJson(user) })
  } catch(error) {
    next(error);
  }
})

// Modify information about the currently logged in user.
// Backend for settings page on the web UI.
router.put('/users/:username', auth.required, async function(req, res, next) {
  try {
    const sequelize = req.app.get('sequelize')
    const user = req.user
    const loggedInUser = await sequelize.models.User.findByPk(req.payload.id)
    const msg = cant.editUser(loggedInUser, user)
    if (msg) {
      throw new lib.ValidationError( [msg], 403)
    }
    const userArg = req.body.user
    if (userArg) {
      // only update fields that were actually passed...
      if (typeof userArg.username !== 'undefined') {
        //user.username = userArg.username
        if (user.username !== userArg.username) {
          throw new lib.ValidationError(
            [`username cannot be modified currently, would change from ${user.username} to ${userArg.username}`],
          )
        }
      }
      if (typeof userArg.email !== 'undefined') {
        //user.email = userArg.email
        if (user.email !== userArg.email) {
          throw new lib.ValidationError(
            [`email cannot be modified currently, would change from ${user.email} to ${userArg.email}`],
          )
        }
      }
      if (typeof userArg.displayName !== 'undefined') {
        const displayName = lib.validateParam(userArg, 'displayName', {
          validators: [front.isString, front.isTruthy],
          defaultValue: undefined,
        })
        user.displayName = displayName
      }
      if (typeof userArg.image !== 'undefined') {
        user.image = userArg.image
      }
      const emailNotifications = lib.validateParam(userArg, 'emailNotifications', {
        validators: [front.isBoolean],
        defaultValue: undefined,
      })
      if (emailNotifications !== undefined) {
        user.emailNotifications = userArg.emailNotifications
      }
      const hideArticleDates = lib.validateParam(userArg, 'hideArticleDates', {
        validators: [front.isBoolean],
        defaultValue: undefined,
      })
      if (hideArticleDates !== undefined) {
        user.hideArticleDates = userArg.hideArticleDates
      }
      if (!cant.setUserLimits(loggedInUser)) {
        const maxArticles = lib.validateParam(userArg, 'maxArticles', {
          typecast: front.typecastInteger,
          validators: [front.isPositiveInteger],
          defaultValue: undefined,
        })
        if (maxArticles !== undefined) {
          user.maxArticles = maxArticles
        }
        const maxArticleSize = lib.validateParam(userArg, 'maxArticleSize', {
          typecast: front.typecastInteger,
          validators: [front.isPositiveInteger],
          defaultValue: undefined,
        })
        if (maxArticleSize !== undefined) {
          user.maxArticleSize = maxArticleSize
        }
        const maxIssuesPerMinute = lib.validateParam(userArg, 'maxIssuesPerMinute', {
          typecast: front.typecastInteger,
          validators: [front.isPositiveInteger],
          defaultValue: undefined,
        })
        if (maxIssuesPerMinute !== undefined) {
          user.maxIssuesPerMinute = maxIssuesPerMinute
        }
        const maxIssuesPerHour = lib.validateParam(userArg, 'maxIssuesPerHour', {
          typecast: front.typecastInteger,
          validators: [front.isPositiveInteger],
          defaultValue: undefined,
        })
        if (maxIssuesPerHour !== undefined) {
          user.maxIssuesPerHour = maxIssuesPerHour
        }
      }
      if (typeof userArg.password !== 'undefined') {
        sequelize.models.User.setPassword(user, userArg.password)
      }
      await user.saveSideEffects()
    }
    user.token = user.generateJWT()
    return res.json({ user: await user.toJson(user) })
  } catch(error) {
    next(error);
  }
})

// Follow

async function validateFollow(req, res, user, isFollow) {
  if ((await user.hasFollow(req.user)) === isFollow) {
    throw new lib.ValidationError(
      [`User '${user.username}' ${isFollow ? 'already follows' : 'does not follow'} user '${req.user.username}'`],
      403,
    )
  }
}

// Follow user.
router.post('/users/:username/follow', auth.required, async function(req, res, next) {
  try {
    const user = await req.app.get('sequelize').models.User.findByPk(req.payload.id)
    await validateFollow(req, res, user, true)
    await user.addFollowSideEffects(req.user)
    const newUser = await req.app.get('sequelize').models.User.findOne({
      where: { username: user.username } })
    return res.json({ user: await req.user.toJson(newUser) })
  } catch(error) {
    next(error);
  }
})

// Unfollow user.
router.delete('/users/:username/follow', auth.required, async function(req, res, next) {
  try {
    const user = await req.app.get('sequelize').models.User.findByPk(req.payload.id)
    await validateFollow(req, res, user, false)
    await user.removeFollowSideEffects(req.user)
    const newUser = await req.app.get('sequelize').models.User.findOne({
      where: { username: user.username } })
    return res.json({ user: await req.user.toJson(user) })
  } catch(error) {
    next(error);
  }
})

module.exports = router
