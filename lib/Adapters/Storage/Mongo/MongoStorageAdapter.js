"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.MongoStorageAdapter = void 0;

var _MongoCollection = _interopRequireDefault(require("./MongoCollection"));

var _MongoSchemaCollection = _interopRequireDefault(require("./MongoSchemaCollection"));

var _StorageAdapter = require("../StorageAdapter");

var _mongodbUrl = require("../../../vendor/mongodbUrl");

var _MongoTransform = require("./MongoTransform");

var _node = _interopRequireDefault(require("parse/node"));

var _lodash = _interopRequireDefault(require("lodash"));

var _defaults = _interopRequireDefault(require("../../../defaults"));

var _logger = _interopRequireDefault(require("../../../logger"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

// -disable-next
const mongodb = require('mongodb');

const MongoClient = mongodb.MongoClient;
const ReadPreference = mongodb.ReadPreference;
const MongoSchemaCollectionName = '_SCHEMA';

const storageAdapterAllCollections = mongoAdapter => {
  return mongoAdapter.connect().then(() => mongoAdapter.database.collections()).then(collections => {
    return collections.filter(collection => {
      if (collection.namespace.match(/\.system\./)) {
        return false;
      } // TODO: If you have one app with a collection prefix that happens to be a prefix of another
      // apps prefix, this will go very very badly. We should fix that somehow.


      return collection.collectionName.indexOf(mongoAdapter._collectionPrefix) == 0;
    });
  });
};

const convertParseSchemaToMongoSchema = (_ref) => {
  let schema = _extends({}, _ref);

  delete schema.fields._rperm;
  delete schema.fields._wperm;

  if (schema.className === '_User') {
    // Legacy mongo adapter knows about the difference between password and _hashed_password.
    // Future database adapters will only know about _hashed_password.
    // Note: Parse Server will bring back password with injectDefaultSchema, so we don't need
    // to add _hashed_password back ever.
    delete schema.fields._hashed_password;
  }

  return schema;
}; // Returns { code, error } if invalid, or { result }, an object
// suitable for inserting into _SCHEMA collection, otherwise.


const mongoSchemaFromFieldsAndClassNameAndCLP = (fields, className, classLevelPermissions, indexes) => {
  const mongoObject = {
    _id: className,
    objectId: 'string',
    updatedAt: 'string',
    createdAt: 'string',
    _metadata: undefined
  };

  for (const fieldName in fields) {
    const _fields$fieldName = fields[fieldName],
          {
      type,
      targetClass
    } = _fields$fieldName,
          fieldOptions = _objectWithoutProperties(_fields$fieldName, ["type", "targetClass"]);

    mongoObject[fieldName] = _MongoSchemaCollection.default.parseFieldTypeToMongoFieldType({
      type,
      targetClass
    });

    if (fieldOptions && Object.keys(fieldOptions).length > 0) {
      mongoObject._metadata = mongoObject._metadata || {};
      mongoObject._metadata.fields_options = mongoObject._metadata.fields_options || {};
      mongoObject._metadata.fields_options[fieldName] = fieldOptions;
    }
  }

  if (typeof classLevelPermissions !== 'undefined') {
    mongoObject._metadata = mongoObject._metadata || {};

    if (!classLevelPermissions) {
      delete mongoObject._metadata.class_permissions;
    } else {
      mongoObject._metadata.class_permissions = classLevelPermissions;
    }
  }

  if (indexes && typeof indexes === 'object' && Object.keys(indexes).length > 0) {
    mongoObject._metadata = mongoObject._metadata || {};
    mongoObject._metadata.indexes = indexes;
  }

  if (!mongoObject._metadata) {
    // cleanup the unused _metadata
    delete mongoObject._metadata;
  }

  return mongoObject;
};

class MongoStorageAdapter {
  // Private
  // Public
  constructor({
    uri = _defaults.default.DefaultMongoURI,
    collectionPrefix = '',
    mongoOptions = {}
  }) {
    this._uri = uri;
    this._collectionPrefix = collectionPrefix;
    this._mongoOptions = mongoOptions;
    this._mongoOptions.useNewUrlParser = true;
    this._mongoOptions.useUnifiedTopology = true;

    this._onchange = () => {}; // MaxTimeMS is not a global MongoDB client option, it is applied per operation.


    this._maxTimeMS = mongoOptions.maxTimeMS;
    this.canSortOnJoinTables = true;
    this.replicaSet = !!mongoOptions.replicaSet;
    delete mongoOptions.replicaSet;
    delete mongoOptions.maxTimeMS;
  }

  watch(callback) {
    this._onchange = callback;
  }

  connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    } // parsing and re-formatting causes the auth value (if there) to get URI
    // encoded


    const encodedUri = (0, _mongodbUrl.format)((0, _mongodbUrl.parse)(this._uri));
    this.connectionPromise = MongoClient.connect(encodedUri, this._mongoOptions).then(client => {
      // Starting mongoDB 3.0, the MongoClient.connect don't return a DB anymore but a client
      // Fortunately, we can get back the options and use them to select the proper DB.
      // https://github.com/mongodb/node-mongodb-native/blob/2c35d76f08574225b8db02d7bef687123e6bb018/lib/mongo_client.js#L885
      const options = client.s.options;
      const database = client.db(options.dbName);

      if (!database) {
        delete this.connectionPromise;
        return;
      }

      database.on('error', () => {
        delete this.connectionPromise;
      });
      database.on('close', () => {
        delete this.connectionPromise;
      });
      this.client = client;
      this.database = database;
    }).catch(err => {
      delete this.connectionPromise;
      return Promise.reject(err);
    });
    return this.connectionPromise;
  }

  handleError(error) {
    if (error && error.code === 13) {
      // Unauthorized error
      delete this.client;
      delete this.database;
      delete this.connectionPromise;

      _logger.default.error('Received unauthorized error', {
        error: error
      });
    }

    throw error;
  }

  handleShutdown() {
    if (!this.client) {
      return Promise.resolve();
    }

    return this.client.close(false);
  }

  _adaptiveCollection(name) {
    return this.connect().then(() => this.database.collection(this._collectionPrefix + name)).then(rawCollection => new _MongoCollection.default(rawCollection)).catch(err => this.handleError(err));
  }

  _schemaCollection() {
    return this.connect().then(() => this._adaptiveCollection(MongoSchemaCollectionName)).then(collection => {
      if (!this._stream && this.replicaSet) {
        this._stream = collection._mongoCollection.watch();

        this._stream.on('change', () => this._onchange());
      }

      return new _MongoSchemaCollection.default(collection);
    });
  }

  classExists(name) {
    return this.connect().then(() => {
      return this.database.listCollections({
        name: this._collectionPrefix + name
      }).toArray();
    }).then(collections => {
      return collections.length > 0;
    }).catch(err => this.handleError(err));
  }

  setClassLevelPermissions(className, CLPs) {
    return this._schemaCollection().then(schemaCollection => schemaCollection.updateSchema(className, {
      $set: {
        '_metadata.class_permissions': CLPs
      }
    })).catch(err => this.handleError(err));
  }

  setIndexesWithSchemaFormat(className, submittedIndexes, existingIndexes = {}, fields) {
    if (submittedIndexes === undefined) {
      return Promise.resolve();
    }

    if (Object.keys(existingIndexes).length === 0) {
      existingIndexes = {
        _id_: {
          _id: 1
        }
      };
    }

    const deletePromises = [];
    const insertedIndexes = [];
    Object.keys(submittedIndexes).forEach(name => {
      const field = submittedIndexes[name];

      if (existingIndexes[name] && field.__op !== 'Delete') {
        throw new _node.default.Error(_node.default.Error.INVALID_QUERY, `Index ${name} exists, cannot update.`);
      }

      if (!existingIndexes[name] && field.__op === 'Delete') {
        throw new _node.default.Error(_node.default.Error.INVALID_QUERY, `Index ${name} does not exist, cannot delete.`);
      }

      if (field.__op === 'Delete') {
        const promise = this.dropIndex(className, name);
        deletePromises.push(promise);
        delete existingIndexes[name];
      } else {
        Object.keys(field).forEach(key => {
          if (!Object.prototype.hasOwnProperty.call(fields, key.indexOf('_p_') === 0 ? key.replace('_p_', '') : key)) {
            throw new _node.default.Error(_node.default.Error.INVALID_QUERY, `Field ${key} does not exist, cannot add index.`);
          }
        });
        existingIndexes[name] = field;
        insertedIndexes.push({
          key: field,
          name
        });
      }
    });
    let insertPromise = Promise.resolve();

    if (insertedIndexes.length > 0) {
      insertPromise = this.createIndexes(className, insertedIndexes);
    }

    return Promise.all(deletePromises).then(() => insertPromise).then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.updateSchema(className, {
      $set: {
        '_metadata.indexes': existingIndexes
      }
    })).catch(err => this.handleError(err));
  }

  setIndexesFromMongo(className) {
    return this.getIndexes(className).then(indexes => {
      indexes = indexes.reduce((obj, index) => {
        if (index.key._fts) {
          delete index.key._fts;
          delete index.key._ftsx;

          for (const field in index.weights) {
            index.key[field] = 'text';
          }
        }

        obj[index.name] = index.key;
        return obj;
      }, {});
      return this._schemaCollection().then(schemaCollection => schemaCollection.updateSchema(className, {
        $set: {
          '_metadata.indexes': indexes
        }
      }));
    }).catch(err => this.handleError(err)).catch(() => {
      // Ignore if collection not found
      return Promise.resolve();
    });
  }

  createClass(className, schema) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoObject = mongoSchemaFromFieldsAndClassNameAndCLP(schema.fields, className, schema.classLevelPermissions, schema.indexes);
    mongoObject._id = className;
    return this.setIndexesWithSchemaFormat(className, schema.indexes, {}, schema.fields).then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.insertSchema(mongoObject)).catch(err => this.handleError(err));
  }

  addFieldIfNotExists(className, fieldName, type) {
    return this._schemaCollection().then(schemaCollection => schemaCollection.addFieldIfNotExists(className, fieldName, type)).then(() => this.createIndexesIfNeeded(className, fieldName, type)).catch(err => this.handleError(err));
  } // Drops a collection. Resolves with true if it was a Parse Schema (eg. _User, Custom, etc.)
  // and resolves with false if it wasn't (eg. a join table). Rejects if deletion was impossible.


  deleteClass(className) {
    return this._adaptiveCollection(className).then(collection => collection.drop()).catch(error => {
      // 'ns not found' means collection was already gone. Ignore deletion attempt.
      if (error.message == 'ns not found') {
        return;
      }

      throw error;
    }) // We've dropped the collection, now remove the _SCHEMA document
    .then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.findAndDeleteSchema(className)).catch(err => this.handleError(err));
  }

  deleteAllClasses(fast) {
    return storageAdapterAllCollections(this).then(collections => Promise.all(collections.map(collection => fast ? collection.deleteMany({}) : collection.drop())));
  } // Remove the column and all the data. For Relations, the _Join collection is handled
  // specially, this function does not delete _Join columns. It should, however, indicate
  // that the relation fields does not exist anymore. In mongo, this means removing it from
  // the _SCHEMA collection.  There should be no actual data in the collection under the same name
  // as the relation column, so it's fine to attempt to delete it. If the fields listed to be
  // deleted do not exist, this function should return successfully anyways. Checking for
  // attempts to delete non-existent fields is the responsibility of Parse Server.
  // Pointer field names are passed for legacy reasons: the original mongo
  // format stored pointer field names differently in the database, and therefore
  // needed to know the type of the field before it could delete it. Future database
  // adapters should ignore the pointerFieldNames argument. All the field names are in
  // fieldNames, they show up additionally in the pointerFieldNames database for use
  // by the mongo adapter, which deals with the legacy mongo format.
  // This function is not obligated to delete fields atomically. It is given the field
  // names in a list so that databases that are capable of deleting fields atomically
  // may do so.
  // Returns a Promise.


  deleteFields(className, schema, fieldNames) {
    const mongoFormatNames = fieldNames.map(fieldName => {
      if (schema.fields[fieldName].type === 'Pointer') {
        return `_p_${fieldName}`;
      } else {
        return fieldName;
      }
    });
    const collectionUpdate = {
      $unset: {}
    };
    mongoFormatNames.forEach(name => {
      collectionUpdate['$unset'][name] = null;
    });
    const collectionFilter = {
      $or: []
    };
    mongoFormatNames.forEach(name => {
      collectionFilter['$or'].push({
        [name]: {
          $exists: true
        }
      });
    });
    const schemaUpdate = {
      $unset: {}
    };
    fieldNames.forEach(name => {
      schemaUpdate['$unset'][name] = null;
      schemaUpdate['$unset'][`_metadata.fields_options.${name}`] = null;
    });
    return this._adaptiveCollection(className).then(collection => collection.updateMany(collectionFilter, collectionUpdate)).then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.updateSchema(className, schemaUpdate)).catch(err => this.handleError(err));
  } // Return a promise for all schemas known to this adapter, in Parse format. In case the
  // schemas cannot be retrieved, returns a promise that rejects. Requirements for the
  // rejection reason are TBD.


  getAllClasses() {
    return this._schemaCollection().then(schemasCollection => schemasCollection._fetchAllSchemasFrom_SCHEMA()).catch(err => this.handleError(err));
  } // Return a promise for the schema with the given name, in Parse format. If
  // this adapter doesn't know about the schema, return a promise that rejects with
  // undefined as the reason.


  getClass(className) {
    return this._schemaCollection().then(schemasCollection => schemasCollection._fetchOneSchemaFrom_SCHEMA(className)).catch(err => this.handleError(err));
  } // TODO: As yet not particularly well specified. Creates an object. Maybe shouldn't even need the schema,
  // and should infer from the type. Or maybe does need the schema for validations. Or maybe needs
  // the schema only for the legacy mongo format. We'll figure that out later.


  createObject(className, schema, object, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoObject = (0, _MongoTransform.parseObjectToMongoObjectForCreate)(className, object, schema);
    return this._adaptiveCollection(className).then(collection => collection.insertOne(mongoObject, transactionalSession)).catch(error => {
      if (error.code === 11000) {
        // Duplicate value
        const err = new _node.default.Error(_node.default.Error.DUPLICATE_VALUE, 'A duplicate value for a field with unique values was provided');
        err.underlyingError = error;

        if (error.message) {
          const matches = error.message.match(/index:[\sa-zA-Z0-9_\-\.]+\$?([a-zA-Z_-]+)_1/);

          if (matches && Array.isArray(matches)) {
            err.userInfo = {
              duplicated_field: matches[1]
            };
          }
        }

        throw err;
      }

      throw error;
    }).catch(err => this.handleError(err));
  } // Remove all objects that match the given Parse Query.
  // If no objects match, reject with OBJECT_NOT_FOUND. If objects are found and deleted, resolve with undefined.
  // If there is some other error, reject with INTERNAL_SERVER_ERROR.


  deleteObjectsByQuery(className, schema, query, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    return this._adaptiveCollection(className).then(collection => {
      const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
      return collection.deleteMany(mongoWhere, transactionalSession);
    }).catch(err => this.handleError(err)).then(({
      result
    }) => {
      if (result.n === 0) {
        throw new _node.default.Error(_node.default.Error.OBJECT_NOT_FOUND, 'Object not found.');
      }

      return Promise.resolve();
    }, () => {
      throw new _node.default.Error(_node.default.Error.INTERNAL_SERVER_ERROR, 'Database adapter error');
    });
  } // Apply the update to all objects that match the given Parse Query.


  updateObjectsByQuery(className, schema, query, update, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoUpdate = (0, _MongoTransform.transformUpdate)(className, update, schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
    return this._adaptiveCollection(className).then(collection => collection.updateMany(mongoWhere, mongoUpdate, transactionalSession)).catch(err => this.handleError(err));
  } // Atomically finds and updates an object based on query.
  // Return value not currently well specified.


  findOneAndUpdate(className, schema, query, update, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoUpdate = (0, _MongoTransform.transformUpdate)(className, update, schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.findOneAndUpdate(mongoWhere, mongoUpdate, {
      returnOriginal: false,
      session: transactionalSession || undefined
    })).then(result => (0, _MongoTransform.mongoObjectToParseObject)(className, result.value, schema)).catch(error => {
      if (error.code === 11000) {
        throw new _node.default.Error(_node.default.Error.DUPLICATE_VALUE, 'A duplicate value for a field with unique values was provided');
      }

      throw error;
    }).catch(err => this.handleError(err));
  } // Hopefully we can get rid of this. It's only used for config and hooks.


  upsertOneObject(className, schema, query, update, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoUpdate = (0, _MongoTransform.transformUpdate)(className, update, schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
    return this._adaptiveCollection(className).then(collection => collection.upsertOne(mongoWhere, mongoUpdate, transactionalSession)).catch(err => this.handleError(err));
  } // Executes a find. Accepts: className, query in Parse format, and { skip, limit, sort }.


  find(className, schema, query, {
    skip,
    limit,
    sort,
    keys,
    readPreference,
    hint,
    caseInsensitive,
    explain
  }) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);

    const mongoSort = _lodash.default.mapKeys(sort, (value, fieldName) => (0, _MongoTransform.transformKey)(className, fieldName, schema));

    const mongoKeys = _lodash.default.reduce(keys, (memo, key) => {
      if (key === 'ACL') {
        memo['_rperm'] = 1;
        memo['_wperm'] = 1;
      } else {
        memo[(0, _MongoTransform.transformKey)(className, key, schema)] = 1;
      }

      return memo;
    }, {}); // If we aren't requesting the `_id` field, we need to explicitly opt out
    // of it. Doing so in parse-server is unusual, but it can allow us to
    // optimize some queries with covering indexes.


    if (keys && !mongoKeys._id) {
      mongoKeys._id = 0;
    }

    readPreference = this._parseReadPreference(readPreference);
    return this.createTextIndexesIfNeeded(className, query, schema).then(() => this._adaptiveCollection(className)).then(collection => collection.find(mongoWhere, {
      skip,
      limit,
      sort: mongoSort,
      keys: mongoKeys,
      maxTimeMS: this._maxTimeMS,
      readPreference,
      hint,
      caseInsensitive,
      explain
    })).then(objects => {
      if (explain) {
        return objects;
      }

      return objects.map(object => (0, _MongoTransform.mongoObjectToParseObject)(className, object, schema));
    }).catch(err => this.handleError(err));
  }

  ensureIndex(className, schema, fieldNames, indexName, caseInsensitive = false, options = {}) {
    schema = convertParseSchemaToMongoSchema(schema);
    const indexCreationRequest = {};
    const mongoFieldNames = fieldNames.map(fieldName => (0, _MongoTransform.transformKey)(className, fieldName, schema));
    mongoFieldNames.forEach(fieldName => {
      indexCreationRequest[fieldName] = options.indexType !== undefined ? options.indexType : 1;
    });
    const defaultOptions = {
      background: true,
      sparse: true
    };
    const indexNameOptions = indexName ? {
      name: indexName
    } : {};
    const ttlOptions = options.ttl !== undefined ? {
      expireAfterSeconds: options.ttl
    } : {};
    const caseInsensitiveOptions = caseInsensitive ? {
      collation: _MongoCollection.default.caseInsensitiveCollation()
    } : {};

    const indexOptions = _objectSpread(_objectSpread(_objectSpread(_objectSpread({}, defaultOptions), caseInsensitiveOptions), indexNameOptions), ttlOptions);

    return this._adaptiveCollection(className).then(collection => new Promise((resolve, reject) => collection._mongoCollection.createIndex(indexCreationRequest, indexOptions, error => error ? reject(error) : resolve()))).catch(err => this.handleError(err));
  } // Create a unique index. Unique indexes on nullable fields are not allowed. Since we don't
  // currently know which fields are nullable and which aren't, we ignore that criteria.
  // As such, we shouldn't expose this function to users of parse until we have an out-of-band
  // Way of determining if a field is nullable. Undefined doesn't count against uniqueness,
  // which is why we use sparse indexes.


  ensureUniqueness(className, schema, fieldNames) {
    schema = convertParseSchemaToMongoSchema(schema);
    const indexCreationRequest = {};
    const mongoFieldNames = fieldNames.map(fieldName => (0, _MongoTransform.transformKey)(className, fieldName, schema));
    mongoFieldNames.forEach(fieldName => {
      indexCreationRequest[fieldName] = 1;
    });
    return this._adaptiveCollection(className).then(collection => collection._ensureSparseUniqueIndexInBackground(indexCreationRequest)).catch(error => {
      if (error.code === 11000) {
        throw new _node.default.Error(_node.default.Error.DUPLICATE_VALUE, 'Tried to ensure field uniqueness for a class that already has duplicates.');
      }

      throw error;
    }).catch(err => this.handleError(err));
  } // Used in tests


  _rawFind(className, query) {
    return this._adaptiveCollection(className).then(collection => collection.find(query, {
      maxTimeMS: this._maxTimeMS
    })).catch(err => this.handleError(err));
  } // Executes a count.


  count(className, schema, query, readPreference, hint) {
    schema = convertParseSchemaToMongoSchema(schema);
    readPreference = this._parseReadPreference(readPreference);
    return this._adaptiveCollection(className).then(collection => collection.count((0, _MongoTransform.transformWhere)(className, query, schema, true), {
      maxTimeMS: this._maxTimeMS,
      readPreference,
      hint
    })).catch(err => this.handleError(err));
  }

  distinct(className, schema, query, fieldName) {
    schema = convertParseSchemaToMongoSchema(schema);
    const isPointerField = schema.fields[fieldName] && schema.fields[fieldName].type === 'Pointer';
    const transformField = (0, _MongoTransform.transformKey)(className, fieldName, schema);
    return this._adaptiveCollection(className).then(collection => collection.distinct(transformField, (0, _MongoTransform.transformWhere)(className, query, schema))).then(objects => {
      objects = objects.filter(obj => obj != null);
      return objects.map(object => {
        if (isPointerField) {
          return (0, _MongoTransform.transformPointerString)(schema, fieldName, object);
        }

        return (0, _MongoTransform.mongoObjectToParseObject)(className, object, schema);
      });
    }).catch(err => this.handleError(err));
  }

  aggregate(className, schema, pipeline, readPreference, hint, explain) {
    let isPointerField = false;
    pipeline = pipeline.map(stage => {
      if (stage.$group) {
        stage.$group = this._parseAggregateGroupArgs(schema, stage.$group);

        if (stage.$group._id && typeof stage.$group._id === 'string' && stage.$group._id.indexOf('$_p_') >= 0) {
          isPointerField = true;
        }
      }

      if (stage.$match) {
        stage.$match = this._parseAggregateArgs(schema, stage.$match);
      }

      if (stage.$project) {
        stage.$project = this._parseAggregateProjectArgs(schema, stage.$project);
      }

      if (stage.$geoNear && stage.$geoNear.query) {
        stage.$geoNear.query = this._parseAggregateArgs(schema, stage.$geoNear.query);
      }

      return stage;
    });
    readPreference = this._parseReadPreference(readPreference);
    return this._adaptiveCollection(className).then(collection => collection.aggregate(pipeline, {
      readPreference,
      maxTimeMS: this._maxTimeMS,
      hint,
      explain
    })).then(results => {
      results.forEach(result => {
        if (Object.prototype.hasOwnProperty.call(result, '_id')) {
          if (isPointerField && result._id) {
            result._id = result._id.split('$')[1];
          }

          if (result._id == null || result._id == undefined || ['object', 'string'].includes(typeof result._id) && _lodash.default.isEmpty(result._id)) {
            result._id = null;
          }

          result.objectId = result._id;
          delete result._id;
        }
      });
      return results;
    }).then(objects => objects.map(object => (0, _MongoTransform.mongoObjectToParseObject)(className, object, schema))).catch(err => this.handleError(err));
  } // This function will recursively traverse the pipeline and convert any Pointer or Date columns.
  // If we detect a pointer column we will rename the column being queried for to match the column
  // in the database. We also modify the value to what we expect the value to be in the database
  // as well.
  // For dates, the driver expects a Date object, but we have a string coming in. So we'll convert
  // the string to a Date so the driver can perform the necessary comparison.
  //
  // The goal of this method is to look for the "leaves" of the pipeline and determine if it needs
  // to be converted. The pipeline can have a few different forms. For more details, see:
  //     https://docs.mongodb.com/manual/reference/operator/aggregation/
  //
  // If the pipeline is an array, it means we are probably parsing an '$and' or '$or' operator. In
  // that case we need to loop through all of it's children to find the columns being operated on.
  // If the pipeline is an object, then we'll loop through the keys checking to see if the key name
  // matches one of the schema columns. If it does match a column and the column is a Pointer or
  // a Date, then we'll convert the value as described above.
  //
  // As much as I hate recursion...this seemed like a good fit for it. We're essentially traversing
  // down a tree to find a "leaf node" and checking to see if it needs to be converted.


  _parseAggregateArgs(schema, pipeline) {
    if (pipeline === null) {
      return null;
    } else if (Array.isArray(pipeline)) {
      return pipeline.map(value => this._parseAggregateArgs(schema, value));
    } else if (typeof pipeline === 'object') {
      const returnValue = {};

      for (const field in pipeline) {
        if (schema.fields[field] && schema.fields[field].type === 'Pointer') {
          if (typeof pipeline[field] === 'object') {
            // Pass objects down to MongoDB...this is more than likely an $exists operator.
            returnValue[`_p_${field}`] = pipeline[field];
          } else {
            returnValue[`_p_${field}`] = `${schema.fields[field].targetClass}$${pipeline[field]}`;
          }
        } else if (schema.fields[field] && schema.fields[field].type === 'Date') {
          returnValue[field] = this._convertToDate(pipeline[field]);
        } else {
          returnValue[field] = this._parseAggregateArgs(schema, pipeline[field]);
        }

        if (field === 'objectId') {
          returnValue['_id'] = returnValue[field];
          delete returnValue[field];
        } else if (field === 'createdAt') {
          returnValue['_created_at'] = returnValue[field];
          delete returnValue[field];
        } else if (field === 'updatedAt') {
          returnValue['_updated_at'] = returnValue[field];
          delete returnValue[field];
        }
      }

      return returnValue;
    }

    return pipeline;
  } // This function is slightly different than the one above. Rather than trying to combine these
  // two functions and making the code even harder to understand, I decided to split it up. The
  // difference with this function is we are not transforming the values, only the keys of the
  // pipeline.


  _parseAggregateProjectArgs(schema, pipeline) {
    const returnValue = {};

    for (const field in pipeline) {
      if (schema.fields[field] && schema.fields[field].type === 'Pointer') {
        returnValue[`_p_${field}`] = pipeline[field];
      } else {
        returnValue[field] = this._parseAggregateArgs(schema, pipeline[field]);
      }

      if (field === 'objectId') {
        returnValue['_id'] = returnValue[field];
        delete returnValue[field];
      } else if (field === 'createdAt') {
        returnValue['_created_at'] = returnValue[field];
        delete returnValue[field];
      } else if (field === 'updatedAt') {
        returnValue['_updated_at'] = returnValue[field];
        delete returnValue[field];
      }
    }

    return returnValue;
  } // This function is slightly different than the two above. MongoDB $group aggregate looks like:
  //     { $group: { _id: <expression>, <field1>: { <accumulator1> : <expression1> }, ... } }
  // The <expression> could be a column name, prefixed with the '$' character. We'll look for
  // these <expression> and check to see if it is a 'Pointer' or if it's one of createdAt,
  // updatedAt or objectId and change it accordingly.


  _parseAggregateGroupArgs(schema, pipeline) {
    if (Array.isArray(pipeline)) {
      return pipeline.map(value => this._parseAggregateGroupArgs(schema, value));
    } else if (typeof pipeline === 'object') {
      const returnValue = {};

      for (const field in pipeline) {
        returnValue[field] = this._parseAggregateGroupArgs(schema, pipeline[field]);
      }

      return returnValue;
    } else if (typeof pipeline === 'string') {
      const field = pipeline.substring(1);

      if (schema.fields[field] && schema.fields[field].type === 'Pointer') {
        return `$_p_${field}`;
      } else if (field == 'createdAt') {
        return '$_created_at';
      } else if (field == 'updatedAt') {
        return '$_updated_at';
      }
    }

    return pipeline;
  } // This function will attempt to convert the provided value to a Date object. Since this is part
  // of an aggregation pipeline, the value can either be a string or it can be another object with
  // an operator in it (like $gt, $lt, etc). Because of this I felt it was easier to make this a
  // recursive method to traverse down to the "leaf node" which is going to be the string.


  _convertToDate(value) {
    if (typeof value === 'string') {
      return new Date(value);
    }

    const returnValue = {};

    for (const field in value) {
      returnValue[field] = this._convertToDate(value[field]);
    }

    return returnValue;
  }

  _parseReadPreference(readPreference) {
    if (readPreference) {
      readPreference = readPreference.toUpperCase();
    }

    switch (readPreference) {
      case 'PRIMARY':
        readPreference = ReadPreference.PRIMARY;
        break;

      case 'PRIMARY_PREFERRED':
        readPreference = ReadPreference.PRIMARY_PREFERRED;
        break;

      case 'SECONDARY':
        readPreference = ReadPreference.SECONDARY;
        break;

      case 'SECONDARY_PREFERRED':
        readPreference = ReadPreference.SECONDARY_PREFERRED;
        break;

      case 'NEAREST':
        readPreference = ReadPreference.NEAREST;
        break;

      case undefined:
      case null:
      case '':
        break;

      default:
        throw new _node.default.Error(_node.default.Error.INVALID_QUERY, 'Not supported read preference.');
    }

    return readPreference;
  }

  performInitialization() {
    return Promise.resolve();
  }

  createIndex(className, index) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.createIndex(index)).catch(err => this.handleError(err));
  }

  createIndexes(className, indexes) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.createIndexes(indexes)).catch(err => this.handleError(err));
  }

  createIndexesIfNeeded(className, fieldName, type) {
    if (type && type.type === 'Polygon') {
      const index = {
        [fieldName]: '2dsphere'
      };
      return this.createIndex(className, index);
    }

    return Promise.resolve();
  }

  createTextIndexesIfNeeded(className, query, schema) {
    for (const fieldName in query) {
      if (!query[fieldName] || !query[fieldName].$text) {
        continue;
      }

      const existingIndexes = schema.indexes;

      for (const key in existingIndexes) {
        const index = existingIndexes[key];

        if (Object.prototype.hasOwnProperty.call(index, fieldName)) {
          return Promise.resolve();
        }
      }

      const indexName = `${fieldName}_text`;
      const textIndex = {
        [indexName]: {
          [fieldName]: 'text'
        }
      };
      return this.setIndexesWithSchemaFormat(className, textIndex, existingIndexes, schema.fields).catch(error => {
        if (error.code === 85) {
          // Index exist with different options
          return this.setIndexesFromMongo(className);
        }

        throw error;
      });
    }

    return Promise.resolve();
  }

  getIndexes(className) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.indexes()).catch(err => this.handleError(err));
  }

  dropIndex(className, index) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.dropIndex(index)).catch(err => this.handleError(err));
  }

  dropAllIndexes(className) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.dropIndexes()).catch(err => this.handleError(err));
  }

  updateSchemaWithIndexes() {
    return this.getAllClasses().then(classes => {
      const promises = classes.map(schema => {
        return this.setIndexesFromMongo(schema.className);
      });
      return Promise.all(promises);
    }).catch(err => this.handleError(err));
  }

  createTransactionalSession() {
    const transactionalSection = this.client.startSession();
    transactionalSection.startTransaction();
    return Promise.resolve(transactionalSection);
  }

  commitTransactionalSession(transactionalSection) {
    return transactionalSection.commitTransaction().then(() => {
      transactionalSection.endSession();
    });
  }

  abortTransactionalSession(transactionalSection) {
    return transactionalSection.abortTransaction().then(() => {
      transactionalSection.endSession();
    });
  }

}

