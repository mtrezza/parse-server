"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParseGraphQLSchema = void 0;

var _node = _interopRequireDefault(require("parse/node"));

var _graphql = require("graphql");

var _stitch = require("@graphql-tools/stitch");

var _utils = require("@graphql-tools/utils");

var _requiredParameter = _interopRequireDefault(require("../requiredParameter"));

var defaultGraphQLTypes = _interopRequireWildcard(require("./loaders/defaultGraphQLTypes"));

var parseClassTypes = _interopRequireWildcard(require("./loaders/parseClassTypes"));

var parseClassQueries = _interopRequireWildcard(require("./loaders/parseClassQueries"));

var parseClassMutations = _interopRequireWildcard(require("./loaders/parseClassMutations"));

var defaultGraphQLQueries = _interopRequireWildcard(require("./loaders/defaultGraphQLQueries"));

var defaultGraphQLMutations = _interopRequireWildcard(require("./loaders/defaultGraphQLMutations"));

var _ParseGraphQLController = _interopRequireWildcard(require("../Controllers/ParseGraphQLController"));

var _DatabaseController = _interopRequireDefault(require("../Controllers/DatabaseController"));

var _parseGraphQLUtils = require("./parseGraphQLUtils");

var schemaDirectives = _interopRequireWildcard(require("./loaders/schemaDirectives"));

var schemaTypes = _interopRequireWildcard(require("./loaders/schemaTypes"));

var _triggers = require("../triggers");

