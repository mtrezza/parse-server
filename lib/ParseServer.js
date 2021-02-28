"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Options = require("./Options");

var _defaults = _interopRequireDefault(require("./defaults"));

var logging = _interopRequireWildcard(require("./logger"));

var _Config = _interopRequireDefault(require("./Config"));

var _PromiseRouter = _interopRequireDefault(require("./PromiseRouter"));

var _requiredParameter = _interopRequireDefault(require("./requiredParameter"));

var _AnalyticsRouter = require("./Routers/AnalyticsRouter");

var _ClassesRouter = require("./Routers/ClassesRouter");

var _FeaturesRouter = require("./Routers/FeaturesRouter");

var _FilesRouter = require("./Routers/FilesRouter");

var _FunctionsRouter = require("./Routers/FunctionsRouter");

var _GlobalConfigRouter = require("./Routers/GlobalConfigRouter");

var _GraphQLRouter = require("./Routers/GraphQLRouter");

var _HooksRouter = require("./Routers/HooksRouter");

var _IAPValidationRouter = require("./Routers/IAPValidationRouter");

var _InstallationsRouter = require("./Routers/InstallationsRouter");

var _LogsRouter = require("./Routers/LogsRouter");

var _ParseLiveQueryServer = require("./LiveQuery/ParseLiveQueryServer");

var _PagesRouter = require("./Routers/PagesRouter");

var _PublicAPIRouter = require("./Routers/PublicAPIRouter");

var _PushRouter = require("./Routers/PushRouter");

var _CloudCodeRouter = require("./Routers/CloudCodeRouter");

var _RolesRouter = require("./Routers/RolesRouter");

var _SchemasRouter = require("./Routers/SchemasRouter");

var _SessionsRouter = require("./Routers/SessionsRouter");

var _UsersRouter = require("./Routers/UsersRouter");

var _PurgeRouter = require("./Routers/PurgeRouter");

var _AudiencesRouter = require("./Routers/AudiencesRouter");

var _AggregateRouter = require("./Routers/AggregateRouter");

var _ParseServerRESTController = require("./ParseServerRESTController");

var controllers = _interopRequireWildcard(require("./Controllers"));

var _ParseGraphQLServer = require("./GraphQL/ParseGraphQLServer");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ParseServer - open-source compatible API Server for Parse apps
var batch = require('./batch'),
    bodyParser = require('body-parser'),
    express = require('express'),
    middlewares = require('./middlewares'),
    Parse = require('parse/node').Parse,
    {
  parse
} = require('graphql'),
    path = require('path'),
    fs = require('fs');

// Mutate the Parse object to add the Cloud Code handlers
addParseCloud(); // ParseServer works like a constructor of an express app.
// https://parseplatform.org/parse-server/api/master/ParseServerOptions.html

class ParseServer {
  /**
   * @constructor
   * @param {ParseServerOptions} options the parse server initialization options
   */
  constructor(options) {
    injectDefaults(options);
    const {
      appId = (0, _requiredParameter.default)('You must provide an appId!'),
      masterKey = (0, _requiredParameter.default)('You must provide a masterKey!'),
      cloud,
      javascriptKey,
      serverURL = (0, _requiredParameter.default)('You must provide a serverURL!'),
      serverStartComplete
    } = options; // Initialize the node client SDK automatically

    Parse.initialize(appId, javascriptKey || 'unused', masterKey);
    Parse.serverURL = serverURL;
    const allControllers = controllers.getControllers(options);
    const {
      loggerController,
      databaseController,
      hooksController
    } = allControllers;
    this.config = _Config.default.put(Object.assign({}, options, allControllers));
    logging.setLogger(loggerController);
    const dbInitPromise = databaseController.performInitialization();
    const hooksLoadPromise = hooksController.load(); // Note: Tests will start to fail if any validation happens after this is called.

    Promise.all([dbInitPromise, hooksLoadPromise]).then(() => {
      if (serverStartComplete) {
        serverStartComplete();
      }
    }).catch(error => {
      if (serverStartComplete) {
        serverStartComplete(error);
      } else {
        console.error(error);
        process.exit(1);
      }
    });

    if (cloud) {
      addParseCloud();

      if (typeof cloud === 'function') {
        cloud(Parse);
      } else if (typeof cloud === 'string') {
        require(path.resolve(process.cwd(), cloud));
      } else {
        throw "argument 'cloud' must either be a string or a function";
      }
    }
  }

  get app() {
    if (!this._app) {
      this._app = ParseServer.app(this.config);
    }

    return this._app;
  }

  handleShutdown() {
    const promises = [];
    const {
      adapter: databaseAdapter
    } = this.config.databaseController;

    if (databaseAdapter && typeof databaseAdapter.handleShutdown === 'function') {
      promises.push(databaseAdapter.handleShutdown());
    }

    const {
      adapter: fileAdapter
    } = this.config.filesController;

    if (fileAdapter && typeof fileAdapter.handleShutdown === 'function') {
      promises.push(fileAdapter.handleShutdown());
    }

    const {
      adapter: cacheAdapter
    } = this.config.cacheController;

    if (cacheAdapter && typeof cacheAdapter.handleShutdown === 'function') {
      promises.push(cacheAdapter.handleShutdown());
    }

    return (promises.length > 0 ? Promise.all(promises) : Promise.resolve()).then(() => {
      if (this.config.serverCloseComplete) {
        this.config.serverCloseComplete();
      }
    });
  }
  /**
   * @static
   * Create an express app for the parse server
   * @param {Object} options let you specify the maxUploadSize when creating the express app  */


  static app(options) {
    const {
      maxUploadSize = '20mb',
      appId,
      directAccess,
      pages
    } = options; // This app serves the Parse API directly.
    // It's the equivalent of https://api.parse.com/1 in the hosted Parse API.

    var api = express(); //api.use("/apps", express.static(__dirname + "/public"));

    api.use(middlewares.allowCrossDomain(appId)); // File handling needs to be before default middlewares are applied

    api.use('/', new _FilesRouter.FilesRouter().expressRouter({
      maxUploadSize: maxUploadSize
    }));
    api.use('/health', function (req, res) {
      res.json({
        status: 'ok'
      });
    });
    api.use('/', bodyParser.urlencoded({
      extended: false
    }), pages.enableRouter ? new _PagesRouter.PagesRouter(pages).expressRouter() : new _PublicAPIRouter.PublicAPIRouter().expressRouter());
    api.use(bodyParser.json({
      type: '*/*',
      limit: maxUploadSize
    }));
    api.use(middlewares.allowMethodOverride);
    api.use(middlewares.handleParseHeaders);
    const appRouter = ParseServer.promiseRouter({
      appId
    });
    api.use(appRouter.expressRouter());
    api.use(middlewares.handleParseErrors); // run the following when not testing

    if (!process.env.TESTING) {
      //This causes tests to spew some useless warnings, so disable in test

      /* istanbul ignore next */
      process.on('uncaughtException', err => {
        if (err.code === 'EADDRINUSE') {
          // user-friendly message for this common error
          process.stderr.write(`Unable to listen on port ${err.port}. The port is already in use.`);
          process.exit(0);
        } else {
          throw err;
        }
      }); // verify the server url after a 'mount' event is received

      /* istanbul ignore next */

      api.on('mount', function () {
        ParseServer.verifyServerUrl();
      });
    }

    if (process.env.PARSE_SERVER_ENABLE_EXPERIMENTAL_DIRECT_ACCESS === '1' || directAccess) {
      Parse.CoreManager.setRESTController((0, _ParseServerRESTController.ParseServerRESTController)(appId, appRouter));
    }

    return api;
  }

