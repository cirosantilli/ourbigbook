module.exports = (sequelize) => {
  const { DataTypes } = sequelize.Sequelize
  return sequelize.define(
    'File',
    {
      path: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      toplevel_id: {
        type: DataTypes.TEXT,
        allowNull: true,
        unique: true,
      },
      last_parse: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_render: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      indexes: [
        { fields: ['last_parse'], },
        { fields: ['last_render'], },
        { fields: ['path'], },
        { fields: ['toplevel_id'], },
      ],
    }
  )
}