var defaultRelaySchema = _interopRequireWildcard(require("./loaders/defaultRelaySchema"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const RESERVED_GRAPHQL_TYPE_NAMES = ['String', 'Boolean', 'Int', 'Float', 'ID', 'ArrayResult', 'Query', 'Mutation', 'Subscription', 'CreateFileInput', 'CreateFilePayload', 'Viewer', 'SignUpInput', 'SignUpPayload', 'LogInInput', 'LogInPayload', 'LogOutInput', 'LogOutPayload', 'CloudCodeFunction', 'CallCloudCodeInput', 'CallCloudCodePayload', 'CreateClassInput', 'CreateClassPayload', 'UpdateClassInput', 'UpdateClassPayload', 'DeleteClassInput', 'DeleteClassPayload', 'PageInfo'];
const RESERVED_GRAPHQL_QUERY_NAMES = ['health', 'viewer', 'class', 'classes'];
const RESERVED_GRAPHQL_MUTATION_NAMES = ['signUp', 'logIn', 'logOut', 'createFile', 'callCloudCode', 'createClass', 'updateClass', 'deleteClass'];

class ParseGraphQLSchema {
  constructor(params = {}) {
    this.parseGraphQLController = params.parseGraphQLController || (0, _requiredParameter.default)('You must provide a parseGraphQLController instance!');
    this.databaseController = params.databaseController || (0, _requiredParameter.default)('You must provide a databaseController instance!');
    this.log = params.log || (0, _requiredParameter.default)('You must provide a log instance!');
    this.graphQLCustomTypeDefs = params.graphQLCustomTypeDefs;
    this.appId = params.appId || (0, _requiredParameter.default)('You must provide the appId!');
  }

  async load() {
    const {
      parseGraphQLConfig
    } = await this._initializeSchemaAndConfig();
    const parseClasses = await this._getClassesForSchema(parseGraphQLConfig);
    const parseClassesString = JSON.stringify(parseClasses);
    const functionNames = await this._getFunctionNames();
    const functionNamesString = JSON.stringify(functionNames);

    if (this.graphQLSchema && !this._hasSchemaInputChanged({
      parseClasses,
      parseClassesString,
      parseGraphQLConfig,
      functionNamesString
    })) {
      return this.graphQLSchema;
    }

    this.parseClasses = parseClasses;
    this.parseClassesString = parseClassesString;
    this.parseGraphQLConfig = parseGraphQLConfig;
    this.functionNames = functionNames;
    this.functionNamesString = functionNamesString;
    this.parseClassTypes = {};
    this.viewerType = null;
    this.graphQLAutoSchema = null;
    this.graphQLSchema = null;
    this.graphQLTypes = [];
    this.graphQLQueries = {};
    this.graphQLMutations = {};
    this.graphQLSubscriptions = {};
    this.graphQLSchemaDirectivesDefinitions = null;
    this.graphQLSchemaDirectives = {};
    this.relayNodeInterface = null;
    defaultGraphQLTypes.load(this);
    defaultRelaySchema.load(this);
    schemaTypes.load(this);

    this._getParseClassesWithConfig(parseClasses, parseGraphQLConfig).forEach(([parseClass, parseClassConfig]) => {
      parseClassTypes.load(this, parseClass, parseClassConfig);
      parseClassQueries.load(this, parseClass, parseClassConfig);
      parseClassMutations.load(this, parseClass, parseClassConfig);
    });

    defaultGraphQLTypes.loadArrayResult(this, parseClasses);
    defaultGraphQLQueries.load(this);
    defaultGraphQLMutations.load(this);
    let graphQLQuery = undefined;

    if (Object.keys(this.graphQLQueries).length > 0) {
      graphQLQuery = new _graphql.GraphQLObjectType({
        name: 'Query',
        description: 'Query is the top level type for queries.',
        fields: this.graphQLQueries
      });
      this.addGraphQLType(graphQLQuery, true, true);
    }

    let graphQLMutation = undefined;

    if (Object.keys(this.graphQLMutations).length > 0) {
      graphQLMutation = new _graphql.GraphQLObjectType({
        name: 'Mutation',
        description: 'Mutation is the top level type for mutations.',
        fields: this.graphQLMutations
      });
      this.addGraphQLType(graphQLMutation, true, true);
    }

    let graphQLSubscription = undefined;

    if (Object.keys(this.graphQLSubscriptions).length > 0) {
      graphQLSubscription = new _graphql.GraphQLObjectType({
        name: 'Subscription',
        description: 'Subscription is the top level type for subscriptions.',
        fields: this.graphQLSubscriptions
      });
      this.addGraphQLType(graphQLSubscription, true, true);
    }

    this.graphQLAutoSchema = new _graphql.GraphQLSchema({
      types: this.graphQLTypes,
      query: graphQLQuery,
      mutation: graphQLMutation,
      subscription: graphQLSubscription
    });

    if (this.graphQLCustomTypeDefs) {
      schemaDirectives.load(this);

      if (typeof this.graphQLCustomTypeDefs.getTypeMap === 'function') {
        const customGraphQLSchemaTypeMap = this.graphQLCustomTypeDefs.getTypeMap();

        const findAndReplaceLastType = (parent, key) => {
          if (parent[key].name) {
            if (this.graphQLAutoSchema.getType(parent[key].name) && this.graphQLAutoSchema.getType(parent[key].name) !== parent[key]) {
              // To avoid unresolved field on overloaded schema
              // replace the final type with the auto schema one
              parent[key] = this.graphQLAutoSchema.getType(parent[key].name);
            }
          } else {
            if (parent[key].ofType) {
              findAndReplaceLastType(parent[key], 'ofType');
            }
          }
        };

        Object.values(customGraphQLSchemaTypeMap).forEach(customGraphQLSchemaType => {
          if (!customGraphQLSchemaType || !customGraphQLSchemaType.name || customGraphQLSchemaType.name.startsWith('__')) {
            return;
          }

          const autoGraphQLSchemaType = this.graphQLAutoSchema.getType(customGraphQLSchemaType.name);

          if (!autoGraphQLSchemaType) {
            this.graphQLAutoSchema._typeMap[customGraphQLSchemaType.name] = customGraphQLSchemaType;
          }
        });
        Object.values(customGraphQLSchemaTypeMap).forEach(customGraphQLSchemaType => {
          if (!customGraphQLSchemaType || !customGraphQLSchemaType.name || customGraphQLSchemaType.name.startsWith('__')) {
            return;
          }

          const autoGraphQLSchemaType = this.graphQLAutoSchema.getType(customGraphQLSchemaType.name);

          if (autoGraphQLSchemaType && typeof customGraphQLSchemaType.getFields === 'function') {
            Object.values(customGraphQLSchemaType.getFields()).forEach(field => {
              findAndReplaceLastType(field, 'type');
            });
            autoGraphQLSchemaType._fields = _objectSpread(_objectSpread({}, autoGraphQLSchemaType.getFields()), customGraphQLSchemaType.getFields());
          }
        });
        this.graphQLSchema = (0, _stitch.stitchSchemas)({
          schemas: [this.graphQLSchemaDirectivesDefinitions, this.graphQLAutoSchema],
          mergeDirectives: true
        });
      } else if (typeof this.graphQLCustomTypeDefs === 'function') {
        this.graphQLSchema = await this.graphQLCustomTypeDefs({
          directivesDefinitionsSchema: this.graphQLSchemaDirectivesDefinitions,
          autoSchema: this.graphQLAutoSchema,
          stitchSchemas: _stitch.stitchSchemas
        });
      } else {
        this.graphQLSchema = (0, _stitch.stitchSchemas)({
          schemas: [this.graphQLSchemaDirectivesDefinitions, this.graphQLAutoSchema, this.graphQLCustomTypeDefs],
          mergeDirectives: true
        });
      }

      const graphQLSchemaTypeMap = this.graphQLSchema.getTypeMap();
      Object.keys(graphQLSchemaTypeMap).forEach(graphQLSchemaTypeName => {
        const graphQLSchemaType = graphQLSchemaTypeMap[graphQLSchemaTypeName];

        if (typeof graphQLSchemaType.getFields === 'function' && this.graphQLCustomTypeDefs.definitions) {
          const graphQLCustomTypeDef = this.graphQLCustomTypeDefs.definitions.find(definition => definition.name.value === graphQLSchemaTypeName);

          if (graphQLCustomTypeDef) {
            const graphQLSchemaTypeFieldMap = graphQLSchemaType.getFields();
            Object.keys(graphQLSchemaTypeFieldMap).forEach(graphQLSchemaTypeFieldName => {
              const graphQLSchemaTypeField = graphQLSchemaTypeFieldMap[graphQLSchemaTypeFieldName];

              if (!graphQLSchemaTypeField.astNode) {
                const astNode = graphQLCustomTypeDef.fields.find(field => field.name.value === graphQLSchemaTypeFieldName);

                if (astNode) {
                  graphQLSchemaTypeField.astNode = astNode;
                }
              }
            });
          }
        }
      });

      _utils.SchemaDirectiveVisitor.visitSchemaDirectives(this.graphQLSchema, this.graphQLSchemaDirectives);
    } else {
      this.graphQLSchema = this.graphQLAutoSchema;
    }

    return this.graphQLSchema;
  }

  addGraphQLType(type, throwError = false, ignoreReserved = false, ignoreConnection = false) {
    if (!ignoreReserved && RESERVED_GRAPHQL_TYPE_NAMES.includes(type.name) || this.graphQLTypes.find(existingType => existingType.name === type.name) || !ignoreConnection && type.name.endsWith('Connection')) {
      const message = `Type ${type.name} could not be added to the auto schema because it collided with an existing type.`;

      if (throwError) {
        throw new Error(message);
      }

      this.log.warn(message);
      return undefined;
    }

    this.graphQLTypes.push(type);
    return type;
  }

  addGraphQLQuery(fieldName, field, throwError = false, ignoreReserved = false) {
    if (!ignoreReserved && RESERVED_GRAPHQL_QUERY_NAMES.includes(fieldName) || this.graphQLQueries[fieldName]) {
      const message = `Query ${fieldName} could not be added to the auto schema because it collided with an existing field.`;

      if (throwError) {
        throw new Error(message);
      }

      this.log.warn(message);
      return undefined;
    }

    this.graphQLQueries[fieldName] = field;
    return field;
  }

  addGraphQLMutation(fieldName, field, throwError = false, ignoreReserved = false) {
    if (!ignoreReserved && RESERVED_GRAPHQL_MUTATION_NAMES.includes(fieldName) || this.graphQLMutations[fieldName]) {
      const message = `Mutation ${fieldName} could not be added to the auto schema because it collided with an existing field.`;

      if (throwError) {
        throw new Error(message);
      }

      this.log.warn(message);
      return undefined;
    }

    this.graphQLMutations[fieldName] = field;
    return field;
  }

  handleError(error) {
    if (error instanceof _node.default.Error) {
      this.log.error('Parse error: ', error);
    } else {
      this.log.error('Uncaught internal server error.', error, error.stack);
    }

    throw (0, _parseGraphQLUtils.toGraphQLError)(error);
  }

  async _initializeSchemaAndConfig() {
    const [schemaController, parseGraphQLConfig] = await Promise.all([this.databaseController.loadSchema(), this.parseGraphQLController.getGraphQLConfig()]);
    this.schemaController = schemaController;
    return {
      parseGraphQLConfig
    };
  }
  /**
   * Gets all classes found by the `schemaController`
   * minus those filtered out by the app's parseGraphQLConfig.
   */


  async _getClassesForSchema(parseGraphQLConfig) {
    const {
      enabledForClasses,
      disabledForClasses
    } = parseGraphQLConfig;
    const allClasses = await this.schemaController.getAllClasses();

    if (Array.isArray(enabledForClasses) || Array.isArray(disabledForClasses)) {
      let includedClasses = allClasses;

      if (enabledForClasses) {
        includedClasses = allClasses.filter(clazz => {
          return enabledForClasses.includes(clazz.className);
        });
      }

      if (disabledForClasses) {
        // Classes included in `enabledForClasses` that
        // are also present in `disabledForClasses` will
        // still be filtered out
        includedClasses = includedClasses.filter(clazz => {
          return !disabledForClasses.includes(clazz.className);
        });
      }

      this.isUsersClassDisabled = !includedClasses.some(clazz => {
        return clazz.className === '_User';
      });
      return includedClasses;
    } else {
      return allClasses;
    }
  }
  /**
   * This method returns a list of tuples
   * that provide the parseClass along with
   * its parseClassConfig where provided.
   */


  _getParseClassesWithConfig(parseClasses, parseGraphQLConfig) {
    const {
      classConfigs
    } = parseGraphQLConfig; // Make sures that the default classes and classes that
    // starts with capitalized letter will be generated first.

    const sortClasses = (a, b) => {
      a = a.className;
      b = b.className;

      if (a[0] === '_') {
        if (b[0] !== '_') {
          return -1;
        }
      }

      if (b[0] === '_') {
        if (a[0] !== '_') {
          return 1;
        }
      }

      if (a === b) {
        return 0;
      } else if (a < b) {
        return -1;
      } else {
        return 1;
      }
    };

    return parseClasses.sort(sortClasses).map(parseClass => {
      let parseClassConfig;

      if (classConfigs) {
        parseClassConfig = classConfigs.find(c => c.className === parseClass.className);
      }

      return [parseClass, parseClassConfig];
    });
  }

  async _getFunctionNames() {
    return await (0, _triggers.getFunctionNames)(this.appId).filter(functionName => {
      if (/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(functionName)) {
        return true;
      } else {
        this.log.warn(`Function ${functionName} could not be added to the auto schema because GraphQL names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/.`);
        return false;
      }
    });
  }
  /**
   * Checks for changes to the parseClasses
   * objects (i.e. database schema) or to
   * the parseGraphQLConfig object. If no
   * changes are found, return true;
   */


  _hasSchemaInputChanged(params) {
    const {
      parseClasses,
      parseClassesString,
      parseGraphQLConfig,
      functionNamesString
    } = params;

    if (JSON.stringify(this.parseGraphQLConfig) === JSON.stringify(parseGraphQLConfig) && this.functionNamesString === functionNamesString) {
      if (this.parseClasses === parseClasses) {
        return false;
      }

      if (this.parseClassesString === parseClassesString) {
        this.parseClasses = parseClasses;
        return false;
      }
    }

    return true;
  }

}

exports.ParseGraphQLSchema = ParseGraphQLSchema;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9HcmFwaFFML1BhcnNlR3JhcGhRTFNjaGVtYS5qcyJdLCJuYW1lcyI6WyJSRVNFUlZFRF9HUkFQSFFMX1RZUEVfTkFNRVMiLCJSRVNFUlZFRF9HUkFQSFFMX1FVRVJZX05BTUVTIiwiUkVTRVJWRURfR1JBUEhRTF9NVVRBVElPTl9OQU1FUyIsIlBhcnNlR3JhcGhRTFNjaGVtYSIsImNvbnN0cnVjdG9yIiwicGFyYW1zIiwicGFyc2VHcmFwaFFMQ29udHJvbGxlciIsImRhdGFiYXNlQ29udHJvbGxlciIsImxvZyIsImdyYXBoUUxDdXN0b21UeXBlRGVmcyIsImFwcElkIiwibG9hZCIsInBhcnNlR3JhcGhRTENvbmZpZyIsIl9pbml0aWFsaXplU2NoZW1hQW5kQ29uZmlnIiwicGFyc2VDbGFzc2VzIiwiX2dldENsYXNzZXNGb3JTY2hlbWEiLCJwYXJzZUNsYXNzZXNTdHJpbmciLCJKU09OIiwic3RyaW5naWZ5IiwiZnVuY3Rpb25OYW1lcyIsIl9nZXRGdW5jdGlvbk5hbWVzIiwiZnVuY3Rpb25OYW1lc1N0cmluZyIsImdyYXBoUUxTY2hlbWEiLCJfaGFzU2NoZW1hSW5wdXRDaGFuZ2VkIiwicGFyc2VDbGFzc1R5cGVzIiwidmlld2VyVHlwZSIsImdyYXBoUUxBdXRvU2NoZW1hIiwiZ3JhcGhRTFR5cGVzIiwiZ3JhcGhRTFF1ZXJpZXMiLCJncmFwaFFMTXV0YXRpb25zIiwiZ3JhcGhRTFN1YnNjcmlwdGlvbnMiLCJncmFwaFFMU2NoZW1hRGlyZWN0aXZlc0RlZmluaXRpb25zIiwiZ3JhcGhRTFNjaGVtYURpcmVjdGl2ZXMiLCJyZWxheU5vZGVJbnRlcmZhY2UiLCJkZWZhdWx0R3JhcGhRTFR5cGVzIiwiZGVmYXVsdFJlbGF5U2NoZW1hIiwic2NoZW1hVHlwZXMiLCJfZ2V0UGFyc2VDbGFzc2VzV2l0aENvbmZpZyIsImZvckVhY2giLCJwYXJzZUNsYXNzIiwicGFyc2VDbGFzc0NvbmZpZyIsInBhcnNlQ2xhc3NRdWVyaWVzIiwicGFyc2VDbGFzc011dGF0aW9ucyIsImxvYWRBcnJheVJlc3VsdCIsImRlZmF1bHRHcmFwaFFMUXVlcmllcyIsImRlZmF1bHRHcmFwaFFMTXV0YXRpb25zIiwiZ3JhcGhRTFF1ZXJ5IiwidW5kZWZpbmVkIiwiT2JqZWN0Iiwia2V5cyIsImxlbmd0aCIsIkdyYXBoUUxPYmplY3RUeXBlIiwibmFtZSIsImRlc2NyaXB0aW9uIiwiZmllbGRzIiwiYWRkR3JhcGhRTFR5cGUiLCJncmFwaFFMTXV0YXRpb24iLCJncmFwaFFMU3Vic2NyaXB0aW9uIiwiR3JhcGhRTFNjaGVtYSIsInR5cGVzIiwicXVlcnkiLCJtdXRhdGlvbiIsInN1YnNjcmlwdGlvbiIsInNjaGVtYURpcmVjdGl2ZXMiLCJnZXRUeXBlTWFwIiwiY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGVNYXAiLCJmaW5kQW5kUmVwbGFjZUxhc3RUeXBlIiwicGFyZW50Iiwia2V5IiwiZ2V0VHlwZSIsIm9mVHlwZSIsInZhbHVlcyIsImN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlIiwic3RhcnRzV2l0aCIsImF1dG9HcmFwaFFMU2NoZW1hVHlwZSIsIl90eXBlTWFwIiwiZ2V0RmllbGRzIiwiZmllbGQiLCJfZmllbGRzIiwic2NoZW1hcyIsIm1lcmdlRGlyZWN0aXZlcyIsImRpcmVjdGl2ZXNEZWZpbml0aW9uc1NjaGVtYSIsImF1dG9TY2hlbWEiLCJzdGl0Y2hTY2hlbWFzIiwiZ3JhcGhRTFNjaGVtYVR5cGVNYXAiLCJncmFwaFFMU2NoZW1hVHlwZU5hbWUiLCJncmFwaFFMU2NoZW1hVHlwZSIsImRlZmluaXRpb25zIiwiZ3JhcGhRTEN1c3RvbVR5cGVEZWYiLCJmaW5kIiwiZGVmaW5pdGlvbiIsInZhbHVlIiwiZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZE1hcCIsImdyYXBoUUxTY2hlbWFUeXBlRmllbGROYW1lIiwiZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZCIsImFzdE5vZGUiLCJTY2hlbWFEaXJlY3RpdmVWaXNpdG9yIiwidmlzaXRTY2hlbWFEaXJlY3RpdmVzIiwidHlwZSIsInRocm93RXJyb3IiLCJpZ25vcmVSZXNlcnZlZCIsImlnbm9yZUNvbm5lY3Rpb24iLCJpbmNsdWRlcyIsImV4aXN0aW5nVHlwZSIsImVuZHNXaXRoIiwibWVzc2FnZSIsIkVycm9yIiwid2FybiIsInB1c2giLCJhZGRHcmFwaFFMUXVlcnkiLCJmaWVsZE5hbWUiLCJhZGRHcmFwaFFMTXV0YXRpb24iLCJoYW5kbGVFcnJvciIsImVycm9yIiwiUGFyc2UiLCJzdGFjayIsInNjaGVtYUNvbnRyb2xsZXIiLCJQcm9taXNlIiwiYWxsIiwibG9hZFNjaGVtYSIsImdldEdyYXBoUUxDb25maWciLCJlbmFibGVkRm9yQ2xhc3NlcyIsImRpc2FibGVkRm9yQ2xhc3NlcyIsImFsbENsYXNzZXMiLCJnZXRBbGxDbGFzc2VzIiwiQXJyYXkiLCJpc0FycmF5IiwiaW5jbHVkZWRDbGFzc2VzIiwiZmlsdGVyIiwiY2xhenoiLCJjbGFzc05hbWUiLCJpc1VzZXJzQ2xhc3NEaXNhYmxlZCIsInNvbWUiLCJjbGFzc0NvbmZpZ3MiLCJzb3J0Q2xhc3NlcyIsImEiLCJiIiwic29ydCIsIm1hcCIsImMiLCJmdW5jdGlvbk5hbWUiLCJ0ZXN0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7Ozs7Ozs7Ozs7O0FBRUEsTUFBTUEsMkJBQTJCLEdBQUcsQ0FDbEMsUUFEa0MsRUFFbEMsU0FGa0MsRUFHbEMsS0FIa0MsRUFJbEMsT0FKa0MsRUFLbEMsSUFMa0MsRUFNbEMsYUFOa0MsRUFPbEMsT0FQa0MsRUFRbEMsVUFSa0MsRUFTbEMsY0FUa0MsRUFVbEMsaUJBVmtDLEVBV2xDLG1CQVhrQyxFQVlsQyxRQVprQyxFQWFsQyxhQWJrQyxFQWNsQyxlQWRrQyxFQWVsQyxZQWZrQyxFQWdCbEMsY0FoQmtDLEVBaUJsQyxhQWpCa0MsRUFrQmxDLGVBbEJrQyxF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RDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0VySCxFQUFBQSxzQkFBc0IsQ0FBQ2xCLE1BQUQsRUFLVjtBQUNWLFVBQU07QUFBRVMsTUFBQUEsWUFBRjtBQUFnQkUsTUFBQUEsa0JBQWhCO0FBQW9DSixNQUFBQSxrQkFBcEM7QUFBd0RTLE1BQUFBO0FBQXhELFFBQWdGaEIsTUFBdEY7O0FBRUEsUUFDRVksSUFBSSxDQUFDQyxTQUFMLENBQWUsS0FBS04sa0JBQXBCLE1BQTRDSyxJQUFJLENBQUNDLFNBQUwsQ0FBZU4sa0JBQWYsQ0FBNUMsSUFDQSxLQUFLUyxtQkFBTCxLQUE2QkEsbUJBRi9CLEVBR0U7QUFDQSxVQUFJLEtBQUtQLFlBQUwsS0FBc0JBLFlBQTFCLEVBQXdDO0FBQ3RDLGVBQU8sS0FBUDtBQUNEOztBQUVELFVBQUksS0FBS0Usa0JBQUwsS0FBNEJBLGtCQUFoQyxFQUFvRDtBQUNsRCxhQUFLRixZQUFMLEdBQW9CQSxZQUFwQjtBQUNBLGVBQU8sS0FBUDtBQUNEO0FBQ0Y7O0FBRUQsV0FBTyxJQUFQO0FBQ0Q7O0FBdGFzQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQYXJzZSBmcm9tICdwYXJzZS9ub2RlJztcbmltcG9ydCB7IEdyYXBoUUxTY2hlbWEsIEdyYXBoUUxPYmplY3RUeXBlLCBEb2N1bWVudE5vZGUsIEdyYXBoUUxOYW1lZFR5cGUgfSBmcm9tICdncmFwaHFsJztcbmltcG9ydCB7IHN0aXRjaFNjaGVtYXMgfSBmcm9tICdAZ3JhcGhxbC10b29scy9zdGl0Y2gnO1xuaW1wb3J0IHsgU2NoZW1hRGlyZWN0aXZlVmlzaXRvciB9IGZyb20gJ0BncmFwaHFsLXRvb2xzL3V0aWxzJztcbmltcG9ydCByZXF1aXJlZFBhcmFtZXRlciBmcm9tICcuLi9yZXF1aXJlZFBhcmFtZXRlcic7XG5pbXBvcnQgKiBhcyBkZWZhdWx0R3JhcGhRTFR5cGVzIGZyb20gJy4vbG9hZGVycy9kZWZhdWx0R3JhcGhRTFR5cGVzJztcbmltcG9ydCAqIGFzIHBhcnNlQ2xhc3NUeXBlcyBmcm9tICcuL2xvYWRlcnMvcGFyc2VDbGFzc1R5cGVzJztcbmltcG9ydCAqIGFzIHBhcnNlQ2xhc3NRdWVyaWVzIGZyb20gJy4vbG9hZGVycy9wYXJzZUNsYXNzUXVlcmllcyc7XG5pbXBvcnQgKiBhcyBwYXJzZUNsYXNzTXV0YXRpb25zIGZyb20gJy4vbG9hZGVycy9wYXJzZUNsYXNzTXV0YXRpb25zJztcbmltcG9ydCAqIGFzIGRlZmF1bHRHcmFwaFFMUXVlcmllcyBmcm9tICcuL2xvYWRlcnMvZGVmYXVsdEdyYXBoUUxRdWVyaWVzJztcbmltcG9ydCAqIGFzIGRlZmF1bHRHcmFwaFFMTXV0YXRpb25zIGZyb20gJy4vbG9hZGVycy9kZWZhdWx0R3JhcGhRTE11dGF0aW9ucyc7XG5pbXBvcnQgUGFyc2VHcmFwaFFMQ29udHJvbGxlciwgeyBQYXJzZUdyYXBoUUxDb25maWcgfSBmcm9tICcuLi9Db250cm9sbGVycy9QYXJzZUdyYXBoUUxDb250cm9sbGVyJztcbmltcG9ydCBEYXRhYmFzZUNvbnRyb2xsZXIgZnJvbSAnLi4vQ29udHJvbGxlcnMvRGF0YWJhc2VDb250cm9sbGVyJztcbmltcG9ydCB7IHRvR3JhcGhRTEVycm9yIH0gZnJvbSAnLi9wYXJzZUdyYXBoUUxVdGlscyc7XG5pbXBvcnQgKiBhcyBzY2hlbWFEaXJlY3RpdmVzIGZyb20gJy4vbG9hZGVycy9zY2hlbWFEaXJlY3RpdmVzJztcbmltcG9ydCAqIGFzIHNjaGVtYVR5cGVzIGZyb20gJy4vbG9hZGVycy9zY2hlbWFUeXBlcyc7XG5pbXBvcnQgeyBnZXRGdW5jdGlvbk5hbWVzIH0gZnJvbSAnLi4vdHJpZ2dlcnMnO1xuaW1wb3J0ICogYXMgZGVmYXVsdFJlbGF5U2NoZW1hIGZyb20gJy4vbG9hZGVycy9kZWZhdWx0UmVsYXlTY2hlbWEnO1xuXG5jb25zdCBSRVNFUlZFRF9HUkFQSFFMX1RZUEVfTkFNRVMgPSBbXG4gICdTdHJpbmcnLFxuICAnQm9vbGVhbicsXG4gICdJbnQnLFxuICAnRmxvYXQnLFxuICAnSUQnLFxuICAnQXJyYXlSZXN1bHQnLFxuICAnUXVlcnknLFxuICAnTXV0YXRpb24nLFxuICAnU3Vic2NyaXB0aW9uJyxcbiAgJ0NyZWF0ZUZpbGVJbnB1dCcsXG4gICdDcmVhdGVGaWxlUGF5bG9hZCcsXG4gICdWaWV3ZXInLFxuICAnU2lnblVwSW5wdXQnLFxuICAnU2lnblVwUGF5bG9hZCcsXG4gICdMb2dJbklucHV0JyxcbiAgJ0xvZ0luUGF5bG9hZCcsXG4gICdMb2dPdXRJbnB1dCcsXG4gICdMb2dPdXRQYXlsb2FkJyxcbiAgJ0Nsb3VkQ29kZUZ1bmN0aW9uJyxcbiAgJ0NhbGxDbG91ZENvZGVJbnB1dCcsXG4gICdDYWxsQ2xvdWRDb2RlUGF5bG9hZCcsXG4gICdDcmVhdGVDbGFzc0lucHV0JyxcbiAgJ0NyZWF0ZUNsYXNzUGF5bG9hZCcsXG4gICdVcGRhdGVDbGFzc0lucHV0JyxcbiAgJ1VwZGF0ZUNsYXNzUGF5bG9hZCcsXG4gICdEZWxldGVDbGFzc0lucHV0JyxcbiAgJ0RlbGV0ZUNsYXNzUGF5bG9hZCcsXG4gICdQYWdlSW5mbycsXG5dO1xuY29uc3QgUkVTRVJWRURfR1JBUEhRTF9RVUVSWV9OQU1FUyA9IFsnaGVhbHRoJywgJ3ZpZXdlcicsICdjbGFzcycsICdjbGFzc2VzJ107XG5jb25zdCBSRVNFUlZFRF9HUkFQSFFMX01VVEFUSU9OX05BTUVTID0gW1xuICAnc2lnblVwJyxcbiAgJ2xvZ0luJyxcbiAgJ2xvZ091dCcsXG4gICdjcmVhdGVGaWxlJyxcbiAgJ2NhbGxDbG91ZENvZGUnLFxuICAnY3JlYXRlQ2xhc3MnLFxuICAndXBkYXRlQ2xhc3MnLFxuICAnZGVsZXRlQ2xhc3MnLFxuXTtcblxuY2xhc3MgUGFyc2VHcmFwaFFMU2NoZW1hIHtcbiAgZGF0YWJhc2VDb250cm9sbGVyOiBEYXRhYmFzZUNvbnRyb2xsZXI7XG4gIHBhcnNlR3JhcGhRTENvbnRyb2xsZXI6IFBhcnNlR3JhcGhRTENvbnRyb2xsZXI7XG4gIHBhcnNlR3JhcGhRTENvbmZpZzogUGFyc2VHcmFwaFFMQ29uZmlnO1xuICBsb2c6IGFueTtcbiAgYXBwSWQ6IHN0cmluZztcbiAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzOiA/KHN0cmluZyB8IEdyYXBoUUxTY2hlbWEgfCBEb2N1bWVudE5vZGUgfCBHcmFwaFFMTmFtZWRUeXBlW10pO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHBhcmFtczoge1xuICAgICAgZGF0YWJhc2VDb250cm9sbGVyOiBEYXRhYmFzZUNvbnRyb2xsZXIsXG4gICAgICBwYXJzZUdyYXBoUUxDb250cm9sbGVyOiBQYXJzZUdyYXBoUUxDb250cm9sbGVyLFxuICAgICAgbG9nOiBhbnksXG4gICAgICBhcHBJZDogc3RyaW5nLFxuICAgICAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzOiA/KHN0cmluZyB8IEdyYXBoUUxTY2hlbWEgfCBEb2N1bWVudE5vZGUgfCBHcmFwaFFMTmFtZWRUeXBlW10pLFxuICAgIH0gPSB7fVxuICApIHtcbiAgICB0aGlzLnBhcnNlR3JhcGhRTENvbnRyb2xsZXIgPVxuICAgICAgcGFyYW1zLnBhcnNlR3JhcGhRTENvbnRyb2xsZXIgfHxcbiAgICAgIHJlcXVpcmVkUGFyYW1ldGVyKCdZb3UgbXVzdCBwcm92aWRlIGEgcGFyc2VHcmFwaFFMQ29udHJvbGxlciBpbnN0YW5jZSEnKTtcbiAgICB0aGlzLmRhdGFiYXNlQ29udHJvbGxlciA9XG4gICAgICBwYXJhbXMuZGF0YWJhc2VDb250cm9sbGVyIHx8XG4gICAgICByZXF1aXJlZFBhcmFtZXRlcignWW91IG11c3QgcHJvdmlkZSBhIGRhdGFiYXNlQ29udHJvbGxlciBpbnN0YW5jZSEnKTtcbiAgICB0aGlzLmxvZyA9IHBhcmFtcy5sb2cgfHwgcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYSBsb2cgaW5zdGFuY2UhJyk7XG4gICAgdGhpcy5ncmFwaFFMQ3VzdG9tVHlwZURlZnMgPSBwYXJhbXMuZ3JhcGhRTEN1c3RvbVR5cGVEZWZzO1xuICAgIHRoaXMuYXBwSWQgPSBwYXJhbXMuYXBwSWQgfHwgcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgdGhlIGFwcElkIScpO1xuICB9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICBjb25zdCB7IHBhcnNlR3JhcGhRTENvbmZpZyB9ID0gYXdhaXQgdGhpcy5faW5pdGlhbGl6ZVNjaGVtYUFuZENvbmZpZygpO1xuICAgIGNvbnN0IHBhcnNlQ2xhc3NlcyA9IGF3YWl0IHRoaXMuX2dldENsYXNzZXNGb3JTY2hlbWEocGFyc2VHcmFwaFFMQ29uZmlnKTtcbiAgICBjb25zdCBwYXJzZUNsYXNzZXNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeShwYXJzZUNsYXNzZXMpO1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZXMgPSBhd2FpdCB0aGlzLl9nZXRGdW5jdGlvbk5hbWVzKCk7XG4gICAgY29uc3QgZnVuY3Rpb25OYW1lc1N0cmluZyA9IEpTT04uc3RyaW5naWZ5KGZ1bmN0aW9uTmFtZXMpO1xuXG4gICAgaWYgKFxuICAgICAgdGhpcy5ncmFwaFFMU2NoZW1hICYmXG4gICAgICAhdGhpcy5faGFzU2NoZW1hSW5wdXRDaGFuZ2VkKHtcbiAgICAgICAgcGFyc2VDbGFzc2VzLFxuICAgICAgICBwYXJzZUNsYXNzZXNTdHJpbmcsXG4gICAgICAgIHBhcnNlR3JhcGhRTENvbmZpZyxcbiAgICAgICAgZnVuY3Rpb25OYW1lc1N0cmluZyxcbiAgICAgIH0pXG4gICAgKSB7XG4gICAgICByZXR1cm4gdGhpcy5ncmFwaFFMU2NoZW1hO1xuICAgIH1cblxuICAgIHRoaXMucGFyc2VDbGFzc2VzID0gcGFyc2VDbGFzc2VzO1xuICAgIHRoaXMucGFyc2VDbGFzc2VzU3RyaW5nID0gcGFyc2VDbGFzc2VzU3RyaW5nO1xuICAgIHRoaXMucGFyc2VHcmFwaFFMQ29uZmlnID0gcGFyc2VHcmFwaFFMQ29uZmlnO1xuICAgIHRoaXMuZnVuY3Rpb25OYW1lcyA9IGZ1bmN0aW9uTmFtZXM7XG4gICAgdGhpcy5mdW5jdGlvbk5hbWVzU3RyaW5nID0gZnVuY3Rpb25OYW1lc1N0cmluZztcbiAgICB0aGlzLnBhcnNlQ2xhc3NUeXBlcyA9IHt9O1xuICAgIHRoaXMudmlld2VyVHlwZSA9IG51bGw7XG4gICAgdGhpcy5ncmFwaFFMQXV0b1NjaGVtYSA9IG51bGw7XG4gICAgdGhpcy5ncmFwaFFMU2NoZW1hID0gbnVsbDtcbiAgICB0aGlzLmdyYXBoUUxUeXBlcyA9IFtdO1xuICAgIHRoaXMuZ3JhcGhRTFF1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLmdyYXBoUUxNdXRhdGlvbnMgPSB7fTtcbiAgICB0aGlzLmdyYXBoUUxTdWJzY3JpcHRpb25zID0ge307XG4gICAgdGhpcy5ncmFwaFFMU2NoZW1hRGlyZWN0aXZlc0RlZmluaXRpb25zID0gbnVsbDtcbiAgICB0aGlzLmdyYXBoUUxTY2hlbWFEaXJlY3RpdmVzID0ge307XG4gICAgdGhpcy5yZWxheU5vZGVJbnRlcmZhY2UgPSBudWxsO1xuXG4gICAgZGVmYXVsdEdyYXBoUUxUeXBlcy5sb2FkKHRoaXMpO1xuICAgIGRlZmF1bHRSZWxheVNjaGVtYS5sb2FkKHRoaXMpO1xuICAgIHNjaGVtYVR5cGVzLmxvYWQodGhpcyk7XG5cbiAgICB0aGlzLl9nZXRQYXJzZUNsYXNzZXNXaXRoQ29uZmlnKHBhcnNlQ2xhc3NlcywgcGFyc2VHcmFwaFFMQ29uZmlnKS5mb3JFYWNoKFxuICAgICAgKFtwYXJzZUNsYXNzLCBwYXJzZUNsYXNzQ29uZmlnXSkgPT4ge1xuICAgICAgICBwYXJzZUNsYXNzVHlwZXMubG9hZCh0aGlzLCBwYXJzZUNsYXNzLCBwYXJzZUNsYXNzQ29uZmlnKTtcbiAgICAgICAgcGFyc2VDbGFzc1F1ZXJpZXMubG9hZCh0aGlzLCBwYXJzZUNsYXNzLCBwYXJzZUNsYXNzQ29uZmlnKTtcbiAgICAgICAgcGFyc2VDbGFzc011dGF0aW9ucy5sb2FkKHRoaXMsIHBhcnNlQ2xhc3MsIHBhcnNlQ2xhc3NDb25maWcpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBkZWZhdWx0R3JhcGhRTFR5cGVzLmxvYWRBcnJheVJlc3VsdCh0aGlzLCBwYXJzZUNsYXNzZXMpO1xuICAgIGRlZmF1bHRHcmFwaFFMUXVlcmllcy5sb2FkKHRoaXMpO1xuICAgIGRlZmF1bHRHcmFwaFFMTXV0YXRpb25zLmxvYWQodGhpcyk7XG5cbiAgICBsZXQgZ3JhcGhRTFF1ZXJ5ID0gdW5kZWZpbmVkO1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLmdyYXBoUUxRdWVyaWVzKS5sZW5ndGggPiAwKSB7XG4gICAgICBncmFwaFFMUXVlcnkgPSBuZXcgR3JhcGhRTE9iamVjdFR5cGUoe1xuICAgICAgICBuYW1lOiAnUXVlcnknLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1F1ZXJ5IGlzIHRoZSB0b3AgbGV2ZWwgdHlwZSBmb3IgcXVlcmllcy4nLFxuICAgICAgICBmaWVsZHM6IHRoaXMuZ3JhcGhRTFF1ZXJpZXMsXG4gICAgICB9KTtcbiAgICAgIHRoaXMuYWRkR3JhcGhRTFR5cGUoZ3JhcGhRTFF1ZXJ5LCB0cnVlLCB0cnVlKTtcbiAgICB9XG5cbiAgICBsZXQgZ3JhcGhRTE11dGF0aW9uID0gdW5kZWZpbmVkO1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLmdyYXBoUUxNdXRhdGlvbnMpLmxlbmd0aCA+IDApIHtcbiAgICAgIGdyYXBoUUxNdXRhdGlvbiA9IG5ldyBHcmFwaFFMT2JqZWN0VHlwZSh7XG4gICAgICAgIG5hbWU6ICdNdXRhdGlvbicsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTXV0YXRpb24gaXMgdGhlIHRvcCBsZXZlbCB0eXBlIGZvciBtdXRhdGlvbnMuJyxcbiAgICAgICAgZmllbGRzOiB0aGlzLmdyYXBoUUxNdXRhdGlvbnMsXG4gICAgICB9KTtcbiAgICAgIHRoaXMuYWRkR3JhcGhRTFR5cGUoZ3JhcGhRTE11dGF0aW9uLCB0cnVlLCB0cnVlKTtcbiAgICB9XG5cbiAgICBsZXQgZ3JhcGhRTFN1YnNjcmlwdGlvbiA9IHVuZGVmaW5lZDtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5ncmFwaFFMU3Vic2NyaXB0aW9ucykubGVuZ3RoID4gMCkge1xuICAgICAgZ3JhcGhRTFN1YnNjcmlwdGlvbiA9IG5ldyBHcmFwaFFMT2JqZWN0VHlwZSh7XG4gICAgICAgIG5hbWU6ICdTdWJzY3JpcHRpb24nLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1N1YnNjcmlwdGlvbiBpcyB0aGUgdG9wIGxldmVsIHR5cGUgZm9yIHN1YnNjcmlwdGlvbnMuJyxcbiAgICAgICAgZmllbGRzOiB0aGlzLmdyYXBoUUxTdWJzY3JpcHRpb25zLFxuICAgICAgfSk7XG4gICAgICB0aGlzLmFkZEdyYXBoUUxUeXBlKGdyYXBoUUxTdWJzY3JpcHRpb24sIHRydWUsIHRydWUpO1xuICAgIH1cblxuICAgIHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEgPSBuZXcgR3JhcGhRTFNjaGVtYSh7XG4gICAgICB0eXBlczogdGhpcy5ncmFwaFFMVHlwZXMsXG4gICAgICBxdWVyeTogZ3JhcGhRTFF1ZXJ5LFxuICAgICAgbXV0YXRpb246IGdyYXBoUUxNdXRhdGlvbixcbiAgICAgIHN1YnNjcmlwdGlvbjogZ3JhcGhRTFN1YnNjcmlwdGlvbixcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcykge1xuICAgICAgc2NoZW1hRGlyZWN0aXZlcy5sb2FkKHRoaXMpO1xuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuZ3JhcGhRTEN1c3RvbVR5cGVEZWZzLmdldFR5cGVNYXAgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY29uc3QgY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGVNYXAgPSB0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcy5nZXRUeXBlTWFwKCk7XG4gICAgICAgIGNvbnN0IGZpbmRBbmRSZXBsYWNlTGFzdFR5cGUgPSAocGFyZW50LCBrZXkpID0+IHtcbiAgICAgICAgICBpZiAocGFyZW50W2tleV0ubmFtZSkge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICB0aGlzLmdyYXBoUUxBdXRvU2NoZW1hLmdldFR5cGUocGFyZW50W2tleV0ubmFtZSkgJiZcbiAgICAgICAgICAgICAgdGhpcy5ncmFwaFFMQXV0b1NjaGVtYS5nZXRUeXBlKHBhcmVudFtrZXldLm5hbWUpICE9PSBwYXJlbnRba2V5XVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIC8vIFRvIGF2b2lkIHVucmVzb2x2ZWQgZmllbGQgb24gb3ZlcmxvYWRlZCBzY2hlbWFcbiAgICAgICAgICAgICAgLy8gcmVwbGFjZSB0aGUgZmluYWwgdHlwZSB3aXRoIHRoZSBhdXRvIHNjaGVtYSBvbmVcbiAgICAgICAgICAgICAgcGFyZW50W2tleV0gPSB0aGlzLmdyYXBoUUxBdXRvU2NoZW1hLmdldFR5cGUocGFyZW50W2tleV0ubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChwYXJlbnRba2V5XS5vZlR5cGUpIHtcbiAgICAgICAgICAgICAgZmluZEFuZFJlcGxhY2VMYXN0VHlwZShwYXJlbnRba2V5XSwgJ29mVHlwZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgT2JqZWN0LnZhbHVlcyhjdXN0b21HcmFwaFFMU2NoZW1hVHlwZU1hcCkuZm9yRWFjaChjdXN0b21HcmFwaFFMU2NoZW1hVHlwZSA9PiB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlIHx8XG4gICAgICAgICAgICAhY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUubmFtZSB8fFxuICAgICAgICAgICAgY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUubmFtZS5zdGFydHNXaXRoKCdfXycpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGF1dG9HcmFwaFFMU2NoZW1hVHlwZSA9IHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEuZ2V0VHlwZShcbiAgICAgICAgICAgIGN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlLm5hbWVcbiAgICAgICAgICApO1xuICAgICAgICAgIGlmICghYXV0b0dyYXBoUUxTY2hlbWFUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLmdyYXBoUUxBdXRvU2NoZW1hLl90eXBlTWFwW2N1c3RvbUdyYXBoUUxTY2hlbWFUeXBlLm5hbWVdID0gY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LnZhbHVlcyhjdXN0b21HcmFwaFFMU2NoZW1hVHlwZU1hcCkuZm9yRWFjaChjdXN0b21HcmFwaFFMU2NoZW1hVHlwZSA9PiB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlIHx8XG4gICAgICAgICAgICAhY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUubmFtZSB8fFxuICAgICAgICAgICAgY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUubmFtZS5zdGFydHNXaXRoKCdfXycpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGF1dG9HcmFwaFFMU2NoZW1hVHlwZSA9IHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEuZ2V0VHlwZShcbiAgICAgICAgICAgIGN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlLm5hbWVcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaWYgKGF1dG9HcmFwaFFMU2NoZW1hVHlwZSAmJiB0eXBlb2YgY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUuZ2V0RmllbGRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBPYmplY3QudmFsdWVzKGN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlLmdldEZpZWxkcygpKS5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICAgICAgICAgICAgZmluZEFuZFJlcGxhY2VMYXN0VHlwZShmaWVsZCwgJ3R5cGUnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYXV0b0dyYXBoUUxTY2hlbWFUeXBlLl9maWVsZHMgPSB7XG4gICAgICAgICAgICAgIC4uLmF1dG9HcmFwaFFMU2NoZW1hVHlwZS5nZXRGaWVsZHMoKSxcbiAgICAgICAgICAgICAgLi4uY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUuZ2V0RmllbGRzKCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYSA9IHN0aXRjaFNjaGVtYXMoe1xuICAgICAgICAgIHNjaGVtYXM6IFt0aGlzLmdyYXBoUUxTY2hlbWFEaXJlY3RpdmVzRGVmaW5pdGlvbnMsIHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWFdLFxuICAgICAgICAgIG1lcmdlRGlyZWN0aXZlczogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLmdyYXBoUUxTY2hlbWEgPSBhd2FpdCB0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcyh7XG4gICAgICAgICAgZGlyZWN0aXZlc0RlZmluaXRpb25zU2NoZW1hOiB0aGlzLmdyYXBoUUxTY2hlbWFEaXJlY3RpdmVzRGVmaW5pdGlvbnMsXG4gICAgICAgICAgYXV0b1NjaGVtYTogdGhpcy5ncmFwaFFMQXV0b1NjaGVtYSxcbiAgICAgICAgICBzdGl0Y2hTY2hlbWFzLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYSA9IHN0aXRjaFNjaGVtYXMoe1xuICAgICAgICAgIHNjaGVtYXM6IFtcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYURpcmVjdGl2ZXNEZWZpbml0aW9ucyxcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEsXG4gICAgICAgICAgICB0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIG1lcmdlRGlyZWN0aXZlczogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGdyYXBoUUxTY2hlbWFUeXBlTWFwID0gdGhpcy5ncmFwaFFMU2NoZW1hLmdldFR5cGVNYXAoKTtcbiAgICAgIE9iamVjdC5rZXlzKGdyYXBoUUxTY2hlbWFUeXBlTWFwKS5mb3JFYWNoKGdyYXBoUUxTY2hlbWFUeXBlTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IGdyYXBoUUxTY2hlbWFUeXBlID0gZ3JhcGhRTFNjaGVtYVR5cGVNYXBbZ3JhcGhRTFNjaGVtYVR5cGVOYW1lXTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHR5cGVvZiBncmFwaFFMU2NoZW1hVHlwZS5nZXRGaWVsZHMgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICB0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcy5kZWZpbml0aW9uc1xuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCBncmFwaFFMQ3VzdG9tVHlwZURlZiA9IHRoaXMuZ3JhcGhRTEN1c3RvbVR5cGVEZWZzLmRlZmluaXRpb25zLmZpbmQoXG4gICAgICAgICAgICBkZWZpbml0aW9uID0+IGRlZmluaXRpb24ubmFtZS52YWx1ZSA9PT0gZ3JhcGhRTFNjaGVtYVR5cGVOYW1lXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoZ3JhcGhRTEN1c3RvbVR5cGVEZWYpIHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoUUxTY2hlbWFUeXBlRmllbGRNYXAgPSBncmFwaFFMU2NoZW1hVHlwZS5nZXRGaWVsZHMoKTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGdyYXBoUUxTY2hlbWFUeXBlRmllbGRNYXApLmZvckVhY2goZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZE5hbWUgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBncmFwaFFMU2NoZW1hVHlwZUZpZWxkID0gZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZE1hcFtncmFwaFFMU2NoZW1hVHlwZUZpZWxkTmFtZV07XG4gICAgICAgICAgICAgIGlmICghZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZC5hc3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXN0Tm9kZSA9IGdyYXBoUUxDdXN0b21UeXBlRGVmLmZpZWxkcy5maW5kKFxuICAgICAgICAgICAgICAgICAgZmllbGQgPT4gZmllbGQubmFtZS52YWx1ZSA9PT0gZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZE5hbWVcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmIChhc3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgICBncmFwaFFMU2NoZW1hVHlwZUZpZWxkLmFzdE5vZGUgPSBhc3ROb2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgU2NoZW1hRGlyZWN0aXZlVmlzaXRvci52aXNpdFNjaGVtYURpcmVjdGl2ZXMoXG4gICAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYSxcbiAgICAgICAgdGhpcy5ncmFwaFFMU2NoZW1hRGlyZWN0aXZlc1xuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ncmFwaFFMU2NoZW1hID0gdGhpcy5ncmFwaFFMQXV0b1NjaGVtYTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5ncmFwaFFMU2NoZW1hO1xuICB9XG5cbiAgYWRkR3JhcGhRTFR5cGUodHlwZSwgdGhyb3dFcnJvciA9IGZhbHNlLCBpZ25vcmVSZXNlcnZlZCA9IGZhbHNlLCBpZ25vcmVDb25uZWN0aW9uID0gZmFsc2UpIHtcbiAgICBpZiAoXG4gICAgICAoIWlnbm9yZVJlc2VydmVkICYmIFJFU0VSVkVEX0dSQVBIUUxfVFlQRV9OQU1FUy5pbmNsdWRlcyh0eXBlLm5hbWUpKSB8fFxuICAgICAgdGhpcy5ncmFwaFFMVHlwZXMuZmluZChleGlzdGluZ1R5cGUgPT4gZXhpc3RpbmdUeXBlLm5hbWUgPT09IHR5cGUubmFtZSkgfHxcbiAgICAgICghaWdub3JlQ29ubmVjdGlvbiAmJiB0eXBlLm5hbWUuZW5kc1dpdGgoJ0Nvbm5lY3Rpb24nKSlcbiAgICApIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgVHlwZSAke3R5cGUubmFtZX0gY291bGQgbm90IGJlIGFkZGVkIHRvIHRoZSBhdXRvIHNjaGVtYSBiZWNhdXNlIGl0IGNvbGxpZGVkIHdpdGggYW4gZXhpc3RpbmcgdHlwZS5gO1xuICAgICAgaWYgKHRocm93RXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2cud2FybihtZXNzYWdlKTtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHRoaXMuZ3JhcGhRTFR5cGVzLnB1c2godHlwZSk7XG4gICAgcmV0dXJuIHR5cGU7XG4gIH1cblxuICBhZGRHcmFwaFFMUXVlcnkoZmllbGROYW1lLCBmaWVsZCwgdGhyb3dFcnJvciA9IGZhbHNlLCBpZ25vcmVSZXNlcnZlZCA9IGZhbHNlKSB7XG4gICAgaWYgKFxuICAgICAgKCFpZ25vcmVSZXNlcnZlZCAmJiBSRVNFUlZFRF9HUkFQSFFMX1FVRVJZX05BTUVTLmluY2x1ZGVzKGZpZWxkTmFtZSkpIHx8XG4gICAgICB0aGlzLmdyYXBoUUxRdWVyaWVzW2ZpZWxkTmFtZV1cbiAgICApIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgUXVlcnkgJHtmaWVsZE5hbWV9IGNvdWxkIG5vdCBiZSBhZGRlZCB0byB0aGUgYXV0byBzY2hlbWEgYmVjYXVzZSBpdCBjb2xsaWRlZCB3aXRoIGFuIGV4aXN0aW5nIGZpZWxkLmA7XG4gICAgICBpZiAodGhyb3dFcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvZy53YXJuKG1lc3NhZ2UpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgdGhpcy5ncmFwaFFMUXVlcmllc1tmaWVsZE5hbWVdID0gZmllbGQ7XG4gICAgcmV0dXJuIGZpZWxkO1xuICB9XG5cbiAgYWRkR3JhcGhRTE11dGF0aW9uKGZpZWxkTmFtZSwgZmllbGQsIHRocm93RXJyb3IgPSBmYWxzZSwgaWdub3JlUmVzZXJ2ZWQgPSBmYWxzZSkge1xuICAgIGlmIChcbiAgICAgICghaWdub3JlUmVzZXJ2ZWQgJiYgUkVTRVJWRURfR1JBUEhRTF9NVVRBVElPTl9OQU1FUy5pbmNsdWRlcyhmaWVsZE5hbWUpKSB8fFxuICAgICAgdGhpcy5ncmFwaFFMTXV0YXRpb25zW2ZpZWxkTmFtZV1cbiAgICApIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgTXV0YXRpb24gJHtmaWVsZE5hbWV9IGNvdWxkIG5vdCBiZSBhZGRlZCB0byB0aGUgYXV0byBzY2hlbWEgYmVjYXVzZSBpdCBjb2xsaWRlZCB3aXRoIGFuIGV4aXN0aW5nIGZpZWxkLmA7XG4gICAgICBpZiAodGhyb3dFcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvZy53YXJuKG1lc3NhZ2UpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgdGhpcy5ncmFwaFFMTXV0YXRpb25zW2ZpZWxkTmFtZV0gPSBmaWVsZDtcbiAgICByZXR1cm4gZmllbGQ7XG4gIH1cblxuICBoYW5kbGVFcnJvcihlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFBhcnNlLkVycm9yKSB7XG4gICAgICB0aGlzLmxvZy5lcnJvcignUGFyc2UgZXJyb3I6ICcsIGVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2cuZXJyb3IoJ1VuY2F1Z2h0IGludGVybmFsIHNlcnZlciBlcnJvci4nLCBlcnJvciwgZXJyb3Iuc3RhY2spO1xuICAgIH1cbiAgICB0aHJvdyB0b0dyYXBoUUxFcnJvcihlcnJvcik7XG4gIH1cblxuICBhc3luYyBfaW5pdGlhbGl6ZVNjaGVtYUFuZENvbmZpZygpIHtcbiAgICBjb25zdCBbc2NoZW1hQ29udHJvbGxlciwgcGFyc2VHcmFwaFFMQ29uZmlnXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuZGF0YWJhc2VDb250cm9sbGVyLmxvYWRTY2hlbWEoKSxcbiAgICAgIHRoaXMucGFyc2VHcmFwaFFMQ29udHJvbGxlci5nZXRHcmFwaFFMQ29uZmlnKCksXG4gICAgXSk7XG5cbiAgICB0aGlzLnNjaGVtYUNvbnRyb2xsZXIgPSBzY2hlbWFDb250cm9sbGVyO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcnNlR3JhcGhRTENvbmZpZyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYWxsIGNsYXNzZXMgZm91bmQgYnkgdGhlIGBzY2hlbWFDb250cm9sbGVyYFxuICAgKiBtaW51cyB0aG9zZSBmaWx0ZXJlZCBvdXQgYnkgdGhlIGFwcCdzIHBhcnNlR3JhcGhRTENvbmZpZy5cbiAgICovXG4gIGFzeW5jIF9nZXRDbGFzc2VzRm9yU2NoZW1hKHBhcnNlR3JhcGhRTENvbmZpZzogUGFyc2VHcmFwaFFMQ29uZmlnKSB7XG4gICAgY29uc3QgeyBlbmFibGVkRm9yQ2xhc3NlcywgZGlzYWJsZWRGb3JDbGFzc2VzIH0gPSBwYXJzZUdyYXBoUUxDb25maWc7XG4gICAgY29uc3QgYWxsQ2xhc3NlcyA9IGF3YWl0IHRoaXMuc2NoZW1hQ29udHJvbGxlci5nZXRBbGxDbGFzc2VzKCk7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShlbmFibGVkRm9yQ2xhc3NlcykgfHwgQXJyYXkuaXNBcnJheShkaXNhYmxlZEZvckNsYXNzZXMpKSB7XG4gICAgICBsZXQgaW5jbHVkZWRDbGFzc2VzID0gYWxsQ2xhc3NlcztcbiAgICAgIGlmIChlbmFibGVkRm9yQ2xhc3Nlcykge1xuICAgICAgICBpbmNsdWRlZENsYXNzZXMgPSBhbGxDbGFzc2VzLmZpbHRlcihjbGF6eiA9PiB7XG4gICAgICAgICAgcmV0dXJuIGVuYWJsZWRGb3JDbGFzc2VzLmluY2x1ZGVzKGNsYXp6LmNsYXNzTmFtZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGRpc2FibGVkRm9yQ2xhc3Nlcykge1xuICAgICAgICAvLyBDbGFzc2VzIGluY2x1ZGVkIGluIGBlbmFibGVkRm9yQ2xhc3Nlc2AgdGhhdFxuICAgICAgICAvLyBhcmUgYWxzbyBwcmVzZW50IGluIGBkaXNhYmxlZEZvckNsYXNzZXNgIHdpbGxcbiAgICAgICAgLy8gc3RpbGwgYmUgZmlsdGVyZWQgb3V0XG4gICAgICAgIGluY2x1ZGVkQ2xhc3NlcyA9IGluY2x1ZGVkQ2xhc3Nlcy5maWx0ZXIoY2xhenogPT4ge1xuICAgICAgICAgIHJldHVybiAhZGlzYWJsZWRGb3JDbGFzc2VzLmluY2x1ZGVzKGNsYXp6LmNsYXNzTmFtZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmlzVXNlcnNDbGFzc0Rpc2FibGVkID0gIWluY2x1ZGVkQ2xhc3Nlcy5zb21lKGNsYXp6ID0+IHtcbiAgICAgICAgcmV0dXJuIGNsYXp6LmNsYXNzTmFtZSA9PT0gJ19Vc2VyJztcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gaW5jbHVkZWRDbGFzc2VzO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYWxsQ2xhc3NlcztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgcmV0dXJucyBhIGxpc3Qgb2YgdHVwbGVzXG4gICAqIHRoYXQgcHJvdmlkZSB0aGUgcGFyc2VDbGFzcyBhbG9uZyB3aXRoXG4gICAqIGl0cyBwYXJzZUNsYXNzQ29uZmlnIHdoZXJlIHByb3ZpZGVkLlxuICAgKi9cbiAgX2dldFBhcnNlQ2xhc3Nlc1dpdGhDb25maWcocGFyc2VDbGFzc2VzLCBwYXJzZUdyYXBoUUxDb25maWc6IFBhcnNlR3JhcGhRTENvbmZpZykge1xuICAgIGNvbnN0IHsgY2xhc3NDb25maWdzIH0gPSBwYXJzZUdyYXBoUUxDb25maWc7XG5cbiAgICAvLyBNYWtlIHN1cmVzIHRoYXQgdGhlIGRlZmF1bHQgY2xhc3NlcyBhbmQgY2xhc3NlcyB0aGF0XG4gICAgLy8gc3RhcnRzIHdpdGggY2FwaXRhbGl6ZWQgbGV0dGVyIHdpbGwgYmUgZ2VuZXJhdGVkIGZpcnN0LlxuICAgIGNvbnN0IHNvcnRDbGFzc2VzID0gKGEsIGIpID0+IHtcbiAgICAgIGEgPSBhLmNsYXNzTmFtZTtcbiAgICAgIGIgPSBiLmNsYXNzTmFtZTtcbiAgICAgIGlmIChhWzBdID09PSAnXycpIHtcbiAgICAgICAgaWYgKGJbMF0gIT09ICdfJykge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGJbMF0gPT09ICdfJykge1xuICAgICAgICBpZiAoYVswXSAhPT0gJ18nKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgfSBlbHNlIGlmIChhIDwgYikge1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHBhcnNlQ2xhc3Nlcy5zb3J0KHNvcnRDbGFzc2VzKS5tYXAocGFyc2VDbGFzcyA9PiB7XG4gICAgICBsZXQgcGFyc2VDbGFzc0NvbmZpZztcbiAgICAgIGlmIChjbGFzc0NvbmZpZ3MpIHtcbiAgICAgICAgcGFyc2VDbGFzc0NvbmZpZyA9IGNsYXNzQ29uZmlncy5maW5kKGMgPT4gYy5jbGFzc05hbWUgPT09IHBhcnNlQ2xhc3MuY2xhc3NOYW1lKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbcGFyc2VDbGFzcywgcGFyc2VDbGFzc0NvbmZpZ107XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBfZ2V0RnVuY3Rpb25OYW1lcygpIHtcbiAgICByZXR1cm4gYXdhaXQgZ2V0RnVuY3Rpb25OYW1lcyh0aGlzLmFwcElkKS5maWx0ZXIoZnVuY3Rpb25OYW1lID0+IHtcbiAgICAgIGlmICgvXltfYS16QS1aXVtfYS16QS1aMC05XSokLy50ZXN0KGZ1bmN0aW9uTmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxvZy53YXJuKFxuICAgICAgICAgIGBGdW5jdGlvbiAke2Z1bmN0aW9uTmFtZX0gY291bGQgbm90IGJlIGFkZGVkIHRvIHRoZSBhdXRvIHNjaGVtYSBiZWNhdXNlIEdyYXBoUUwgbmFtZXMgbXVzdCBtYXRjaCAvXltfYS16QS1aXVtfYS16QS1aMC05XSokLy5gXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgZm9yIGNoYW5nZXMgdG8gdGhlIHBhcnNlQ2xhc3Nlc1xuICAgKiBvYmplY3RzIChpLmUuIGRhdGFiYXNlIHNjaGVtYSkgb3IgdG9cbiAgICogdGhlIHBhcnNlR3JhcGhRTENvbmZpZyBvYmplY3QuIElmIG5vXG4gICAqIGNoYW5nZXMgYXJlIGZvdW5kLCByZXR1cm4gdHJ1ZTtcbiAgICovXG4gIF9oYXNTY2hlbWFJbnB1dENoYW5nZWQocGFyYW1zOiB7XG4gICAgcGFyc2VDbGFzc2VzOiBhbnksXG4gICAgcGFyc2VDbGFzc2VzU3RyaW5nOiBzdHJpbmcsXG4gICAgcGFyc2VHcmFwaFFMQ29uZmlnOiA/UGFyc2VHcmFwaFFMQ29uZmlnLFxuICAgIGZ1bmN0aW9uTmFtZXNTdHJpbmc6IHN0cmluZyxcbiAgfSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHsgcGFyc2VDbGFzc2VzLCBwYXJzZUNsYXNzZXNTdHJpbmcsIHBhcnNlR3JhcGhRTENvbmZpZywgZnVuY3Rpb25OYW1lc1N0cmluZyB9ID0gcGFyYW1zO1xuXG4gICAgaWYgKFxuICAgICAgSlNPTi5zdHJpbmdpZnkodGhpcy5wYXJzZUdyYXBoUUxDb25maWcpID09PSBKU09OLnN0cmluZ2lmeShwYXJzZUdyYXBoUUxDb25maWcpICYmXG4gICAgICB0aGlzLmZ1bmN0aW9uTmFtZXNTdHJpbmcgPT09IGZ1bmN0aW9uTmFtZXNTdHJpbmdcbiAgICApIHtcbiAgICAgIGlmICh0aGlzLnBhcnNlQ2xhc3NlcyA9PT0gcGFyc2VDbGFzc2VzKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMucGFyc2VDbGFzc2VzU3RyaW5nID09PSBwYXJzZUNsYXNzZXNTdHJpbmcpIHtcbiAgICAgICAgdGhpcy5wYXJzZUNsYXNzZXMgPSBwYXJzZUNsYXNzZXM7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5leHBvcnQgeyBQYXJzZUdyYXBoUUxTY2hlbWEgfTtcbiJdfQ==