  static promiseRouter({
    appId
  }) {
    const routers = [new _ClassesRouter.ClassesRouter(), new _UsersRouter.UsersRouter(), new _SessionsRouter.SessionsRouter(), new _RolesRouter.RolesRouter(), new _AnalyticsRouter.AnalyticsRouter(), new _InstallationsRouter.InstallationsRouter(), new _FunctionsRouter.FunctionsRouter(), new _SchemasRouter.SchemasRouter(), new _PushRouter.PushRouter(), new _LogsRouter.LogsRouter(), new _IAPValidationRouter.IAPValidationRouter(), new _FeaturesRouter.FeaturesRouter(), new _GlobalConfigRouter.GlobalConfigRouter(), new _GraphQLRouter.GraphQLRouter(), new _PurgeRouter.PurgeRouter(), new _HooksRouter.HooksRouter(), new _CloudCodeRouter.CloudCodeRouter(), new _AudiencesRouter.AudiencesRouter(), new _AggregateRouter.AggregateRouter()];
    const routes = routers.reduce((memo, router) => {
      return memo.concat(router.routes);
    }, []);
    const appRouter = new _PromiseRouter.default(routes, appId);
    batch.mountOnto(appRouter);
    return appRouter;
  }
  /**
   * starts the parse server's express app
   * @param {ParseServerOptions} options to use to start the server
   * @param {Function} callback called when the server has started
   * @returns {ParseServer} the parse server instance
   */


  start(options, callback) {
    const app = express();

    if (options.middleware) {
      let middleware;

      if (typeof options.middleware == 'string') {
        middleware = require(path.resolve(process.cwd(), options.middleware));
      } else {
        middleware = options.middleware; // use as-is let express fail
      }

      app.use(middleware);
    }

    app.use(options.mountPath, this.app);

    if (options.mountGraphQL === true || options.mountPlayground === true) {
      let graphQLCustomTypeDefs = undefined;

      if (typeof options.graphQLSchema === 'string') {
        graphQLCustomTypeDefs = parse(fs.readFileSync(options.graphQLSchema, 'utf8'));
      } else if (typeof options.graphQLSchema === 'object' || typeof options.graphQLSchema === 'function') {
        graphQLCustomTypeDefs = options.graphQLSchema;
      }

      const parseGraphQLServer = new _ParseGraphQLServer.ParseGraphQLServer(this, {
        graphQLPath: options.graphQLPath,
        playgroundPath: options.playgroundPath,
        graphQLCustomTypeDefs
      });

      if (options.mountGraphQL) {
        parseGraphQLServer.applyGraphQL(app);
      }

      if (options.mountPlayground) {
        parseGraphQLServer.applyPlayground(app);
      }
    }

    const server = app.listen(options.port, options.host, callback);
    this.server = server;

    if (options.startLiveQueryServer || options.liveQueryServerOptions) {
      this.liveQueryServer = ParseServer.createLiveQueryServer(server, options.liveQueryServerOptions, options);
    }
    /* istanbul ignore next */


    if (!process.env.TESTING) {
      configureListeners(this);
    }

    this.expressApp = app;
    return this;
  }
  /**
   * Creates a new ParseServer and starts it.
   * @param {ParseServerOptions} options used to start the server
   * @param {Function} callback called when the server has started
   * @returns {ParseServer} the parse server instance
   */


  static start(options, callback) {
    const parseServer = new ParseServer(options);
    return parseServer.start(options, callback);
  }
  /**
   * Helper method to create a liveQuery server
   * @static
   * @param {Server} httpServer an optional http server to pass
   * @param {LiveQueryServerOptions} config options for the liveQueryServer
   * @param {ParseServerOptions} options options for the ParseServer
   * @returns {ParseLiveQueryServer} the live query server instance
   */


  static createLiveQueryServer(httpServer, config, options) {
    if (!httpServer || config && config.port) {
      var app = express();
      httpServer = require('http').createServer(app);
      httpServer.listen(config.port);
    }

    return new _ParseLiveQueryServer.ParseLiveQueryServer(httpServer, config, options);
  }

  static verifyServerUrl(callback) {
    // perform a health check on the serverURL value
    if (Parse.serverURL) {
      const request = require('./request');

      request({
        url: Parse.serverURL.replace(/\/$/, '') + '/health'
      }).catch(response => response).then(response => {
        const json = response.data || null;

        if (response.status !== 200 || !json || json && json.status !== 'ok') {
          /* eslint-disable no-console */
          console.warn(`\nWARNING, Unable to connect to '${Parse.serverURL}'.` + ` Cloud code and push notifications may be unavailable!\n`);
          /* eslint-enable no-console */

          if (callback) {
            callback(false);
          }
        } else {
          if (callback) {
            callback(true);
          }
        }
      });
    }
  }

}

function addParseCloud() {
  const ParseCloud = require('./cloud-code/Parse.Cloud');

  Object.assign(Parse.Cloud, ParseCloud);
  global.Parse = Parse;
}

function injectDefaults(options) {
  Object.keys(_defaults.default).forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(options, key)) {
      options[key] = _defaults.default[key];
    }
  });

  if (!Object.prototype.hasOwnProperty.call(options, 'serverURL')) {
    options.serverURL = `http://localhost:${options.port}${options.mountPath}`;
  } // Reserved Characters


  if (options.appId) {
    const regex = /[!#$%'()*+&/:;=?@[\]{}^,|<>]/g;

    if (options.appId.match(regex)) {
      console.warn(`\nWARNING, appId that contains special characters can cause issues while using with urls.\n`);
    }
  } // Backwards compatibility


  if (options.userSensitiveFields) {
    /* eslint-disable no-console */
    !process.env.TESTING && console.warn(`\nDEPRECATED: userSensitiveFields has been replaced by protectedFields allowing the ability to protect fields in all classes with CLP. \n`);
    /* eslint-enable no-console */

    const userSensitiveFields = Array.from(new Set([...(_defaults.default.userSensitiveFields || []), ...(options.userSensitiveFields || [])])); // If the options.protectedFields is unset,
    // it'll be assigned the default above.
    // Here, protect against the case where protectedFields
    // is set, but doesn't have _User.

    if (!('_User' in options.protectedFields)) {
      options.protectedFields = Object.assign({
        _User: []
      }, options.protectedFields);
    }

    options.protectedFields['_User']['*'] = Array.from(new Set([...(options.protectedFields['_User']['*'] || []), ...userSensitiveFields]));
  } // Merge protectedFields options with defaults.


  Object.keys(_defaults.default.protectedFields).forEach(c => {
    const cur = options.protectedFields[c];

    if (!cur) {
      options.protectedFields[c] = _defaults.default.protectedFields[c];
    } else {
      Object.keys(_defaults.default.protectedFields[c]).forEach(r => {
        const unq = new Set([...(options.protectedFields[c][r] || []), ..._defaults.default.protectedFields[c][r]]);
        options.protectedFields[c][r] = Array.from(unq);
      });
    }
  });
  options.masterKeyIps = Array.from(new Set(options.masterKeyIps.concat(_defaults.default.masterKeyIps, options.masterKeyIps)));
} // Those can't be tested as it requires a subprocess

/* istanbul ignore next */