exports.MongoStorageAdapter = MongoStorageAdapter;
var _default = MongoStorageAdapter;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9BZGFwdGVycy9TdG9yYWdlL01vbmdvL01vbmdvU3RvcmFnZUFkYXB0ZXIuanMiXSwibmFtZXMiOlsibW9uZ29kYiIsInJlcXVpcmUiLCJNb25nb0NsaWVudCIsIlJlYWRQcmVmZXJlbmNlIiwiTW9uZ29TY2hlbWFDb2xsZWN0aW9uTmFtZSIsInN0b3JhZ2VBZGFwdGVyQWxsQ29sbGVjdGlvbnMiLCJtb25nb0FkYXB0ZXIiLCJjb25uZWN0IiwidGhlbiIsImRhdGFiYXNlIiwiY29sbGVjdGlvbnMiLCJmaWx0ZXIiLCJjb2xsZWN0aW9uIiwibmFtZXNwYWNlIiwibWF0Y2giLCJjb2xsZWN0aW9uTmFtZSIsImluZGV4T2YiLCJfY29sbGVjdGlvblByZWZpeCIsImNvbnZlcnRQYXJzZVNjaGVtYVRvTW9uZ29TY2hlbWEiLCJzY2hlbWEiLCJmaWVsZHMiLCJfcnBlcm0iLCJfd3Blcm0iLCJjbGFzc05hbWUiLCJfaGFzaGVkX3Bhc3N3b3JkIiwibW9uZ29TY2hlbWFGcm9tRmllbGRzQW5kQ2xhc3NOYW1lQW5kQ0xQIiwiY2xhc3NMZXZlbFBlcm1pc3Npb25zIiwiaW5kZXhlcyIsIm1vbmdvT2JqZWN0IiwiX2lkIiwib2JqZWN0SWQiLCJ1cGRhdGVkQXQiLCJjcmVhdGVkQXQiLCJfbWV0YWRhdGEiLCJ1bmRlZmluZWQiLCJmaWVsZE5hbWUiLCJ0eXBlIiwidGFyZ2V0Q2xhc3MiLCJmaWVsZE9wdGlvbnMiLCJNb25nb1NjaGVtYUNvbGxlY3Rpb24iLCJwYXJzZUZpZWxkVHlwZVRvTW9uZ29GaWVsZFR5cGUiLCJPYmplY3QiLCJrZXlzIiwibGVuZ3RoIiwiZmllbGRzX29wdGlvbnMiLCJjbGFzc19wZXJtaXNzaW9ucyIsIk1vbmdvU3RvcmFnZUFkYXB0ZXIiLCJjb25zdHJ1Y3RvciIsInVyaSIsImRlZmF1bHRzIiwiRGVmYXVsdE1vbmdvVVJJIiwiY29sbGVjdGlvblByZWZpeCIsIm1vbmdvT3B0aW9ucyIsIl91cmkiLCJfbW9uZ29PcHRpb25zIiwidXNlTmV3VXJsUGFyc2VyIiwidXNlVW5pZmllZFRvcG9sb2d5IiwiX29uY2hhbmdlIiwiX21heFRpbWVNUyIsIm1heFRpbWVNUyIsImNhblNvcnRPbkpvaW5UYWJsZXMiLCJyZXBsaWNhU2V0Iiwid2F0Y2giLCJjYWxsYmFjayIsImNvbm5lY3Rpb25Qcm9taXNlIiwiZW5jb2RlZFVyaSIsImNsaWVudCIsIm9wdGlvbnMiLCJzIiwiZGIiLCJkYk5hbWUiLCJvbiIsImNhdGNoIiwiZXJyIiwiUHJvbWlzZSIsInJlamVjdCIsImhhbmRsZUVycm9yIiwiZXJyb3IiLCJjb2RlIiwibG9nZ2VyIiwiaGFuZGxlU2h1dGRvd24iLCJyZXNvbHZlIiwiY2xvc2UiLCJfYWRhcHRpdmVDb2xsZWN0aW9uIiwibmFtZSIsInJhd0NvbGxlY3Rpb24iLCJNb25nb0NvbGxlY3Rpb24iLCJfc2NoZW1hQ29sbGVjdGlvbiIsIl9zdHJlYW0iLCJfbW9uZ29Db2xsZWN0aW9uIiwiY2xhc3NFeGlzdHMiLCJsaXN0Q29sbGVjdGlvbnMiLCJ0b0FycmF5Iiwic2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zIiwiQ0xQcyIsInNjaGVtYUNvbGxlY3Rpb24iLCJ1cGRhdGVTY2hlbWEiLCIkc2V0Iiwic2V0SW5kZXhlc1dpdGhTY2hlbWFGb3JtYXQiLCJzdWJtaXR0ZWRJbmRleGVzIiwiZXhpc3RpbmdJbmRleGVzIiwiX2lkXyIsImRlbGV0ZVByb21pc2VzIiwiaW5zZXJ0ZWRJbmRleGVzIiwiZm9yRWFjaCIsImZpZWxkIiwiX19vcCIsIlBhcnNlIiwiRXJyb3IiLCJJTlZBTElEX1FVRVJZIiwicHJvbWlzZSIsImRyb3BJbmRleCIsInB1c2giLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJyZXBsYWNlIiwiaW5zZXJ0UHJvbWlzZSIsImNyZWF0ZUluZGV4ZXMiLCJhbGwiLCJzZXRJbmRleGVzRnJvbU1vbmdvIiwiZ2V0SW5kZXhlcyIsInJlZHVjZSIsIm9iaiIsImluZGV4IiwiX2Z0cyIsIl9mdHN4Iiwid2VpZ2h0cyIsImNyZWF0ZUNsYXNzIiwiaW5zZXJ0U2NoZW1hIiwiYWRkRmllbGRJZk5vdEV4aXN0cyIsImNyZWF0ZUluZGV4ZXNJZk5lZWRlZCIsImRlbGV0ZUNsYXNzIiwiZHJvcCIsIm1lc3NhZ2UiLCJmaW5kQW5kRGVsZXRlU2NoZW1hIiwiZGVsZXRlQWxsQ2xhc3NlcyIsImZhc3QiLCJtYXAiLCJkZWxldGVNYW55IiwiZGVsZXRlRmllbGRzIiwiZmllbGROYW1lcyIsIm1vbmdvRm9ybWF0TmFtZXMiLCJjb2xsZWN0aW9uVXBkYXRlIiwiJHVuc2V0IiwiY29sbGVjdGlvbkZpbHRlciIsIiRvciIsIiRleGlzdHMiLCJzY2hlbWFVcGRhdGUiLCJ1cGRhdGVNYW55IiwiZ2V0QWxsQ2xhc3NlcyIsInNjaGVtYXNDb2xsZWN0aW9uIiwiX2ZldGNoQWxsU2NoZW1hc0Zyb21fU0NIRU1BIiwiZ2V0Q2xhc3MiLCJfZmV0Y2hPbmVTY2hlbWFGcm9tX1NDSEVNQSIsImNyZWF0ZU9iamVjdCIsIm9iamVjdCIsInRyYW5zYWN0aW9uYWxTZXNzaW9uIiwiaW5zZXJ0T25lIiwiRFVQTElDQVRFX1ZBTFVFIiwidW5kZXJseWluZ0Vycm9yIiwibWF0Y2hlcyIsIkFycmF5IiwiaXNBcnJheSIsInVzZXJJbmZvIiwiZHVwbGljYXRlZF9maWVsZCIsImRlbGV0ZU9iamVjdHNCeVF1ZXJ5IiwicXVlcnkiLCJtb25nb1doZXJlIiwicmVzdWx0IiwibiIsIk9CSkVDVF9OT1RfRk9VTkQiLCJJTlRFUk5BTF9TRVJWRVJfRVJST1IiLCJ1cGRhdGVPYmplY3RzQnlRdWVyeSIsInVwZGF0ZSIsIm1vbmdvVXBkYXRlIiwiZmluZE9uZUFuZFVwZGF0ZSIsInJldHVybk9yaWdpbmFsIiwic2Vzc2lvbiIsInZhbHVlIiwidXBzZXJ0T25lT2JqZWN0IiwidXBzZXJ0T25lIiwiZmluZCIsInNraXAiLCJsaW1pdCIsInNvcnQiLCJyZWFkUHJlZmVyZW5jZSIsImhpbnQiLCJjYXNlSW5zZW5zaXRpdmUiLCJleHBsYWluIiwibW9uZ29Tb3J0IiwiXyIsIm1hcEtleXMiLCJtb25nb0tleXMiLCJtZW1vIiwiX3BhcnNlUmVhZFByZWZlcmVuY2UiLCJjcmVhdGVUZXh0SW5kZXhlc0lmTmVlZGVkIiwib2JqZWN0cyIsImVuc3VyZUluZGV4IiwiaW5kZXhOYW1lIiwiaW5kZXhDcmVhdGlvblJlcXVlc3QiLCJtb25nb0ZpZWxkTmFtZXMiLCJpbmRleFR5cGUiLCJkZWZhdWx0T3B0aW9ucyIsImJhY2tncm91bmQiLCJzcGFyc2UiLCJpbmRleE5hbWVPcHRpb25zIiwidHRsT3B0aW9ucyIsInR0bCIsImV4cGlyZUFmdGVyU2Vjb25kcyIsImNhc2VJbnNlbnNpdGl2ZU9wdGlvbnMiLCJjb2xsYXRpb24iLCJjYXNlSW5zZW5zaXRpdmVDb2xsYXRpb24iLCJpbmRleE9wdGlvbnMiLCJjcmVhdGVJbmRleCIsImVuc3VyZVVuaXF1ZW5lc3MiLCJfZW5zdXJlU3BhcnNlVW5pcXVlSW5kZXhJbkJhY2tncm91bmQiLCJfcmF3RmluZCIsImNvdW50IiwiZGlzdGluY3QiLCJpc1BvaW50ZXJGaWVsZCIsInRyYW5zZm9ybUZpZWxkIiwiYWdncmVnYXRlIiwicGlwZWxpbmUiLCJzdGFnZSIsIiRncm91cCIsIl9wYXJzZUFnZ3JlZ2F0ZUdyb3VwQXJncyIsIiRtYXRjaCIsIl9wYXJzZUFnZ3JlZ2F0ZUFyZ3MiLCIkcHJvamVjdCIsIl9wYXJzZUFnZ3JlZ2F0ZVByb2plY3RBcmdzIiwiJGdlb05lYXIiLCJyZXN1bHRzIiwic3BsaXQiLCJpbmNsdWRlcyIsImlzRW1wdHkiLCJyZXR1cm5WYWx1ZSIsIl9jb252ZXJ0VG9EYXRlIiwic3Vic3RyaW5nIiwiRGF0ZSIsInRvVXBwZXJDYXNlIiwiUFJJTUFSWSIsIlBSSU1BUllfUFJFRkVSUkVEIiwiU0VDT05EQVJZIiwiU0VDT05EQVJZX1BSRUZFUlJFRCIsIk5FQVJFU1QiLCJwZXJmb3JtSW5pdGlhbGl6YXRpb24iLCIkdGV4dCIsInRleHRJbmRleCIsImRyb3BBbGxJbmRleGVzIiwiZHJvcEluZGV4ZXMiLCJ1cGRhdGVTY2hlbWFXaXRoSW5kZXhlcyIsImNsYXNzZXMiLCJwcm9taXNlcyIsImNyZWF0ZVRyYW5zYWN0aW9uYWxTZXNzaW9uIiwidHJhbnNhY3Rpb25hbFNlY3Rpb24iLCJzdGFydFNlc3Npb24iLCJzdGFydFRyYW5zYWN0aW9uIiwiY29tbWl0VHJhbnNhY3Rpb25hbFNlc3Npb24iLCJjb21taXRUcmFuc2FjdGlvbiIsImVuZFNlc3Npb24iLCJhYm9ydFRyYW5zYWN0aW9uYWxTZXNzaW9uIiwiYWJvcnRUcmFuc2FjdGlvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUNBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQVNBOztBQUVBOztBQUNBOztBQUNBOzs7Ozs7Ozs7Ozs7Ozs7O0FBRUE7QUFDQSxNQUFNQSxPQUFPLEdBQUdDLE9BQU8sQ0FBQyxTQUFELENBQXZCOztBQUNBLE1BQU1DLFdBQVcsR0FBR0YsT0FBTyxDQUFDRSxXQUE1QjtBQUNBLE1BQU1DLGNBQWMsR0FBR0gsT0FBTyxDQUFDRyxjQUEvQjtBQUVBLE1BQU1DLHlCQUF5QixHQUFHLFNBQWxDOztBQUVBLE1BQU1DLDRCQUE0QixHQUFHQyxZQUFZLElBQUk7QUFDbkQsU0FBT0EsWUFBWSxDQUNoQkMsT0FESSxHQUVKQyxJQUZJLENBRUMsTUFBTUYsWUFBWSxDQUFDRyxRQUFiLENBQXNCQyxXQUF0QixFQUZQLEVBR0pGLElBSEksQ0FHQ0UsV0FBVyxJQUFJO0FBQ25CLFdBQU9BLFdBQVcsQ0FBQ0MsTUFBWixDQUFtQkMsVUFBVSxJQUFJO0FBQ3RDLFVBQUlBLFVBQVUsQ0FBQ0MsU0FBWCxDQUFxQkMsS0FBckIsQ0FBMkIsWUFBM0IsQ0FBSixFQUE4QztBQUM1QyxlQUFPLEtBQVA7QUFDRCxPQUhxQyxDQUl0QztBQUNBOzs7QUFDQSxhQUFPRixVQUFVLENBQUNHLGNBQVgsQ0FBMEJDLE9BQTFCLENBQWtDVixZQUFZLENBQUNXLGlCQUEvQyxLQUFxRSxDQUE1RTtBQUNELEtBUE0sQ0FBUDtBQVFELEdBWkksQ0FBUDtBQWFELENBZEQ7O0FBZ0JBLE1BQU1DLCtCQUErQixHQUFHLFVBQW1CO0FBQUEsTUFBYkMsTUFBYTs7QUFDekQsU0FBT0EsTUFBTSxDQUFDQyxNQUFQLENBQWNDLE1BQXJCO0FBQ0EsU0FBT0YsTUFBTSxDQUFDQyxNQUFQLENBQWNFLE1BQXJCOztBQUVBLE1BQUlILE1BQU0sQ0FBQ0ksU0FBUCxLQUFxQixPQUF6QixFQUFrQztBQUNoQztBQUNBO0FBQ0E7QUFDQTtBQUNBLFdBQU9KLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjSSxnQkFBckI7QUFDRDs7QUFFRCxTQUFPTCxNQUFQO0FBQ0QsQ0FiRCxDLENBZUE7QUFDQTs7O0FBQ0EsTUFBTU0sdUNBQXVDLEdBQUcsQ0FDOUNMLE1BRDhDLEVBRTlDRyxTQUY4QyxFQUc5Q0cscUJBSDhDLEVBSTlDQyxPQUo4QyxLQUszQztBQUNILFFBQU1DLFdBQVcsR0FBRztBQUNsQkMsSUFBQUEsR0FBRyxFQUFFTixTQURhO0FBRWxCTyxJQUFBQSxRQUFRLEVBQUUsUUFGUTtBQUdsQkMsSUFBQUEsU0FBUyxFQUFFLFFBSE87QUFJbEJDLElBQUFBLFNBQVMsRUFBRSxRQUpPO0FBS2xCQyxJQUFBQSxTQUFTLEVBQUVDO0FBTE8sR0FBcEI7O0FBUUEsT0FBSyxNQUFNQyxTQUFYLElBQXdCZixNQUF4QixFQUFnQztBQUM5Qiw4QkFBK0NBLE1BQU0sQ0FBQ2UsU0FBRCxDQUFyRDtBQUFBLFVBQU07QUFBRUMsTUFBQUEsSUFBRjtBQUFRQyxNQUFBQTtBQUFSLEtBQU47QUFBQSxVQUE4QkMsWUFBOUI7O0FBQ0FWLElBQUFBLFdBQVcsQ0FBQ08sU0FBRCxDQUFYLEdBQXlCSSwrQkFBc0JDLDhCQUF0QixDQUFxRDtBQUM1RUosTUFBQUEsSUFENEU7QUFFNUVDLE1BQUFBO0FBRjRFLEtBQXJELENBQXpCOztBQUlBLFFBQUlDLFlBQVksSUFBSUcsTUFBTSxDQUFDQyxJQUFQLENBQVlKLFlBQVosRUFBMEJLLE1BQTFCLEdBQW1DLENBQXZELEVBQTBEO0FBQ3hEZixNQUFBQSxXQUFXLENBQUNLLFNBQVosR0FBd0JMLFdBQVcsQ0FBQ0ssU0FBWixJQUF5QixFQUFqRDtBQUNBTCxNQUFBQSxXQUFXLENBQUNLLFNBQVosQ0FBc0JXLGNBQXRCLEdBQXVDaEIsV0FBVyxDQUFDSyxTQUFaLENBQXNCVyxjQUF0QixJQUF3QyxFQUEvRTtBQUNBaEIsTUFBQUEsV0FBVyxDQUFDSyxTQUFaLENBQXNCVyxjQUF0QixDQUFxQ1QsU0FBckMsSUFBa0RHLFlBQWxEO0FBQ0Q7QUFDRjs7QUFFRCxNQUFJLE9BQU9aLHFCQUFQLEtBQWlDLFdBQXJDLEVBQWtEO0FBQ2hERSxJQUFBQSxXQUFXLENBQUNLLFNBQVosR0FBd0JMLFdBQVcsQ0FBQ0ssU0FBWixJQUF5QixFQUFqRDs7QUFDQSxRQUFJLENBQUNQLHFCQUFMLEVBQTRCO0FBQzFCLGFBQU9FLFdBQVcsQ0FBQ0ssU0FBWixDQUFzQlksaUJBQTdCO0FBQ0QsS0FGRCxNQUVPO0FBQ0xqQixNQUFBQSxXQUFXLENBQUNLLFNBQVosQ0FBc0JZLGlCQUF0QixHQUEwQ25CLHFCQUExQztBQUNEO0FBQ0Y7O0FBRUQsTUFBSUMsT0FBTyxJQUFJLE9BQU9BLE9BQVAsS0FBbUIsUUFBOUIsSUFBMENjLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZZixPQUFaLEVBQXFCZ0IsTUFBckIsR0FBOEIsQ0FBNUUsRUFBK0U7QUFDN0VmLElBQUFBLFdBQVcsQ0FBQ0ssU0FBWixHQUF3QkwsV0FBVyxDQUFDSyxTQUFaLElBQXlCLEVBQWpEO0FBQ0FMLElBQUFBLFdBQVcsQ0FBQ0ssU0FBWixDQUFzQk4sT0FBdEIsR0FBZ0NBLE9BQWhDO0FBQ0Q7O0FBRUQsTUFBSSxDQUFDQyxXQUFXLENBQUNLLFNBQWpCLEVBQTRCO0FBQzFCO0FBQ0EsV0FBT0wsV0FBVyxDQUFDSyxTQUFuQjtBQUNEOztBQUVELFNBQU9MLFdBQVA7QUFDRCxDQS9DRDs7QUFpRE8sTUFBTWtCLG1CQUFOLENBQW9EO0FBQ3pEO0FBTUE7QUFRQUMsRUFBQUEsV0FBVyxDQUFDO0FBQUVDLElBQUFBLEdBQUcsR0FBR0Msa0JBQVNDLGVBQWpCO0FBQWtDQyxJQUFBQSxnQkFBZ0IsR0FBRyxFQUFyRDtBQUF5REMsSUFBQUEsWUFBWSxHQUFHO0FBQXhFLEdBQUQsRUFBb0Y7QUFDN0YsU0FBS0MsSUFBTCxHQUFZTCxHQUFaO0FBQ0EsU0FBSy9CLGlCQUFMLEdBQXlCa0MsZ0JBQXpCO0FBQ0EsU0FBS0csYUFBTCxHQUFxQkYsWUFBckI7QUFDQSxTQUFLRSxhQUFMLENBQW1CQyxlQUFuQixHQUFxQyxJQUFyQztBQUNBLFNBQUtELGFBQUwsQ0FBbUJFLGtCQUFuQixHQUF3QyxJQUF4Qzs7QUFDQSxTQUFLQyxTQUFMLEdBQWlCLE1BQU0sQ0FBRSxDQUF6QixDQU42RixDQVE3Rjs7O0FBQ0EsU0FBS0MsVUFBTCxHQUFrQk4sWUFBWSxDQUFDTyxTQUEvQjtBQUNBLFNBQUtDLG1CQUFMLEdBQTJCLElBQTNCO0FBQ0EsU0FBS0MsVUFBTCxHQUFrQixDQUFDLENBQUNULFlBQVksQ0FBQ1MsVUFBakM7QUFDQSxXQUFPVCxZQUFZLENBQUNTLFVBQXBCO0FBQ0EsV0FBT1QsWUFBWSxDQUFDTyxTQUFwQjtBQUNEOztBQUVERyxFQUFBQSxLQUFLLENBQUNDLFFBQUQsRUFBNkI7QUFDaEMsU0FBS04sU0FBTCxHQUFpQk0sUUFBakI7QUFDRDs7QUFFRHhELEVBQUFBLE9BQU8sR0FBRztBQUNSLFFBQUksS0FBS3lELGlCQUFULEVBQTRCO0FBQzFCLGFBQU8sS0FBS0EsaUJBQVo7QUFDRCxLQUhPLENBS1I7QUFDQTs7O0FBQ0EsVUFBTUMsVUFBVSxHQUFHLHdCQUFVLHVCQUFTLEtBQUtaLElBQWQsQ0FBVixDQUFuQjtBQUVBLFNBQUtXLGlCQUFMLEdBQXlCOUQsV0FBVyxDQUFDSyxPQUFaLENBQW9CMEQsVUFBcEIsRUFBZ0MsS0FBS1gsYUFBckMsRUFDdEI5QyxJQURzQixDQUNqQjBELE1BQU0sSUFBSTtBQUNkO0FBQ0E7QUFDQTtBQUNBLFlBQU1DLE9BQU8sR0FBR0QsTUFBTSxDQUFDRSxDQUFQLENBQVNELE9BQXpCO0FBQ0EsWUFBTTFELFFBQVEsR0FBR3lELE1BQU0sQ0FBQ0csRUFBUCxDQUFVRixPQUFPLENBQUNHLE1BQWxCLENBQWpCOztBQUNBLFVBQUksQ0FBQzdELFFBQUwsRUFBZTtBQUNiLGVBQU8sS0FBS3VELGlCQUFaO0FBQ0E7QUFDRDs7QUFDRHZELE1BQUFBLFFBQVEsQ0FBQzhELEVBQVQsQ0FBWSxPQUFaLEVBQXFCLE1BQU07QUFDekIsZUFBTyxLQUFLUCxpQkFBWjtBQUNELE9BRkQ7QUFHQXZELE1BQUFBLFFBQVEsQ0FBQzhELEVBQVQsQ0FBWSxPQUFaLEVBQXFCLE1BQU07QUFDekIsZUFBTyxLQUFLUCxpQkFBWjtBQUNELE9BRkQ7QUFHQSxXQUFLRSxNQUFMLEdBQWNBLE1BQWQ7QUFDQSxXQUFLekQsUUFBTCxHQUFnQkEsUUFBaEI7QUFDRCxLQW5Cc0IsRUFvQnRCK0QsS0FwQnNCLENBb0JoQkMsR0FBRyxJQUFJO0FBQ1osYUFBTyxLQUFLVCxpQkFBWjtBQUNBLGFBQU9VLE9BQU8sQ0FBQ0MsTUFBUixDQUFlRixHQUFmLENBQVA7QUFDRCxLQXZCc0IsQ0FBekI7QUF5QkEsV0FBTyxLQUFLVCxpQkFBWjtBQUNEOztBQUVEWSxFQUFBQSxXQUFXLENBQUlDLEtBQUosRUFBK0M7QUFDeEQsUUFBSUEsS0FBSyxJQUFJQSxLQUFLLENBQUNDLElBQU4sS0FBZSxFQUE1QixFQUFnQztBQUM5QjtBQUNBLGFBQU8sS0FBS1osTUFBWjtBQUNBLGFBQU8sS0FBS3pELFFBQVo7QUFDQSxhQUFPLEtBQUt1RCxpQkFBWjs7QUFDQWUsc0JBQU9GLEtBQVAsQ0FBYSw2QkFBYixFQUE0QztBQUFFQSxRQUFBQSxLQUFLLEVBQUVBO0FBQVQsT0FBNUM7QUFDRDs7QUFDRCxVQUFNQSxLQUFOO0FBQ0Q7O0FBRURHLEVBQUFBLGNBQWMsR0FBRztBQUNmLFFBQUksQ0FBQyxLQUFLZCxNQUFWLEVBQWtCO0FBQ2hCLGFBQU9RLE9BQU8sQ0FBQ08sT0FBUixFQUFQO0FBQ0Q7O0FBQ0QsV0FBTyxLQUFLZixNQUFMLENBQVlnQixLQUFaLENBQWtCLEtBQWxCLENBQVA7QUFDRDs7QUFFREMsRUFBQUEsbUJBQW1CLENBQUNDLElBQUQsRUFBZTtBQUNoQyxXQUFPLEtBQUs3RSxPQUFMLEdBQ0pDLElBREksQ0FDQyxNQUFNLEtBQUtDLFFBQUwsQ0FBY0csVUFBZCxDQUF5QixLQUFLSyxpQkFBTCxHQUF5Qm1FLElBQWxELENBRFAsRUFFSjVFLElBRkksQ0FFQzZFLGFBQWEsSUFBSSxJQUFJQyx3QkFBSixDQUFvQkQsYUFBcEIsQ0FGbEIsRUFHSmIsS0FISSxDQUdFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FIVCxDQUFQO0FBSUQ7O0FBRURjLEVBQUFBLGlCQUFpQixHQUFtQztBQUNsRCxXQUFPLEtBQUtoRixPQUFMLEdBQ0pDLElBREksQ0FDQyxNQUFNLEtBQUsyRSxtQkFBTCxDQUF5Qi9FLHlCQUF6QixDQURQLEVBRUpJLElBRkksQ0FFQ0ksVUFBVSxJQUFJO0FBQ2xCLFVBQUksQ0FBQyxLQUFLNEUsT0FBTixJQUFpQixLQUFLM0IsVUFBMUIsRUFBc0M7QUFDcEMsYUFBSzJCLE9BQUwsR0FBZTVFLFVBQVUsQ0FBQzZFLGdCQUFYLENBQTRCM0IsS0FBNUIsRUFBZjs7QUFDQSxhQUFLMEIsT0FBTCxDQUFhakIsRUFBYixDQUFnQixRQUFoQixFQUEwQixNQUFNLEtBQUtkLFNBQUwsRUFBaEM7QUFDRDs7QUFDRCxhQUFPLElBQUlsQiw4QkFBSixDQUEwQjNCLFVBQTFCLENBQVA7QUFDRCxLQVJJLENBQVA7QUFTRDs7QUFFRDhFLEVBQUFBLFdBQVcsQ0FBQ04sSUFBRCxFQUFlO0FBQ3hCLFdBQU8sS0FBSzdFLE9BQUwsR0FDSkMsSUFESSxDQUNDLE1BQU07QUFDVixhQUFPLEtBQUtDLFFBQUwsQ0FBY2tGLGVBQWQsQ0FBOEI7QUFBRVAsUUFBQUEsSUFBSSxFQUFFLEtBQUtuRSxpQkFBTCxHQUF5Qm1FO0FBQWpDLE9BQTlCLEVBQXVFUSxPQUF2RSxFQUFQO0FBQ0QsS0FISSxFQUlKcEYsSUFKSSxDQUlDRSxXQUFXLElBQUk7QUFDbkIsYUFBT0EsV0FBVyxDQUFDaUMsTUFBWixHQUFxQixDQUE1QjtBQUNELEtBTkksRUFPSjZCLEtBUEksQ0FPRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBUFQsQ0FBUDtBQVFEOztBQUVEb0IsRUFBQUEsd0JBQXdCLENBQUN0RSxTQUFELEVBQW9CdUUsSUFBcEIsRUFBOEM7QUFDcEUsV0FBTyxLQUFLUCxpQkFBTCxHQUNKL0UsSUFESSxDQUNDdUYsZ0JBQWdCLElBQ3BCQSxnQkFBZ0IsQ0FBQ0MsWUFBakIsQ0FBOEJ6RSxTQUE5QixFQUF5QztBQUN2QzBFLE1BQUFBLElBQUksRUFBRTtBQUFFLHVDQUErQkg7QUFBakM7QUFEaUMsS0FBekMsQ0FGRyxFQU1KdEIsS0FOSSxDQU1FQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FOVCxDQUFQO0FBT0Q7O0FBRUR5QixFQUFBQSwwQkFBMEIsQ0FDeEIzRSxTQUR3QixFQUV4QjRFLGdCQUZ3QixFQUd4QkMsZUFBb0IsR0FBRyxFQUhDLEVBSXhCaEYsTUFKd0IsRUFLVDtBQUNmLFFBQUkrRSxnQkFBZ0IsS0FBS2pFLFNBQXpCLEVBQW9DO0FBQ2xDLGFBQU93QyxPQUFPLENBQUNPLE9BQVIsRUFBUDtBQUNEOztBQUNELFFBQUl4QyxNQUFNLENBQUNDLElBQVAsQ0FBWTBELGVBQVosRUFBNkJ6RCxNQUE3QixLQUF3QyxDQUE1QyxFQUErQztBQUM3Q3lELE1BQUFBLGVBQWUsR0FBRztBQUFFQyxRQUFBQSxJQUFJLEVBQUU7QUFBRXhFLFVBQUFBLEdBQUcsRUFBRTtBQUFQO0FBQVIsT0FBbEI7QUFDRDs7QUFDRCxVQUFNeUUsY0FBYyxHQUFHLEVBQXZCO0FBQ0EsVUFBTUMsZUFBZSxHQUFHLEVBQXhCO0FBQ0E5RCxJQUFBQSxNQUFNLENBQUNDLElBQVAsQ0FBWXlELGdCQUFaLEVBQThCSyxPQUE5QixDQUFzQ3BCLElBQUksSUFBSTtBQUM1QyxZQUFNcUIsS0FBSyxHQUFHTixnQkFBZ0IsQ0FBQ2YsSUFBRCxDQUE5Qjs7QUFDQSxVQUFJZ0IsZUFBZSxDQUFDaEIsSUFBRCxDQUFmLElBQXlCcUIsS0FBSyxDQUFDQyxJQUFOLEtBQWUsUUFBNUMsRUFBc0Q7QUFDcEQsY0FBTSxJQUFJQyxjQUFNQyxLQUFWLENBQWdCRCxjQUFNQyxLQUFOLENBQVlDLGFBQTVCLEVBQTRDLFNBQVF6QixJQUFLLHlCQUF6RCxDQUFOO0FBQ0Q7O0FBQ0QsVUFBSSxDQUFDZ0IsZUFBZSxDQUFDaEIsSUFBRCxDQUFoQixJQUEwQnFCLEtBQUssQ0FBQ0MsSUFBTixLQUFlLFFBQTdDLEVBQXVEO0FBQ3JELGNBQU0sSUFBSUMsY0FBTUMsS0FBVixDQUNKRCxjQUFNQyxLQUFOLENBQVlDLGFBRFIsRUFFSCxTQUFRekIsSUFBSyxpQ0FGVixDQUFOO0FBSUQ7O0FBQ0QsVUFBSXFCLEtBQUssQ0FBQ0MsSUFBTixLQUFlLFFBQW5CLEVBQTZCO0FBQzNCLGNBQU1JLE9BQU8sR0FBRyxLQUFLQyxTQUFMLENBQWV4RixTQUFmLEVBQTBCNkQsSUFBMUIsQ0FBaEI7QUFDQWtCLFFBQUFBLGNBQWMsQ0FBQ1UsSUFBZixDQUFvQkYsT0FBcEI7QUFDQSxlQUFPVixlQUFlLENBQUNoQixJQUFELENBQXRCO0FBQ0QsT0FKRCxNQUlPO0FBQ0wzQyxRQUFBQSxNQUFNLENBQUNDLElBQVAsQ0FBWStELEtBQVosRUFBbUJELE9BQW5CLENBQTJCUyxHQUFHLElBQUk7QUFDaEMsY0FDRSxDQUFDeEUsTUFBTSxDQUFDeUUsU0FBUCxDQUFpQkMsY0FBakIsQ0FBZ0NDLElBQWhDLENBQ0NoRyxNQURELEVBRUM2RixHQUFHLENBQUNqRyxPQUFKLENBQVksS0FBWixNQUF1QixDQUF2QixHQUEyQmlHLEdBQUcsQ0FBQ0ksT0FBSixDQUFZLEtBQVosRUFBbUIsRUFBbkIsQ0FBM0IsR0FBb0RKLEdBRnJELENBREgsRUFLRTtBQUNBLGtCQUFNLElBQUlOLGNBQU1DLEtBQVYsQ0FDSkQsY0FBTUMsS0FBTixDQUFZQyxhQURSLEVBRUgsU0FBUUksR0FBSSxvQ0FGVCxDQUFOO0FBSUQ7QUFDRixTQVpEO0FBYUFiLFFBQUFBLGVBQWUsQ0FBQ2hCLElBQUQsQ0FBZixHQUF3QnFCLEtBQXhCO0FBQ0FGLFFBQUFBLGVBQWUsQ0FBQ1MsSUFBaEIsQ0FBcUI7QUFDbkJDLFVBQUFBLEdBQUcsRUFBRVIsS0FEYztBQUVuQnJCLFVBQUFBO0FBRm1CLFNBQXJCO0FBSUQ7QUFDRixLQW5DRDtBQW9DQSxRQUFJa0MsYUFBYSxHQUFHNUMsT0FBTyxDQUFDTyxPQUFSLEVBQXBCOztBQUNBLFFBQUlzQixlQUFlLENBQUM1RCxNQUFoQixHQUF5QixDQUE3QixFQUFnQztBQUM5QjJFLE1BQUFBLGFBQWEsR0FBRyxLQUFLQyxhQUFMLENBQW1CaEcsU0FBbkIsRUFBOEJnRixlQUE5QixDQUFoQjtBQUNEOztBQUNELFdBQU83QixPQUFPLENBQUM4QyxHQUFSLENBQVlsQixjQUFaLEVBQ0o5RixJQURJLENBQ0MsTUFBTThHLGFBRFAsRUFFSjlHLElBRkksQ0FFQyxNQUFNLEtBQUsrRSxpQkFBTCxFQUZQLEVBR0ovRSxJQUhJLENBR0N1RixnQkFBZ0IsSUFDcEJBLGdCQUFnQixDQUFDQyxZQUFqQixDQUE4QnpFLFNBQTlCLEVBQXlDO0FBQ3ZDMEUsTUFBQUEsSUFBSSxFQUFFO0FBQUUsNkJBQXFCRztBQUF2QjtBQURpQyxLQUF6QyxDQUpHLEVBUUo1QixLQVJJLENBUUVDLEdBQUcsSUFBSSxLQUFLRyxXQUFMLENBQWlCSCxHQUFqQixDQVJULENBQVA7QUFTRDs7QUFFRGdELEVBQUFBLG1CQUFtQixDQUFDbEcsU0FBRCxFQUFvQjtBQUNyQyxXQUFPLEtBQUttRyxVQUFMLENBQWdCbkcsU0FBaEIsRUFDSmYsSUFESSxDQUNDbUIsT0FBTyxJQUFJO0FBQ2ZBLE1BQUFBLE9BQU8sR0FBR0EsT0FBTyxDQUFDZ0csTUFBUixDQUFlLENBQUNDLEdBQUQsRUFBTUMsS0FBTixLQUFnQjtBQUN2QyxZQUFJQSxLQUFLLENBQUNaLEdBQU4sQ0FBVWEsSUFBZCxFQUFvQjtBQUNsQixpQkFBT0QsS0FBSyxDQUFDWixHQUFOLENBQVVhLElBQWpCO0FBQ0EsaUJBQU9ELEtBQUssQ0FBQ1osR0FBTixDQUFVYyxLQUFqQjs7QUFDQSxlQUFLLE1BQU10QixLQUFYLElBQW9Cb0IsS0FBSyxDQUFDRyxPQUExQixFQUFtQztBQUNqQ0gsWUFBQUEsS0FBSyxDQUFDWixHQUFOLENBQVVSLEtBQVYsSUFBbUIsTUFBbkI7QUFDRDtBQUNGOztBQUNEbUIsUUFBQUEsR0FBRyxDQUFDQyxLQUFLLENBQUN6QyxJQUFQLENBQUgsR0FBa0J5QyxLQUFLLENBQUNaLEdBQXhCO0FBQ0EsZUFBT1csR0FBUDtBQUNELE9BVlMsRUFVUCxFQVZPLENBQVY7QUFXQSxhQUFPLEtBQUtyQyxpQkFBTCxHQUF5Qi9FLElBQXpCLENBQThCdUYsZ0JBQWdCLElBQ25EQSxnQkFBZ0IsQ0FBQ0MsWUFBakIsQ0FBOEJ6RSxTQUE5QixFQUF5QztBQUN2QzBFLFFBQUFBLElBQUksRUFBRTtBQUFFLCtCQUFxQnRFO0FBQXZCO0FBRGlDLE9BQXpDLENBREssQ0FBUDtBQUtELEtBbEJJLEVBbUJKNkMsS0FuQkksQ0FtQkVDLEdBQUcsSUFBSSxLQUFLRyxXQUFMLENBQWlCSCxHQUFqQixDQW5CVCxFQW9CSkQsS0FwQkksQ0FvQkUsTUFBTTtBQUNYO0FBQ0EsYUFBT0UsT0FBTyxDQUFDTyxPQUFSLEVBQVA7QUFDRCxLQXZCSSxDQUFQO0FBd0JEOztBQUVEZ0QsRUFBQUEsV0FBVyxDQUFDMUcsU0FBRCxFQUFvQkosTUFBcEIsRUFBdUQ7QUFDaEVBLElBQUFBLE1BQU0sR0FBR0QsK0JBQStCLENBQUNDLE1BQUQsQ0FBeEM7QUFDQSxVQUFNUyxXQUFXLEdBQUdILHVDQUF1QyxDQUN6RE4sTUFBTSxDQUFDQyxNQURrRCxFQUV6REcsU0FGeUQsRUFHekRKLE1BQU0sQ0FBQ08scUJBSGtELEVBSXpEUCxNQUFNLENBQUNRLE9BSmtELENBQTNEO0FBTUFDLElBQUFBLFdBQVcsQ0FBQ0MsR0FBWixHQUFrQk4sU0FBbEI7QUFDQSxXQUFPLEtBQUsyRSwwQkFBTCxDQUFnQzNFLFNBQWhDLEVBQTJDSixNQUFNLENBQUNRLE9BQWxELEVBQTJELEVBQTNELEVBQStEUixNQUFNLENBQUNDLE1BQXRFLEVBQ0paLElBREksQ0FDQyxNQUFNLEtBQUsrRSxpQkFBTCxFQURQLEVBRUovRSxJQUZJLENBRUN1RixnQkFBZ0IsSUFBSUEsZ0JBQWdCLENBQUNtQyxZQUFqQixDQUE4QnRHLFdBQTlCLENBRnJCLEVBR0o0QyxLQUhJLENBR0VDLEdBQUcsSUFBSSxLQUFLRyxXQUFMLENBQWlCSCxHQUFqQixDQUhULENBQVA7QUFJRDs7QUFFRDBELEVBQUFBLG1CQUFtQixDQUFDNUcsU0FBRCxFQUFvQlksU0FBcEIsRUFBdUNDLElBQXZDLEVBQWlFO0FBQ2xGLFdBQU8sS0FBS21ELGlCQUFMLEdBQ0ovRSxJQURJLENBQ0N1RixnQkFBZ0IsSUFBSUEsZ0JBQWdCLENBQUNvQyxtQkFBakIsQ0FBcUM1RyxTQUFyQyxFQUFnRFksU0FBaEQsRUFBMkRDLElBQTNELENBRHJCLEVBRUo1QixJQUZJLENBRUMsTUFBTSxLQUFLNEgscUJBQUwsQ0FBMkI3RyxTQUEzQixFQUFzQ1ksU0FBdEMsRUFBaURDLElBQWpELENBRlAsRUFHSm9DLEtBSEksQ0FHRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBSFQsQ0FBUDtBQUlELEdBbFB3RCxDQW9QekQ7QUFDQTs7O0FBQ0E0RCxFQUFBQSxXQUFXLENBQUM5RyxTQUFELEVBQW9CO0FBQzdCLFdBQ0UsS0FBSzRELG1CQUFMLENBQXlCNUQsU0FBekIsRUFDR2YsSUFESCxDQUNRSSxVQUFVLElBQUlBLFVBQVUsQ0FBQzBILElBQVgsRUFEdEIsRUFFRzlELEtBRkgsQ0FFU0ssS0FBSyxJQUFJO0FBQ2Q7QUFDQSxVQUFJQSxLQUFLLENBQUMwRCxPQUFOLElBQWlCLGNBQXJCLEVBQXFDO0FBQ25DO0FBQ0Q7O0FBQ0QsWUFBTTFELEtBQU47QUFDRCxLQVJILEVBU0U7QUFURixLQVVHckUsSUFWSCxDQVVRLE1BQU0sS0FBSytFLGlCQUFMLEVBVmQsRUFXRy9FLElBWEgsQ0FXUXVGLGdCQUFnQixJQUFJQSxnQkFBZ0IsQ0FBQ3lDLG1CQUFqQixDQUFxQ2pILFNBQXJDLENBWDVCLEVBWUdpRCxLQVpILENBWVNDLEdBQUcsSUFBSSxLQUFLRyxXQUFMLENBQWlCSCxHQUFqQixDQVpoQixDQURGO0FBZUQ7O0FBRURnRSxFQUFBQSxnQkFBZ0IsQ0FBQ0MsSUFBRCxFQUFnQjtBQUM5QixXQUFPckksNEJBQTRCLENBQUMsSUFBRCxDQUE1QixDQUFtQ0csSUFBbkMsQ0FBd0NFLFdBQVcsSUFDeERnRSxPQUFPLENBQUM4QyxHQUFSLENBQ0U5RyxXQUFXLENBQUNpSSxHQUFaLENBQWdCL0gsVUFBVSxJQUFLOEgsSUFBSSxHQUFHOUgsVUFBVSxDQUFDZ0ksVUFBWCxDQUFzQixFQUF0QixDQUFILEdBQStCaEksVUFBVSxDQUFDMEgsSUFBWCxFQUFsRSxDQURGLENBREssQ0FBUDtBQUtELEdBOVF3RCxDQWdSekQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFFQTs7O0FBQ0FPLEVBQUFBLFlBQVksQ0FBQ3RILFNBQUQsRUFBb0JKLE1BQXBCLEVBQXdDMkgsVUFBeEMsRUFBOEQ7QUFDeEUsVUFBTUMsZ0JBQWdCLEdBQUdELFVBQVUsQ0FBQ0gsR0FBWCxDQUFleEcsU0FBUyxJQUFJO0FBQ25ELFVBQUloQixNQUFNLENBQUNDLE1BQVAsQ0FBY2UsU0FBZCxFQUF5QkMsSUFBekIsS0FBa0MsU0FBdEMsRUFBaUQ7QUFDL0MsZUFBUSxNQUFLRCxTQUFVLEVBQXZCO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsZUFBT0EsU0FBUDtBQUNEO0FBQ0YsS0FOd0IsQ0FBekI7QUFPQSxVQUFNNkcsZ0JBQWdCLEdBQUc7QUFBRUMsTUFBQUEsTUFBTSxFQUFFO0FBQVYsS0FBekI7QUFDQUYsSUFBQUEsZ0JBQWdCLENBQUN2QyxPQUFqQixDQUF5QnBCLElBQUksSUFBSTtBQUMvQjRELE1BQUFBLGdCQUFnQixDQUFDLFFBQUQsQ0FBaEIsQ0FBMkI1RCxJQUEzQixJQUFtQyxJQUFuQztBQUNELEtBRkQ7QUFJQSxVQUFNOEQsZ0JBQWdCLEdBQUc7QUFBRUMsTUFBQUEsR0FBRyxFQUFFO0FBQVAsS0FBekI7QUFDQUosSUFBQUEsZ0JBQWdCLENBQUN2QyxPQUFqQixDQUF5QnBCLElBQUksSUFBSTtBQUMvQjhELE1BQUFBLGdCQUFnQixDQUFDLEtBQUQsQ0FBaEIsQ0FBd0JsQyxJQUF4QixDQUE2QjtBQUFFLFNBQUM1QixJQUFELEdBQVE7QUFBRWdFLFVBQUFBLE9BQU8sRUFBRTtBQUFYO0FBQVYsT0FBN0I7QUFDRCxLQUZEO0FBSUEsVUFBTUMsWUFBWSxHQUFHO0FBQUVKLE1BQUFBLE1BQU0sRUFBRTtBQUFWLEtBQXJCO0FBQ0FILElBQUFBLFVBQVUsQ0FBQ3RDLE9BQVgsQ0FBbUJwQixJQUFJLElBQUk7QUFDekJpRSxNQUFBQSxZQUFZLENBQUMsUUFBRCxDQUFaLENBQXVCakUsSUFBdkIsSUFBK0IsSUFBL0I7QUFDQWlFLE1BQUFBLFlBQVksQ0FBQyxRQUFELENBQVosQ0FBd0IsNEJBQTJCakUsSUFBSyxFQUF4RCxJQUE2RCxJQUE3RDtBQUNELEtBSEQ7QUFLQSxXQUFPLEtBQUtELG1CQUFMLENBQXlCNUQsU0FBekIsRUFDSmYsSUFESSxDQUNDSSxVQUFVLElBQUlBLFVBQVUsQ0FBQzBJLFVBQVgsQ0FBc0JKLGdCQUF0QixFQUF3Q0YsZ0JBQXhDLENBRGYsRUFFSnhJLElBRkksQ0FFQyxNQUFNLEtBQUsrRSxpQkFBTCxFQUZQLEVBR0ovRSxJQUhJLENBR0N1RixnQkFBZ0IsSUFBSUEsZ0JBQWdCLENBQUNDLFlBQWpCLENBQThCekUsU0FBOUIsRUFBeUM4SCxZQUF6QyxDQUhyQixFQUlKN0UsS0FKSSxDQUlFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FKVCxDQUFQO0FBS0QsR0FqVXdELENBbVV6RDtBQUNBO0FBQ0E7OztBQUNBOEUsRUFBQUEsYUFBYSxHQUE0QjtBQUN2QyxXQUFPLEtBQUtoRSxpQkFBTCxHQUNKL0UsSUFESSxDQUNDZ0osaUJBQWlCLElBQUlBLGlCQUFpQixDQUFDQywyQkFBbEIsRUFEdEIsRUFFSmpGLEtBRkksQ0FFRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBRlQsQ0FBUDtBQUdELEdBMVV3RCxDQTRVekQ7QUFDQTtBQUNBOzs7QUFDQWlGLEVBQUFBLFFBQVEsQ0FBQ25JLFNBQUQsRUFBMkM7QUFDakQsV0FBTyxLQUFLZ0UsaUJBQUwsR0FDSi9FLElBREksQ0FDQ2dKLGlCQUFpQixJQUFJQSxpQkFBaUIsQ0FBQ0csMEJBQWxCLENBQTZDcEksU0FBN0MsQ0FEdEIsRUFFSmlELEtBRkksQ0FFRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBRlQsQ0FBUDtBQUdELEdBblZ3RCxDQXFWekQ7QUFDQTtBQUNBOzs7QUFDQW1GLEVBQUFBLFlBQVksQ0FBQ3JJLFNBQUQsRUFBb0JKLE1BQXBCLEVBQXdDMEksTUFBeEMsRUFBcURDLG9CQUFyRCxFQUFpRjtBQUMzRjNJLElBQUFBLE1BQU0sR0FBR0QsK0JBQStCLENBQUNDLE1BQUQsQ0FBeEM7QUFDQSxVQUFNUyxXQUFXLEdBQUcsdURBQWtDTCxTQUFsQyxFQUE2Q3NJLE1BQTdDLEVBQXFEMUksTUFBckQsQ0FBcEI7QUFDQSxXQUFPLEtBQUtnRSxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUFJQSxVQUFVLENBQUNtSixTQUFYLENBQXFCbkksV0FBckIsRUFBa0NrSSxvQkFBbEMsQ0FEZixFQUVKdEYsS0FGSSxDQUVFSyxLQUFLLElBQUk7QUFDZCxVQUFJQSxLQUFLLENBQUNDLElBQU4sS0FBZSxLQUFuQixFQUEwQjtBQUN4QjtBQUNBLGNBQU1MLEdBQUcsR0FBRyxJQUFJa0MsY0FBTUMsS0FBVixDQUNWRCxjQUFNQyxLQUFOLENBQVlvRCxlQURGLEVBRVYsK0RBRlUsQ0FBWjtBQUlBdkYsUUFBQUEsR0FBRyxDQUFDd0YsZUFBSixHQUFzQnBGLEtBQXRCOztBQUNBLFlBQUlBLEtBQUssQ0FBQzBELE9BQVYsRUFBbUI7QUFDakIsZ0JBQU0yQixPQUFPLEdBQUdyRixLQUFLLENBQUMwRCxPQUFOLENBQWN6SCxLQUFkLENBQW9CLDZDQUFwQixDQUFoQjs7QUFDQSxjQUFJb0osT0FBTyxJQUFJQyxLQUFLLENBQUNDLE9BQU4sQ0FBY0YsT0FBZCxDQUFmLEVBQXVDO0FBQ3JDekYsWUFBQUEsR0FBRyxDQUFDNEYsUUFBSixHQUFlO0FBQUVDLGNBQUFBLGdCQUFnQixFQUFFSixPQUFPLENBQUMsQ0FBRDtBQUEzQixhQUFmO0FBQ0Q7QUFDRjs7QUFDRCxjQUFNekYsR0FBTjtBQUNEOztBQUNELFlBQU1JLEtBQU47QUFDRCxLQW5CSSxFQW9CSkwsS0FwQkksQ0FvQkVDLEdBQUcsSUFBSSxLQUFLRyxXQUFMLENBQWlCSCxHQUFqQixDQXBCVCxDQUFQO0FBcUJELEdBaFh3RCxDQWtYekQ7QUFDQTtBQUNBOzs7QUFDQThGLEVBQUFBLG9CQUFvQixDQUNsQmhKLFNBRGtCLEVBRWxCSixNQUZrQixFQUdsQnFKLEtBSGtCLEVBSWxCVixvQkFKa0IsRUFLbEI7QUFDQTNJLElBQUFBLE1BQU0sR0FBR0QsK0JBQStCLENBQUNDLE1BQUQsQ0FBeEM7QUFDQSxXQUFPLEtBQUtnRSxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUFJO0FBQ2xCLFlBQU02SixVQUFVLEdBQUcsb0NBQWVsSixTQUFmLEVBQTBCaUosS0FBMUIsRUFBaUNySixNQUFqQyxDQUFuQjtBQUNBLGFBQU9QLFVBQVUsQ0FBQ2dJLFVBQVgsQ0FBc0I2QixVQUF0QixFQUFrQ1gsb0JBQWxDLENBQVA7QUFDRCxLQUpJLEVBS0p0RixLQUxJLENBS0VDLEdBQUcsSUFBSSxLQUFLRyxXQUFMLENBQWlCSCxHQUFqQixDQUxULEVBTUpqRSxJQU5JLENBT0gsQ0FBQztBQUFFa0ssTUFBQUE7QUFBRixLQUFELEtBQWdCO0FBQ2QsVUFBSUEsTUFBTSxDQUFDQyxDQUFQLEtBQWEsQ0FBakIsRUFBb0I7QUFDbEIsY0FBTSxJQUFJaEUsY0FBTUMsS0FBVixDQUFnQkQsY0FBTUMsS0FBTixDQUFZZ0UsZ0JBQTVCLEVBQThDLG1CQUE5QyxDQUFOO0FBQ0Q7O0FBQ0QsYUFBT2xHLE9BQU8sQ0FBQ08sT0FBUixFQUFQO0FBQ0QsS0FaRSxFQWFILE1BQU07QUFDSixZQUFNLElBQUkwQixjQUFNQyxLQUFWLENBQWdCRCxjQUFNQyxLQUFOLENBQVlpRSxxQkFBNUIsRUFBbUQsd0JBQW5ELENBQU47QUFDRCxLQWZFLENBQVA7QUFpQkQsR0E3WXdELENBK1l6RDs7O0FBQ0FDLEVBQUFBLG9CQUFvQixDQUNsQnZKLFNBRGtCLEVBRWxCSixNQUZrQixFQUdsQnFKLEtBSGtCLEVBSWxCTyxNQUprQixFQUtsQmpCLG9CQUxrQixFQU1sQjtBQUNBM0ksSUFBQUEsTUFBTSxHQUFHRCwrQkFBK0IsQ0FBQ0MsTUFBRCxDQUF4QztBQUNBLFVBQU02SixXQUFXLEdBQUcscUNBQWdCekosU0FBaEIsRUFBMkJ3SixNQUEzQixFQUFtQzVKLE1BQW5DLENBQXBCO0FBQ0EsVUFBTXNKLFVBQVUsR0FBRyxvQ0FBZWxKLFNBQWYsRUFBMEJpSixLQUExQixFQUFpQ3JKLE1BQWpDLENBQW5CO0FBQ0EsV0FBTyxLQUFLZ0UsbUJBQUwsQ0FBeUI1RCxTQUF6QixFQUNKZixJQURJLENBQ0NJLFVBQVUsSUFBSUEsVUFBVSxDQUFDMEksVUFBWCxDQUFzQm1CLFVBQXRCLEVBQWtDTyxXQUFsQyxFQUErQ2xCLG9CQUEvQyxDQURmLEVBRUp0RixLQUZJLENBRUVDLEdBQUcsSUFBSSxLQUFLRyxXQUFMLENBQWlCSCxHQUFqQixDQUZULENBQVA7QUFHRCxHQTdad0QsQ0ErWnpEO0FBQ0E7OztBQUNBd0csRUFBQUEsZ0JBQWdCLENBQ2QxSixTQURjLEVBRWRKLE1BRmMsRUFHZHFKLEtBSGMsRUFJZE8sTUFKYyxFQUtkakIsb0JBTGMsRUFNZDtBQUNBM0ksSUFBQUEsTUFBTSxHQUFHRCwrQkFBK0IsQ0FBQ0MsTUFBRCxDQUF4QztBQUNBLFVBQU02SixXQUFXLEdBQUcscUNBQWdCekosU0FBaEIsRUFBMkJ3SixNQUEzQixFQUFtQzVKLE1BQW5DLENBQXBCO0FBQ0EsVUFBTXNKLFVBQVUsR0FBRyxvQ0FBZWxKLFNBQWYsRUFBMEJpSixLQUExQixFQUFpQ3JKLE1BQWpDLENBQW5CO0FBQ0EsV0FBTyxLQUFLZ0UsbUJBQUwsQ0FBeUI1RCxTQUF6QixFQUNKZixJQURJLENBQ0NJLFVBQVUsSUFDZEEsVUFBVSxDQUFDNkUsZ0JBQVgsQ0FBNEJ3RixnQkFBNUIsQ0FBNkNSLFVBQTdDLEVBQXlETyxXQUF6RCxFQUFzRTtBQUNwRUUsTUFBQUEsY0FBYyxFQUFFLEtBRG9EO0FBRXBFQyxNQUFBQSxPQUFPLEVBQUVyQixvQkFBb0IsSUFBSTVIO0FBRm1DLEtBQXRFLENBRkcsRUFPSjFCLElBUEksQ0FPQ2tLLE1BQU0sSUFBSSw4Q0FBeUJuSixTQUF6QixFQUFvQ21KLE1BQU0sQ0FBQ1UsS0FBM0MsRUFBa0RqSyxNQUFsRCxDQVBYLEVBUUpxRCxLQVJJLENBUUVLLEtBQUssSUFBSTtBQUNkLFVBQUlBLEtBQUssQ0FBQ0MsSUFBTixLQUFlLEtBQW5CLEVBQTBCO0FBQ3hCLGNBQU0sSUFBSTZCLGNBQU1DLEtBQVYsQ0FDSkQsY0FBTUMsS0FBTixDQUFZb0QsZUFEUixFQUVKLCtEQUZJLENBQU47QUFJRDs7QUFDRCxZQUFNbkYsS0FBTjtBQUNELEtBaEJJLEVBaUJKTCxLQWpCSSxDQWlCRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBakJULENBQVA7QUFrQkQsR0E3YndELENBK2J6RDs7O0FBQ0E0RyxFQUFBQSxlQUFlLENBQ2I5SixTQURhLEVBRWJKLE1BRmEsRUFHYnFKLEtBSGEsRUFJYk8sTUFKYSxFQUtiakIsb0JBTGEsRUFNYjtBQUNBM0ksSUFBQUEsTUFBTSxHQUFHRCwrQkFBK0IsQ0FBQ0MsTUFBRCxDQUF4QztBQUNBLFVBQU02SixXQUFXLEdBQUcscUNBQWdCekosU0FBaEIsRUFBMkJ3SixNQUEzQixFQUFtQzVKLE1BQW5DLENBQXBCO0FBQ0EsVUFBTXNKLFVBQVUsR0FBRyxvQ0FBZWxKLFNBQWYsRUFBMEJpSixLQUExQixFQUFpQ3JKLE1BQWpDLENBQW5CO0FBQ0EsV0FBTyxLQUFLZ0UsbUJBQUwsQ0FBeUI1RCxTQUF6QixFQUNKZixJQURJLENBQ0NJLFVBQVUsSUFBSUEsVUFBVSxDQUFDMEssU0FBWCxDQUFxQmIsVUFBckIsRUFBaUNPLFdBQWpDLEVBQThDbEIsb0JBQTlDLENBRGYsRUFFSnRGLEtBRkksQ0FFRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBRlQsQ0FBUDtBQUdELEdBN2N3RCxDQStjekQ7OztBQUNBOEcsRUFBQUEsSUFBSSxDQUNGaEssU0FERSxFQUVGSixNQUZFLEVBR0ZxSixLQUhFLEVBSUY7QUFBRWdCLElBQUFBLElBQUY7QUFBUUMsSUFBQUEsS0FBUjtBQUFlQyxJQUFBQSxJQUFmO0FBQXFCaEosSUFBQUEsSUFBckI7QUFBMkJpSixJQUFBQSxjQUEzQjtBQUEyQ0MsSUFBQUEsSUFBM0M7QUFBaURDLElBQUFBLGVBQWpEO0FBQWtFQyxJQUFBQTtBQUFsRSxHQUpFLEVBS1k7QUFDZDNLLElBQUFBLE1BQU0sR0FBR0QsK0JBQStCLENBQUNDLE1BQUQsQ0FBeEM7QUFDQSxVQUFNc0osVUFBVSxHQUFHLG9DQUFlbEosU0FBZixFQUEwQmlKLEtBQTFCLEVBQWlDckosTUFBakMsQ0FBbkI7O0FBQ0EsVUFBTTRLLFNBQVMsR0FBR0MsZ0JBQUVDLE9BQUYsQ0FBVVAsSUFBVixFQUFnQixDQUFDTixLQUFELEVBQVFqSixTQUFSLEtBQ2hDLGtDQUFhWixTQUFiLEVBQXdCWSxTQUF4QixFQUFtQ2hCLE1BQW5DLENBRGdCLENBQWxCOztBQUdBLFVBQU0rSyxTQUFTLEdBQUdGLGdCQUFFckUsTUFBRixDQUNoQmpGLElBRGdCLEVBRWhCLENBQUN5SixJQUFELEVBQU9sRixHQUFQLEtBQWU7QUFDYixVQUFJQSxHQUFHLEtBQUssS0FBWixFQUFtQjtBQUNqQmtGLFFBQUFBLElBQUksQ0FBQyxRQUFELENBQUosR0FBaUIsQ0FBakI7QUFDQUEsUUFBQUEsSUFBSSxDQUFDLFFBQUQsQ0FBSixHQUFpQixDQUFqQjtBQUNELE9BSEQsTUFHTztBQUNMQSxRQUFBQSxJQUFJLENBQUMsa0NBQWE1SyxTQUFiLEVBQXdCMEYsR0FBeEIsRUFBNkI5RixNQUE3QixDQUFELENBQUosR0FBNkMsQ0FBN0M7QUFDRDs7QUFDRCxhQUFPZ0wsSUFBUDtBQUNELEtBVmUsRUFXaEIsRUFYZ0IsQ0FBbEIsQ0FOYyxDQW9CZDtBQUNBO0FBQ0E7OztBQUNBLFFBQUl6SixJQUFJLElBQUksQ0FBQ3dKLFNBQVMsQ0FBQ3JLLEdBQXZCLEVBQTRCO0FBQzFCcUssTUFBQUEsU0FBUyxDQUFDckssR0FBVixHQUFnQixDQUFoQjtBQUNEOztBQUVEOEosSUFBQUEsY0FBYyxHQUFHLEtBQUtTLG9CQUFMLENBQTBCVCxjQUExQixDQUFqQjtBQUNBLFdBQU8sS0FBS1UseUJBQUwsQ0FBK0I5SyxTQUEvQixFQUEwQ2lKLEtBQTFDLEVBQWlEckosTUFBakQsRUFDSlgsSUFESSxDQUNDLE1BQU0sS0FBSzJFLG1CQUFMLENBQXlCNUQsU0FBekIsQ0FEUCxFQUVKZixJQUZJLENBRUNJLFVBQVUsSUFDZEEsVUFBVSxDQUFDMkssSUFBWCxDQUFnQmQsVUFBaEIsRUFBNEI7QUFDMUJlLE1BQUFBLElBRDBCO0FBRTFCQyxNQUFBQSxLQUYwQjtBQUcxQkMsTUFBQUEsSUFBSSxFQUFFSyxTQUhvQjtBQUkxQnJKLE1BQUFBLElBQUksRUFBRXdKLFNBSm9CO0FBSzFCdkksTUFBQUEsU0FBUyxFQUFFLEtBQUtELFVBTFU7QUFNMUJpSSxNQUFBQSxjQU4wQjtBQU8xQkMsTUFBQUEsSUFQMEI7QUFRMUJDLE1BQUFBLGVBUjBCO0FBUzFCQyxNQUFBQTtBQVQwQixLQUE1QixDQUhHLEVBZUp0TCxJQWZJLENBZUM4TCxPQUFPLElBQUk7QUFDZixVQUFJUixPQUFKLEVBQWE7QUFDWCxlQUFPUSxPQUFQO0FBQ0Q7O0FBQ0QsYUFBT0EsT0FBTyxDQUFDM0QsR0FBUixDQUFZa0IsTUFBTSxJQUFJLDhDQUF5QnRJLFNBQXpCLEVBQW9Dc0ksTUFBcEMsRUFBNEMxSSxNQUE1QyxDQUF0QixDQUFQO0FBQ0QsS0FwQkksRUFxQkpxRCxLQXJCSSxDQXFCRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBckJULENBQVA7QUFzQkQ7O0FBRUQ4SCxFQUFBQSxXQUFXLENBQ1RoTCxTQURTLEVBRVRKLE1BRlMsRUFHVDJILFVBSFMsRUFJVDBELFNBSlMsRUFLVFgsZUFBd0IsR0FBRyxLQUxsQixFQU1UMUgsT0FBZ0IsR0FBRyxFQU5WLEVBT0s7QUFDZGhELElBQUFBLE1BQU0sR0FBR0QsK0JBQStCLENBQUNDLE1BQUQsQ0FBeEM7QUFDQSxVQUFNc0wsb0JBQW9CLEdBQUcsRUFBN0I7QUFDQSxVQUFNQyxlQUFlLEdBQUc1RCxVQUFVLENBQUNILEdBQVgsQ0FBZXhHLFNBQVMsSUFBSSxrQ0FBYVosU0FBYixFQUF3QlksU0FBeEIsRUFBbUNoQixNQUFuQyxDQUE1QixDQUF4QjtBQUNBdUwsSUFBQUEsZUFBZSxDQUFDbEcsT0FBaEIsQ0FBd0JyRSxTQUFTLElBQUk7QUFDbkNzSyxNQUFBQSxvQkFBb0IsQ0FBQ3RLLFNBQUQsQ0FBcEIsR0FBa0NnQyxPQUFPLENBQUN3SSxTQUFSLEtBQXNCekssU0FBdEIsR0FBa0NpQyxPQUFPLENBQUN3SSxTQUExQyxHQUFzRCxDQUF4RjtBQUNELEtBRkQ7QUFJQSxVQUFNQyxjQUFzQixHQUFHO0FBQUVDLE1BQUFBLFVBQVUsRUFBRSxJQUFkO0FBQW9CQyxNQUFBQSxNQUFNLEVBQUU7QUFBNUIsS0FBL0I7QUFDQSxVQUFNQyxnQkFBd0IsR0FBR1AsU0FBUyxHQUFHO0FBQUVwSCxNQUFBQSxJQUFJLEVBQUVvSDtBQUFSLEtBQUgsR0FBeUIsRUFBbkU7QUFDQSxVQUFNUSxVQUFrQixHQUFHN0ksT0FBTyxDQUFDOEksR0FBUixLQUFnQi9LLFNBQWhCLEdBQTRCO0FBQUVnTCxNQUFBQSxrQkFBa0IsRUFBRS9JLE9BQU8sQ0FBQzhJO0FBQTlCLEtBQTVCLEdBQWtFLEVBQTdGO0FBQ0EsVUFBTUUsc0JBQThCLEdBQUd0QixlQUFlLEdBQ2xEO0FBQUV1QixNQUFBQSxTQUFTLEVBQUU5SCx5QkFBZ0IrSCx3QkFBaEI7QUFBYixLQURrRCxHQUVsRCxFQUZKOztBQUdBLFVBQU1DLFlBQW9CLCtEQUNyQlYsY0FEcUIsR0FFckJPLHNCQUZxQixHQUdyQkosZ0JBSHFCLEdBSXJCQyxVQUpxQixDQUExQjs7QUFPQSxXQUFPLEtBQUs3SCxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FFSEksVUFBVSxJQUNSLElBQUk4RCxPQUFKLENBQVksQ0FBQ08sT0FBRCxFQUFVTixNQUFWLEtBQ1YvRCxVQUFVLENBQUM2RSxnQkFBWCxDQUE0QjhILFdBQTVCLENBQXdDZCxvQkFBeEMsRUFBOERhLFlBQTlELEVBQTRFekksS0FBSyxJQUMvRUEsS0FBSyxHQUFHRixNQUFNLENBQUNFLEtBQUQsQ0FBVCxHQUFtQkksT0FBTyxFQURqQyxDQURGLENBSEMsRUFTSlQsS0FUSSxDQVNFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FUVCxDQUFQO0FBVUQsR0EvaUJ3RCxDQWlqQnpEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBK0ksRUFBQUEsZ0JBQWdCLENBQUNqTSxTQUFELEVBQW9CSixNQUFwQixFQUF3QzJILFVBQXhDLEVBQThEO0FBQzVFM0gsSUFBQUEsTUFBTSxHQUFHRCwrQkFBK0IsQ0FBQ0MsTUFBRCxDQUF4QztBQUNBLFVBQU1zTCxvQkFBb0IsR0FBRyxFQUE3QjtBQUNBLFVBQU1DLGVBQWUsR0FBRzVELFVBQVUsQ0FBQ0gsR0FBWCxDQUFleEcsU0FBUyxJQUFJLGtDQUFhWixTQUFiLEVBQXdCWSxTQUF4QixFQUFtQ2hCLE1BQW5DLENBQTVCLENBQXhCO0FBQ0F1TCxJQUFBQSxlQUFlLENBQUNsRyxPQUFoQixDQUF3QnJFLFNBQVMsSUFBSTtBQUNuQ3NLLE1BQUFBLG9CQUFvQixDQUFDdEssU0FBRCxDQUFwQixHQUFrQyxDQUFsQztBQUNELEtBRkQ7QUFHQSxXQUFPLEtBQUtnRCxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUFJQSxVQUFVLENBQUM2TSxvQ0FBWCxDQUFnRGhCLG9CQUFoRCxDQURmLEVBRUpqSSxLQUZJLENBRUVLLEtBQUssSUFBSTtBQUNkLFVBQUlBLEtBQUssQ0FBQ0MsSUFBTixLQUFlLEtBQW5CLEVBQTBCO0FBQ3hCLGNBQU0sSUFBSTZCLGNBQU1DLEtBQVYsQ0FDSkQsY0FBTUMsS0FBTixDQUFZb0QsZUFEUixFQUVKLDJFQUZJLENBQU47QUFJRDs7QUFDRCxZQUFNbkYsS0FBTjtBQUNELEtBVkksRUFXSkwsS0FYSSxDQVdFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FYVCxDQUFQO0FBWUQsR0F6a0J3RCxDQTJrQnpEOzs7QUFDQWlKLEVBQUFBLFFBQVEsQ0FBQ25NLFNBQUQsRUFBb0JpSixLQUFwQixFQUFzQztBQUM1QyxXQUFPLEtBQUtyRixtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUNkQSxVQUFVLENBQUMySyxJQUFYLENBQWdCZixLQUFoQixFQUF1QjtBQUNyQjdHLE1BQUFBLFNBQVMsRUFBRSxLQUFLRDtBQURLLEtBQXZCLENBRkcsRUFNSmMsS0FOSSxDQU1FQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FOVCxDQUFQO0FBT0QsR0FwbEJ3RCxDQXNsQnpEOzs7QUFDQWtKLEVBQUFBLEtBQUssQ0FDSHBNLFNBREcsRUFFSEosTUFGRyxFQUdIcUosS0FIRyxFQUlIbUIsY0FKRyxFQUtIQyxJQUxHLEVBTUg7QUFDQXpLLElBQUFBLE1BQU0sR0FBR0QsK0JBQStCLENBQUNDLE1BQUQsQ0FBeEM7QUFDQXdLLElBQUFBLGNBQWMsR0FBRyxLQUFLUyxvQkFBTCxDQUEwQlQsY0FBMUIsQ0FBakI7QUFDQSxXQUFPLEtBQUt4RyxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUNkQSxVQUFVLENBQUMrTSxLQUFYLENBQWlCLG9DQUFlcE0sU0FBZixFQUEwQmlKLEtBQTFCLEVBQWlDckosTUFBakMsRUFBeUMsSUFBekMsQ0FBakIsRUFBaUU7QUFDL0R3QyxNQUFBQSxTQUFTLEVBQUUsS0FBS0QsVUFEK0M7QUFFL0RpSSxNQUFBQSxjQUYrRDtBQUcvREMsTUFBQUE7QUFIK0QsS0FBakUsQ0FGRyxFQVFKcEgsS0FSSSxDQVFFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FSVCxDQUFQO0FBU0Q7O0FBRURtSixFQUFBQSxRQUFRLENBQUNyTSxTQUFELEVBQW9CSixNQUFwQixFQUF3Q3FKLEtBQXhDLEVBQTBEckksU0FBMUQsRUFBNkU7QUFDbkZoQixJQUFBQSxNQUFNLEdBQUdELCtCQUErQixDQUFDQyxNQUFELENBQXhDO0FBQ0EsVUFBTTBNLGNBQWMsR0FBRzFNLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjZSxTQUFkLEtBQTRCaEIsTUFBTSxDQUFDQyxNQUFQLENBQWNlLFNBQWQsRUFBeUJDLElBQXpCLEtBQWtDLFNBQXJGO0FBQ0EsVUFBTTBMLGNBQWMsR0FBRyxrQ0FBYXZNLFNBQWIsRUFBd0JZLFNBQXhCLEVBQW1DaEIsTUFBbkMsQ0FBdkI7QUFFQSxXQUFPLEtBQUtnRSxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUNkQSxVQUFVLENBQUNnTixRQUFYLENBQW9CRSxjQUFwQixFQUFvQyxvQ0FBZXZNLFNBQWYsRUFBMEJpSixLQUExQixFQUFpQ3JKLE1BQWpDLENBQXBDLENBRkcsRUFJSlgsSUFKSSxDQUlDOEwsT0FBTyxJQUFJO0FBQ2ZBLE1BQUFBLE9BQU8sR0FBR0EsT0FBTyxDQUFDM0wsTUFBUixDQUFlaUgsR0FBRyxJQUFJQSxHQUFHLElBQUksSUFBN0IsQ0FBVjtBQUNBLGFBQU8wRSxPQUFPLENBQUMzRCxHQUFSLENBQVlrQixNQUFNLElBQUk7QUFDM0IsWUFBSWdFLGNBQUosRUFBb0I7QUFDbEIsaUJBQU8sNENBQXVCMU0sTUFBdkIsRUFBK0JnQixTQUEvQixFQUEwQzBILE1BQTFDLENBQVA7QUFDRDs7QUFDRCxlQUFPLDhDQUF5QnRJLFNBQXpCLEVBQW9Dc0ksTUFBcEMsRUFBNEMxSSxNQUE1QyxDQUFQO0FBQ0QsT0FMTSxDQUFQO0FBTUQsS0FaSSxFQWFKcUQsS0FiSSxDQWFFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FiVCxDQUFQO0FBY0Q7O0FBRURzSixFQUFBQSxTQUFTLENBQ1B4TSxTQURPLEVBRVBKLE1BRk8sRUFHUDZNLFFBSE8sRUFJUHJDLGNBSk8sRUFLUEMsSUFMTyxFQU1QRSxPQU5PLEVBT1A7QUFDQSxRQUFJK0IsY0FBYyxHQUFHLEtBQXJCO0FBQ0FHLElBQUFBLFFBQVEsR0FBR0EsUUFBUSxDQUFDckYsR0FBVCxDQUFhc0YsS0FBSyxJQUFJO0FBQy9CLFVBQUlBLEtBQUssQ0FBQ0MsTUFBVixFQUFrQjtBQUNoQkQsUUFBQUEsS0FBSyxDQUFDQyxNQUFOLEdBQWUsS0FBS0Msd0JBQUwsQ0FBOEJoTixNQUE5QixFQUFzQzhNLEtBQUssQ0FBQ0MsTUFBNUMsQ0FBZjs7QUFDQSxZQUNFRCxLQUFLLENBQUNDLE1BQU4sQ0FBYXJNLEdBQWIsSUFDQSxPQUFPb00sS0FBSyxDQUFDQyxNQUFOLENBQWFyTSxHQUFwQixLQUE0QixRQUQ1QixJQUVBb00sS0FBSyxDQUFDQyxNQUFOLENBQWFyTSxHQUFiLENBQWlCYixPQUFqQixDQUF5QixNQUF6QixLQUFvQyxDQUh0QyxFQUlFO0FBQ0E2TSxVQUFBQSxjQUFjLEdBQUcsSUFBakI7QUFDRDtBQUNGOztBQUNELFVBQUlJLEtBQUssQ0FBQ0csTUFBVixFQUFrQjtBQUNoQkgsUUFBQUEsS0FBSyxDQUFDRyxNQUFOLEdBQWUsS0FBS0MsbUJBQUwsQ0FBeUJsTixNQUF6QixFQUFpQzhNLEtBQUssQ0FBQ0csTUFBdkMsQ0FBZjtBQUNEOztBQUNELFVBQUlILEtBQUssQ0FBQ0ssUUFBVixFQUFvQjtBQUNsQkwsUUFBQUEsS0FBSyxDQUFDSyxRQUFOLEdBQWlCLEtBQUtDLDBCQUFMLENBQWdDcE4sTUFBaEMsRUFBd0M4TSxLQUFLLENBQUNLLFFBQTlDLENBQWpCO0FBQ0Q7O0FBQ0QsVUFBSUwsS0FBSyxDQUFDTyxRQUFOLElBQWtCUCxLQUFLLENBQUNPLFFBQU4sQ0FBZWhFLEtBQXJDLEVBQTRDO0FBQzFDeUQsUUFBQUEsS0FBSyxDQUFDTyxRQUFOLENBQWVoRSxLQUFmLEdBQXVCLEtBQUs2RCxtQkFBTCxDQUF5QmxOLE1BQXpCLEVBQWlDOE0sS0FBSyxDQUFDTyxRQUFOLENBQWVoRSxLQUFoRCxDQUF2QjtBQUNEOztBQUNELGFBQU95RCxLQUFQO0FBQ0QsS0FyQlUsQ0FBWDtBQXNCQXRDLElBQUFBLGNBQWMsR0FBRyxLQUFLUyxvQkFBTCxDQUEwQlQsY0FBMUIsQ0FBakI7QUFDQSxXQUFPLEtBQUt4RyxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUNkQSxVQUFVLENBQUNtTixTQUFYLENBQXFCQyxRQUFyQixFQUErQjtBQUM3QnJDLE1BQUFBLGNBRDZCO0FBRTdCaEksTUFBQUEsU0FBUyxFQUFFLEtBQUtELFVBRmE7QUFHN0JrSSxNQUFBQSxJQUg2QjtBQUk3QkUsTUFBQUE7QUFKNkIsS0FBL0IsQ0FGRyxFQVNKdEwsSUFUSSxDQVNDaU8sT0FBTyxJQUFJO0FBQ2ZBLE1BQUFBLE9BQU8sQ0FBQ2pJLE9BQVIsQ0FBZ0JrRSxNQUFNLElBQUk7QUFDeEIsWUFBSWpJLE1BQU0sQ0FBQ3lFLFNBQVAsQ0FBaUJDLGNBQWpCLENBQWdDQyxJQUFoQyxDQUFxQ3NELE1BQXJDLEVBQTZDLEtBQTdDLENBQUosRUFBeUQ7QUFDdkQsY0FBSW1ELGNBQWMsSUFBSW5ELE1BQU0sQ0FBQzdJLEdBQTdCLEVBQWtDO0FBQ2hDNkksWUFBQUEsTUFBTSxDQUFDN0ksR0FBUCxHQUFhNkksTUFBTSxDQUFDN0ksR0FBUCxDQUFXNk0sS0FBWCxDQUFpQixHQUFqQixFQUFzQixDQUF0QixDQUFiO0FBQ0Q7O0FBQ0QsY0FDRWhFLE1BQU0sQ0FBQzdJLEdBQVAsSUFBYyxJQUFkLElBQ0E2SSxNQUFNLENBQUM3SSxHQUFQLElBQWNLLFNBRGQsSUFFQyxDQUFDLFFBQUQsRUFBVyxRQUFYLEVBQXFCeU0sUUFBckIsQ0FBOEIsT0FBT2pFLE1BQU0sQ0FBQzdJLEdBQTVDLEtBQW9EbUssZ0JBQUU0QyxPQUFGLENBQVVsRSxNQUFNLENBQUM3SSxHQUFqQixDQUh2RCxFQUlFO0FBQ0E2SSxZQUFBQSxNQUFNLENBQUM3SSxHQUFQLEdBQWEsSUFBYjtBQUNEOztBQUNENkksVUFBQUEsTUFBTSxDQUFDNUksUUFBUCxHQUFrQjRJLE1BQU0sQ0FBQzdJLEdBQXpCO0FBQ0EsaUJBQU82SSxNQUFNLENBQUM3SSxHQUFkO0FBQ0Q7QUFDRixPQWZEO0FBZ0JBLGFBQU80TSxPQUFQO0FBQ0QsS0EzQkksRUE0QkpqTyxJQTVCSSxDQTRCQzhMLE9BQU8sSUFBSUEsT0FBTyxDQUFDM0QsR0FBUixDQUFZa0IsTUFBTSxJQUFJLDhDQUF5QnRJLFNBQXpCLEVBQW9Dc0ksTUFBcEMsRUFBNEMxSSxNQUE1QyxDQUF0QixDQTVCWixFQTZCSnFELEtBN0JJLENBNkJFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0E3QlQsQ0FBUDtBQThCRCxHQTlyQndELENBZ3NCekQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBNEosRUFBQUEsbUJBQW1CLENBQUNsTixNQUFELEVBQWM2TSxRQUFkLEVBQWtDO0FBQ25ELFFBQUlBLFFBQVEsS0FBSyxJQUFqQixFQUF1QjtBQUNyQixhQUFPLElBQVA7QUFDRCxLQUZELE1BRU8sSUFBSTdELEtBQUssQ0FBQ0MsT0FBTixDQUFjNEQsUUFBZCxDQUFKLEVBQTZCO0FBQ2xDLGFBQU9BLFFBQVEsQ0FBQ3JGLEdBQVQsQ0FBYXlDLEtBQUssSUFBSSxLQUFLaUQsbUJBQUwsQ0FBeUJsTixNQUF6QixFQUFpQ2lLLEtBQWpDLENBQXRCLENBQVA7QUFDRCxLQUZNLE1BRUEsSUFBSSxPQUFPNEMsUUFBUCxLQUFvQixRQUF4QixFQUFrQztBQUN2QyxZQUFNYSxXQUFXLEdBQUcsRUFBcEI7O0FBQ0EsV0FBSyxNQUFNcEksS0FBWCxJQUFvQnVILFFBQXBCLEVBQThCO0FBQzVCLFlBQUk3TSxNQUFNLENBQUNDLE1BQVAsQ0FBY3FGLEtBQWQsS0FBd0J0RixNQUFNLENBQUNDLE1BQVAsQ0FBY3FGLEtBQWQsRUFBcUJyRSxJQUFyQixLQUE4QixTQUExRCxFQUFxRTtBQUNuRSxjQUFJLE9BQU80TCxRQUFRLENBQUN2SCxLQUFELENBQWYsS0FBMkIsUUFBL0IsRUFBeUM7QUFDdkM7QUFDQW9JLFlBQUFBLFdBQVcsQ0FBRSxNQUFLcEksS0FBTSxFQUFiLENBQVgsR0FBNkJ1SCxRQUFRLENBQUN2SCxLQUFELENBQXJDO0FBQ0QsV0FIRCxNQUdPO0FBQ0xvSSxZQUFBQSxXQUFXLENBQUUsTUFBS3BJLEtBQU0sRUFBYixDQUFYLEdBQThCLEdBQUV0RixNQUFNLENBQUNDLE1BQVAsQ0FBY3FGLEtBQWQsRUFBcUJwRSxXQUFZLElBQUcyTCxRQUFRLENBQUN2SCxLQUFELENBQVEsRUFBcEY7QUFDRDtBQUNGLFNBUEQsTUFPTyxJQUFJdEYsTUFBTSxDQUFDQyxNQUFQLENBQWNxRixLQUFkLEtBQXdCdEYsTUFBTSxDQUFDQyxNQUFQLENBQWNxRixLQUFkLEVBQXFCckUsSUFBckIsS0FBOEIsTUFBMUQsRUFBa0U7QUFDdkV5TSxVQUFBQSxXQUFXLENBQUNwSSxLQUFELENBQVgsR0FBcUIsS0FBS3FJLGNBQUwsQ0FBb0JkLFFBQVEsQ0FBQ3ZILEtBQUQsQ0FBNUIsQ0FBckI7QUFDRCxTQUZNLE1BRUE7QUFDTG9JLFVBQUFBLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBWCxHQUFxQixLQUFLNEgsbUJBQUwsQ0FBeUJsTixNQUF6QixFQUFpQzZNLFFBQVEsQ0FBQ3ZILEtBQUQsQ0FBekMsQ0FBckI7QUFDRDs7QUFFRCxZQUFJQSxLQUFLLEtBQUssVUFBZCxFQUEwQjtBQUN4Qm9JLFVBQUFBLFdBQVcsQ0FBQyxLQUFELENBQVgsR0FBcUJBLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBaEM7QUFDQSxpQkFBT29JLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBbEI7QUFDRCxTQUhELE1BR08sSUFBSUEsS0FBSyxLQUFLLFdBQWQsRUFBMkI7QUFDaENvSSxVQUFBQSxXQUFXLENBQUMsYUFBRCxDQUFYLEdBQTZCQSxXQUFXLENBQUNwSSxLQUFELENBQXhDO0FBQ0EsaUJBQU9vSSxXQUFXLENBQUNwSSxLQUFELENBQWxCO0FBQ0QsU0FITSxNQUdBLElBQUlBLEtBQUssS0FBSyxXQUFkLEVBQTJCO0FBQ2hDb0ksVUFBQUEsV0FBVyxDQUFDLGFBQUQsQ0FBWCxHQUE2QkEsV0FBVyxDQUFDcEksS0FBRCxDQUF4QztBQUNBLGlCQUFPb0ksV0FBVyxDQUFDcEksS0FBRCxDQUFsQjtBQUNEO0FBQ0Y7O0FBQ0QsYUFBT29JLFdBQVA7QUFDRDs7QUFDRCxXQUFPYixRQUFQO0FBQ0QsR0F0dkJ3RCxDQXd2QnpEO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQU8sRUFBQUEsMEJBQTBCLENBQUNwTixNQUFELEVBQWM2TSxRQUFkLEVBQWtDO0FBQzFELFVBQU1hLFdBQVcsR0FBRyxFQUFwQjs7QUFDQSxTQUFLLE1BQU1wSSxLQUFYLElBQW9CdUgsUUFBcEIsRUFBOEI7QUFDNUIsVUFBSTdNLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjcUYsS0FBZCxLQUF3QnRGLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjcUYsS0FBZCxFQUFxQnJFLElBQXJCLEtBQThCLFNBQTFELEVBQXFFO0FBQ25FeU0sUUFBQUEsV0FBVyxDQUFFLE1BQUtwSSxLQUFNLEVBQWIsQ0FBWCxHQUE2QnVILFFBQVEsQ0FBQ3ZILEtBQUQsQ0FBckM7QUFDRCxPQUZELE1BRU87QUFDTG9JLFFBQUFBLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBWCxHQUFxQixLQUFLNEgsbUJBQUwsQ0FBeUJsTixNQUF6QixFQUFpQzZNLFFBQVEsQ0FBQ3ZILEtBQUQsQ0FBekMsQ0FBckI7QUFDRDs7QUFFRCxVQUFJQSxLQUFLLEtBQUssVUFBZCxFQUEwQjtBQUN4Qm9JLFFBQUFBLFdBQVcsQ0FBQyxLQUFELENBQVgsR0FBcUJBLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBaEM7QUFDQSxlQUFPb0ksV0FBVyxDQUFDcEksS0FBRCxDQUFsQjtBQUNELE9BSEQsTUFHTyxJQUFJQSxLQUFLLEtBQUssV0FBZCxFQUEyQjtBQUNoQ29JLFFBQUFBLFdBQVcsQ0FBQyxhQUFELENBQVgsR0FBNkJBLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBeEM7QUFDQSxlQUFPb0ksV0FBVyxDQUFDcEksS0FBRCxDQUFsQjtBQUNELE9BSE0sTUFHQSxJQUFJQSxLQUFLLEtBQUssV0FBZCxFQUEyQjtBQUNoQ29JLFFBQUFBLFdBQVcsQ0FBQyxhQUFELENBQVgsR0FBNkJBLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBeEM7QUFDQSxlQUFPb0ksV0FBVyxDQUFDcEksS0FBRCxDQUFsQjtBQUNEO0FBQ0Y7O0FBQ0QsV0FBT29JLFdBQVA7QUFDRCxHQWp4QndELENBbXhCekQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0FWLEVBQUFBLHdCQUF3QixDQUFDaE4sTUFBRCxFQUFjNk0sUUFBZCxFQUFrQztBQUN4RCxRQUFJN0QsS0FBSyxDQUFDQyxPQUFOLENBQWM0RCxRQUFkLENBQUosRUFBNkI7QUFDM0IsYUFBT0EsUUFBUSxDQUFDckYsR0FBVCxDQUFheUMsS0FBSyxJQUFJLEtBQUsrQyx3QkFBTCxDQUE4QmhOLE1BQTlCLEVBQXNDaUssS0FBdEMsQ0FBdEIsQ0FBUDtBQUNELEtBRkQsTUFFTyxJQUFJLE9BQU80QyxRQUFQLEtBQW9CLFFBQXhCLEVBQWtDO0FBQ3ZDLFlBQU1hLFdBQVcsR0FBRyxFQUFwQjs7QUFDQSxXQUFLLE1BQU1wSSxLQUFYLElBQW9CdUgsUUFBcEIsRUFBOEI7QUFDNUJhLFFBQUFBLFdBQVcsQ0FBQ3BJLEtBQUQsQ0FBWCxHQUFxQixLQUFLMEgsd0JBQUwsQ0FBOEJoTixNQUE5QixFQUFzQzZNLFFBQVEsQ0FBQ3ZILEtBQUQsQ0FBOUMsQ0FBckI7QUFDRDs7QUFDRCxhQUFPb0ksV0FBUDtBQUNELEtBTk0sTUFNQSxJQUFJLE9BQU9iLFFBQVAsS0FBb0IsUUFBeEIsRUFBa0M7QUFDdkMsWUFBTXZILEtBQUssR0FBR3VILFFBQVEsQ0FBQ2UsU0FBVCxDQUFtQixDQUFuQixDQUFkOztBQUNBLFVBQUk1TixNQUFNLENBQUNDLE1BQVAsQ0FBY3FGLEtBQWQsS0FBd0J0RixNQUFNLENBQUNDLE1BQVAsQ0FBY3FGLEtBQWQsRUFBcUJyRSxJQUFyQixLQUE4QixTQUExRCxFQUFxRTtBQUNuRSxlQUFRLE9BQU1xRSxLQUFNLEVBQXBCO0FBQ0QsT0FGRCxNQUVPLElBQUlBLEtBQUssSUFBSSxXQUFiLEVBQTBCO0FBQy9CLGVBQU8sY0FBUDtBQUNELE9BRk0sTUFFQSxJQUFJQSxLQUFLLElBQUksV0FBYixFQUEwQjtBQUMvQixlQUFPLGNBQVA7QUFDRDtBQUNGOztBQUNELFdBQU91SCxRQUFQO0FBQ0QsR0E1eUJ3RCxDQTh5QnpEO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQWMsRUFBQUEsY0FBYyxDQUFDMUQsS0FBRCxFQUFrQjtBQUM5QixRQUFJLE9BQU9BLEtBQVAsS0FBaUIsUUFBckIsRUFBK0I7QUFDN0IsYUFBTyxJQUFJNEQsSUFBSixDQUFTNUQsS0FBVCxDQUFQO0FBQ0Q7O0FBRUQsVUFBTXlELFdBQVcsR0FBRyxFQUFwQjs7QUFDQSxTQUFLLE1BQU1wSSxLQUFYLElBQW9CMkUsS0FBcEIsRUFBMkI7QUFDekJ5RCxNQUFBQSxXQUFXLENBQUNwSSxLQUFELENBQVgsR0FBcUIsS0FBS3FJLGNBQUwsQ0FBb0IxRCxLQUFLLENBQUMzRSxLQUFELENBQXpCLENBQXJCO0FBQ0Q7O0FBQ0QsV0FBT29JLFdBQVA7QUFDRDs7QUFFRHpDLEVBQUFBLG9CQUFvQixDQUFDVCxjQUFELEVBQW1DO0FBQ3JELFFBQUlBLGNBQUosRUFBb0I7QUFDbEJBLE1BQUFBLGNBQWMsR0FBR0EsY0FBYyxDQUFDc0QsV0FBZixFQUFqQjtBQUNEOztBQUNELFlBQVF0RCxjQUFSO0FBQ0UsV0FBSyxTQUFMO0FBQ0VBLFFBQUFBLGNBQWMsR0FBR3hMLGNBQWMsQ0FBQytPLE9BQWhDO0FBQ0E7O0FBQ0YsV0FBSyxtQkFBTDtBQUNFdkQsUUFBQUEsY0FBYyxHQUFHeEwsY0FBYyxDQUFDZ1AsaUJBQWhDO0FBQ0E7O0FBQ0YsV0FBSyxXQUFMO0FBQ0V4RCxRQUFBQSxjQUFjLEdBQUd4TCxjQUFjLENBQUNpUCxTQUFoQztBQUNBOztBQUNGLFdBQUsscUJBQUw7QUFDRXpELFFBQUFBLGNBQWMsR0FBR3hMLGNBQWMsQ0FBQ2tQLG1CQUFoQztBQUNBOztBQUNGLFdBQUssU0FBTDtBQUNFMUQsUUFBQUEsY0FBYyxHQUFHeEwsY0FBYyxDQUFDbVAsT0FBaEM7QUFDQTs7QUFDRixXQUFLcE4sU0FBTDtBQUNBLFdBQUssSUFBTDtBQUNBLFdBQUssRUFBTDtBQUNFOztBQUNGO0FBQ0UsY0FBTSxJQUFJeUUsY0FBTUMsS0FBVixDQUFnQkQsY0FBTUMsS0FBTixDQUFZQyxhQUE1QixFQUEyQyxnQ0FBM0MsQ0FBTjtBQXJCSjs7QUF1QkEsV0FBTzhFLGNBQVA7QUFDRDs7QUFFRDRELEVBQUFBLHFCQUFxQixHQUFrQjtBQUNyQyxXQUFPN0ssT0FBTyxDQUFDTyxPQUFSLEVBQVA7QUFDRDs7QUFFRHNJLEVBQUFBLFdBQVcsQ0FBQ2hNLFNBQUQsRUFBb0JzRyxLQUFwQixFQUFnQztBQUN6QyxXQUFPLEtBQUsxQyxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUFJQSxVQUFVLENBQUM2RSxnQkFBWCxDQUE0QjhILFdBQTVCLENBQXdDMUYsS0FBeEMsQ0FEZixFQUVKckQsS0FGSSxDQUVFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FGVCxDQUFQO0FBR0Q7O0FBRUQ4QyxFQUFBQSxhQUFhLENBQUNoRyxTQUFELEVBQW9CSSxPQUFwQixFQUFrQztBQUM3QyxXQUFPLEtBQUt3RCxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUFJQSxVQUFVLENBQUM2RSxnQkFBWCxDQUE0QjhCLGFBQTVCLENBQTBDNUYsT0FBMUMsQ0FEZixFQUVKNkMsS0FGSSxDQUVFQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FGVCxDQUFQO0FBR0Q7O0FBRUQyRCxFQUFBQSxxQkFBcUIsQ0FBQzdHLFNBQUQsRUFBb0JZLFNBQXBCLEVBQXVDQyxJQUF2QyxFQUFrRDtBQUNyRSxRQUFJQSxJQUFJLElBQUlBLElBQUksQ0FBQ0EsSUFBTCxLQUFjLFNBQTFCLEVBQXFDO0FBQ25DLFlBQU15RixLQUFLLEdBQUc7QUFDWixTQUFDMUYsU0FBRCxHQUFhO0FBREQsT0FBZDtBQUdBLGFBQU8sS0FBS29MLFdBQUwsQ0FBaUJoTSxTQUFqQixFQUE0QnNHLEtBQTVCLENBQVA7QUFDRDs7QUFDRCxXQUFPbkQsT0FBTyxDQUFDTyxPQUFSLEVBQVA7QUFDRDs7QUFFRG9ILEVBQUFBLHlCQUF5QixDQUFDOUssU0FBRCxFQUFvQmlKLEtBQXBCLEVBQXNDckosTUFBdEMsRUFBa0U7QUFDekYsU0FBSyxNQUFNZ0IsU0FBWCxJQUF3QnFJLEtBQXhCLEVBQStCO0FBQzdCLFVBQUksQ0FBQ0EsS0FBSyxDQUFDckksU0FBRCxDQUFOLElBQXFCLENBQUNxSSxLQUFLLENBQUNySSxTQUFELENBQUwsQ0FBaUJxTixLQUEzQyxFQUFrRDtBQUNoRDtBQUNEOztBQUNELFlBQU1wSixlQUFlLEdBQUdqRixNQUFNLENBQUNRLE9BQS9COztBQUNBLFdBQUssTUFBTXNGLEdBQVgsSUFBa0JiLGVBQWxCLEVBQW1DO0FBQ2pDLGNBQU15QixLQUFLLEdBQUd6QixlQUFlLENBQUNhLEdBQUQsQ0FBN0I7O0FBQ0EsWUFBSXhFLE1BQU0sQ0FBQ3lFLFNBQVAsQ0FBaUJDLGNBQWpCLENBQWdDQyxJQUFoQyxDQUFxQ1MsS0FBckMsRUFBNEMxRixTQUE1QyxDQUFKLEVBQTREO0FBQzFELGlCQUFPdUMsT0FBTyxDQUFDTyxPQUFSLEVBQVA7QUFDRDtBQUNGOztBQUNELFlBQU11SCxTQUFTLEdBQUksR0FBRXJLLFNBQVUsT0FBL0I7QUFDQSxZQUFNc04sU0FBUyxHQUFHO0FBQ2hCLFNBQUNqRCxTQUFELEdBQWE7QUFBRSxXQUFDckssU0FBRCxHQUFhO0FBQWY7QUFERyxPQUFsQjtBQUdBLGFBQU8sS0FBSytELDBCQUFMLENBQ0wzRSxTQURLLEVBRUxrTyxTQUZLLEVBR0xySixlQUhLLEVBSUxqRixNQUFNLENBQUNDLE1BSkYsRUFLTG9ELEtBTEssQ0FLQ0ssS0FBSyxJQUFJO0FBQ2YsWUFBSUEsS0FBSyxDQUFDQyxJQUFOLEtBQWUsRUFBbkIsRUFBdUI7QUFDckI7QUFDQSxpQkFBTyxLQUFLMkMsbUJBQUwsQ0FBeUJsRyxTQUF6QixDQUFQO0FBQ0Q7O0FBQ0QsY0FBTXNELEtBQU47QUFDRCxPQVhNLENBQVA7QUFZRDs7QUFDRCxXQUFPSCxPQUFPLENBQUNPLE9BQVIsRUFBUDtBQUNEOztBQUVEeUMsRUFBQUEsVUFBVSxDQUFDbkcsU0FBRCxFQUFvQjtBQUM1QixXQUFPLEtBQUs0RCxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUFJQSxVQUFVLENBQUM2RSxnQkFBWCxDQUE0QjlELE9BQTVCLEVBRGYsRUFFSjZDLEtBRkksQ0FFRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBRlQsQ0FBUDtBQUdEOztBQUVEc0MsRUFBQUEsU0FBUyxDQUFDeEYsU0FBRCxFQUFvQnNHLEtBQXBCLEVBQWdDO0FBQ3ZDLFdBQU8sS0FBSzFDLG1CQUFMLENBQXlCNUQsU0FBekIsRUFDSmYsSUFESSxDQUNDSSxVQUFVLElBQUlBLFVBQVUsQ0FBQzZFLGdCQUFYLENBQTRCc0IsU0FBNUIsQ0FBc0NjLEtBQXRDLENBRGYsRUFFSnJELEtBRkksQ0FFRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBRlQsQ0FBUDtBQUdEOztBQUVEaUwsRUFBQUEsY0FBYyxDQUFDbk8sU0FBRCxFQUFvQjtBQUNoQyxXQUFPLEtBQUs0RCxtQkFBTCxDQUF5QjVELFNBQXpCLEVBQ0pmLElBREksQ0FDQ0ksVUFBVSxJQUFJQSxVQUFVLENBQUM2RSxnQkFBWCxDQUE0QmtLLFdBQTVCLEVBRGYsRUFFSm5MLEtBRkksQ0FFRUMsR0FBRyxJQUFJLEtBQUtHLFdBQUwsQ0FBaUJILEdBQWpCLENBRlQsQ0FBUDtBQUdEOztBQUVEbUwsRUFBQUEsdUJBQXVCLEdBQWlCO0FBQ3RDLFdBQU8sS0FBS3JHLGFBQUwsR0FDSi9JLElBREksQ0FDQ3FQLE9BQU8sSUFBSTtBQUNmLFlBQU1DLFFBQVEsR0FBR0QsT0FBTyxDQUFDbEgsR0FBUixDQUFZeEgsTUFBTSxJQUFJO0FBQ3JDLGVBQU8sS0FBS3NHLG1CQUFMLENBQXlCdEcsTUFBTSxDQUFDSSxTQUFoQyxDQUFQO0FBQ0QsT0FGZ0IsQ0FBakI7QUFHQSxhQUFPbUQsT0FBTyxDQUFDOEMsR0FBUixDQUFZc0ksUUFBWixDQUFQO0FBQ0QsS0FOSSxFQU9KdEwsS0FQSSxDQU9FQyxHQUFHLElBQUksS0FBS0csV0FBTCxDQUFpQkgsR0FBakIsQ0FQVCxDQUFQO0FBUUQ7O0FBRURzTCxFQUFBQSwwQkFBMEIsR0FBaUI7QUFDekMsVUFBTUMsb0JBQW9CLEdBQUcsS0FBSzlMLE1BQUwsQ0FBWStMLFlBQVosRUFBN0I7QUFDQUQsSUFBQUEsb0JBQW9CLENBQUNFLGdCQUFyQjtBQUNBLFdBQU94TCxPQUFPLENBQUNPLE9BQVIsQ0FBZ0IrSyxvQkFBaEIsQ0FBUDtBQUNEOztBQUVERyxFQUFBQSwwQkFBMEIsQ0FBQ0gsb0JBQUQsRUFBMkM7QUFDbkUsV0FBT0Esb0JBQW9CLENBQUNJLGlCQUFyQixHQUF5QzVQLElBQXpDLENBQThDLE1BQU07QUFDekR3UCxNQUFBQSxvQkFBb0IsQ0FBQ0ssVUFBckI7QUFDRCxLQUZNLENBQVA7QUFHRDs7QUFFREMsRUFBQUEseUJBQXlCLENBQUNOLG9CQUFELEVBQTJDO0FBQ2xFLFdBQU9BLG9CQUFvQixDQUFDTyxnQkFBckIsR0FBd0MvUCxJQUF4QyxDQUE2QyxNQUFNO0FBQ3hEd1AsTUFBQUEsb0JBQW9CLENBQUNLLFVBQXJCO0FBQ0QsS0FGTSxDQUFQO0FBR0Q7O0FBbjhCd0Q7OztlQXM4QjVDdk4sbUIiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAZmxvd1xuaW1wb3J0IE1vbmdvQ29sbGVjdGlvbiBmcm9tICcuL01vbmdvQ29sbGVjdGlvbic7XG5pbXBvcnQgTW9uZ29TY2hlbWFDb2xsZWN0aW9uIGZyb20gJy4vTW9uZ29TY2hlbWFDb2xsZWN0aW9uJztcbmltcG9ydCB7IFN0b3JhZ2VBZGFwdGVyIH0gZnJvbSAnLi4vU3RvcmFnZUFkYXB0ZXInO1xuaW1wb3J0IHR5cGUgeyBTY2hlbWFUeXBlLCBRdWVyeVR5cGUsIFN0b3JhZ2VDbGFzcywgUXVlcnlPcHRpb25zIH0gZnJvbSAnLi4vU3RvcmFnZUFkYXB0ZXInO1xuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VVcmwsIGZvcm1hdCBhcyBmb3JtYXRVcmwgfSBmcm9tICcuLi8uLi8uLi92ZW5kb3IvbW9uZ29kYlVybCc7XG5pbXBvcnQge1xuICBwYXJzZU9iamVjdFRvTW9uZ29PYmplY3RGb3JDcmVhdGUsXG4gIG1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdCxcbiAgdHJhbnNmb3JtS2V5LFxuICB0cmFuc2Zvcm1XaGVyZSxcbiAgdHJhbnNmb3JtVXBkYXRlLFxuICB0cmFuc2Zvcm1Qb2ludGVyU3RyaW5nLFxufSBmcm9tICcuL01vbmdvVHJhbnNmb3JtJztcbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuaW1wb3J0IFBhcnNlIGZyb20gJ3BhcnNlL25vZGUnO1xuLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IGRlZmF1bHRzIGZyb20gJy4uLy4uLy4uL2RlZmF1bHRzJztcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi4vLi4vLi4vbG9nZ2VyJztcblxuLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG5jb25zdCBtb25nb2RiID0gcmVxdWlyZSgnbW9uZ29kYicpO1xuY29uc3QgTW9uZ29DbGllbnQgPSBtb25nb2RiLk1vbmdvQ2xpZW50O1xuY29uc3QgUmVhZFByZWZlcmVuY2UgPSBtb25nb2RiLlJlYWRQcmVmZXJlbmNlO1xuXG5jb25zdCBNb25nb1NjaGVtYUNvbGxlY3Rpb25OYW1lID0gJ19TQ0hFTUEnO1xuXG5jb25zdCBzdG9yYWdlQWRhcHRlckFsbENvbGxlY3Rpb25zID0gbW9uZ29BZGFwdGVyID0+IHtcbiAgcmV0dXJuIG1vbmdvQWRhcHRlclxuICAgIC5jb25uZWN0KClcbiAgICAudGhlbigoKSA9PiBtb25nb0FkYXB0ZXIuZGF0YWJhc2UuY29sbGVjdGlvbnMoKSlcbiAgICAudGhlbihjb2xsZWN0aW9ucyA9PiB7XG4gICAgICByZXR1cm4gY29sbGVjdGlvbnMuZmlsdGVyKGNvbGxlY3Rpb24gPT4ge1xuICAgICAgICBpZiAoY29sbGVjdGlvbi5uYW1lc3BhY2UubWF0Y2goL1xcLnN5c3RlbVxcLi8pKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRPRE86IElmIHlvdSBoYXZlIG9uZSBhcHAgd2l0aCBhIGNvbGxlY3Rpb24gcHJlZml4IHRoYXQgaGFwcGVucyB0byBiZSBhIHByZWZpeCBvZiBhbm90aGVyXG4gICAgICAgIC8vIGFwcHMgcHJlZml4LCB0aGlzIHdpbGwgZ28gdmVyeSB2ZXJ5IGJhZGx5LiBXZSBzaG91bGQgZml4IHRoYXQgc29tZWhvdy5cbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb24uY29sbGVjdGlvbk5hbWUuaW5kZXhPZihtb25nb0FkYXB0ZXIuX2NvbGxlY3Rpb25QcmVmaXgpID09IDA7XG4gICAgICB9KTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNvbnZlcnRQYXJzZVNjaGVtYVRvTW9uZ29TY2hlbWEgPSAoeyAuLi5zY2hlbWEgfSkgPT4ge1xuICBkZWxldGUgc2NoZW1hLmZpZWxkcy5fcnBlcm07XG4gIGRlbGV0ZSBzY2hlbWEuZmllbGRzLl93cGVybTtcblxuICBpZiAoc2NoZW1hLmNsYXNzTmFtZSA9PT0gJ19Vc2VyJykge1xuICAgIC8vIExlZ2FjeSBtb25nbyBhZGFwdGVyIGtub3dzIGFib3V0IHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gcGFzc3dvcmQgYW5kIF9oYXNoZWRfcGFzc3dvcmQuXG4gICAgLy8gRnV0dXJlIGRhdGFiYXNlIGFkYXB0ZXJzIHdpbGwgb25seSBrbm93IGFib3V0IF9oYXNoZWRfcGFzc3dvcmQuXG4gICAgLy8gTm90ZTogUGFyc2UgU2VydmVyIHdpbGwgYnJpbmcgYmFjayBwYXNzd29yZCB3aXRoIGluamVjdERlZmF1bHRTY2hlbWEsIHNvIHdlIGRvbid0IG5lZWRcbiAgICAvLyB0byBhZGQgX2hhc2hlZF9wYXNzd29yZCBiYWNrIGV2ZXIuXG4gICAgZGVsZXRlIHNjaGVtYS5maWVsZHMuX2hhc2hlZF9wYXNzd29yZDtcbiAgfVxuXG4gIHJldHVybiBzY2hlbWE7XG59O1xuXG4vLyBSZXR1cm5zIHsgY29kZSwgZXJyb3IgfSBpZiBpbnZhbGlkLCBvciB7IHJlc3VsdCB9LCBhbiBvYmplY3Rcbi8vIHN1aXRhYmxlIGZvciBpbnNlcnRpbmcgaW50byBfU0NIRU1BIGNvbGxlY3Rpb24sIG90aGVyd2lzZS5cbmNvbnN0IG1vbmdvU2NoZW1hRnJvbUZpZWxkc0FuZENsYXNzTmFtZUFuZENMUCA9IChcbiAgZmllbGRzLFxuICBjbGFzc05hbWUsXG4gIGNsYXNzTGV2ZWxQZXJtaXNzaW9ucyxcbiAgaW5kZXhlc1xuKSA9PiB7XG4gIGNvbnN0IG1vbmdvT2JqZWN0ID0ge1xuICAgIF9pZDogY2xhc3NOYW1lLFxuICAgIG9iamVjdElkOiAnc3RyaW5nJyxcbiAgICB1cGRhdGVkQXQ6ICdzdHJpbmcnLFxuICAgIGNyZWF0ZWRBdDogJ3N0cmluZycsXG4gICAgX21ldGFkYXRhOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgZm9yIChjb25zdCBmaWVsZE5hbWUgaW4gZmllbGRzKSB7XG4gICAgY29uc3QgeyB0eXBlLCB0YXJnZXRDbGFzcywgLi4uZmllbGRPcHRpb25zIH0gPSBmaWVsZHNbZmllbGROYW1lXTtcbiAgICBtb25nb09iamVjdFtmaWVsZE5hbWVdID0gTW9uZ29TY2hlbWFDb2xsZWN0aW9uLnBhcnNlRmllbGRUeXBlVG9Nb25nb0ZpZWxkVHlwZSh7XG4gICAgICB0eXBlLFxuICAgICAgdGFyZ2V0Q2xhc3MsXG4gICAgfSk7XG4gICAgaWYgKGZpZWxkT3B0aW9ucyAmJiBPYmplY3Qua2V5cyhmaWVsZE9wdGlvbnMpLmxlbmd0aCA+IDApIHtcbiAgICAgIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YSA9IG1vbmdvT2JqZWN0Ll9tZXRhZGF0YSB8fCB7fTtcbiAgICAgIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YS5maWVsZHNfb3B0aW9ucyA9IG1vbmdvT2JqZWN0Ll9tZXRhZGF0YS5maWVsZHNfb3B0aW9ucyB8fCB7fTtcbiAgICAgIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YS5maWVsZHNfb3B0aW9uc1tmaWVsZE5hbWVdID0gZmllbGRPcHRpb25zO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlb2YgY2xhc3NMZXZlbFBlcm1pc3Npb25zICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YSA9IG1vbmdvT2JqZWN0Ll9tZXRhZGF0YSB8fCB7fTtcbiAgICBpZiAoIWNsYXNzTGV2ZWxQZXJtaXNzaW9ucykge1xuICAgICAgZGVsZXRlIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YS5jbGFzc19wZXJtaXNzaW9ucztcbiAgICB9IGVsc2Uge1xuICAgICAgbW9uZ29PYmplY3QuX21ldGFkYXRhLmNsYXNzX3Blcm1pc3Npb25zID0gY2xhc3NMZXZlbFBlcm1pc3Npb25zO1xuICAgIH1cbiAgfVxuXG4gIGlmIChpbmRleGVzICYmIHR5cGVvZiBpbmRleGVzID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyhpbmRleGVzKS5sZW5ndGggPiAwKSB7XG4gICAgbW9uZ29PYmplY3QuX21ldGFkYXRhID0gbW9uZ29PYmplY3QuX21ldGFkYXRhIHx8IHt9O1xuICAgIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YS5pbmRleGVzID0gaW5kZXhlcztcbiAgfVxuXG4gIGlmICghbW9uZ29PYmplY3QuX21ldGFkYXRhKSB7XG4gICAgLy8gY2xlYW51cCB0aGUgdW51c2VkIF9tZXRhZGF0YVxuICAgIGRlbGV0ZSBtb25nb09iamVjdC5fbWV0YWRhdGE7XG4gIH1cblxuICByZXR1cm4gbW9uZ29PYmplY3Q7XG59O1xuXG5leHBvcnQgY2xhc3MgTW9uZ29TdG9yYWdlQWRhcHRlciBpbXBsZW1lbnRzIFN0b3JhZ2VBZGFwdGVyIHtcbiAgLy8gUHJpdmF0ZVxuICBfdXJpOiBzdHJpbmc7XG4gIF9jb2xsZWN0aW9uUHJlZml4OiBzdHJpbmc7XG4gIF9tb25nb09wdGlvbnM6IE9iamVjdDtcbiAgX29uY2hhbmdlOiBhbnk7XG4gIF9zdHJlYW06IGFueTtcbiAgLy8gUHVibGljXG4gIGNvbm5lY3Rpb25Qcm9taXNlOiA/UHJvbWlzZTxhbnk+O1xuICBkYXRhYmFzZTogYW55O1xuICBjbGllbnQ6IE1vbmdvQ2xpZW50O1xuICBfbWF4VGltZU1TOiA/bnVtYmVyO1xuICBjYW5Tb3J0T25Kb2luVGFibGVzOiBib29sZWFuO1xuICByZXBsaWNhU2V0OiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKHsgdXJpID0gZGVmYXVsdHMuRGVmYXVsdE1vbmdvVVJJLCBjb2xsZWN0aW9uUHJlZml4ID0gJycsIG1vbmdvT3B0aW9ucyA9IHt9IH06IGFueSkge1xuICAgIHRoaXMuX3VyaSA9IHVyaTtcbiAgICB0aGlzLl9jb2xsZWN0aW9uUHJlZml4ID0gY29sbGVjdGlvblByZWZpeDtcbiAgICB0aGlzLl9tb25nb09wdGlvbnMgPSBtb25nb09wdGlvbnM7XG4gICAgdGhpcy5fbW9uZ29PcHRpb25zLnVzZU5ld1VybFBhcnNlciA9IHRydWU7XG4gICAgdGhpcy5fbW9uZ29PcHRpb25zLnVzZVVuaWZpZWRUb3BvbG9neSA9IHRydWU7XG4gICAgdGhpcy5fb25jaGFuZ2UgPSAoKSA9PiB7fTtcblxuICAgIC8vIE1heFRpbWVNUyBpcyBub3QgYSBnbG9iYWwgTW9uZ29EQiBjbGllbnQgb3B0aW9uLCBpdCBpcyBhcHBsaWVkIHBlciBvcGVyYXRpb24uXG4gICAgdGhpcy5fbWF4VGltZU1TID0gbW9uZ29PcHRpb25zLm1heFRpbWVNUztcbiAgICB0aGlzLmNhblNvcnRPbkpvaW5UYWJsZXMgPSB0cnVlO1xuICAgIHRoaXMucmVwbGljYVNldCA9ICEhbW9uZ29PcHRpb25zLnJlcGxpY2FTZXQ7XG4gICAgZGVsZXRlIG1vbmdvT3B0aW9ucy5yZXBsaWNhU2V0O1xuICAgIGRlbGV0ZSBtb25nb09wdGlvbnMubWF4VGltZU1TO1xuICB9XG5cbiAgd2F0Y2goY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9vbmNoYW5nZSA9IGNhbGxiYWNrO1xuICB9XG5cbiAgY29ubmVjdCgpIHtcbiAgICBpZiAodGhpcy5jb25uZWN0aW9uUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdGlvblByb21pc2U7XG4gICAgfVxuXG4gICAgLy8gcGFyc2luZyBhbmQgcmUtZm9ybWF0dGluZyBjYXVzZXMgdGhlIGF1dGggdmFsdWUgKGlmIHRoZXJlKSB0byBnZXQgVVJJXG4gICAgLy8gZW5jb2RlZFxuICAgIGNvbnN0IGVuY29kZWRVcmkgPSBmb3JtYXRVcmwocGFyc2VVcmwodGhpcy5fdXJpKSk7XG5cbiAgICB0aGlzLmNvbm5lY3Rpb25Qcm9taXNlID0gTW9uZ29DbGllbnQuY29ubmVjdChlbmNvZGVkVXJpLCB0aGlzLl9tb25nb09wdGlvbnMpXG4gICAgICAudGhlbihjbGllbnQgPT4ge1xuICAgICAgICAvLyBTdGFydGluZyBtb25nb0RCIDMuMCwgdGhlIE1vbmdvQ2xpZW50LmNvbm5lY3QgZG9uJ3QgcmV0dXJuIGEgREIgYW55bW9yZSBidXQgYSBjbGllbnRcbiAgICAgICAgLy8gRm9ydHVuYXRlbHksIHdlIGNhbiBnZXQgYmFjayB0aGUgb3B0aW9ucyBhbmQgdXNlIHRoZW0gdG8gc2VsZWN0IHRoZSBwcm9wZXIgREIuXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tb25nb2RiL25vZGUtbW9uZ29kYi1uYXRpdmUvYmxvYi8yYzM1ZDc2ZjA4NTc0MjI1YjhkYjAyZDdiZWY2ODcxMjNlNmJiMDE4L2xpYi9tb25nb19jbGllbnQuanMjTDg4NVxuICAgICAgICBjb25zdCBvcHRpb25zID0gY2xpZW50LnMub3B0aW9ucztcbiAgICAgICAgY29uc3QgZGF0YWJhc2UgPSBjbGllbnQuZGIob3B0aW9ucy5kYk5hbWUpO1xuICAgICAgICBpZiAoIWRhdGFiYXNlKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvblByb21pc2U7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGRhdGFiYXNlLm9uKCdlcnJvcicsICgpID0+IHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uUHJvbWlzZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRhdGFiYXNlLm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uUHJvbWlzZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xuICAgICAgICB0aGlzLmRhdGFiYXNlID0gZGF0YWJhc2U7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb25Qcm9taXNlO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdGlvblByb21pc2U7XG4gIH1cblxuICBoYW5kbGVFcnJvcjxUPihlcnJvcjogPyhFcnJvciB8IFBhcnNlLkVycm9yKSk6IFByb21pc2U8VD4ge1xuICAgIGlmIChlcnJvciAmJiBlcnJvci5jb2RlID09PSAxMykge1xuICAgICAgLy8gVW5hdXRob3JpemVkIGVycm9yXG4gICAgICBkZWxldGUgdGhpcy5jbGllbnQ7XG4gICAgICBkZWxldGUgdGhpcy5kYXRhYmFzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb25Qcm9taXNlO1xuICAgICAgbG9nZ2VyLmVycm9yKCdSZWNlaXZlZCB1bmF1dGhvcml6ZWQgZXJyb3InLCB7IGVycm9yOiBlcnJvciB9KTtcbiAgICB9XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBoYW5kbGVTaHV0ZG93bigpIHtcbiAgICBpZiAoIXRoaXMuY2xpZW50KSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNsaWVudC5jbG9zZShmYWxzZSk7XG4gIH1cblxuICBfYWRhcHRpdmVDb2xsZWN0aW9uKG5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmNvbm5lY3QoKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5kYXRhYmFzZS5jb2xsZWN0aW9uKHRoaXMuX2NvbGxlY3Rpb25QcmVmaXggKyBuYW1lKSlcbiAgICAgIC50aGVuKHJhd0NvbGxlY3Rpb24gPT4gbmV3IE1vbmdvQ29sbGVjdGlvbihyYXdDb2xsZWN0aW9uKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIF9zY2hlbWFDb2xsZWN0aW9uKCk6IFByb21pc2U8TW9uZ29TY2hlbWFDb2xsZWN0aW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdCgpXG4gICAgICAudGhlbigoKSA9PiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oTW9uZ29TY2hlbWFDb2xsZWN0aW9uTmFtZSkpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdHJlYW0gJiYgdGhpcy5yZXBsaWNhU2V0KSB7XG4gICAgICAgICAgdGhpcy5fc3RyZWFtID0gY29sbGVjdGlvbi5fbW9uZ29Db2xsZWN0aW9uLndhdGNoKCk7XG4gICAgICAgICAgdGhpcy5fc3RyZWFtLm9uKCdjaGFuZ2UnLCAoKSA9PiB0aGlzLl9vbmNoYW5nZSgpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IE1vbmdvU2NoZW1hQ29sbGVjdGlvbihjb2xsZWN0aW9uKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgY2xhc3NFeGlzdHMobmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdCgpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFiYXNlLmxpc3RDb2xsZWN0aW9ucyh7IG5hbWU6IHRoaXMuX2NvbGxlY3Rpb25QcmVmaXggKyBuYW1lIH0pLnRvQXJyYXkoKTtcbiAgICAgIH0pXG4gICAgICAudGhlbihjb2xsZWN0aW9ucyA9PiB7XG4gICAgICAgIHJldHVybiBjb2xsZWN0aW9ucy5sZW5ndGggPiAwO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIHNldENsYXNzTGV2ZWxQZXJtaXNzaW9ucyhjbGFzc05hbWU6IHN0cmluZywgQ0xQczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuX3NjaGVtYUNvbGxlY3Rpb24oKVxuICAgICAgLnRoZW4oc2NoZW1hQ29sbGVjdGlvbiA9PlxuICAgICAgICBzY2hlbWFDb2xsZWN0aW9uLnVwZGF0ZVNjaGVtYShjbGFzc05hbWUsIHtcbiAgICAgICAgICAkc2V0OiB7ICdfbWV0YWRhdGEuY2xhc3NfcGVybWlzc2lvbnMnOiBDTFBzIH0sXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBzZXRJbmRleGVzV2l0aFNjaGVtYUZvcm1hdChcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBzdWJtaXR0ZWRJbmRleGVzOiBhbnksXG4gICAgZXhpc3RpbmdJbmRleGVzOiBhbnkgPSB7fSxcbiAgICBmaWVsZHM6IGFueVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoc3VibWl0dGVkSW5kZXhlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuICAgIGlmIChPYmplY3Qua2V5cyhleGlzdGluZ0luZGV4ZXMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZXhpc3RpbmdJbmRleGVzID0geyBfaWRfOiB7IF9pZDogMSB9IH07XG4gICAgfVxuICAgIGNvbnN0IGRlbGV0ZVByb21pc2VzID0gW107XG4gICAgY29uc3QgaW5zZXJ0ZWRJbmRleGVzID0gW107XG4gICAgT2JqZWN0LmtleXMoc3VibWl0dGVkSW5kZXhlcykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbnN0IGZpZWxkID0gc3VibWl0dGVkSW5kZXhlc1tuYW1lXTtcbiAgICAgIGlmIChleGlzdGluZ0luZGV4ZXNbbmFtZV0gJiYgZmllbGQuX19vcCAhPT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksIGBJbmRleCAke25hbWV9IGV4aXN0cywgY2Fubm90IHVwZGF0ZS5gKTtcbiAgICAgIH1cbiAgICAgIGlmICghZXhpc3RpbmdJbmRleGVzW25hbWVdICYmIGZpZWxkLl9fb3AgPT09ICdEZWxldGUnKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLFxuICAgICAgICAgIGBJbmRleCAke25hbWV9IGRvZXMgbm90IGV4aXN0LCBjYW5ub3QgZGVsZXRlLmBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChmaWVsZC5fX29wID09PSAnRGVsZXRlJykge1xuICAgICAgICBjb25zdCBwcm9taXNlID0gdGhpcy5kcm9wSW5kZXgoY2xhc3NOYW1lLCBuYW1lKTtcbiAgICAgICAgZGVsZXRlUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgZGVsZXRlIGV4aXN0aW5nSW5kZXhlc1tuYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGZpZWxkKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChcbiAgICAgICAgICAgICAgZmllbGRzLFxuICAgICAgICAgICAgICBrZXkuaW5kZXhPZignX3BfJykgPT09IDAgPyBrZXkucmVwbGFjZSgnX3BfJywgJycpIDoga2V5XG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksXG4gICAgICAgICAgICAgIGBGaWVsZCAke2tleX0gZG9lcyBub3QgZXhpc3QsIGNhbm5vdCBhZGQgaW5kZXguYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBleGlzdGluZ0luZGV4ZXNbbmFtZV0gPSBmaWVsZDtcbiAgICAgICAgaW5zZXJ0ZWRJbmRleGVzLnB1c2goe1xuICAgICAgICAgIGtleTogZmllbGQsXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgbGV0IGluc2VydFByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICBpZiAoaW5zZXJ0ZWRJbmRleGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGluc2VydFByb21pc2UgPSB0aGlzLmNyZWF0ZUluZGV4ZXMoY2xhc3NOYW1lLCBpbnNlcnRlZEluZGV4ZXMpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoZGVsZXRlUHJvbWlzZXMpXG4gICAgICAudGhlbigoKSA9PiBpbnNlcnRQcm9taXNlKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpKVxuICAgICAgLnRoZW4oc2NoZW1hQ29sbGVjdGlvbiA9PlxuICAgICAgICBzY2hlbWFDb2xsZWN0aW9uLnVwZGF0ZVNjaGVtYShjbGFzc05hbWUsIHtcbiAgICAgICAgICAkc2V0OiB7ICdfbWV0YWRhdGEuaW5kZXhlcyc6IGV4aXN0aW5nSW5kZXhlcyB9LFxuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgc2V0SW5kZXhlc0Zyb21Nb25nbyhjbGFzc05hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmdldEluZGV4ZXMoY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oaW5kZXhlcyA9PiB7XG4gICAgICAgIGluZGV4ZXMgPSBpbmRleGVzLnJlZHVjZSgob2JqLCBpbmRleCkgPT4ge1xuICAgICAgICAgIGlmIChpbmRleC5rZXkuX2Z0cykge1xuICAgICAgICAgICAgZGVsZXRlIGluZGV4LmtleS5fZnRzO1xuICAgICAgICAgICAgZGVsZXRlIGluZGV4LmtleS5fZnRzeDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmllbGQgaW4gaW5kZXgud2VpZ2h0cykge1xuICAgICAgICAgICAgICBpbmRleC5rZXlbZmllbGRdID0gJ3RleHQnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBvYmpbaW5kZXgubmFtZV0gPSBpbmRleC5rZXk7XG4gICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfSwge30pO1xuICAgICAgICByZXR1cm4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpLnRoZW4oc2NoZW1hQ29sbGVjdGlvbiA9PlxuICAgICAgICAgIHNjaGVtYUNvbGxlY3Rpb24udXBkYXRlU2NoZW1hKGNsYXNzTmFtZSwge1xuICAgICAgICAgICAgJHNldDogeyAnX21ldGFkYXRhLmluZGV4ZXMnOiBpbmRleGVzIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAgIC8vIElnbm9yZSBpZiBjb2xsZWN0aW9uIG5vdCBmb3VuZFxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUNsYXNzKGNsYXNzTmFtZTogc3RyaW5nLCBzY2hlbWE6IFNjaGVtYVR5cGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgbW9uZ29PYmplY3QgPSBtb25nb1NjaGVtYUZyb21GaWVsZHNBbmRDbGFzc05hbWVBbmRDTFAoXG4gICAgICBzY2hlbWEuZmllbGRzLFxuICAgICAgY2xhc3NOYW1lLFxuICAgICAgc2NoZW1hLmNsYXNzTGV2ZWxQZXJtaXNzaW9ucyxcbiAgICAgIHNjaGVtYS5pbmRleGVzXG4gICAgKTtcbiAgICBtb25nb09iamVjdC5faWQgPSBjbGFzc05hbWU7XG4gICAgcmV0dXJuIHRoaXMuc2V0SW5kZXhlc1dpdGhTY2hlbWFGb3JtYXQoY2xhc3NOYW1lLCBzY2hlbWEuaW5kZXhlcywge30sIHNjaGVtYS5maWVsZHMpXG4gICAgICAudGhlbigoKSA9PiB0aGlzLl9zY2hlbWFDb2xsZWN0aW9uKCkpXG4gICAgICAudGhlbihzY2hlbWFDb2xsZWN0aW9uID0+IHNjaGVtYUNvbGxlY3Rpb24uaW5zZXJ0U2NoZW1hKG1vbmdvT2JqZWN0KSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIGFkZEZpZWxkSWZOb3RFeGlzdHMoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nLCB0eXBlOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpXG4gICAgICAudGhlbihzY2hlbWFDb2xsZWN0aW9uID0+IHNjaGVtYUNvbGxlY3Rpb24uYWRkRmllbGRJZk5vdEV4aXN0cyhjbGFzc05hbWUsIGZpZWxkTmFtZSwgdHlwZSkpXG4gICAgICAudGhlbigoKSA9PiB0aGlzLmNyZWF0ZUluZGV4ZXNJZk5lZWRlZChjbGFzc05hbWUsIGZpZWxkTmFtZSwgdHlwZSkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBEcm9wcyBhIGNvbGxlY3Rpb24uIFJlc29sdmVzIHdpdGggdHJ1ZSBpZiBpdCB3YXMgYSBQYXJzZSBTY2hlbWEgKGVnLiBfVXNlciwgQ3VzdG9tLCBldGMuKVxuICAvLyBhbmQgcmVzb2x2ZXMgd2l0aCBmYWxzZSBpZiBpdCB3YXNuJ3QgKGVnLiBhIGpvaW4gdGFibGUpLiBSZWplY3RzIGlmIGRlbGV0aW9uIHdhcyBpbXBvc3NpYmxlLlxuICBkZWxldGVDbGFzcyhjbGFzc05hbWU6IHN0cmluZykge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uZHJvcCgpKVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIC8vICducyBub3QgZm91bmQnIG1lYW5zIGNvbGxlY3Rpb24gd2FzIGFscmVhZHkgZ29uZS4gSWdub3JlIGRlbGV0aW9uIGF0dGVtcHQuXG4gICAgICAgICAgaWYgKGVycm9yLm1lc3NhZ2UgPT0gJ25zIG5vdCBmb3VuZCcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH0pXG4gICAgICAgIC8vIFdlJ3ZlIGRyb3BwZWQgdGhlIGNvbGxlY3Rpb24sIG5vdyByZW1vdmUgdGhlIF9TQ0hFTUEgZG9jdW1lbnRcbiAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpKVxuICAgICAgICAudGhlbihzY2hlbWFDb2xsZWN0aW9uID0+IHNjaGVtYUNvbGxlY3Rpb24uZmluZEFuZERlbGV0ZVNjaGVtYShjbGFzc05hbWUpKVxuICAgICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSlcbiAgICApO1xuICB9XG5cbiAgZGVsZXRlQWxsQ2xhc3NlcyhmYXN0OiBib29sZWFuKSB7XG4gICAgcmV0dXJuIHN0b3JhZ2VBZGFwdGVyQWxsQ29sbGVjdGlvbnModGhpcykudGhlbihjb2xsZWN0aW9ucyA9PlxuICAgICAgUHJvbWlzZS5hbGwoXG4gICAgICAgIGNvbGxlY3Rpb25zLm1hcChjb2xsZWN0aW9uID0+IChmYXN0ID8gY29sbGVjdGlvbi5kZWxldGVNYW55KHt9KSA6IGNvbGxlY3Rpb24uZHJvcCgpKSlcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgLy8gUmVtb3ZlIHRoZSBjb2x1bW4gYW5kIGFsbCB0aGUgZGF0YS4gRm9yIFJlbGF0aW9ucywgdGhlIF9Kb2luIGNvbGxlY3Rpb24gaXMgaGFuZGxlZFxuICAvLyBzcGVjaWFsbHksIHRoaXMgZnVuY3Rpb24gZG9lcyBub3QgZGVsZXRlIF9Kb2luIGNvbHVtbnMuIEl0IHNob3VsZCwgaG93ZXZlciwgaW5kaWNhdGVcbiAgLy8gdGhhdCB0aGUgcmVsYXRpb24gZmllbGRzIGRvZXMgbm90IGV4aXN0IGFueW1vcmUuIEluIG1vbmdvLCB0aGlzIG1lYW5zIHJlbW92aW5nIGl0IGZyb21cbiAgLy8gdGhlIF9TQ0hFTUEgY29sbGVjdGlvbi4gIFRoZXJlIHNob3VsZCBiZSBubyBhY3R1YWwgZGF0YSBpbiB0aGUgY29sbGVjdGlvbiB1bmRlciB0aGUgc2FtZSBuYW1lXG4gIC8vIGFzIHRoZSByZWxhdGlvbiBjb2x1bW4sIHNvIGl0J3MgZmluZSB0byBhdHRlbXB0IHRvIGRlbGV0ZSBpdC4gSWYgdGhlIGZpZWxkcyBsaXN0ZWQgdG8gYmVcbiAgLy8gZGVsZXRlZCBkbyBub3QgZXhpc3QsIHRoaXMgZnVuY3Rpb24gc2hvdWxkIHJldHVybiBzdWNjZXNzZnVsbHkgYW55d2F5cy4gQ2hlY2tpbmcgZm9yXG4gIC8vIGF0dGVtcHRzIHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgZmllbGRzIGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiBQYXJzZSBTZXJ2ZXIuXG5cbiAgLy8gUG9pbnRlciBmaWVsZCBuYW1lcyBhcmUgcGFzc2VkIGZvciBsZWdhY3kgcmVhc29uczogdGhlIG9yaWdpbmFsIG1vbmdvXG4gIC8vIGZvcm1hdCBzdG9yZWQgcG9pbnRlciBmaWVsZCBuYW1lcyBkaWZmZXJlbnRseSBpbiB0aGUgZGF0YWJhc2UsIGFuZCB0aGVyZWZvcmVcbiAgLy8gbmVlZGVkIHRvIGtub3cgdGhlIHR5cGUgb2YgdGhlIGZpZWxkIGJlZm9yZSBpdCBjb3VsZCBkZWxldGUgaXQuIEZ1dHVyZSBkYXRhYmFzZVxuICAvLyBhZGFwdGVycyBzaG91bGQgaWdub3JlIHRoZSBwb2ludGVyRmllbGROYW1lcyBhcmd1bWVudC4gQWxsIHRoZSBmaWVsZCBuYW1lcyBhcmUgaW5cbiAgLy8gZmllbGROYW1lcywgdGhleSBzaG93IHVwIGFkZGl0aW9uYWxseSBpbiB0aGUgcG9pbnRlckZpZWxkTmFtZXMgZGF0YWJhc2UgZm9yIHVzZVxuICAvLyBieSB0aGUgbW9uZ28gYWRhcHRlciwgd2hpY2ggZGVhbHMgd2l0aCB0aGUgbGVnYWN5IG1vbmdvIGZvcm1hdC5cblxuICAvLyBUaGlzIGZ1bmN0aW9uIGlzIG5vdCBvYmxpZ2F0ZWQgdG8gZGVsZXRlIGZpZWxkcyBhdG9taWNhbGx5LiBJdCBpcyBnaXZlbiB0aGUgZmllbGRcbiAgLy8gbmFtZXMgaW4gYSBsaXN0IHNvIHRoYXQgZGF0YWJhc2VzIHRoYXQgYXJlIGNhcGFibGUgb2YgZGVsZXRpbmcgZmllbGRzIGF0b21pY2FsbHlcbiAgLy8gbWF5IGRvIHNvLlxuXG4gIC8vIFJldHVybnMgYSBQcm9taXNlLlxuICBkZWxldGVGaWVsZHMoY2xhc3NOYW1lOiBzdHJpbmcsIHNjaGVtYTogU2NoZW1hVHlwZSwgZmllbGROYW1lczogc3RyaW5nW10pIHtcbiAgICBjb25zdCBtb25nb0Zvcm1hdE5hbWVzID0gZmllbGROYW1lcy5tYXAoZmllbGROYW1lID0+IHtcbiAgICAgIGlmIChzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0udHlwZSA9PT0gJ1BvaW50ZXInKSB7XG4gICAgICAgIHJldHVybiBgX3BfJHtmaWVsZE5hbWV9YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmaWVsZE5hbWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgY29sbGVjdGlvblVwZGF0ZSA9IHsgJHVuc2V0OiB7fSB9O1xuICAgIG1vbmdvRm9ybWF0TmFtZXMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbGxlY3Rpb25VcGRhdGVbJyR1bnNldCddW25hbWVdID0gbnVsbDtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbGxlY3Rpb25GaWx0ZXIgPSB7ICRvcjogW10gfTtcbiAgICBtb25nb0Zvcm1hdE5hbWVzLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb2xsZWN0aW9uRmlsdGVyWyckb3InXS5wdXNoKHsgW25hbWVdOiB7ICRleGlzdHM6IHRydWUgfSB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHNjaGVtYVVwZGF0ZSA9IHsgJHVuc2V0OiB7fSB9O1xuICAgIGZpZWxkTmFtZXMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIHNjaGVtYVVwZGF0ZVsnJHVuc2V0J11bbmFtZV0gPSBudWxsO1xuICAgICAgc2NoZW1hVXBkYXRlWyckdW5zZXQnXVtgX21ldGFkYXRhLmZpZWxkc19vcHRpb25zLiR7bmFtZX1gXSA9IG51bGw7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi51cGRhdGVNYW55KGNvbGxlY3Rpb25GaWx0ZXIsIGNvbGxlY3Rpb25VcGRhdGUpKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpKVxuICAgICAgLnRoZW4oc2NoZW1hQ29sbGVjdGlvbiA9PiBzY2hlbWFDb2xsZWN0aW9uLnVwZGF0ZVNjaGVtYShjbGFzc05hbWUsIHNjaGVtYVVwZGF0ZSkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBSZXR1cm4gYSBwcm9taXNlIGZvciBhbGwgc2NoZW1hcyBrbm93biB0byB0aGlzIGFkYXB0ZXIsIGluIFBhcnNlIGZvcm1hdC4gSW4gY2FzZSB0aGVcbiAgLy8gc2NoZW1hcyBjYW5ub3QgYmUgcmV0cmlldmVkLCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMuIFJlcXVpcmVtZW50cyBmb3IgdGhlXG4gIC8vIHJlamVjdGlvbiByZWFzb24gYXJlIFRCRC5cbiAgZ2V0QWxsQ2xhc3NlcygpOiBQcm9taXNlPFN0b3JhZ2VDbGFzc1tdPiB7XG4gICAgcmV0dXJuIHRoaXMuX3NjaGVtYUNvbGxlY3Rpb24oKVxuICAgICAgLnRoZW4oc2NoZW1hc0NvbGxlY3Rpb24gPT4gc2NoZW1hc0NvbGxlY3Rpb24uX2ZldGNoQWxsU2NoZW1hc0Zyb21fU0NIRU1BKCkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBSZXR1cm4gYSBwcm9taXNlIGZvciB0aGUgc2NoZW1hIHdpdGggdGhlIGdpdmVuIG5hbWUsIGluIFBhcnNlIGZvcm1hdC4gSWZcbiAgLy8gdGhpcyBhZGFwdGVyIGRvZXNuJ3Qga25vdyBhYm91dCB0aGUgc2NoZW1hLCByZXR1cm4gYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aXRoXG4gIC8vIHVuZGVmaW5lZCBhcyB0aGUgcmVhc29uLlxuICBnZXRDbGFzcyhjbGFzc05hbWU6IHN0cmluZyk6IFByb21pc2U8U3RvcmFnZUNsYXNzPiB7XG4gICAgcmV0dXJuIHRoaXMuX3NjaGVtYUNvbGxlY3Rpb24oKVxuICAgICAgLnRoZW4oc2NoZW1hc0NvbGxlY3Rpb24gPT4gc2NoZW1hc0NvbGxlY3Rpb24uX2ZldGNoT25lU2NoZW1hRnJvbV9TQ0hFTUEoY2xhc3NOYW1lKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIFRPRE86IEFzIHlldCBub3QgcGFydGljdWxhcmx5IHdlbGwgc3BlY2lmaWVkLiBDcmVhdGVzIGFuIG9iamVjdC4gTWF5YmUgc2hvdWxkbid0IGV2ZW4gbmVlZCB0aGUgc2NoZW1hLFxuICAvLyBhbmQgc2hvdWxkIGluZmVyIGZyb20gdGhlIHR5cGUuIE9yIG1heWJlIGRvZXMgbmVlZCB0aGUgc2NoZW1hIGZvciB2YWxpZGF0aW9ucy4gT3IgbWF5YmUgbmVlZHNcbiAgLy8gdGhlIHNjaGVtYSBvbmx5IGZvciB0aGUgbGVnYWN5IG1vbmdvIGZvcm1hdC4gV2UnbGwgZmlndXJlIHRoYXQgb3V0IGxhdGVyLlxuICBjcmVhdGVPYmplY3QoY2xhc3NOYW1lOiBzdHJpbmcsIHNjaGVtYTogU2NoZW1hVHlwZSwgb2JqZWN0OiBhbnksIHRyYW5zYWN0aW9uYWxTZXNzaW9uOiA/YW55KSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIGNvbnN0IG1vbmdvT2JqZWN0ID0gcGFyc2VPYmplY3RUb01vbmdvT2JqZWN0Rm9yQ3JlYXRlKGNsYXNzTmFtZSwgb2JqZWN0LCBzY2hlbWEpO1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiBjb2xsZWN0aW9uLmluc2VydE9uZShtb25nb09iamVjdCwgdHJhbnNhY3Rpb25hbFNlc3Npb24pKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT09IDExMDAwKSB7XG4gICAgICAgICAgLy8gRHVwbGljYXRlIHZhbHVlXG4gICAgICAgICAgY29uc3QgZXJyID0gbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuRFVQTElDQVRFX1ZBTFVFLFxuICAgICAgICAgICAgJ0EgZHVwbGljYXRlIHZhbHVlIGZvciBhIGZpZWxkIHdpdGggdW5pcXVlIHZhbHVlcyB3YXMgcHJvdmlkZWQnXG4gICAgICAgICAgKTtcbiAgICAgICAgICBlcnIudW5kZXJseWluZ0Vycm9yID0gZXJyb3I7XG4gICAgICAgICAgaWYgKGVycm9yLm1lc3NhZ2UpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBlcnJvci5tZXNzYWdlLm1hdGNoKC9pbmRleDpbXFxzYS16QS1aMC05X1xcLVxcLl0rXFwkPyhbYS16QS1aXy1dKylfMS8pO1xuICAgICAgICAgICAgaWYgKG1hdGNoZXMgJiYgQXJyYXkuaXNBcnJheShtYXRjaGVzKSkge1xuICAgICAgICAgICAgICBlcnIudXNlckluZm8gPSB7IGR1cGxpY2F0ZWRfZmllbGQ6IG1hdGNoZXNbMV0gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIFJlbW92ZSBhbGwgb2JqZWN0cyB0aGF0IG1hdGNoIHRoZSBnaXZlbiBQYXJzZSBRdWVyeS5cbiAgLy8gSWYgbm8gb2JqZWN0cyBtYXRjaCwgcmVqZWN0IHdpdGggT0JKRUNUX05PVF9GT1VORC4gSWYgb2JqZWN0cyBhcmUgZm91bmQgYW5kIGRlbGV0ZWQsIHJlc29sdmUgd2l0aCB1bmRlZmluZWQuXG4gIC8vIElmIHRoZXJlIGlzIHNvbWUgb3RoZXIgZXJyb3IsIHJlamVjdCB3aXRoIElOVEVSTkFMX1NFUlZFUl9FUlJPUi5cbiAgZGVsZXRlT2JqZWN0c0J5UXVlcnkoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIHF1ZXJ5OiBRdWVyeVR5cGUsXG4gICAgdHJhbnNhY3Rpb25hbFNlc3Npb246ID9hbnlcbiAgKSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiB7XG4gICAgICAgIGNvbnN0IG1vbmdvV2hlcmUgPSB0cmFuc2Zvcm1XaGVyZShjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWEpO1xuICAgICAgICByZXR1cm4gY29sbGVjdGlvbi5kZWxldGVNYW55KG1vbmdvV2hlcmUsIHRyYW5zYWN0aW9uYWxTZXNzaW9uKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSlcbiAgICAgIC50aGVuKFxuICAgICAgICAoeyByZXN1bHQgfSkgPT4ge1xuICAgICAgICAgIGlmIChyZXN1bHQubiA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsICdPYmplY3Qgbm90IGZvdW5kLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH0sXG4gICAgICAgICgpID0+IHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5URVJOQUxfU0VSVkVSX0VSUk9SLCAnRGF0YWJhc2UgYWRhcHRlciBlcnJvcicpO1xuICAgICAgICB9XG4gICAgICApO1xuICB9XG5cbiAgLy8gQXBwbHkgdGhlIHVwZGF0ZSB0byBhbGwgb2JqZWN0cyB0aGF0IG1hdGNoIHRoZSBnaXZlbiBQYXJzZSBRdWVyeS5cbiAgdXBkYXRlT2JqZWN0c0J5UXVlcnkoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIHF1ZXJ5OiBRdWVyeVR5cGUsXG4gICAgdXBkYXRlOiBhbnksXG4gICAgdHJhbnNhY3Rpb25hbFNlc3Npb246ID9hbnlcbiAgKSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIGNvbnN0IG1vbmdvVXBkYXRlID0gdHJhbnNmb3JtVXBkYXRlKGNsYXNzTmFtZSwgdXBkYXRlLCBzY2hlbWEpO1xuICAgIGNvbnN0IG1vbmdvV2hlcmUgPSB0cmFuc2Zvcm1XaGVyZShjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWEpO1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiBjb2xsZWN0aW9uLnVwZGF0ZU1hbnkobW9uZ29XaGVyZSwgbW9uZ29VcGRhdGUsIHRyYW5zYWN0aW9uYWxTZXNzaW9uKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIEF0b21pY2FsbHkgZmluZHMgYW5kIHVwZGF0ZXMgYW4gb2JqZWN0IGJhc2VkIG9uIHF1ZXJ5LlxuICAvLyBSZXR1cm4gdmFsdWUgbm90IGN1cnJlbnRseSB3ZWxsIHNwZWNpZmllZC5cbiAgZmluZE9uZUFuZFVwZGF0ZShcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBzY2hlbWE6IFNjaGVtYVR5cGUsXG4gICAgcXVlcnk6IFF1ZXJ5VHlwZSxcbiAgICB1cGRhdGU6IGFueSxcbiAgICB0cmFuc2FjdGlvbmFsU2Vzc2lvbjogP2FueVxuICApIHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgbW9uZ29VcGRhdGUgPSB0cmFuc2Zvcm1VcGRhdGUoY2xhc3NOYW1lLCB1cGRhdGUsIHNjaGVtYSk7XG4gICAgY29uc3QgbW9uZ29XaGVyZSA9IHRyYW5zZm9ybVdoZXJlKGNsYXNzTmFtZSwgcXVlcnksIHNjaGVtYSk7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+XG4gICAgICAgIGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi5maW5kT25lQW5kVXBkYXRlKG1vbmdvV2hlcmUsIG1vbmdvVXBkYXRlLCB7XG4gICAgICAgICAgcmV0dXJuT3JpZ2luYWw6IGZhbHNlLFxuICAgICAgICAgIHNlc3Npb246IHRyYW5zYWN0aW9uYWxTZXNzaW9uIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC50aGVuKHJlc3VsdCA9PiBtb25nb09iamVjdFRvUGFyc2VPYmplY3QoY2xhc3NOYW1lLCByZXN1bHQudmFsdWUsIHNjaGVtYSkpXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBpZiAoZXJyb3IuY29kZSA9PT0gMTEwMDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5EVVBMSUNBVEVfVkFMVUUsXG4gICAgICAgICAgICAnQSBkdXBsaWNhdGUgdmFsdWUgZm9yIGEgZmllbGQgd2l0aCB1bmlxdWUgdmFsdWVzIHdhcyBwcm92aWRlZCdcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIEhvcGVmdWxseSB3ZSBjYW4gZ2V0IHJpZCBvZiB0aGlzLiBJdCdzIG9ubHkgdXNlZCBmb3IgY29uZmlnIGFuZCBob29rcy5cbiAgdXBzZXJ0T25lT2JqZWN0KFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogU2NoZW1hVHlwZSxcbiAgICBxdWVyeTogUXVlcnlUeXBlLFxuICAgIHVwZGF0ZTogYW55LFxuICAgIHRyYW5zYWN0aW9uYWxTZXNzaW9uOiA/YW55XG4gICkge1xuICAgIHNjaGVtYSA9IGNvbnZlcnRQYXJzZVNjaGVtYVRvTW9uZ29TY2hlbWEoc2NoZW1hKTtcbiAgICBjb25zdCBtb25nb1VwZGF0ZSA9IHRyYW5zZm9ybVVwZGF0ZShjbGFzc05hbWUsIHVwZGF0ZSwgc2NoZW1hKTtcbiAgICBjb25zdCBtb25nb1doZXJlID0gdHJhbnNmb3JtV2hlcmUoY2xhc3NOYW1lLCBxdWVyeSwgc2NoZW1hKTtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi51cHNlcnRPbmUobW9uZ29XaGVyZSwgbW9uZ29VcGRhdGUsIHRyYW5zYWN0aW9uYWxTZXNzaW9uKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIEV4ZWN1dGVzIGEgZmluZC4gQWNjZXB0czogY2xhc3NOYW1lLCBxdWVyeSBpbiBQYXJzZSBmb3JtYXQsIGFuZCB7IHNraXAsIGxpbWl0LCBzb3J0IH0uXG4gIGZpbmQoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIHF1ZXJ5OiBRdWVyeVR5cGUsXG4gICAgeyBza2lwLCBsaW1pdCwgc29ydCwga2V5cywgcmVhZFByZWZlcmVuY2UsIGhpbnQsIGNhc2VJbnNlbnNpdGl2ZSwgZXhwbGFpbiB9OiBRdWVyeU9wdGlvbnNcbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgbW9uZ29XaGVyZSA9IHRyYW5zZm9ybVdoZXJlKGNsYXNzTmFtZSwgcXVlcnksIHNjaGVtYSk7XG4gICAgY29uc3QgbW9uZ29Tb3J0ID0gXy5tYXBLZXlzKHNvcnQsICh2YWx1ZSwgZmllbGROYW1lKSA9PlxuICAgICAgdHJhbnNmb3JtS2V5KGNsYXNzTmFtZSwgZmllbGROYW1lLCBzY2hlbWEpXG4gICAgKTtcbiAgICBjb25zdCBtb25nb0tleXMgPSBfLnJlZHVjZShcbiAgICAgIGtleXMsXG4gICAgICAobWVtbywga2V5KSA9PiB7XG4gICAgICAgIGlmIChrZXkgPT09ICdBQ0wnKSB7XG4gICAgICAgICAgbWVtb1snX3JwZXJtJ10gPSAxO1xuICAgICAgICAgIG1lbW9bJ193cGVybSddID0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtZW1vW3RyYW5zZm9ybUtleShjbGFzc05hbWUsIGtleSwgc2NoZW1hKV0gPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfSxcbiAgICAgIHt9XG4gICAgKTtcblxuICAgIC8vIElmIHdlIGFyZW4ndCByZXF1ZXN0aW5nIHRoZSBgX2lkYCBmaWVsZCwgd2UgbmVlZCB0byBleHBsaWNpdGx5IG9wdCBvdXRcbiAgICAvLyBvZiBpdC4gRG9pbmcgc28gaW4gcGFyc2Utc2VydmVyIGlzIHVudXN1YWwsIGJ1dCBpdCBjYW4gYWxsb3cgdXMgdG9cbiAgICAvLyBvcHRpbWl6ZSBzb21lIHF1ZXJpZXMgd2l0aCBjb3ZlcmluZyBpbmRleGVzLlxuICAgIGlmIChrZXlzICYmICFtb25nb0tleXMuX2lkKSB7XG4gICAgICBtb25nb0tleXMuX2lkID0gMDtcbiAgICB9XG5cbiAgICByZWFkUHJlZmVyZW5jZSA9IHRoaXMuX3BhcnNlUmVhZFByZWZlcmVuY2UocmVhZFByZWZlcmVuY2UpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZVRleHRJbmRleGVzSWZOZWVkZWQoY2xhc3NOYW1lLCBxdWVyeSwgc2NoZW1hKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSkpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+XG4gICAgICAgIGNvbGxlY3Rpb24uZmluZChtb25nb1doZXJlLCB7XG4gICAgICAgICAgc2tpcCxcbiAgICAgICAgICBsaW1pdCxcbiAgICAgICAgICBzb3J0OiBtb25nb1NvcnQsXG4gICAgICAgICAga2V5czogbW9uZ29LZXlzLFxuICAgICAgICAgIG1heFRpbWVNUzogdGhpcy5fbWF4VGltZU1TLFxuICAgICAgICAgIHJlYWRQcmVmZXJlbmNlLFxuICAgICAgICAgIGhpbnQsXG4gICAgICAgICAgY2FzZUluc2Vuc2l0aXZlLFxuICAgICAgICAgIGV4cGxhaW4sXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgICAudGhlbihvYmplY3RzID0+IHtcbiAgICAgICAgaWYgKGV4cGxhaW4pIHtcbiAgICAgICAgICByZXR1cm4gb2JqZWN0cztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqZWN0cy5tYXAob2JqZWN0ID0+IG1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdChjbGFzc05hbWUsIG9iamVjdCwgc2NoZW1hKSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgZW5zdXJlSW5kZXgoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIGZpZWxkTmFtZXM6IHN0cmluZ1tdLFxuICAgIGluZGV4TmFtZTogP3N0cmluZyxcbiAgICBjYXNlSW5zZW5zaXRpdmU6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICBvcHRpb25zPzogT2JqZWN0ID0ge31cbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgaW5kZXhDcmVhdGlvblJlcXVlc3QgPSB7fTtcbiAgICBjb25zdCBtb25nb0ZpZWxkTmFtZXMgPSBmaWVsZE5hbWVzLm1hcChmaWVsZE5hbWUgPT4gdHJhbnNmb3JtS2V5KGNsYXNzTmFtZSwgZmllbGROYW1lLCBzY2hlbWEpKTtcbiAgICBtb25nb0ZpZWxkTmFtZXMuZm9yRWFjaChmaWVsZE5hbWUgPT4ge1xuICAgICAgaW5kZXhDcmVhdGlvblJlcXVlc3RbZmllbGROYW1lXSA9IG9wdGlvbnMuaW5kZXhUeXBlICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmluZGV4VHlwZSA6IDE7XG4gICAgfSk7XG5cbiAgICBjb25zdCBkZWZhdWx0T3B0aW9uczogT2JqZWN0ID0geyBiYWNrZ3JvdW5kOiB0cnVlLCBzcGFyc2U6IHRydWUgfTtcbiAgICBjb25zdCBpbmRleE5hbWVPcHRpb25zOiBPYmplY3QgPSBpbmRleE5hbWUgPyB7IG5hbWU6IGluZGV4TmFtZSB9IDoge307XG4gICAgY29uc3QgdHRsT3B0aW9uczogT2JqZWN0ID0gb3B0aW9ucy50dGwgIT09IHVuZGVmaW5lZCA/IHsgZXhwaXJlQWZ0ZXJTZWNvbmRzOiBvcHRpb25zLnR0bCB9IDoge307XG4gICAgY29uc3QgY2FzZUluc2Vuc2l0aXZlT3B0aW9uczogT2JqZWN0ID0gY2FzZUluc2Vuc2l0aXZlXG4gICAgICA/IHsgY29sbGF0aW9uOiBNb25nb0NvbGxlY3Rpb24uY2FzZUluc2Vuc2l0aXZlQ29sbGF0aW9uKCkgfVxuICAgICAgOiB7fTtcbiAgICBjb25zdCBpbmRleE9wdGlvbnM6IE9iamVjdCA9IHtcbiAgICAgIC4uLmRlZmF1bHRPcHRpb25zLFxuICAgICAgLi4uY2FzZUluc2Vuc2l0aXZlT3B0aW9ucyxcbiAgICAgIC4uLmluZGV4TmFtZU9wdGlvbnMsXG4gICAgICAuLi50dGxPcHRpb25zLFxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKFxuICAgICAgICBjb2xsZWN0aW9uID0+XG4gICAgICAgICAgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgICAgICAgIGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi5jcmVhdGVJbmRleChpbmRleENyZWF0aW9uUmVxdWVzdCwgaW5kZXhPcHRpb25zLCBlcnJvciA9PlxuICAgICAgICAgICAgICBlcnJvciA/IHJlamVjdChlcnJvcikgOiByZXNvbHZlKClcbiAgICAgICAgICAgIClcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBDcmVhdGUgYSB1bmlxdWUgaW5kZXguIFVuaXF1ZSBpbmRleGVzIG9uIG51bGxhYmxlIGZpZWxkcyBhcmUgbm90IGFsbG93ZWQuIFNpbmNlIHdlIGRvbid0XG4gIC8vIGN1cnJlbnRseSBrbm93IHdoaWNoIGZpZWxkcyBhcmUgbnVsbGFibGUgYW5kIHdoaWNoIGFyZW4ndCwgd2UgaWdub3JlIHRoYXQgY3JpdGVyaWEuXG4gIC8vIEFzIHN1Y2gsIHdlIHNob3VsZG4ndCBleHBvc2UgdGhpcyBmdW5jdGlvbiB0byB1c2VycyBvZiBwYXJzZSB1bnRpbCB3ZSBoYXZlIGFuIG91dC1vZi1iYW5kXG4gIC8vIFdheSBvZiBkZXRlcm1pbmluZyBpZiBhIGZpZWxkIGlzIG51bGxhYmxlLiBVbmRlZmluZWQgZG9lc24ndCBjb3VudCBhZ2FpbnN0IHVuaXF1ZW5lc3MsXG4gIC8vIHdoaWNoIGlzIHdoeSB3ZSB1c2Ugc3BhcnNlIGluZGV4ZXMuXG4gIGVuc3VyZVVuaXF1ZW5lc3MoY2xhc3NOYW1lOiBzdHJpbmcsIHNjaGVtYTogU2NoZW1hVHlwZSwgZmllbGROYW1lczogc3RyaW5nW10pIHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgaW5kZXhDcmVhdGlvblJlcXVlc3QgPSB7fTtcbiAgICBjb25zdCBtb25nb0ZpZWxkTmFtZXMgPSBmaWVsZE5hbWVzLm1hcChmaWVsZE5hbWUgPT4gdHJhbnNmb3JtS2V5KGNsYXNzTmFtZSwgZmllbGROYW1lLCBzY2hlbWEpKTtcbiAgICBtb25nb0ZpZWxkTmFtZXMuZm9yRWFjaChmaWVsZE5hbWUgPT4ge1xuICAgICAgaW5kZXhDcmVhdGlvblJlcXVlc3RbZmllbGROYW1lXSA9IDE7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uX2Vuc3VyZVNwYXJzZVVuaXF1ZUluZGV4SW5CYWNrZ3JvdW5kKGluZGV4Q3JlYXRpb25SZXF1ZXN0KSlcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGlmIChlcnJvci5jb2RlID09PSAxMTAwMCkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgIFBhcnNlLkVycm9yLkRVUExJQ0FURV9WQUxVRSxcbiAgICAgICAgICAgICdUcmllZCB0byBlbnN1cmUgZmllbGQgdW5pcXVlbmVzcyBmb3IgYSBjbGFzcyB0aGF0IGFscmVhZHkgaGFzIGR1cGxpY2F0ZXMuJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgLy8gVXNlZCBpbiB0ZXN0c1xuICBfcmF3RmluZChjbGFzc05hbWU6IHN0cmluZywgcXVlcnk6IFF1ZXJ5VHlwZSkge1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PlxuICAgICAgICBjb2xsZWN0aW9uLmZpbmQocXVlcnksIHtcbiAgICAgICAgICBtYXhUaW1lTVM6IHRoaXMuX21heFRpbWVNUyxcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIEV4ZWN1dGVzIGEgY291bnQuXG4gIGNvdW50KFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogU2NoZW1hVHlwZSxcbiAgICBxdWVyeTogUXVlcnlUeXBlLFxuICAgIHJlYWRQcmVmZXJlbmNlOiA/c3RyaW5nLFxuICAgIGhpbnQ6ID9taXhlZFxuICApIHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgcmVhZFByZWZlcmVuY2UgPSB0aGlzLl9wYXJzZVJlYWRQcmVmZXJlbmNlKHJlYWRQcmVmZXJlbmNlKTtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT5cbiAgICAgICAgY29sbGVjdGlvbi5jb3VudCh0cmFuc2Zvcm1XaGVyZShjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWEsIHRydWUpLCB7XG4gICAgICAgICAgbWF4VGltZU1TOiB0aGlzLl9tYXhUaW1lTVMsXG4gICAgICAgICAgcmVhZFByZWZlcmVuY2UsXG4gICAgICAgICAgaGludCxcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIGRpc3RpbmN0KGNsYXNzTmFtZTogc3RyaW5nLCBzY2hlbWE6IFNjaGVtYVR5cGUsIHF1ZXJ5OiBRdWVyeVR5cGUsIGZpZWxkTmFtZTogc3RyaW5nKSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIGNvbnN0IGlzUG9pbnRlckZpZWxkID0gc2NoZW1hLmZpZWxkc1tmaWVsZE5hbWVdICYmIHNjaGVtYS5maWVsZHNbZmllbGROYW1lXS50eXBlID09PSAnUG9pbnRlcic7XG4gICAgY29uc3QgdHJhbnNmb3JtRmllbGQgPSB0cmFuc2Zvcm1LZXkoY2xhc3NOYW1lLCBmaWVsZE5hbWUsIHNjaGVtYSk7XG5cbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT5cbiAgICAgICAgY29sbGVjdGlvbi5kaXN0aW5jdCh0cmFuc2Zvcm1GaWVsZCwgdHJhbnNmb3JtV2hlcmUoY2xhc3NOYW1lLCBxdWVyeSwgc2NoZW1hKSlcbiAgICAgIClcbiAgICAgIC50aGVuKG9iamVjdHMgPT4ge1xuICAgICAgICBvYmplY3RzID0gb2JqZWN0cy5maWx0ZXIob2JqID0+IG9iaiAhPSBudWxsKTtcbiAgICAgICAgcmV0dXJuIG9iamVjdHMubWFwKG9iamVjdCA9PiB7XG4gICAgICAgICAgaWYgKGlzUG9pbnRlckZpZWxkKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJhbnNmb3JtUG9pbnRlclN0cmluZyhzY2hlbWEsIGZpZWxkTmFtZSwgb2JqZWN0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdChjbGFzc05hbWUsIG9iamVjdCwgc2NoZW1hKTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgYWdncmVnYXRlKFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogYW55LFxuICAgIHBpcGVsaW5lOiBhbnksXG4gICAgcmVhZFByZWZlcmVuY2U6ID9zdHJpbmcsXG4gICAgaGludDogP21peGVkLFxuICAgIGV4cGxhaW4/OiBib29sZWFuXG4gICkge1xuICAgIGxldCBpc1BvaW50ZXJGaWVsZCA9IGZhbHNlO1xuICAgIHBpcGVsaW5lID0gcGlwZWxpbmUubWFwKHN0YWdlID0+IHtcbiAgICAgIGlmIChzdGFnZS4kZ3JvdXApIHtcbiAgICAgICAgc3RhZ2UuJGdyb3VwID0gdGhpcy5fcGFyc2VBZ2dyZWdhdGVHcm91cEFyZ3Moc2NoZW1hLCBzdGFnZS4kZ3JvdXApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc3RhZ2UuJGdyb3VwLl9pZCAmJlxuICAgICAgICAgIHR5cGVvZiBzdGFnZS4kZ3JvdXAuX2lkID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgIHN0YWdlLiRncm91cC5faWQuaW5kZXhPZignJF9wXycpID49IDBcbiAgICAgICAgKSB7XG4gICAgICAgICAgaXNQb2ludGVyRmllbGQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc3RhZ2UuJG1hdGNoKSB7XG4gICAgICAgIHN0YWdlLiRtYXRjaCA9IHRoaXMuX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWEsIHN0YWdlLiRtYXRjaCk7XG4gICAgICB9XG4gICAgICBpZiAoc3RhZ2UuJHByb2plY3QpIHtcbiAgICAgICAgc3RhZ2UuJHByb2plY3QgPSB0aGlzLl9wYXJzZUFnZ3JlZ2F0ZVByb2plY3RBcmdzKHNjaGVtYSwgc3RhZ2UuJHByb2plY3QpO1xuICAgICAgfVxuICAgICAgaWYgKHN0YWdlLiRnZW9OZWFyICYmIHN0YWdlLiRnZW9OZWFyLnF1ZXJ5KSB7XG4gICAgICAgIHN0YWdlLiRnZW9OZWFyLnF1ZXJ5ID0gdGhpcy5fcGFyc2VBZ2dyZWdhdGVBcmdzKHNjaGVtYSwgc3RhZ2UuJGdlb05lYXIucXVlcnkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YWdlO1xuICAgIH0pO1xuICAgIHJlYWRQcmVmZXJlbmNlID0gdGhpcy5fcGFyc2VSZWFkUHJlZmVyZW5jZShyZWFkUHJlZmVyZW5jZSk7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+XG4gICAgICAgIGNvbGxlY3Rpb24uYWdncmVnYXRlKHBpcGVsaW5lLCB7XG4gICAgICAgICAgcmVhZFByZWZlcmVuY2UsXG4gICAgICAgICAgbWF4VGltZU1TOiB0aGlzLl9tYXhUaW1lTVMsXG4gICAgICAgICAgaGludCxcbiAgICAgICAgICBleHBsYWluLFxuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLnRoZW4ocmVzdWx0cyA9PiB7XG4gICAgICAgIHJlc3VsdHMuZm9yRWFjaChyZXN1bHQgPT4ge1xuICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocmVzdWx0LCAnX2lkJykpIHtcbiAgICAgICAgICAgIGlmIChpc1BvaW50ZXJGaWVsZCAmJiByZXN1bHQuX2lkKSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5faWQgPSByZXN1bHQuX2lkLnNwbGl0KCckJylbMV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIHJlc3VsdC5faWQgPT0gbnVsbCB8fFxuICAgICAgICAgICAgICByZXN1bHQuX2lkID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICAoWydvYmplY3QnLCAnc3RyaW5nJ10uaW5jbHVkZXModHlwZW9mIHJlc3VsdC5faWQpICYmIF8uaXNFbXB0eShyZXN1bHQuX2lkKSlcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICByZXN1bHQuX2lkID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5vYmplY3RJZCA9IHJlc3VsdC5faWQ7XG4gICAgICAgICAgICBkZWxldGUgcmVzdWx0Ll9pZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgIH0pXG4gICAgICAudGhlbihvYmplY3RzID0+IG9iamVjdHMubWFwKG9iamVjdCA9PiBtb25nb09iamVjdFRvUGFyc2VPYmplY3QoY2xhc3NOYW1lLCBvYmplY3QsIHNjaGVtYSkpKVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIHRoZSBwaXBlbGluZSBhbmQgY29udmVydCBhbnkgUG9pbnRlciBvciBEYXRlIGNvbHVtbnMuXG4gIC8vIElmIHdlIGRldGVjdCBhIHBvaW50ZXIgY29sdW1uIHdlIHdpbGwgcmVuYW1lIHRoZSBjb2x1bW4gYmVpbmcgcXVlcmllZCBmb3IgdG8gbWF0Y2ggdGhlIGNvbHVtblxuICAvLyBpbiB0aGUgZGF0YWJhc2UuIFdlIGFsc28gbW9kaWZ5IHRoZSB2YWx1ZSB0byB3aGF0IHdlIGV4cGVjdCB0aGUgdmFsdWUgdG8gYmUgaW4gdGhlIGRhdGFiYXNlXG4gIC8vIGFzIHdlbGwuXG4gIC8vIEZvciBkYXRlcywgdGhlIGRyaXZlciBleHBlY3RzIGEgRGF0ZSBvYmplY3QsIGJ1dCB3ZSBoYXZlIGEgc3RyaW5nIGNvbWluZyBpbi4gU28gd2UnbGwgY29udmVydFxuICAvLyB0aGUgc3RyaW5nIHRvIGEgRGF0ZSBzbyB0aGUgZHJpdmVyIGNhbiBwZXJmb3JtIHRoZSBuZWNlc3NhcnkgY29tcGFyaXNvbi5cbiAgLy9cbiAgLy8gVGhlIGdvYWwgb2YgdGhpcyBtZXRob2QgaXMgdG8gbG9vayBmb3IgdGhlIFwibGVhdmVzXCIgb2YgdGhlIHBpcGVsaW5lIGFuZCBkZXRlcm1pbmUgaWYgaXQgbmVlZHNcbiAgLy8gdG8gYmUgY29udmVydGVkLiBUaGUgcGlwZWxpbmUgY2FuIGhhdmUgYSBmZXcgZGlmZmVyZW50IGZvcm1zLiBGb3IgbW9yZSBkZXRhaWxzLCBzZWU6XG4gIC8vICAgICBodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9vcGVyYXRvci9hZ2dyZWdhdGlvbi9cbiAgLy9cbiAgLy8gSWYgdGhlIHBpcGVsaW5lIGlzIGFuIGFycmF5LCBpdCBtZWFucyB3ZSBhcmUgcHJvYmFibHkgcGFyc2luZyBhbiAnJGFuZCcgb3IgJyRvcicgb3BlcmF0b3IuIEluXG4gIC8vIHRoYXQgY2FzZSB3ZSBuZWVkIHRvIGxvb3AgdGhyb3VnaCBhbGwgb2YgaXQncyBjaGlsZHJlbiB0byBmaW5kIHRoZSBjb2x1bW5zIGJlaW5nIG9wZXJhdGVkIG9uLlxuICAvLyBJZiB0aGUgcGlwZWxpbmUgaXMgYW4gb2JqZWN0LCB0aGVuIHdlJ2xsIGxvb3AgdGhyb3VnaCB0aGUga2V5cyBjaGVja2luZyB0byBzZWUgaWYgdGhlIGtleSBuYW1lXG4gIC8vIG1hdGNoZXMgb25lIG9mIHRoZSBzY2hlbWEgY29sdW1ucy4gSWYgaXQgZG9lcyBtYXRjaCBhIGNvbHVtbiBhbmQgdGhlIGNvbHVtbiBpcyBhIFBvaW50ZXIgb3JcbiAgLy8gYSBEYXRlLCB0aGVuIHdlJ2xsIGNvbnZlcnQgdGhlIHZhbHVlIGFzIGRlc2NyaWJlZCBhYm92ZS5cbiAgLy9cbiAgLy8gQXMgbXVjaCBhcyBJIGhhdGUgcmVjdXJzaW9uLi4udGhpcyBzZWVtZWQgbGlrZSBhIGdvb2QgZml0IGZvciBpdC4gV2UncmUgZXNzZW50aWFsbHkgdHJhdmVyc2luZ1xuICAvLyBkb3duIGEgdHJlZSB0byBmaW5kIGEgXCJsZWFmIG5vZGVcIiBhbmQgY2hlY2tpbmcgdG8gc2VlIGlmIGl0IG5lZWRzIHRvIGJlIGNvbnZlcnRlZC5cbiAgX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWE6IGFueSwgcGlwZWxpbmU6IGFueSk6IGFueSB7XG4gICAgaWYgKHBpcGVsaW5lID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocGlwZWxpbmUpKSB7XG4gICAgICByZXR1cm4gcGlwZWxpbmUubWFwKHZhbHVlID0+IHRoaXMuX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWEsIHZhbHVlKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcGlwZWxpbmUgPT09ICdvYmplY3QnKSB7XG4gICAgICBjb25zdCByZXR1cm5WYWx1ZSA9IHt9O1xuICAgICAgZm9yIChjb25zdCBmaWVsZCBpbiBwaXBlbGluZSkge1xuICAgICAgICBpZiAoc2NoZW1hLmZpZWxkc1tmaWVsZF0gJiYgc2NoZW1hLmZpZWxkc1tmaWVsZF0udHlwZSA9PT0gJ1BvaW50ZXInKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBwaXBlbGluZVtmaWVsZF0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAvLyBQYXNzIG9iamVjdHMgZG93biB0byBNb25nb0RCLi4udGhpcyBpcyBtb3JlIHRoYW4gbGlrZWx5IGFuICRleGlzdHMgb3BlcmF0b3IuXG4gICAgICAgICAgICByZXR1cm5WYWx1ZVtgX3BfJHtmaWVsZH1gXSA9IHBpcGVsaW5lW2ZpZWxkXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuVmFsdWVbYF9wXyR7ZmllbGR9YF0gPSBgJHtzY2hlbWEuZmllbGRzW2ZpZWxkXS50YXJnZXRDbGFzc30kJHtwaXBlbGluZVtmaWVsZF19YDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2NoZW1hLmZpZWxkc1tmaWVsZF0gJiYgc2NoZW1hLmZpZWxkc1tmaWVsZF0udHlwZSA9PT0gJ0RhdGUnKSB7XG4gICAgICAgICAgcmV0dXJuVmFsdWVbZmllbGRdID0gdGhpcy5fY29udmVydFRvRGF0ZShwaXBlbGluZVtmaWVsZF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVyblZhbHVlW2ZpZWxkXSA9IHRoaXMuX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWEsIHBpcGVsaW5lW2ZpZWxkXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmllbGQgPT09ICdvYmplY3RJZCcpIHtcbiAgICAgICAgICByZXR1cm5WYWx1ZVsnX2lkJ10gPSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICAgICAgZGVsZXRlIHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgICAgfSBlbHNlIGlmIChmaWVsZCA9PT0gJ2NyZWF0ZWRBdCcpIHtcbiAgICAgICAgICByZXR1cm5WYWx1ZVsnX2NyZWF0ZWRfYXQnXSA9IHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgICAgICBkZWxldGUgcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgICB9IGVsc2UgaWYgKGZpZWxkID09PSAndXBkYXRlZEF0Jykge1xuICAgICAgICAgIHJldHVyblZhbHVlWydfdXBkYXRlZF9hdCddID0gcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgICAgIGRlbGV0ZSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHBpcGVsaW5lO1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBpcyBzbGlnaHRseSBkaWZmZXJlbnQgdGhhbiB0aGUgb25lIGFib3ZlLiBSYXRoZXIgdGhhbiB0cnlpbmcgdG8gY29tYmluZSB0aGVzZVxuICAvLyB0d28gZnVuY3Rpb25zIGFuZCBtYWtpbmcgdGhlIGNvZGUgZXZlbiBoYXJkZXIgdG8gdW5kZXJzdGFuZCwgSSBkZWNpZGVkIHRvIHNwbGl0IGl0IHVwLiBUaGVcbiAgLy8gZGlmZmVyZW5jZSB3aXRoIHRoaXMgZnVuY3Rpb24gaXMgd2UgYXJlIG5vdCB0cmFuc2Zvcm1pbmcgdGhlIHZhbHVlcywgb25seSB0aGUga2V5cyBvZiB0aGVcbiAgLy8gcGlwZWxpbmUuXG4gIF9wYXJzZUFnZ3JlZ2F0ZVByb2plY3RBcmdzKHNjaGVtYTogYW55LCBwaXBlbGluZTogYW55KTogYW55IHtcbiAgICBjb25zdCByZXR1cm5WYWx1ZSA9IHt9O1xuICAgIGZvciAoY29uc3QgZmllbGQgaW4gcGlwZWxpbmUpIHtcbiAgICAgIGlmIChzY2hlbWEuZmllbGRzW2ZpZWxkXSAmJiBzY2hlbWEuZmllbGRzW2ZpZWxkXS50eXBlID09PSAnUG9pbnRlcicpIHtcbiAgICAgICAgcmV0dXJuVmFsdWVbYF9wXyR7ZmllbGR9YF0gPSBwaXBlbGluZVtmaWVsZF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm5WYWx1ZVtmaWVsZF0gPSB0aGlzLl9wYXJzZUFnZ3JlZ2F0ZUFyZ3Moc2NoZW1hLCBwaXBlbGluZVtmaWVsZF0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmllbGQgPT09ICdvYmplY3RJZCcpIHtcbiAgICAgICAgcmV0dXJuVmFsdWVbJ19pZCddID0gcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgICBkZWxldGUgcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgfSBlbHNlIGlmIChmaWVsZCA9PT0gJ2NyZWF0ZWRBdCcpIHtcbiAgICAgICAgcmV0dXJuVmFsdWVbJ19jcmVhdGVkX2F0J10gPSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICAgIGRlbGV0ZSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICB9IGVsc2UgaWYgKGZpZWxkID09PSAndXBkYXRlZEF0Jykge1xuICAgICAgICByZXR1cm5WYWx1ZVsnX3VwZGF0ZWRfYXQnXSA9IHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgICAgZGVsZXRlIHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJldHVyblZhbHVlO1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBpcyBzbGlnaHRseSBkaWZmZXJlbnQgdGhhbiB0aGUgdHdvIGFib3ZlLiBNb25nb0RCICRncm91cCBhZ2dyZWdhdGUgbG9va3MgbGlrZTpcbiAgLy8gICAgIHsgJGdyb3VwOiB7IF9pZDogPGV4cHJlc3Npb24+LCA8ZmllbGQxPjogeyA8YWNjdW11bGF0b3IxPiA6IDxleHByZXNzaW9uMT4gfSwgLi4uIH0gfVxuICAvLyBUaGUgPGV4cHJlc3Npb24+IGNvdWxkIGJlIGEgY29sdW1uIG5hbWUsIHByZWZpeGVkIHdpdGggdGhlICckJyBjaGFyYWN0ZXIuIFdlJ2xsIGxvb2sgZm9yXG4gIC8vIHRoZXNlIDxleHByZXNzaW9uPiBhbmQgY2hlY2sgdG8gc2VlIGlmIGl0IGlzIGEgJ1BvaW50ZXInIG9yIGlmIGl0J3Mgb25lIG9mIGNyZWF0ZWRBdCxcbiAgLy8gdXBkYXRlZEF0IG9yIG9iamVjdElkIGFuZCBjaGFuZ2UgaXQgYWNjb3JkaW5nbHkuXG4gIF9wYXJzZUFnZ3JlZ2F0ZUdyb3VwQXJncyhzY2hlbWE6IGFueSwgcGlwZWxpbmU6IGFueSk6IGFueSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocGlwZWxpbmUpKSB7XG4gICAgICByZXR1cm4gcGlwZWxpbmUubWFwKHZhbHVlID0+IHRoaXMuX3BhcnNlQWdncmVnYXRlR3JvdXBBcmdzKHNjaGVtYSwgdmFsdWUpKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwaXBlbGluZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNvbnN0IHJldHVyblZhbHVlID0ge307XG4gICAgICBmb3IgKGNvbnN0IGZpZWxkIGluIHBpcGVsaW5lKSB7XG4gICAgICAgIHJldHVyblZhbHVlW2ZpZWxkXSA9IHRoaXMuX3BhcnNlQWdncmVnYXRlR3JvdXBBcmdzKHNjaGVtYSwgcGlwZWxpbmVbZmllbGRdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwaXBlbGluZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IGZpZWxkID0gcGlwZWxpbmUuc3Vic3RyaW5nKDEpO1xuICAgICAgaWYgKHNjaGVtYS5maWVsZHNbZmllbGRdICYmIHNjaGVtYS5maWVsZHNbZmllbGRdLnR5cGUgPT09ICdQb2ludGVyJykge1xuICAgICAgICByZXR1cm4gYCRfcF8ke2ZpZWxkfWA7XG4gICAgICB9IGVsc2UgaWYgKGZpZWxkID09ICdjcmVhdGVkQXQnKSB7XG4gICAgICAgIHJldHVybiAnJF9jcmVhdGVkX2F0JztcbiAgICAgIH0gZWxzZSBpZiAoZmllbGQgPT0gJ3VwZGF0ZWRBdCcpIHtcbiAgICAgICAgcmV0dXJuICckX3VwZGF0ZWRfYXQnO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcGlwZWxpbmU7XG4gIH1cblxuICAvLyBUaGlzIGZ1bmN0aW9uIHdpbGwgYXR0ZW1wdCB0byBjb252ZXJ0IHRoZSBwcm92aWRlZCB2YWx1ZSB0byBhIERhdGUgb2JqZWN0LiBTaW5jZSB0aGlzIGlzIHBhcnRcbiAgLy8gb2YgYW4gYWdncmVnYXRpb24gcGlwZWxpbmUsIHRoZSB2YWx1ZSBjYW4gZWl0aGVyIGJlIGEgc3RyaW5nIG9yIGl0IGNhbiBiZSBhbm90aGVyIG9iamVjdCB3aXRoXG4gIC8vIGFuIG9wZXJhdG9yIGluIGl0IChsaWtlICRndCwgJGx0LCBldGMpLiBCZWNhdXNlIG9mIHRoaXMgSSBmZWx0IGl0IHdhcyBlYXNpZXIgdG8gbWFrZSB0aGlzIGFcbiAgLy8gcmVjdXJzaXZlIG1ldGhvZCB0byB0cmF2ZXJzZSBkb3duIHRvIHRoZSBcImxlYWYgbm9kZVwiIHdoaWNoIGlzIGdvaW5nIHRvIGJlIHRoZSBzdHJpbmcuXG4gIF9jb252ZXJ0VG9EYXRlKHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gbmV3IERhdGUodmFsdWUpO1xuICAgIH1cblxuICAgIGNvbnN0IHJldHVyblZhbHVlID0ge307XG4gICAgZm9yIChjb25zdCBmaWVsZCBpbiB2YWx1ZSkge1xuICAgICAgcmV0dXJuVmFsdWVbZmllbGRdID0gdGhpcy5fY29udmVydFRvRGF0ZSh2YWx1ZVtmaWVsZF0pO1xuICAgIH1cbiAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gIH1cblxuICBfcGFyc2VSZWFkUHJlZmVyZW5jZShyZWFkUHJlZmVyZW5jZTogP3N0cmluZyk6ID9zdHJpbmcge1xuICAgIGlmIChyZWFkUHJlZmVyZW5jZSkge1xuICAgICAgcmVhZFByZWZlcmVuY2UgPSByZWFkUHJlZmVyZW5jZS50b1VwcGVyQ2FzZSgpO1xuICAgIH1cbiAgICBzd2l0Y2ggKHJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICBjYXNlICdQUklNQVJZJzpcbiAgICAgICAgcmVhZFByZWZlcmVuY2UgPSBSZWFkUHJlZmVyZW5jZS5QUklNQVJZO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ1BSSU1BUllfUFJFRkVSUkVEJzpcbiAgICAgICAgcmVhZFByZWZlcmVuY2UgPSBSZWFkUHJlZmVyZW5jZS5QUklNQVJZX1BSRUZFUlJFRDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdTRUNPTkRBUlknOlxuICAgICAgICByZWFkUHJlZmVyZW5jZSA9IFJlYWRQcmVmZXJlbmNlLlNFQ09OREFSWTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdTRUNPTkRBUllfUFJFRkVSUkVEJzpcbiAgICAgICAgcmVhZFByZWZlcmVuY2UgPSBSZWFkUHJlZmVyZW5jZS5TRUNPTkRBUllfUFJFRkVSUkVEO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ05FQVJFU1QnOlxuICAgICAgICByZWFkUHJlZmVyZW5jZSA9IFJlYWRQcmVmZXJlbmNlLk5FQVJFU1Q7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICBjYXNlIG51bGw6XG4gICAgICBjYXNlICcnOlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLCAnTm90IHN1cHBvcnRlZCByZWFkIHByZWZlcmVuY2UuJyk7XG4gICAgfVxuICAgIHJldHVybiByZWFkUHJlZmVyZW5jZTtcbiAgfVxuXG4gIHBlcmZvcm1Jbml0aWFsaXphdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBjcmVhdGVJbmRleChjbGFzc05hbWU6IHN0cmluZywgaW5kZXg6IGFueSkge1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiBjb2xsZWN0aW9uLl9tb25nb0NvbGxlY3Rpb24uY3JlYXRlSW5kZXgoaW5kZXgpKVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgY3JlYXRlSW5kZXhlcyhjbGFzc05hbWU6IHN0cmluZywgaW5kZXhlczogYW55KSB7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi5jcmVhdGVJbmRleGVzKGluZGV4ZXMpKVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgY3JlYXRlSW5kZXhlc0lmTmVlZGVkKGNsYXNzTmFtZTogc3RyaW5nLCBmaWVsZE5hbWU6IHN0cmluZywgdHlwZTogYW55KSB7XG4gICAgaWYgKHR5cGUgJiYgdHlwZS50eXBlID09PSAnUG9seWdvbicpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0ge1xuICAgICAgICBbZmllbGROYW1lXTogJzJkc3BoZXJlJyxcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVJbmRleChjbGFzc05hbWUsIGluZGV4KTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgY3JlYXRlVGV4dEluZGV4ZXNJZk5lZWRlZChjbGFzc05hbWU6IHN0cmluZywgcXVlcnk6IFF1ZXJ5VHlwZSwgc2NoZW1hOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBmb3IgKGNvbnN0IGZpZWxkTmFtZSBpbiBxdWVyeSkge1xuICAgICAgaWYgKCFxdWVyeVtmaWVsZE5hbWVdIHx8ICFxdWVyeVtmaWVsZE5hbWVdLiR0ZXh0KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZXhpc3RpbmdJbmRleGVzID0gc2NoZW1hLmluZGV4ZXM7XG4gICAgICBmb3IgKGNvbnN0IGtleSBpbiBleGlzdGluZ0luZGV4ZXMpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBleGlzdGluZ0luZGV4ZXNba2V5XTtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChpbmRleCwgZmllbGROYW1lKSkge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgaW5kZXhOYW1lID0gYCR7ZmllbGROYW1lfV90ZXh0YDtcbiAgICAgIGNvbnN0IHRleHRJbmRleCA9IHtcbiAgICAgICAgW2luZGV4TmFtZV06IHsgW2ZpZWxkTmFtZV06ICd0ZXh0JyB9LFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLnNldEluZGV4ZXNXaXRoU2NoZW1hRm9ybWF0KFxuICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgIHRleHRJbmRleCxcbiAgICAgICAgZXhpc3RpbmdJbmRleGVzLFxuICAgICAgICBzY2hlbWEuZmllbGRzXG4gICAgICApLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT09IDg1KSB7XG4gICAgICAgICAgLy8gSW5kZXggZXhpc3Qgd2l0aCBkaWZmZXJlbnQgb3B0aW9uc1xuICAgICAgICAgIHJldHVybiB0aGlzLnNldEluZGV4ZXNGcm9tTW9uZ28oY2xhc3NOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBnZXRJbmRleGVzKGNsYXNzTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi5pbmRleGVzKCkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBkcm9wSW5kZXgoY2xhc3NOYW1lOiBzdHJpbmcsIGluZGV4OiBhbnkpIHtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi5fbW9uZ29Db2xsZWN0aW9uLmRyb3BJbmRleChpbmRleCkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBkcm9wQWxsSW5kZXhlcyhjbGFzc05hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiBjb2xsZWN0aW9uLl9tb25nb0NvbGxlY3Rpb24uZHJvcEluZGV4ZXMoKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIHVwZGF0ZVNjaGVtYVdpdGhJbmRleGVzKCk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsQ2xhc3NlcygpXG4gICAgICAudGhlbihjbGFzc2VzID0+IHtcbiAgICAgICAgY29uc3QgcHJvbWlzZXMgPSBjbGFzc2VzLm1hcChzY2hlbWEgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNldEluZGV4ZXNGcm9tTW9uZ28oc2NoZW1hLmNsYXNzTmFtZSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIGNyZWF0ZVRyYW5zYWN0aW9uYWxTZXNzaW9uKCk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgdHJhbnNhY3Rpb25hbFNlY3Rpb24gPSB0aGlzLmNsaWVudC5zdGFydFNlc3Npb24oKTtcbiAgICB0cmFuc2FjdGlvbmFsU2VjdGlvbi5zdGFydFRyYW5zYWN0aW9uKCk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cmFuc2FjdGlvbmFsU2VjdGlvbik7XG4gIH1cblxuICBjb21taXRUcmFuc2FjdGlvbmFsU2Vzc2lvbih0cmFuc2FjdGlvbmFsU2VjdGlvbjogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRyYW5zYWN0aW9uYWxTZWN0aW9uLmNvbW1pdFRyYW5zYWN0aW9uKCkudGhlbigoKSA9PiB7XG4gICAgICB0cmFuc2FjdGlvbmFsU2VjdGlvbi5lbmRTZXNzaW9uKCk7XG4gICAgfSk7XG4gIH1cblxuICBhYm9ydFRyYW5zYWN0aW9uYWxTZXNzaW9uKHRyYW5zYWN0aW9uYWxTZWN0aW9uOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdHJhbnNhY3Rpb25hbFNlY3Rpb24uYWJvcnRUcmFuc2FjdGlvbigpLnRoZW4oKCkgPT4ge1xuICAgICAgdHJhbnNhY3Rpb25hbFNlY3Rpb24uZW5kU2Vzc2lvbigpO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1vbmdvU3RvcmFnZUFkYXB0ZXI7XG4iXX0=