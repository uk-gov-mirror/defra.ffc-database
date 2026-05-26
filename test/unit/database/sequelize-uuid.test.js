const path = require('path')
const fs = require('fs')
const os = require('os')
const { Sequelize, DataTypes } = require('sequelize')
const { v1: uuidv1, v4: uuidv4 } = require('uuid')
const Base = require('../../../app/database/base')

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_V1_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('Sequelize uuid compatibility', () => {
  // Verify sequelize's module-level imports work — if uuid breaks CJS exports
  // (e.g. because a version pinned an ESM-only release), these will throw on load.
  describe('module loading', () => {
    test('sequelize loads without error', () => {
      expect(Sequelize).toBeDefined()
      expect(DataTypes).toBeDefined()
    })

    test('UUID DataType is available', () => {
      expect(DataTypes.UUID).toBeDefined()
    })

    test('UUIDV4 DataType is available', () => {
      expect(DataTypes.UUIDV4).toBeDefined()
    })

    test('UUIDV1 DataType is available', () => {
      expect(DataTypes.UUIDV1).toBeDefined()
    })
  })

  // Sequelize's utils.js calls require('uuid').v4 and require('uuid').v1 directly.
  // These tests verify that those functions work correctly with whatever version
  // is pinned via the npm overrides field.
  describe('uuid functions used by sequelize internals', () => {
    test('uuidv4 is a function', () => {
      expect(typeof uuidv4).toBe('function')
    })

    test('uuidv1 is a function', () => {
      expect(typeof uuidv1).toBe('function')
    })

    test('uuidv4() returns a valid UUID v4 string', () => {
      const uuid = uuidv4()
      expect(typeof uuid).toBe('string')
      expect(uuid).toMatch(UUID_V4_PATTERN)
    })

    test('uuidv1() returns a valid UUID v1 string', () => {
      const uuid = uuidv1()
      expect(typeof uuid).toBe('string')
      expect(uuid).toMatch(UUID_V1_PATTERN)
    })

    test('uuidv4() generates unique values on repeated calls', () => {
      const values = Array.from({ length: 10 }, () => uuidv4())
      expect(new Set(values).size).toBe(10)
    })

    test('uuidv1() generates unique values on repeated calls', () => {
      const values = Array.from({ length: 10 }, () => uuidv1())
      expect(new Set(values).size).toBe(10)
    })
  })

  describe('Base.connect() with real Sequelize and UUID model defaults', () => {
    let tempDir
    let db

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffc-db-uuid-test-'))

      const modelSrc = [
        'module.exports = (sequelize, DataTypes) => {',
        '  return sequelize.define(', JSON.stringify('Record'), ', {',
        '    id: {',
        '      type: DataTypes.UUID,',
        '      defaultValue: DataTypes.UUIDV4,',
        '      primaryKey: true',
        '    },',
        '    ref: {',
        '      type: DataTypes.UUID,',
        '      defaultValue: DataTypes.UUIDV1',
        '    },',
        '    name: { type: DataTypes.STRING }',
        '  }, { timestamps: false })',
        '}'
      ].join(String.fromCharCode(10))

      fs.writeFileSync(path.join(tempDir, 'record.js'), modelSrc)

      const config = {
        database: 'test',
        username: 'test',
        password: 'test',
        modelPath: tempDir,
        dialect: 'postgres',
        logging: false
      }

      db = new Base(config).connect()
    })

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true })
    })

    test('connect() returns a real Sequelize instance', () => {
      expect(db.sequelize).toBeInstanceOf(Sequelize)
    })

    test('connect() registers the model', () => {
      expect(db.Record).toBeDefined()
    })

    test('UUIDV4 default applies a valid UUID v4 to the primary key on build', () => {
      const record = db.Record.build({})
      expect(record.id).toMatch(UUID_V4_PATTERN)
    })

    test('UUIDV1 default applies a valid UUID v1 to ref field on build', () => {
      const record = db.Record.build({})
      expect(record.ref).toMatch(UUID_V1_PATTERN)
    })

    test('each built record receives a unique primary key', () => {
      const ids = Array.from({ length: 10 }, () => db.Record.build({}).id)
      expect(new Set(ids).size).toBe(10)
    })
  })
})