function configureListeners(parseServer) {
  const server = parseServer.server;
  const sockets = {};
  /* Currently, express doesn't shut down immediately after receiving SIGINT/SIGTERM if it has client connections that haven't timed out. (This is a known issue with node - https://github.com/nodejs/node/issues/2642)
    This function, along with `destroyAliveConnections()`, intend to fix this behavior such that parse server will close all open connections and initiate the shutdown process as soon as it receives a SIGINT/SIGTERM signal. */

  server.on('connection', socket => {
    const socketId = socket.remoteAddress + ':' + socket.remotePort;
    sockets[socketId] = socket;
    socket.on('close', () => {
      delete sockets[socketId];
    });
  });

  const destroyAliveConnections = function () {
    for (const socketId in sockets) {
      try {
        sockets[socketId].destroy();
      } catch (e) {
        /* */
      }
    }
  };

  const handleShutdown = function () {
    process.stdout.write('Termination signal received. Shutting down.');
    destroyAliveConnections();
    server.close();
    parseServer.handleShutdown();
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

var _default = ParseServer;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9QYXJzZVNlcnZlci5qcyJdLCJuYW1lcyI6WyJiYXRjaCIsInJlcXVpcmUiLCJib2R5UGFyc2VyIiwiZXhwcmVzcyIsIm1pZGRsZXdhcmVzIiwiUGFyc2UiLCJwYXJzZSIsInBhdGgiLCJmcyIsImFkZFBhcnNlQ2xvdWQiLCJQYXJzZVNlcnZlciIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsImluamVjdERlZmF1bHRzIiwiYXBwSWQiLCJtYXN0ZXJLZXkiLCJjbG91ZCIsImphdmFzY3JpcHRLZXkiLCJzZXJ2ZXJVUkwiLCJzZXJ2ZXJTdGFydENvbXBsZXRlIiwiaW5pdGlhbGl6ZSIsImFsbENvbnRyb2xsZXJzIiwiY29udHJvbGxlcnMiLCJnZXRDb250cm9sbGVycyIsImxvZ2dlckNvbnRyb2xsZXIiLCJkYXRhYmFzZUNvbnRyb2xsZXIiLCJob29rc0NvbnRyb2xsZXIiLCJjb25maWciLCJDb25maWciLCJwdXQiLCJPYmplY3QiLCJhc3NpZ24iLCJsb2dnaW5nIiwic2V0TG9nZ2VyIiwiZGJJbml0UHJvbWlzZSIsInBlcmZvcm1Jbml0aWFsaXphdGlvbiIsImhvb2tzTG9hZFByb21pc2UiLCJsb2FkIiwiUHJvbWlzZSIsImFsbCIsInRoZW4iLCJjYXRjaCIsImVycm9yIiwiY29uc29sZSIsInByb2Nlc3MiLCJleGl0IiwicmVzb2x2ZSIsImN3ZCIsImFwcCIsIl9hcHAiLCJoYW5kbGVTaHV0ZG93biIsInByb21pc2VzIiwiYWRhcHRlciIsImRhdGFiYXNlQWRhcHRlciIsInB1c2giLCJmaWxlQWRhcHRlciIsImZpbGVzQ29udHJvbGxlciIsImNhY2hlQWRhcHRlciIsImNhY2hlQ29udHJvbGxlciIsImxlbmd0aCIsInNlcnZlckNsb3NlQ29tcGxldGUiLCJtYXhVcGxvYWRTaXplIiwiZGlyZWN0QWNjZXNzIiwicGFnZXMiLCJhcGkiLCJ1c2UiLCJhbGxvd0Nyb3NzRG9tYWluIiwiRmlsZXNSb3V0ZXIiLCJleHByZXNzUm91dGVyIiwicmVxIiwicmVzIiwianNvbiIsInN0YXR1cyIsInVybGVuY29kZWQiLCJleHRlbmRlZCIsImVuYWJsZVJvdXRlciIsIlBhZ2VzUm91dGVyIiwiUHVibGljQVBJUm91dGVyIiwidHlwZSIsImxpbWl0IiwiYWxsb3dNZXRob2RPdmVycmlkZSIsImhhbmRsZVBhcnNlSGVhZGVycyIsImFwcFJvdXRlciIsInByb21pc2VSb3V0ZXIiLCJoYW5kbGVQYXJzZUVycm9ycyIsImVudiIsIlRFU1RJTkciLCJvbiIsImVyciIsImNvZGUiLCJzdGRlcnIiLCJ3cml0ZSIsInBvcnQiLCJ2ZXJpZnlTZXJ2ZXJVcmwiLCJQQVJTRV9TRVJWRVJfRU5BQkxFX0VYUEVSSU1FTlRBTF9ESVJFQ1RfQUNDRVNTIiwiQ29yZU1hbmFnZXIiLCJzZXRSRVNUQ29udHJvbGxlciIsInJvdXRlcnMiLCJDbGFzc2VzUm91dGVyIiwiVXNlcnNSb3V0ZXIiLCJTZXNzaW9uc1JvdXRlciIsIlJvbGVzUm91dGVyIiwiQW5hbHl0aWNzUm91dGVyIiwiSW5zdGFsbGF0aW9uc1JvdXRlciIsIkZ1bmN0aW9uc1JvdXRlciIsIlNjaGVtYXNSb3V0ZXIiLCJQdXNoUm91dGVyIiwiTG9nc1JvdXRlciIsIklBUFZhbGlkYXRpb25Sb3V0ZXIiLCJGZWF0dXJlc1JvdXRlciIsIkdsb2JhbENvbmZpZ1JvdXRlciIsIkdyYXBoUUxSb3V0ZXIiLCJQdXJnZVJvdXRlciIsIkhvb2tzUm91dGVyIiwiQ2xvdWRDb2RlUm91dGVyIiwiQXVkaWVuY2VzUm91dGVyIiwiQWdncmVnYXRlUm91dGVyIiwicm91dGVzIiwicmVkdWNlIiwibWVtbyIsInJvdXRlciIsImNvbmNhdCIsIlByb21pc2VSb3V0ZXIiLCJtb3VudE9udG8iLCJzdGFydCIsImNhbGxiYWNrIiwibWlkZGxld2FyZSIsIm1vdW50UGF0aCIsIm1vdW50R3JhcGhRTCIsIm1vdW50UGxheWdyb3VuZCIsImdyYXBoUUxDdXN0b21UeXBlRGVmcyIsInVuZGVmaW5lZCIsImdyYXBoUUxTY2hlbWEiLCJyZWFkRmlsZVN5bmMiLCJwYXJzZUdyYXBoUUxTZXJ2ZXIiLCJQYXJzZUdyYXBoUUxTZXJ2ZXIiLCJncmFwaFFMUGF0aCIsInBsYXlncm91bmRQYXRoIiwiYXBwbHlHcmFwaFFMIiwiYXBwbHlQbGF5Z3JvdW5kIiwic2VydmVyIiwibGlzdGVuIiwiaG9zdCIsInN0YXJ0TGl2ZVF1ZXJ5U2VydmVyIiwibGl2ZVF1ZXJ5U2VydmVyT3B0aW9ucyIsImxpdmVRdWVyeVNlcnZlciIsImNyZWF0ZUxpdmVRdWVyeVNlcnZlciIsImNvbmZpZ3VyZUxpc3RlbmVycyIsImV4cHJlc3NBcHAiLCJwYXJzZVNlcnZlciIsImh0dHBTZXJ2ZXIiLCJjcmVhdGVTZXJ2ZXIiLCJQYXJzZUxpdmVRdWVyeVNlcnZlciIsInJlcXVlc3QiLCJ1cmwiLCJyZXBsYWNlIiwicmVzcG9uc2UiLCJkYXRhIiwid2FybiIsIlBhcnNlQ2xvdWQiLCJDbG91ZCIsImdsb2JhbCIsImtleXMiLCJkZWZhdWx0cyIsImZvckVhY2giLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJyZWdleCIsIm1hdGNoIiwidXNlclNlbnNpdGl2ZUZpZWxkcyIsIkFycmF5IiwiZnJvbSIsIlNldCIsInByb3RlY3RlZEZpZWxkcyIsIl9Vc2VyIiwiYyIsImN1ciIsInIiLCJ1bnEiLCJtYXN0ZXJLZXlJcHMiLCJzb2NrZXRzIiwic29ja2V0Iiwic29ja2V0SWQiLCJyZW1vdGVBZGRyZXNzIiwicmVtb3RlUG9ydCIsImRlc3Ryb3lBbGl2ZUNvbm5lY3Rpb25zIiwiZGVzdHJveSIsImUiLCJzdGRvdXQiLCJjbG9zZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQVdBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNB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LE9BRkQsQ0FFRSxPQUFPQyxDQUFQLEVBQVU7QUFDVjtBQUNEO0FBQ0Y7QUFDRixHQVJEOztBQVVBLFFBQU0zSSxjQUFjLEdBQUcsWUFBWTtBQUNqQ04sSUFBQUEsT0FBTyxDQUFDa0osTUFBUixDQUFlbkcsS0FBZixDQUFxQiw2Q0FBckI7QUFDQWdHLElBQUFBLHVCQUF1QjtBQUN2Qi9DLElBQUFBLE1BQU0sQ0FBQ21ELEtBQVA7QUFDQTFDLElBQUFBLFdBQVcsQ0FBQ25HLGNBQVo7QUFDRCxHQUxEOztBQU1BTixFQUFBQSxPQUFPLENBQUMyQyxFQUFSLENBQVcsU0FBWCxFQUFzQnJDLGNBQXRCO0FBQ0FOLEVBQUFBLE9BQU8sQ0FBQzJDLEVBQVIsQ0FBVyxRQUFYLEVBQXFCckMsY0FBckI7QUFDRDs7ZUFFY3hDLFciLCJzb3VyY2VzQ29udGVudCI6WyIvLyBQYXJzZVNlcnZlciAtIG9wZW4tc291cmNlIGNvbXBhdGlibGUgQVBJIFNlcnZlciBmb3IgUGFyc2UgYXBwc1xuXG52YXIgYmF0Y2ggPSByZXF1aXJlKCcuL2JhdGNoJyksXG4gIGJvZHlQYXJzZXIgPSByZXF1aXJlKCdib2R5LXBhcnNlcicpLFxuICBleHByZXNzID0gcmVxdWlyZSgnZXhwcmVzcycpLFxuICBtaWRkbGV3YXJlcyA9IHJlcXVpcmUoJy4vbWlkZGxld2FyZXMnKSxcbiAgUGFyc2UgPSByZXF1aXJlKCdwYXJzZS9ub2RlJykuUGFyc2UsXG4gIHsgcGFyc2UgfSA9IHJlcXVpcmUoJ2dyYXBocWwnKSxcbiAgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKSxcbiAgZnMgPSByZXF1aXJlKCdmcycpO1xuXG5pbXBvcnQgeyBQYXJzZVNlcnZlck9wdGlvbnMsIExpdmVRdWVyeVNlcnZlck9wdGlvbnMgfSBmcm9tICcuL09wdGlvbnMnO1xuaW1wb3J0IGRlZmF1bHRzIGZyb20gJy4vZGVmYXVsdHMnO1xuaW1wb3J0ICogYXMgbG9nZ2luZyBmcm9tICcuL2xvZ2dlcic7XG5pbXBvcnQgQ29uZmlnIGZyb20gJy4vQ29uZmlnJztcbmltcG9ydCBQcm9taXNlUm91dGVyIGZyb20gJy4vUHJvbWlzZVJvdXRlcic7XG5pbXBvcnQgcmVxdWlyZWRQYXJhbWV0ZXIgZnJvbSAnLi9yZXF1aXJlZFBhcmFtZXRlcic7XG5pbXBvcnQgeyBBbmFseXRpY3NSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvQW5hbHl0aWNzUm91dGVyJztcbmltcG9ydCB7IENsYXNzZXNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvQ2xhc3Nlc1JvdXRlcic7XG5pbXBvcnQgeyBGZWF0dXJlc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9GZWF0dXJlc1JvdXRlcic7XG5pbXBvcnQgeyBGaWxlc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9GaWxlc1JvdXRlcic7XG5pbXBvcnQgeyBGdW5jdGlvbnNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvRnVuY3Rpb25zUm91dGVyJztcbmltcG9ydCB7IEdsb2JhbENvbmZpZ1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9HbG9iYWxDb25maWdSb3V0ZXInO1xuaW1wb3J0IHsgR3JhcGhRTFJvdXRlciB9IGZyb20gJy4vUm91dGVycy9HcmFwaFFMUm91dGVyJztcbmltcG9ydCB7IEhvb2tzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0hvb2tzUm91dGVyJztcbmltcG9ydCB7IElBUFZhbGlkYXRpb25Sb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvSUFQVmFsaWRhdGlvblJvdXRlcic7XG5pbXBvcnQgeyBJbnN0YWxsYXRpb25zUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0luc3RhbGxhdGlvbnNSb3V0ZXInO1xuaW1wb3J0IHsgTG9nc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9Mb2dzUm91dGVyJztcbmltcG9ydCB7IFBhcnNlTGl2ZVF1ZXJ5U2VydmVyIH0gZnJvbSAnLi9MaXZlUXVlcnkvUGFyc2VMaXZlUXVlcnlTZXJ2ZXInO1xuaW1wb3J0IHsgUGFnZXNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvUGFnZXNSb3V0ZXInO1xuaW1wb3J0IHsgUHVibGljQVBJUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1B1YmxpY0FQSVJvdXRlcic7XG5pbXBvcnQgeyBQdXNoUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1B1c2hSb3V0ZXInO1xuaW1wb3J0IHsgQ2xvdWRDb2RlUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0Nsb3VkQ29kZVJvdXRlcic7XG5pbXBvcnQgeyBSb2xlc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9Sb2xlc1JvdXRlcic7XG5pbXBvcnQgeyBTY2hlbWFzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1NjaGVtYXNSb3V0ZXInO1xuaW1wb3J0IHsgU2Vzc2lvbnNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvU2Vzc2lvbnNSb3V0ZXInO1xuaW1wb3J0IHsgVXNlcnNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvVXNlcnNSb3V0ZXInO1xuaW1wb3J0IHsgUHVyZ2VSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvUHVyZ2VSb3V0ZXInO1xuaW1wb3J0IHsgQXVkaWVuY2VzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0F1ZGllbmNlc1JvdXRlcic7XG5pbXBvcnQgeyBBZ2dyZWdhdGVSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvQWdncmVnYXRlUm91dGVyJztcbmltcG9ydCB7IFBhcnNlU2VydmVyUkVTVENvbnRyb2xsZXIgfSBmcm9tICcuL1BhcnNlU2VydmVyUkVTVENvbnRyb2xsZXInO1xuaW1wb3J0ICogYXMgY29udHJvbGxlcnMgZnJvbSAnLi9Db250cm9sbGVycyc7XG5pbXBvcnQgeyBQYXJzZUdyYXBoUUxTZXJ2ZXIgfSBmcm9tICcuL0dyYXBoUUwvUGFyc2VHcmFwaFFMU2VydmVyJztcblxuLy8gTXV0YXRlIHRoZSBQYXJzZSBvYmplY3QgdG8gYWRkIHRoZSBDbG91ZCBDb2RlIGhhbmRsZXJzXG5hZGRQYXJzZUNsb3VkKCk7XG5cbi8vIFBhcnNlU2VydmVyIHdvcmtzIGxpa2UgYSBjb25zdHJ1Y3RvciBvZiBhbiBleHByZXNzIGFwcC5cbi8vIGh0dHBzOi8vcGFyc2VwbGF0Zm9ybS5vcmcvcGFyc2Utc2VydmVyL2FwaS9tYXN0ZXIvUGFyc2VTZXJ2ZXJPcHRpb25zLmh0bWxcbmNsYXNzIFBhcnNlU2VydmVyIHtcbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyB0aGUgcGFyc2Ugc2VydmVyIGluaXRpYWxpemF0aW9uIG9wdGlvbnNcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFBhcnNlU2VydmVyT3B0aW9ucykge1xuICAgIGluamVjdERlZmF1bHRzKG9wdGlvbnMpO1xuICAgIGNvbnN0IHtcbiAgICAgIGFwcElkID0gcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYW4gYXBwSWQhJyksXG4gICAgICBtYXN0ZXJLZXkgPSByZXF1aXJlZFBhcmFtZXRlcignWW91IG11c3QgcHJvdmlkZSBhIG1hc3RlcktleSEnKSxcbiAgICAgIGNsb3VkLFxuICAgICAgamF2YXNjcmlwdEtleSxcbiAgICAgIHNlcnZlclVSTCA9IHJlcXVpcmVkUGFyYW1ldGVyKCdZb3UgbXVzdCBwcm92aWRlIGEgc2VydmVyVVJMIScpLFxuICAgICAgc2VydmVyU3RhcnRDb21wbGV0ZSxcbiAgICB9ID0gb3B0aW9ucztcbiAgICAvLyBJbml0aWFsaXplIHRoZSBub2RlIGNsaWVudCBTREsgYXV0b21hdGljYWxseVxuICAgIFBhcnNlLmluaXRpYWxpemUoYXBwSWQsIGphdmFzY3JpcHRLZXkgfHwgJ3VudXNlZCcsIG1hc3RlcktleSk7XG4gICAgUGFyc2Uuc2VydmVyVVJMID0gc2VydmVyVVJMO1xuXG4gICAgY29uc3QgYWxsQ29udHJvbGxlcnMgPSBjb250cm9sbGVycy5nZXRDb250cm9sbGVycyhvcHRpb25zKTtcblxuICAgIGNvbnN0IHsgbG9nZ2VyQ29udHJvbGxlciwgZGF0YWJhc2VDb250cm9sbGVyLCBob29rc0NvbnRyb2xsZXIgfSA9IGFsbENvbnRyb2xsZXJzO1xuICAgIHRoaXMuY29uZmlnID0gQ29uZmlnLnB1dChPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zLCBhbGxDb250cm9sbGVycykpO1xuXG4gICAgbG9nZ2luZy5zZXRMb2dnZXIobG9nZ2VyQ29udHJvbGxlcik7XG4gICAgY29uc3QgZGJJbml0UHJvbWlzZSA9IGRhdGFiYXNlQ29udHJvbGxlci5wZXJmb3JtSW5pdGlhbGl6YXRpb24oKTtcbiAgICBjb25zdCBob29rc0xvYWRQcm9taXNlID0gaG9va3NDb250cm9sbGVyLmxvYWQoKTtcblxuICAgIC8vIE5vdGU6IFRlc3RzIHdpbGwgc3RhcnQgdG8gZmFpbCBpZiBhbnkgdmFsaWRhdGlvbiBoYXBwZW5zIGFmdGVyIHRoaXMgaXMgY2FsbGVkLlxuICAgIFByb21pc2UuYWxsKFtkYkluaXRQcm9taXNlLCBob29rc0xvYWRQcm9taXNlXSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHNlcnZlclN0YXJ0Q29tcGxldGUpIHtcbiAgICAgICAgICBzZXJ2ZXJTdGFydENvbXBsZXRlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBpZiAoc2VydmVyU3RhcnRDb21wbGV0ZSkge1xuICAgICAgICAgIHNlcnZlclN0YXJ0Q29tcGxldGUoZXJyb3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICBpZiAoY2xvdWQpIHtcbiAgICAgIGFkZFBhcnNlQ2xvdWQoKTtcbiAgICAgIGlmICh0eXBlb2YgY2xvdWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2xvdWQoUGFyc2UpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY2xvdWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJlcXVpcmUocGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIGNsb3VkKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBcImFyZ3VtZW50ICdjbG91ZCcgbXVzdCBlaXRoZXIgYmUgYSBzdHJpbmcgb3IgYSBmdW5jdGlvblwiO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBhcHAoKSB7XG4gICAgaWYgKCF0aGlzLl9hcHApIHtcbiAgICAgIHRoaXMuX2FwcCA9IFBhcnNlU2VydmVyLmFwcCh0aGlzLmNvbmZpZyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9hcHA7XG4gIH1cblxuICBoYW5kbGVTaHV0ZG93bigpIHtcbiAgICBjb25zdCBwcm9taXNlcyA9IFtdO1xuICAgIGNvbnN0IHsgYWRhcHRlcjogZGF0YWJhc2VBZGFwdGVyIH0gPSB0aGlzLmNvbmZpZy5kYXRhYmFzZUNvbnRyb2xsZXI7XG4gICAgaWYgKGRhdGFiYXNlQWRhcHRlciAmJiB0eXBlb2YgZGF0YWJhc2VBZGFwdGVyLmhhbmRsZVNodXRkb3duID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBwcm9taXNlcy5wdXNoKGRhdGFiYXNlQWRhcHRlci5oYW5kbGVTaHV0ZG93bigpKTtcbiAgICB9XG4gICAgY29uc3QgeyBhZGFwdGVyOiBmaWxlQWRhcHRlciB9ID0gdGhpcy5jb25maWcuZmlsZXNDb250cm9sbGVyO1xuICAgIGlmIChmaWxlQWRhcHRlciAmJiB0eXBlb2YgZmlsZUFkYXB0ZXIuaGFuZGxlU2h1dGRvd24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHByb21pc2VzLnB1c2goZmlsZUFkYXB0ZXIuaGFuZGxlU2h1dGRvd24oKSk7XG4gICAgfVxuICAgIGNvbnN0IHsgYWRhcHRlcjogY2FjaGVBZGFwdGVyIH0gPSB0aGlzLmNvbmZpZy5jYWNoZUNvbnRyb2xsZXI7XG4gICAgaWYgKGNhY2hlQWRhcHRlciAmJiB0eXBlb2YgY2FjaGVBZGFwdGVyLmhhbmRsZVNodXRkb3duID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBwcm9taXNlcy5wdXNoKGNhY2hlQWRhcHRlci5oYW5kbGVTaHV0ZG93bigpKTtcbiAgICB9XG4gICAgcmV0dXJuIChwcm9taXNlcy5sZW5ndGggPiAwID8gUHJvbWlzZS5hbGwocHJvbWlzZXMpIDogUHJvbWlzZS5yZXNvbHZlKCkpLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuY29uZmlnLnNlcnZlckNsb3NlQ29tcGxldGUpIHtcbiAgICAgICAgdGhpcy5jb25maWcuc2VydmVyQ2xvc2VDb21wbGV0ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdGF0aWNcbiAgICogQ3JlYXRlIGFuIGV4cHJlc3MgYXBwIGZvciB0aGUgcGFyc2Ugc2VydmVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIGxldCB5b3Ugc3BlY2lmeSB0aGUgbWF4VXBsb2FkU2l6ZSB3aGVuIGNyZWF0aW5nIHRoZSBleHByZXNzIGFwcCAgKi9cbiAgc3RhdGljIGFwcChvcHRpb25zKSB7XG4gICAgY29uc3QgeyBtYXhVcGxvYWRTaXplID0gJzIwbWInLCBhcHBJZCwgZGlyZWN0QWNjZXNzLCBwYWdlcyB9ID0gb3B0aW9ucztcbiAgICAvLyBUaGlzIGFwcCBzZXJ2ZXMgdGhlIFBhcnNlIEFQSSBkaXJlY3RseS5cbiAgICAvLyBJdCdzIHRoZSBlcXVpdmFsZW50IG9mIGh0dHBzOi8vYXBpLnBhcnNlLmNvbS8xIGluIHRoZSBob3N0ZWQgUGFyc2UgQVBJLlxuICAgIHZhciBhcGkgPSBleHByZXNzKCk7XG4gICAgLy9hcGkudXNlKFwiL2FwcHNcIiwgZXhwcmVzcy5zdGF0aWMoX19kaXJuYW1lICsgXCIvcHVibGljXCIpKTtcbiAgICBhcGkudXNlKG1pZGRsZXdhcmVzLmFsbG93Q3Jvc3NEb21haW4oYXBwSWQpKTtcbiAgICAvLyBGaWxlIGhhbmRsaW5nIG5lZWRzIHRvIGJlIGJlZm9yZSBkZWZhdWx0IG1pZGRsZXdhcmVzIGFyZSBhcHBsaWVkXG4gICAgYXBpLnVzZShcbiAgICAgICcvJyxcbiAgICAgIG5ldyBGaWxlc1JvdXRlcigpLmV4cHJlc3NSb3V0ZXIoe1xuICAgICAgICBtYXhVcGxvYWRTaXplOiBtYXhVcGxvYWRTaXplLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgYXBpLnVzZSgnL2hlYWx0aCcsIGZ1bmN0aW9uIChyZXEsIHJlcykge1xuICAgICAgcmVzLmpzb24oe1xuICAgICAgICBzdGF0dXM6ICdvaycsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGFwaS51c2UoXG4gICAgICAnLycsXG4gICAgICBib2R5UGFyc2VyLnVybGVuY29kZWQoeyBleHRlbmRlZDogZmFsc2UgfSksXG4gICAgICBwYWdlcy5lbmFibGVSb3V0ZXJcbiAgICAgICAgPyBuZXcgUGFnZXNSb3V0ZXIocGFnZXMpLmV4cHJlc3NSb3V0ZXIoKVxuICAgICAgICA6IG5ldyBQdWJsaWNBUElSb3V0ZXIoKS5leHByZXNzUm91dGVyKClcbiAgICApO1xuXG4gICAgYXBpLnVzZShib2R5UGFyc2VyLmpzb24oeyB0eXBlOiAnKi8qJywgbGltaXQ6IG1heFVwbG9hZFNpemUgfSkpO1xuICAgIGFwaS51c2UobWlkZGxld2FyZXMuYWxsb3dNZXRob2RPdmVycmlkZSk7XG4gICAgYXBpLnVzZShtaWRkbGV3YXJlcy5oYW5kbGVQYXJzZUhlYWRlcnMpO1xuXG4gICAgY29uc3QgYXBwUm91dGVyID0gUGFyc2VTZXJ2ZXIucHJvbWlzZVJvdXRlcih7IGFwcElkIH0pO1xuICAgIGFwaS51c2UoYXBwUm91dGVyLmV4cHJlc3NSb3V0ZXIoKSk7XG5cbiAgICBhcGkudXNlKG1pZGRsZXdhcmVzLmhhbmRsZVBhcnNlRXJyb3JzKTtcblxuICAgIC8vIHJ1biB0aGUgZm9sbG93aW5nIHdoZW4gbm90IHRlc3RpbmdcbiAgICBpZiAoIXByb2Nlc3MuZW52LlRFU1RJTkcpIHtcbiAgICAgIC8vVGhpcyBjYXVzZXMgdGVzdHMgdG8gc3BldyBzb21lIHVzZWxlc3Mgd2FybmluZ3MsIHNvIGRpc2FibGUgaW4gdGVzdFxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIHByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgZXJyID0+IHtcbiAgICAgICAgaWYgKGVyci5jb2RlID09PSAnRUFERFJJTlVTRScpIHtcbiAgICAgICAgICAvLyB1c2VyLWZyaWVuZGx5IG1lc3NhZ2UgZm9yIHRoaXMgY29tbW9uIGVycm9yXG4gICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYFVuYWJsZSB0byBsaXN0ZW4gb24gcG9ydCAke2Vyci5wb3J0fS4gVGhlIHBvcnQgaXMgYWxyZWFkeSBpbiB1c2UuYCk7XG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvLyB2ZXJpZnkgdGhlIHNlcnZlciB1cmwgYWZ0ZXIgYSAnbW91bnQnIGV2ZW50IGlzIHJlY2VpdmVkXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgYXBpLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgUGFyc2VTZXJ2ZXIudmVyaWZ5U2VydmVyVXJsKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHByb2Nlc3MuZW52LlBBUlNFX1NFUlZFUl9FTkFCTEVfRVhQRVJJTUVOVEFMX0RJUkVDVF9BQ0NFU1MgPT09ICcxJyB8fCBkaXJlY3RBY2Nlc3MpIHtcbiAgICAgIFBhcnNlLkNvcmVNYW5hZ2VyLnNldFJFU1RDb250cm9sbGVyKFBhcnNlU2VydmVyUkVTVENvbnRyb2xsZXIoYXBwSWQsIGFwcFJvdXRlcikpO1xuICAgIH1cbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgc3RhdGljIHByb21pc2VSb3V0ZXIoeyBhcHBJZCB9KSB7XG4gICAgY29uc3Qgcm91dGVycyA9IFtcbiAgICAgIG5ldyBDbGFzc2VzUm91dGVyKCksXG4gICAgICBuZXcgVXNlcnNSb3V0ZXIoKSxcbiAgICAgIG5ldyBTZXNzaW9uc1JvdXRlcigpLFxuICAgICAgbmV3IFJvbGVzUm91dGVyKCksXG4gICAgICBuZXcgQW5hbHl0aWNzUm91dGVyKCksXG4gICAgICBuZXcgSW5zdGFsbGF0aW9uc1JvdXRlcigpLFxuICAgICAgbmV3IEZ1bmN0aW9uc1JvdXRlcigpLFxuICAgICAgbmV3IFNjaGVtYXNSb3V0ZXIoKSxcbiAgICAgIG5ldyBQdXNoUm91dGVyKCksXG4gICAgICBuZXcgTG9nc1JvdXRlcigpLFxuICAgICAgbmV3IElBUFZhbGlkYXRpb25Sb3V0ZXIoKSxcbiAgICAgIG5ldyBGZWF0dXJlc1JvdXRlcigpLFxuICAgICAgbmV3IEdsb2JhbENvbmZpZ1JvdXRlcigpLFxuICAgICAgbmV3IEdyYXBoUUxSb3V0ZXIoKSxcbiAgICAgIG5ldyBQdXJnZVJvdXRlcigpLFxuICAgICAgbmV3IEhvb2tzUm91dGVyKCksXG4gICAgICBuZXcgQ2xvdWRDb2RlUm91dGVyKCksXG4gICAgICBuZXcgQXVkaWVuY2VzUm91dGVyKCksXG4gICAgICBuZXcgQWdncmVnYXRlUm91dGVyKCksXG4gICAgXTtcblxuICAgIGNvbnN0IHJvdXRlcyA9IHJvdXRlcnMucmVkdWNlKChtZW1vLCByb3V0ZXIpID0+IHtcbiAgICAgIHJldHVybiBtZW1vLmNvbmNhdChyb3V0ZXIucm91dGVzKTtcbiAgICB9LCBbXSk7XG5cbiAgICBjb25zdCBhcHBSb3V0ZXIgPSBuZXcgUHJvbWlzZVJvdXRlcihyb3V0ZXMsIGFwcElkKTtcblxuICAgIGJhdGNoLm1vdW50T250byhhcHBSb3V0ZXIpO1xuICAgIHJldHVybiBhcHBSb3V0ZXI7XG4gIH1cblxuICAvKipcbiAgICogc3RhcnRzIHRoZSBwYXJzZSBzZXJ2ZXIncyBleHByZXNzIGFwcFxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyB0byB1c2UgdG8gc3RhcnQgdGhlIHNlcnZlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBjYWxsZWQgd2hlbiB0aGUgc2VydmVyIGhhcyBzdGFydGVkXG4gICAqIEByZXR1cm5zIHtQYXJzZVNlcnZlcn0gdGhlIHBhcnNlIHNlcnZlciBpbnN0YW5jZVxuICAgKi9cbiAgc3RhcnQob3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zLCBjYWxsYmFjazogPygpID0+IHZvaWQpIHtcbiAgICBjb25zdCBhcHAgPSBleHByZXNzKCk7XG4gICAgaWYgKG9wdGlvbnMubWlkZGxld2FyZSkge1xuICAgICAgbGV0IG1pZGRsZXdhcmU7XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMubWlkZGxld2FyZSA9PSAnc3RyaW5nJykge1xuICAgICAgICBtaWRkbGV3YXJlID0gcmVxdWlyZShwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgb3B0aW9ucy5taWRkbGV3YXJlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtaWRkbGV3YXJlID0gb3B0aW9ucy5taWRkbGV3YXJlOyAvLyB1c2UgYXMtaXMgbGV0IGV4cHJlc3MgZmFpbFxuICAgICAgfVxuICAgICAgYXBwLnVzZShtaWRkbGV3YXJlKTtcbiAgICB9XG5cbiAgICBhcHAudXNlKG9wdGlvbnMubW91bnRQYXRoLCB0aGlzLmFwcCk7XG5cbiAgICBpZiAob3B0aW9ucy5tb3VudEdyYXBoUUwgPT09IHRydWUgfHwgb3B0aW9ucy5tb3VudFBsYXlncm91bmQgPT09IHRydWUpIHtcbiAgICAgIGxldCBncmFwaFFMQ3VzdG9tVHlwZURlZnMgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMuZ3JhcGhRTFNjaGVtYSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzID0gcGFyc2UoZnMucmVhZEZpbGVTeW5jKG9wdGlvbnMuZ3JhcGhRTFNjaGVtYSwgJ3V0ZjgnKSk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0eXBlb2Ygb3B0aW9ucy5ncmFwaFFMU2NoZW1hID09PSAnb2JqZWN0JyB8fFxuICAgICAgICB0eXBlb2Ygb3B0aW9ucy5ncmFwaFFMU2NoZW1hID09PSAnZnVuY3Rpb24nXG4gICAgICApIHtcbiAgICAgICAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzID0gb3B0aW9ucy5ncmFwaFFMU2NoZW1hO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZUdyYXBoUUxTZXJ2ZXIgPSBuZXcgUGFyc2VHcmFwaFFMU2VydmVyKHRoaXMsIHtcbiAgICAgICAgZ3JhcGhRTFBhdGg6IG9wdGlvbnMuZ3JhcGhRTFBhdGgsXG4gICAgICAgIHBsYXlncm91bmRQYXRoOiBvcHRpb25zLnBsYXlncm91bmRQYXRoLFxuICAgICAgICBncmFwaFFMQ3VzdG9tVHlwZURlZnMsXG4gICAgICB9KTtcblxuICAgICAgaWYgKG9wdGlvbnMubW91bnRHcmFwaFFMKSB7XG4gICAgICAgIHBhcnNlR3JhcGhRTFNlcnZlci5hcHBseUdyYXBoUUwoYXBwKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMubW91bnRQbGF5Z3JvdW5kKSB7XG4gICAgICAgIHBhcnNlR3JhcGhRTFNlcnZlci5hcHBseVBsYXlncm91bmQoYXBwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBzZXJ2ZXIgPSBhcHAubGlzdGVuKG9wdGlvbnMucG9ydCwgb3B0aW9ucy5ob3N0LCBjYWxsYmFjayk7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzZXJ2ZXI7XG5cbiAgICBpZiAob3B0aW9ucy5zdGFydExpdmVRdWVyeVNlcnZlciB8fCBvcHRpb25zLmxpdmVRdWVyeVNlcnZlck9wdGlvbnMpIHtcbiAgICAgIHRoaXMubGl2ZVF1ZXJ5U2VydmVyID0gUGFyc2VTZXJ2ZXIuY3JlYXRlTGl2ZVF1ZXJ5U2VydmVyKFxuICAgICAgICBzZXJ2ZXIsXG4gICAgICAgIG9wdGlvbnMubGl2ZVF1ZXJ5U2VydmVyT3B0aW9ucyxcbiAgICAgICAgb3B0aW9uc1xuICAgICAgKTtcbiAgICB9XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAoIXByb2Nlc3MuZW52LlRFU1RJTkcpIHtcbiAgICAgIGNvbmZpZ3VyZUxpc3RlbmVycyh0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5leHByZXNzQXBwID0gYXBwO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgUGFyc2VTZXJ2ZXIgYW5kIHN0YXJ0cyBpdC5cbiAgICogQHBhcmFtIHtQYXJzZVNlcnZlck9wdGlvbnN9IG9wdGlvbnMgdXNlZCB0byBzdGFydCB0aGUgc2VydmVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGNhbGxlZCB3aGVuIHRoZSBzZXJ2ZXIgaGFzIHN0YXJ0ZWRcbiAgICogQHJldHVybnMge1BhcnNlU2VydmVyfSB0aGUgcGFyc2Ugc2VydmVyIGluc3RhbmNlXG4gICAqL1xuICBzdGF0aWMgc3RhcnQob3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zLCBjYWxsYmFjazogPygpID0+IHZvaWQpIHtcbiAgICBjb25zdCBwYXJzZVNlcnZlciA9IG5ldyBQYXJzZVNlcnZlcihvcHRpb25zKTtcbiAgICByZXR1cm4gcGFyc2VTZXJ2ZXIuc3RhcnQob3B0aW9ucywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBtZXRob2QgdG8gY3JlYXRlIGEgbGl2ZVF1ZXJ5IHNlcnZlclxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7U2VydmVyfSBodHRwU2VydmVyIGFuIG9wdGlvbmFsIGh0dHAgc2VydmVyIHRvIHBhc3NcbiAgICogQHBhcmFtIHtMaXZlUXVlcnlTZXJ2ZXJPcHRpb25zfSBjb25maWcgb3B0aW9ucyBmb3IgdGhlIGxpdmVRdWVyeVNlcnZlclxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyBvcHRpb25zIGZvciB0aGUgUGFyc2VTZXJ2ZXJcbiAgICogQHJldHVybnMge1BhcnNlTGl2ZVF1ZXJ5U2VydmVyfSB0aGUgbGl2ZSBxdWVyeSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICovXG4gIHN0YXRpYyBjcmVhdGVMaXZlUXVlcnlTZXJ2ZXIoXG4gICAgaHR0cFNlcnZlcixcbiAgICBjb25maWc6IExpdmVRdWVyeVNlcnZlck9wdGlvbnMsXG4gICAgb3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zXG4gICkge1xuICAgIGlmICghaHR0cFNlcnZlciB8fCAoY29uZmlnICYmIGNvbmZpZy5wb3J0KSkge1xuICAgICAgdmFyIGFwcCA9IGV4cHJlc3MoKTtcbiAgICAgIGh0dHBTZXJ2ZXIgPSByZXF1aXJlKCdodHRwJykuY3JlYXRlU2VydmVyKGFwcCk7XG4gICAgICBodHRwU2VydmVyLmxpc3Rlbihjb25maWcucG9ydCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUGFyc2VMaXZlUXVlcnlTZXJ2ZXIoaHR0cFNlcnZlciwgY29uZmlnLCBvcHRpb25zKTtcbiAgfVxuXG4gIHN0YXRpYyB2ZXJpZnlTZXJ2ZXJVcmwoY2FsbGJhY2spIHtcbiAgICAvLyBwZXJmb3JtIGEgaGVhbHRoIGNoZWNrIG9uIHRoZSBzZXJ2ZXJVUkwgdmFsdWVcbiAgICBpZiAoUGFyc2Uuc2VydmVyVVJMKSB7XG4gICAgICBjb25zdCByZXF1ZXN0ID0gcmVxdWlyZSgnLi9yZXF1ZXN0Jyk7XG4gICAgICByZXF1ZXN0KHsgdXJsOiBQYXJzZS5zZXJ2ZXJVUkwucmVwbGFjZSgvXFwvJC8sICcnKSArICcvaGVhbHRoJyB9KVxuICAgICAgICAuY2F0Y2gocmVzcG9uc2UgPT4gcmVzcG9uc2UpXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICBjb25zdCBqc29uID0gcmVzcG9uc2UuZGF0YSB8fCBudWxsO1xuICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgIT09IDIwMCB8fCAhanNvbiB8fCAoanNvbiAmJiBqc29uLnN0YXR1cyAhPT0gJ29rJykpIHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgYFxcbldBUk5JTkcsIFVuYWJsZSB0byBjb25uZWN0IHRvICcke1BhcnNlLnNlcnZlclVSTH0nLmAgK1xuICAgICAgICAgICAgICAgIGAgQ2xvdWQgY29kZSBhbmQgcHVzaCBub3RpZmljYXRpb25zIG1heSBiZSB1bmF2YWlsYWJsZSFcXG5gXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25zb2xlICovXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2sodHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkUGFyc2VDbG91ZCgpIHtcbiAgY29uc3QgUGFyc2VDbG91ZCA9IHJlcXVpcmUoJy4vY2xvdWQtY29kZS9QYXJzZS5DbG91ZCcpO1xuICBPYmplY3QuYXNzaWduKFBhcnNlLkNsb3VkLCBQYXJzZUNsb3VkKTtcbiAgZ2xvYmFsLlBhcnNlID0gUGFyc2U7XG59XG5cbmZ1bmN0aW9uIGluamVjdERlZmF1bHRzKG9wdGlvbnM6IFBhcnNlU2VydmVyT3B0aW9ucykge1xuICBPYmplY3Qua2V5cyhkZWZhdWx0cykuZm9yRWFjaChrZXkgPT4ge1xuICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9wdGlvbnMsIGtleSkpIHtcbiAgICAgIG9wdGlvbnNba2V5XSA9IGRlZmF1bHRzW2tleV07XG4gICAgfVxuICB9KTtcblxuICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvcHRpb25zLCAnc2VydmVyVVJMJykpIHtcbiAgICBvcHRpb25zLnNlcnZlclVSTCA9IGBodHRwOi8vbG9jYWxob3N0OiR7b3B0aW9ucy5wb3J0fSR7b3B0aW9ucy5tb3VudFBhdGh9YDtcbiAgfVxuXG4gIC8vIFJlc2VydmVkIENoYXJhY3RlcnNcbiAgaWYgKG9wdGlvbnMuYXBwSWQpIHtcbiAgICBjb25zdCByZWdleCA9IC9bISMkJScoKSorJi86Oz0/QFtcXF17fV4sfDw+XS9nO1xuICAgIGlmIChvcHRpb25zLmFwcElkLm1hdGNoKHJlZ2V4KSkge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBgXFxuV0FSTklORywgYXBwSWQgdGhhdCBjb250YWlucyBzcGVjaWFsIGNoYXJhY3RlcnMgY2FuIGNhdXNlIGlzc3VlcyB3aGlsZSB1c2luZyB3aXRoIHVybHMuXFxuYFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvLyBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICBpZiAob3B0aW9ucy51c2VyU2Vuc2l0aXZlRmllbGRzKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuICAgICFwcm9jZXNzLmVudi5URVNUSU5HICYmXG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBcXG5ERVBSRUNBVEVEOiB1c2VyU2Vuc2l0aXZlRmllbGRzIGhhcyBiZWVuIHJlcGxhY2VkIGJ5IHByb3RlY3RlZEZpZWxkcyBhbGxvd2luZyB0aGUgYWJpbGl0eSB0byBwcm90ZWN0IGZpZWxkcyBpbiBhbGwgY2xhc3NlcyB3aXRoIENMUC4gXFxuYFxuICAgICAgKTtcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cblxuICAgIGNvbnN0IHVzZXJTZW5zaXRpdmVGaWVsZHMgPSBBcnJheS5mcm9tKFxuICAgICAgbmV3IFNldChbLi4uKGRlZmF1bHRzLnVzZXJTZW5zaXRpdmVGaWVsZHMgfHwgW10pLCAuLi4ob3B0aW9ucy51c2VyU2Vuc2l0aXZlRmllbGRzIHx8IFtdKV0pXG4gICAgKTtcblxuICAgIC8vIElmIHRoZSBvcHRpb25zLnByb3RlY3RlZEZpZWxkcyBpcyB1bnNldCxcbiAgICAvLyBpdCdsbCBiZSBhc3NpZ25lZCB0aGUgZGVmYXVsdCBhYm92ZS5cbiAgICAvLyBIZXJlLCBwcm90ZWN0IGFnYWluc3QgdGhlIGNhc2Ugd2hlcmUgcHJvdGVjdGVkRmllbGRzXG4gICAgLy8gaXMgc2V0LCBidXQgZG9lc24ndCBoYXZlIF9Vc2VyLlxuICAgIGlmICghKCdfVXNlcicgaW4gb3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHMpKSB7XG4gICAgICBvcHRpb25zLnByb3RlY3RlZEZpZWxkcyA9IE9iamVjdC5hc3NpZ24oeyBfVXNlcjogW10gfSwgb3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHMpO1xuICAgIH1cblxuICAgIG9wdGlvbnMucHJvdGVjdGVkRmllbGRzWydfVXNlciddWycqJ10gPSBBcnJheS5mcm9tKFxuICAgICAgbmV3IFNldChbLi4uKG9wdGlvbnMucHJvdGVjdGVkRmllbGRzWydfVXNlciddWycqJ10gfHwgW10pLCAuLi51c2VyU2Vuc2l0aXZlRmllbGRzXSlcbiAgICApO1xuICB9XG5cbiAgLy8gTWVyZ2UgcHJvdGVjdGVkRmllbGRzIG9wdGlvbnMgd2l0aCBkZWZhdWx0cy5cbiAgT2JqZWN0LmtleXMoZGVmYXVsdHMucHJvdGVjdGVkRmllbGRzKS5mb3JFYWNoKGMgPT4ge1xuICAgIGNvbnN0IGN1ciA9IG9wdGlvbnMucHJvdGVjdGVkRmllbGRzW2NdO1xuICAgIGlmICghY3VyKSB7XG4gICAgICBvcHRpb25zLnByb3RlY3RlZEZpZWxkc1tjXSA9IGRlZmF1bHRzLnByb3RlY3RlZEZpZWxkc1tjXTtcbiAgICB9IGVsc2Uge1xuICAgICAgT2JqZWN0LmtleXMoZGVmYXVsdHMucHJvdGVjdGVkRmllbGRzW2NdKS5mb3JFYWNoKHIgPT4ge1xuICAgICAgICBjb25zdCB1bnEgPSBuZXcgU2V0KFtcbiAgICAgICAgICAuLi4ob3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHNbY11bcl0gfHwgW10pLFxuICAgICAgICAgIC4uLmRlZmF1bHRzLnByb3RlY3RlZEZpZWxkc1tjXVtyXSxcbiAgICAgICAgXSk7XG4gICAgICAgIG9wdGlvbnMucHJvdGVjdGVkRmllbGRzW2NdW3JdID0gQXJyYXkuZnJvbSh1bnEpO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICBvcHRpb25zLm1hc3RlcktleUlwcyA9IEFycmF5LmZyb20oXG4gICAgbmV3IFNldChvcHRpb25zLm1hc3RlcktleUlwcy5jb25jYXQoZGVmYXVsdHMubWFzdGVyS2V5SXBzLCBvcHRpb25zLm1hc3RlcktleUlwcykpXG4gICk7XG59XG5cbi8vIFRob3NlIGNhbid0IGJlIHRlc3RlZCBhcyBpdCByZXF1aXJlcyBhIHN1YnByb2Nlc3Ncbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5mdW5jdGlvbiBjb25maWd1cmVMaXN0ZW5lcnMocGFyc2VTZXJ2ZXIpIHtcbiAgY29uc3Qgc2VydmVyID0gcGFyc2VTZXJ2ZXIuc2VydmVyO1xuICBjb25zdCBzb2NrZXRzID0ge307XG4gIC8qIEN1cnJlbnRseSwgZXhwcmVzcyBkb2Vzbid0IHNodXQgZG93biBpbW1lZGlhdGVseSBhZnRlciByZWNlaXZpbmcgU0lHSU5UL1NJR1RFUk0gaWYgaXQgaGFzIGNsaWVudCBjb25uZWN0aW9ucyB0aGF0IGhhdmVuJ3QgdGltZWQgb3V0LiAoVGhpcyBpcyBhIGtub3duIGlzc3VlIHdpdGggbm9kZSAtIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMjY0MilcbiAgICBUaGlzIGZ1bmN0aW9uLCBhbG9uZyB3aXRoIGBkZXN0cm95QWxpdmVDb25uZWN0aW9ucygpYCwgaW50ZW5kIHRvIGZpeCB0aGlzIGJlaGF2aW9yIHN1Y2ggdGhhdCBwYXJzZSBzZXJ2ZXIgd2lsbCBjbG9zZSBhbGwgb3BlbiBjb25uZWN0aW9ucyBhbmQgaW5pdGlhdGUgdGhlIHNodXRkb3duIHByb2Nlc3MgYXMgc29vbiBhcyBpdCByZWNlaXZlcyBhIFNJR0lOVC9TSUdURVJNIHNpZ25hbC4gKi9cbiAgc2VydmVyLm9uKCdjb25uZWN0aW9uJywgc29ja2V0ID0+IHtcbiAgICBjb25zdCBzb2NrZXRJZCA9IHNvY2tldC5yZW1vdGVBZGRyZXNzICsgJzonICsgc29ja2V0LnJlbW90ZVBvcnQ7XG4gICAgc29ja2V0c1tzb2NrZXRJZF0gPSBzb2NrZXQ7XG4gICAgc29ja2V0Lm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgIGRlbGV0ZSBzb2NrZXRzW3NvY2tldElkXTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgY29uc3QgZGVzdHJveUFsaXZlQ29ubmVjdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yIChjb25zdCBzb2NrZXRJZCBpbiBzb2NrZXRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBzb2NrZXRzW3NvY2tldElkXS5kZXN0cm95KCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8qICovXG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVNodXRkb3duID0gZnVuY3Rpb24gKCkge1xuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCdUZXJtaW5hdGlvbiBzaWduYWwgcmVjZWl2ZWQuIFNodXR0aW5nIGRvd24uJyk7XG4gICAgZGVzdHJveUFsaXZlQ29ubmVjdGlvbnMoKTtcbiAgICBzZXJ2ZXIuY2xvc2UoKTtcbiAgICBwYXJzZVNlcnZlci5oYW5kbGVTaHV0ZG93bigpO1xuICB9O1xuICBwcm9jZXNzLm9uKCdTSUdURVJNJywgaGFuZGxlU2h1dGRvd24pO1xuICBwcm9jZXNzLm9uKCdTSUdJTlQnLCBoYW5kbGVTaHV0ZG93bik7XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBhcnNlU2VydmVyO1xuIl19