const fs = require('fs')
const path = require('path')

const { DatabaseError, Sequelize, DataTypes } = require('sequelize')

const ourbigbook_models = require('ourbigbook/models')
const ourbigbook_nodejs_webpack_safe = require('ourbigbook/nodejs_webpack_safe');

const config = require('../front/config')

function getSequelize(toplevelDir, toplevelBasename) {
  const sequelizeParams = Object.assign(
    {
      logging: config.verbose ? console.log : false,
    },
    ourbigbook_nodejs_webpack_safe.db_options,
  );
  let sequelize;
  if (config.isProduction || config.postgres) {
    sequelizeParams.dialect = config.production.dialect;
    sequelizeParams.dialectOptions = config.production.dialectOptions;
    sequelize = new Sequelize(config.production.url, sequelizeParams);
  } else {
    sequelizeParams.dialect = config.development.dialect;
    let storage;
    if (process.env.NEXT_PUBLIC_NODE_ENV === 'test' || toplevelDir === undefined) {
      storage = ':memory:';
    } else {
      if (toplevelBasename === undefined) {
        toplevelBasename = config.development.storage;
      }
      storage = path.join(toplevelDir, toplevelBasename);
    }
    sequelizeParams.storage = storage;
    sequelize = new Sequelize(sequelizeParams);
  }
  const Article = require('./article')(sequelize)
  const Comment = require('./comment')(sequelize)
  const SequelizeMeta = require('./sequelize_meta')(sequelize)
  const User = require('./user')(sequelize)
  ourbigbook_models.addModels(sequelize, { web: true })
  const File = sequelize.models.File

  // Associations.

  // User follow user (super many to many)
  const UserFollowUser = sequelize.define('UserFollowUser',
    {
      userId: {
        type: DataTypes.INTEGER,
        references: {
          model: User,
          key: 'id'
        }
      },
      followId: {
        type: DataTypes.INTEGER,
        references: {
          model: User,
          key: 'id'
        }
      },
    },
    {
      tableName: 'UserFollowUser'
    }
  );
  User.belongsToMany(User, {through: UserFollowUser, as: 'follows', foreignKey: 'userId', otherKey: 'followId'});
  UserFollowUser.belongsTo(User, {foreignKey: 'userId'})
  User.hasMany(UserFollowUser, {foreignKey: 'followId'})

  // User like Article
  Article.belongsToMany(User, { through: 'UserLikeArticle', as: 'likedBy', foreignKey: 'articleId', otherKey: 'userId'  });
  User.belongsToMany(Article, { through: 'UserLikeArticle', as: 'likes',   foreignKey: 'userId', otherKey: 'articleId'  });

  // Article author User
  File.belongsTo(User, {
    as: 'author',
    foreignKey: {
      name: 'authorId',
      allowNull: false
    }
  })
  User.hasMany(File, {
    as: 'authoredArticles',
    foreignKey: 'authorId'
  })

  // Article belongs to a source File
  Article.belongsTo(File, {
    as: 'file',
    foreignKey: {
      name: 'fileId',
      allowNull: false
    }
  })
  File.hasMany(Article, {
    as: 'file',
    foreignKey: 'fileId'
  })

  // Article has Comment
  Article.hasMany(Comment, { foreignKey: 'articleId' })
  Comment.belongsTo(Article, {
    foreignKey: {
      name: 'articleId',
      allowNull: false
    },
  })

  // Comment author User
  Comment.belongsTo(User, {
    as: 'author',
    foreignKey: {
      name: 'authorId',
      allowNull: false
    },
  });
  User.hasMany(Comment, {foreignKey: 'authorId'});

  return sequelize;
}

// Do sequelize.sync, and then also populate SequelizeMeta with migrations
// that might not be needed if we've just done a full sync.
async function sync(sequelize, opts={}) {
  let dbExists
  try {
    await sequelize.models.SequelizeMeta.findOne()
    dbExists = true
  } catch(e) {
    if (e instanceof DatabaseError) {
      dbExists = false
    }
  }
  await sequelize.sync(opts)
  if (!dbExists || opts.force) {
    await sequelize.models.SequelizeMeta.bulkCreate(
      fs.readdirSync(path.join(path.dirname(__dirname), 'migrations')).map(
        basename => { return { name: basename } }
      )
    )
  }
  return dbExists
}

module.exports = {
  getSequelize,
  sync,
}
