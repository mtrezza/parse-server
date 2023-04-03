"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FilesRouter = void 0;
var _express = _interopRequireDefault(require("express"));
var _bodyParser = _interopRequireDefault(require("body-parser"));
var Middlewares = _interopRequireWildcard(require("../middlewares"));
var _node = _interopRequireDefault(require("parse/node"));
var _Config = _interopRequireDefault(require("../Config"));
var _mime = _interopRequireDefault(require("mime"));
var _logger = _interopRequireDefault(require("../logger"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const triggers = require('../triggers');
const http = require('http');
const Utils = require('../Utils');
const downloadFileFromURI = uri => {
  return new Promise((res, rej) => {
    http.get(uri, response => {
      response.setDefaultEncoding('base64');
      let body = `data:${response.headers['content-type']};base64,`;
      response.on('data', data => body += data);
      response.on('end', () => res(body));
    }).on('error', e => {
      rej(`Error downloading file from ${uri}: ${e.message}`);
    });
  });
};
const addFileDataIfNeeded = async file => {
  if (file._source.format === 'uri') {
    const base64 = await downloadFileFromURI(file._source.uri);
    file._previousSave = file;
    file._data = base64;
    file._requestTask = null;
  }
  return file;
};
class FilesRouter {
  expressRouter({
    maxUploadSize = '20Mb'
  } = {}) {
    var router = _express.default.Router();
    router.get('/files/:appId/:filename', this.getHandler);
    router.get('/files/:appId/metadata/:filename', this.metadataHandler);
    router.post('/files', function (req, res, next) {
      next(new _node.default.Error(_node.default.Error.INVALID_FILE_NAME, 'Filename not provided.'));
    });
    router.post('/files/:filename', _bodyParser.default.raw({
      type: () => {
        return true;
      },
      limit: maxUploadSize
    }),
    // Allow uploads without Content-Type, or with any Content-Type.
    Middlewares.handleParseHeaders, Middlewares.handleParseSession, this.createHandler);
    router.delete('/files/:filename', Middlewares.handleParseHeaders, Middlewares.handleParseSession, Middlewares.enforceMasterKeyAccess, this.deleteHandler);
    return router;
  }
  getHandler(req, res) {
    const config = _Config.default.get(req.params.appId);
    if (!config) {
      res.status(403);
      const err = new _node.default.Error(_node.default.Error.OPERATION_FORBIDDEN, 'Invalid application ID.');
      res.json({
        code: err.code,
        error: err.message
      });
      return;
    }
    const filesController = config.filesController;
    const filename = req.params.filename;
    const contentType = _mime.default.getType(filename);
    if (isFileStreamable(req, filesController)) {
      filesController.handleFileStream(config, filename, req, res, contentType).catch(() => {
        res.status(404);
        res.set('Content-Type', 'text/plain');
        res.end('File not found.');
      });
    } else {
      filesController.getFileData(config, filename).then(data => {
        res.status(200);
        res.set('Content-Type', contentType);
        res.set('Content-Length', data.length);
        res.end(data);
      }).catch(() => {
        res.status(404);
        res.set('Content-Type', 'text/plain');
        res.end('File not found.');
      });
    }
  }
  async createHandler(req, res, next) {
    const config = req.config;
    const user = req.auth.user;
    const isMaster = req.auth.isMaster;
    const isLinked = user && _node.default.AnonymousUtils.isLinked(user);
    if (!isMaster && !config.fileUpload.enableForAnonymousUser && isLinked) {
      next(new _node.default.Error(_node.default.Error.FILE_SAVE_ERROR, 'File upload by anonymous user is disabled.'));
      return;
    }
    if (!isMaster && !config.fileUpload.enableForAuthenticatedUser && !isLinked && user) {
      next(new _node.default.Error(_node.default.Error.FILE_SAVE_ERROR, 'File upload by authenticated user is disabled.'));
      return;
    }
    if (!isMaster && !config.fileUpload.enableForPublic && !user) {
      next(new _node.default.Error(_node.default.Error.FILE_SAVE_ERROR, 'File upload by public is disabled.'));
      return;
    }
    const filesController = config.filesController;
    const {
      filename
    } = req.params;
    const contentType = req.get('Content-type');
    if (!req.body || !req.body.length) {
      next(new _node.default.Error(_node.default.Error.FILE_SAVE_ERROR, 'Invalid file upload.'));
      return;
    }
    const error = filesController.validateFilename(filename);
    if (error) {
      next(error);
      return;
    }
    const base64 = req.body.toString('base64');
    const file = new _node.default.File(filename, {
      base64
    }, contentType);
    const {
      metadata = {},
      tags = {}
    } = req.fileData || {};
    if (req.config && req.config.requestKeywordDenylist) {
      // Scan request data for denied keywords
      for (const keyword of req.config.requestKeywordDenylist) {
        const match = Utils.objectContainsKeyValue(metadata, keyword.key, keyword.value) || Utils.objectContainsKeyValue(tags, keyword.key, keyword.value);
        if (match) {
          next(new _node.default.Error(_node.default.Error.INVALID_KEY_NAME, `Prohibited keyword in request data: ${JSON.stringify(keyword)}.`));
          return;
        }
      }
    }
    file.setTags(tags);
    file.setMetadata(metadata);
    const fileSize = Buffer.byteLength(req.body);
    const fileObject = {
      file,
      fileSize
    };
    try {
      // run beforeSaveFile trigger
      const triggerResult = await triggers.maybeRunFileTrigger(triggers.Types.beforeSave, fileObject, config, req.auth);
      let saveResult;
      // if a new ParseFile is returned check if it's an already saved file
      if (triggerResult instanceof _node.default.File) {
        fileObject.file = triggerResult;
        if (triggerResult.url()) {
          // set fileSize to null because we wont know how big it is here
          fileObject.fileSize = null;
          saveResult = {
            url: triggerResult.url(),
            name: triggerResult._name
          };
        }
      }
      // if the file returned by the trigger has already been saved skip saving anything
      if (!saveResult) {
        // if the ParseFile returned is type uri, download the file before saving it
        await addFileDataIfNeeded(fileObject.file);
        // update fileSize
        const bufferData = Buffer.from(fileObject.file._data, 'base64');
        fileObject.fileSize = Buffer.byteLength(bufferData);
        // prepare file options
        const fileOptions = {
          metadata: fileObject.file._metadata
        };
        // some s3-compatible providers (DigitalOcean, Linode) do not accept tags
        // so we do not include the tags option if it is empty.
        const fileTags = Object.keys(fileObject.file._tags).length > 0 ? {
          tags: fileObject.file._tags
        } : {};
        Object.assign(fileOptions, fileTags);
        // save file
        const createFileResult = await filesController.createFile(config, fileObject.file._name, bufferData, fileObject.file._source.type, fileOptions);
        // update file with new data
        fileObject.file._name = createFileResult.name;
        fileObject.file._url = createFileResult.url;
        fileObject.file._requestTask = null;
        fileObject.file._previousSave = Promise.resolve(fileObject.file);
        saveResult = {
          url: createFileResult.url,
          name: createFileResult.name
        };
      }
      // run afterSaveFile trigger
      await triggers.maybeRunFileTrigger(triggers.Types.afterSave, fileObject, config, req.auth);
      res.status(201);
      res.set('Location', saveResult.url);
      res.json(saveResult);
    } catch (e) {
      _logger.default.error('Error creating a file: ', e);
      const error = triggers.resolveError(e, {
        code: _node.default.Error.FILE_SAVE_ERROR,
        message: `Could not store file: ${fileObject.file._name}.`
      });
      next(error);
    }
  }
  async deleteHandler(req, res, next) {
    try {
      const {
        filesController
      } = req.config;
      const {
        filename
      } = req.params;
      // run beforeDeleteFile trigger
      const file = new _node.default.File(filename);
      file._url = filesController.adapter.getFileLocation(req.config, filename);
      const fileObject = {
        file,
        fileSize: null
      };
      await triggers.maybeRunFileTrigger(triggers.Types.beforeDelete, fileObject, req.config, req.auth);
      // delete file
      await filesController.deleteFile(req.config, filename);
      // run afterDeleteFile trigger
      await triggers.maybeRunFileTrigger(triggers.Types.afterDelete, fileObject, req.config, req.auth);
      res.status(200);
      // TODO: return useful JSON here?
      res.end();
    } catch (e) {
      _logger.default.error('Error deleting a file: ', e);
      const error = triggers.resolveError(e, {
        code: _node.default.Error.FILE_DELETE_ERROR,
        message: 'Could not delete file.'
      });
      next(error);
    }
  }
  async metadataHandler(req, res) {
    try {
      const config = _Config.default.get(req.params.appId);
      const {
        filesController
      } = config;
      const {
        filename
      } = req.params;
      const data = await filesController.getMetadata(filename);
      res.status(200);
      res.json(data);
    } catch (e) {
      res.status(200);
      res.json({});
    }
  }
}
exports.FilesRouter = FilesRouter;
function isFileStreamable(req, filesController) {
  const range = (req.get('Range') || '/-/').split('-');
  const start = Number(range[0]);
  const end = Number(range[1]);
  return (!isNaN(start) || !isNaN(end)) && typeof filesController.adapter.handleFileStream === 'function';
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJ0cmlnZ2VycyIsInJlcXVpcmUiLCJodHRwIiwiVXRpbHMiLCJkb3dubG9hZEZpbGVGcm9tVVJJIiwidXJpIiwiUHJvbWlzZSIsInJlcyIsInJlaiIsImdldCIsInJlc3BvbnNlIiwic2V0RGVmYXVsdEVuY29kaW5nIiwiYm9keSIsImhlYWRlcnMiLCJvbiIsImRhdGEiLCJlIiwibWVzc2FnZSIsImFkZEZpbGVEYXRhSWZOZWVkZWQiLCJmaWxlIiwiX3NvdXJjZSIsImZvcm1hdCIsImJhc2U2NCIsIl9wcmV2aW91c1NhdmUiLCJfZGF0YSIsIl9yZXF1ZXN0VGFzayIsIkZpbGVzUm91dGVyIiwiZXhwcmVzc1JvdXRlciIsIm1heFVwbG9hZFNpemUiLCJyb3V0ZXIiLCJleHByZXNzIiwiUm91dGVyIiwiZ2V0SGFuZGxlciIsIm1ldGFkYXRhSGFuZGxlciIsInBvc3QiLCJyZXEiLCJuZXh0IiwiUGFyc2UiLCJFcnJvciIsIklOVkFMSURfRklMRV9OQU1FIiwiQm9keVBhcnNlciIsInJhdyIsInR5cGUiLCJsaW1pdCIsIk1pZGRsZXdhcmVzIiwiaGFuZGxlUGFyc2VIZWFkZXJzIiwiaGFuZGxlUGFyc2VTZXNzaW9uIiwiY3JlYXRlSGFuZGxlciIsImRlbGV0ZSIsImVuZm9yY2VNYXN0ZXJLZXlBY2Nlc3MiLCJkZWxldGVIYW5kbGVyIiwiY29uZmlnIiwiQ29uZmlnIiwicGFyYW1zIiwiYXBwSWQiLCJzdGF0dXMiLCJlcnIiLCJPUEVSQVRJT05fRk9SQklEREVOIiwianNvbiIsImNvZGUiLCJlcnJvciIsImZpbGVzQ29udHJvbGxlciIsImZpbGVuYW1lIiwiY29udGVudFR5cGUiLCJtaW1lIiwiZ2V0VHlwZSIsImlzRmlsZVN0cmVhbWFibGUiLCJoYW5kbGVGaWxlU3RyZWFtIiwiY2F0Y2giLCJzZXQiLCJlbmQiLCJnZXRGaWxlRGF0YSIsInRoZW4iLCJsZW5ndGgiLCJ1c2VyIiwiYXV0aCIsImlzTWFzdGVyIiwiaXNMaW5rZWQiLCJBbm9ueW1vdXNVdGlscyIsImZpbGVVcGxvYWQiLCJlbmFibGVGb3JBbm9ueW1vdXNVc2VyIiwiRklMRV9TQVZFX0VSUk9SIiwiZW5hYmxlRm9yQXV0aGVudGljYXRlZFVzZXIiLCJlbmFibGVGb3JQdWJsaWMiLCJ2YWxpZGF0ZUZpbGVuYW1lIiwidG9TdHJpbmciLCJGaWxlIiwibWV0YWRhdGEiLCJ0YWdzIiwiZmlsZURhdGEiLCJyZXF1ZXN0S2V5d29yZERlbnlsaXN0Iiwia2V5d29yZCIsIm1hdGNoIiwib2JqZWN0Q29udGFpbnNLZXlWYWx1ZSIsImtleSIsInZhbHVlIiwiSU5WQUxJRF9LRVlfTkFNRSIsIkpTT04iLCJzdHJpbmdpZnkiLCJzZXRUYWdzIiwic2V0TWV0YWRhdGEiLCJmaWxlU2l6ZSIsIkJ1ZmZlciIsImJ5dGVMZW5ndGgiLCJmaWxlT2JqZWN0IiwidHJpZ2dlclJlc3VsdCIsIm1heWJlUnVuRmlsZVRyaWdnZXIiLCJUeXBlcyIsImJlZm9yZVNhdmUiLCJzYXZlUmVzdWx0IiwidXJsIiwibmFtZSIsIl9uYW1lIiwiYnVmZmVyRGF0YSIsImZyb20iLCJmaWxlT3B0aW9ucyIsIl9tZXRhZGF0YSIsImZpbGVUYWdzIiwiT2JqZWN0Iiwia2V5cyIsIl90YWdzIiwiYXNzaWduIiwiY3JlYXRlRmlsZVJlc3VsdCIsImNyZWF0ZUZpbGUiLCJfdXJsIiwicmVzb2x2ZSIsImFmdGVyU2F2ZSIsImxvZ2dlciIsInJlc29sdmVFcnJvciIsImFkYXB0ZXIiLCJnZXRGaWxlTG9jYXRpb24iLCJiZWZvcmVEZWxldGUiLCJkZWxldGVGaWxlIiwiYWZ0ZXJEZWxldGUiLCJGSUxFX0RFTEVURV9FUlJPUiIsImdldE1ldGFkYXRhIiwicmFuZ2UiLCJzcGxpdCIsInN0YXJ0IiwiTnVtYmVyIiwiaXNOYU4iXSwic291cmNlcyI6WyIuLi8uLi9zcmMvUm91dGVycy9GaWxlc1JvdXRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZXhwcmVzcyBmcm9tICdleHByZXNzJztcbmltcG9ydCBCb2R5UGFyc2VyIGZyb20gJ2JvZHktcGFyc2VyJztcbmltcG9ydCAqIGFzIE1pZGRsZXdhcmVzIGZyb20gJy4uL21pZGRsZXdhcmVzJztcbmltcG9ydCBQYXJzZSBmcm9tICdwYXJzZS9ub2RlJztcbmltcG9ydCBDb25maWcgZnJvbSAnLi4vQ29uZmlnJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9sb2dnZXInO1xuY29uc3QgdHJpZ2dlcnMgPSByZXF1aXJlKCcuLi90cmlnZ2VycycpO1xuY29uc3QgaHR0cCA9IHJlcXVpcmUoJ2h0dHAnKTtcbmNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi4vVXRpbHMnKTtcblxuY29uc3QgZG93bmxvYWRGaWxlRnJvbVVSSSA9IHVyaSA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcbiAgICBodHRwXG4gICAgICAuZ2V0KHVyaSwgcmVzcG9uc2UgPT4ge1xuICAgICAgICByZXNwb25zZS5zZXREZWZhdWx0RW5jb2RpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICBsZXQgYm9keSA9IGBkYXRhOiR7cmVzcG9uc2UuaGVhZGVyc1snY29udGVudC10eXBlJ119O2Jhc2U2NCxgO1xuICAgICAgICByZXNwb25zZS5vbignZGF0YScsIGRhdGEgPT4gKGJvZHkgKz0gZGF0YSkpO1xuICAgICAgICByZXNwb25zZS5vbignZW5kJywgKCkgPT4gcmVzKGJvZHkpKTtcbiAgICAgIH0pXG4gICAgICAub24oJ2Vycm9yJywgZSA9PiB7XG4gICAgICAgIHJlaihgRXJyb3IgZG93bmxvYWRpbmcgZmlsZSBmcm9tICR7dXJpfTogJHtlLm1lc3NhZ2V9YCk7XG4gICAgICB9KTtcbiAgfSk7XG59O1xuXG5jb25zdCBhZGRGaWxlRGF0YUlmTmVlZGVkID0gYXN5bmMgZmlsZSA9PiB7XG4gIGlmIChmaWxlLl9zb3VyY2UuZm9ybWF0ID09PSAndXJpJykge1xuICAgIGNvbnN0IGJhc2U2NCA9IGF3YWl0IGRvd25sb2FkRmlsZUZyb21VUkkoZmlsZS5fc291cmNlLnVyaSk7XG4gICAgZmlsZS5fcHJldmlvdXNTYXZlID0gZmlsZTtcbiAgICBmaWxlLl9kYXRhID0gYmFzZTY0O1xuICAgIGZpbGUuX3JlcXVlc3RUYXNrID0gbnVsbDtcbiAgfVxuICByZXR1cm4gZmlsZTtcbn07XG5cbmV4cG9ydCBjbGFzcyBGaWxlc1JvdXRlciB7XG4gIGV4cHJlc3NSb3V0ZXIoeyBtYXhVcGxvYWRTaXplID0gJzIwTWInIH0gPSB7fSkge1xuICAgIHZhciByb3V0ZXIgPSBleHByZXNzLlJvdXRlcigpO1xuICAgIHJvdXRlci5nZXQoJy9maWxlcy86YXBwSWQvOmZpbGVuYW1lJywgdGhpcy5nZXRIYW5kbGVyKTtcbiAgICByb3V0ZXIuZ2V0KCcvZmlsZXMvOmFwcElkL21ldGFkYXRhLzpmaWxlbmFtZScsIHRoaXMubWV0YWRhdGFIYW5kbGVyKTtcblxuICAgIHJvdXRlci5wb3N0KCcvZmlsZXMnLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICAgIG5leHQobmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfRklMRV9OQU1FLCAnRmlsZW5hbWUgbm90IHByb3ZpZGVkLicpKTtcbiAgICB9KTtcblxuICAgIHJvdXRlci5wb3N0KFxuICAgICAgJy9maWxlcy86ZmlsZW5hbWUnLFxuICAgICAgQm9keVBhcnNlci5yYXcoe1xuICAgICAgICB0eXBlOiAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIGxpbWl0OiBtYXhVcGxvYWRTaXplLFxuICAgICAgfSksIC8vIEFsbG93IHVwbG9hZHMgd2l0aG91dCBDb250ZW50LVR5cGUsIG9yIHdpdGggYW55IENvbnRlbnQtVHlwZS5cbiAgICAgIE1pZGRsZXdhcmVzLmhhbmRsZVBhcnNlSGVhZGVycyxcbiAgICAgIE1pZGRsZXdhcmVzLmhhbmRsZVBhcnNlU2Vzc2lvbixcbiAgICAgIHRoaXMuY3JlYXRlSGFuZGxlclxuICAgICk7XG5cbiAgICByb3V0ZXIuZGVsZXRlKFxuICAgICAgJy9maWxlcy86ZmlsZW5hbWUnLFxuICAgICAgTWlkZGxld2FyZXMuaGFuZGxlUGFyc2VIZWFkZXJzLFxuICAgICAgTWlkZGxld2FyZXMuaGFuZGxlUGFyc2VTZXNzaW9uLFxuICAgICAgTWlkZGxld2FyZXMuZW5mb3JjZU1hc3RlcktleUFjY2VzcyxcbiAgICAgIHRoaXMuZGVsZXRlSGFuZGxlclxuICAgICk7XG4gICAgcmV0dXJuIHJvdXRlcjtcbiAgfVxuXG4gIGdldEhhbmRsZXIocmVxLCByZXMpIHtcbiAgICBjb25zdCBjb25maWcgPSBDb25maWcuZ2V0KHJlcS5wYXJhbXMuYXBwSWQpO1xuICAgIGlmICghY29uZmlnKSB7XG4gICAgICByZXMuc3RhdHVzKDQwMyk7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT1BFUkFUSU9OX0ZPUkJJRERFTiwgJ0ludmFsaWQgYXBwbGljYXRpb24gSUQuJyk7XG4gICAgICByZXMuanNvbih7IGNvZGU6IGVyci5jb2RlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGZpbGVzQ29udHJvbGxlciA9IGNvbmZpZy5maWxlc0NvbnRyb2xsZXI7XG4gICAgY29uc3QgZmlsZW5hbWUgPSByZXEucGFyYW1zLmZpbGVuYW1lO1xuICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gbWltZS5nZXRUeXBlKGZpbGVuYW1lKTtcbiAgICBpZiAoaXNGaWxlU3RyZWFtYWJsZShyZXEsIGZpbGVzQ29udHJvbGxlcikpIHtcbiAgICAgIGZpbGVzQ29udHJvbGxlci5oYW5kbGVGaWxlU3RyZWFtKGNvbmZpZywgZmlsZW5hbWUsIHJlcSwgcmVzLCBjb250ZW50VHlwZSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICByZXMuc3RhdHVzKDQwNCk7XG4gICAgICAgIHJlcy5zZXQoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L3BsYWluJyk7XG4gICAgICAgIHJlcy5lbmQoJ0ZpbGUgbm90IGZvdW5kLicpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbGVzQ29udHJvbGxlclxuICAgICAgICAuZ2V0RmlsZURhdGEoY29uZmlnLCBmaWxlbmFtZSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgcmVzLnN0YXR1cygyMDApO1xuICAgICAgICAgIHJlcy5zZXQoJ0NvbnRlbnQtVHlwZScsIGNvbnRlbnRUeXBlKTtcbiAgICAgICAgICByZXMuc2V0KCdDb250ZW50LUxlbmd0aCcsIGRhdGEubGVuZ3RoKTtcbiAgICAgICAgICByZXMuZW5kKGRhdGEpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KTtcbiAgICAgICAgICByZXMuc2V0KCdDb250ZW50LVR5cGUnLCAndGV4dC9wbGFpbicpO1xuICAgICAgICAgIHJlcy5lbmQoJ0ZpbGUgbm90IGZvdW5kLicpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBjcmVhdGVIYW5kbGVyKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY29uZmlnID0gcmVxLmNvbmZpZztcbiAgICBjb25zdCB1c2VyID0gcmVxLmF1dGgudXNlcjtcbiAgICBjb25zdCBpc01hc3RlciA9IHJlcS5hdXRoLmlzTWFzdGVyO1xuICAgIGNvbnN0IGlzTGlua2VkID0gdXNlciAmJiBQYXJzZS5Bbm9ueW1vdXNVdGlscy5pc0xpbmtlZCh1c2VyKTtcbiAgICBpZiAoIWlzTWFzdGVyICYmICFjb25maWcuZmlsZVVwbG9hZC5lbmFibGVGb3JBbm9ueW1vdXNVc2VyICYmIGlzTGlua2VkKSB7XG4gICAgICBuZXh0KFxuICAgICAgICBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuRklMRV9TQVZFX0VSUk9SLCAnRmlsZSB1cGxvYWQgYnkgYW5vbnltb3VzIHVzZXIgaXMgZGlzYWJsZWQuJylcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghaXNNYXN0ZXIgJiYgIWNvbmZpZy5maWxlVXBsb2FkLmVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyICYmICFpc0xpbmtlZCAmJiB1c2VyKSB7XG4gICAgICBuZXh0KFxuICAgICAgICBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgUGFyc2UuRXJyb3IuRklMRV9TQVZFX0VSUk9SLFxuICAgICAgICAgICdGaWxlIHVwbG9hZCBieSBhdXRoZW50aWNhdGVkIHVzZXIgaXMgZGlzYWJsZWQuJ1xuICAgICAgICApXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIWlzTWFzdGVyICYmICFjb25maWcuZmlsZVVwbG9hZC5lbmFibGVGb3JQdWJsaWMgJiYgIXVzZXIpIHtcbiAgICAgIG5leHQobmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLkZJTEVfU0FWRV9FUlJPUiwgJ0ZpbGUgdXBsb2FkIGJ5IHB1YmxpYyBpcyBkaXNhYmxlZC4nKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGZpbGVzQ29udHJvbGxlciA9IGNvbmZpZy5maWxlc0NvbnRyb2xsZXI7XG4gICAgY29uc3QgeyBmaWxlbmFtZSB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBjb250ZW50VHlwZSA9IHJlcS5nZXQoJ0NvbnRlbnQtdHlwZScpO1xuXG4gICAgaWYgKCFyZXEuYm9keSB8fCAhcmVxLmJvZHkubGVuZ3RoKSB7XG4gICAgICBuZXh0KG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5GSUxFX1NBVkVfRVJST1IsICdJbnZhbGlkIGZpbGUgdXBsb2FkLicpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBlcnJvciA9IGZpbGVzQ29udHJvbGxlci52YWxpZGF0ZUZpbGVuYW1lKGZpbGVuYW1lKTtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJhc2U2NCA9IHJlcS5ib2R5LnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICBjb25zdCBmaWxlID0gbmV3IFBhcnNlLkZpbGUoZmlsZW5hbWUsIHsgYmFzZTY0IH0sIGNvbnRlbnRUeXBlKTtcbiAgICBjb25zdCB7IG1ldGFkYXRhID0ge30sIHRhZ3MgPSB7fSB9ID0gcmVxLmZpbGVEYXRhIHx8IHt9O1xuICAgIGlmIChyZXEuY29uZmlnICYmIHJlcS5jb25maWcucmVxdWVzdEtleXdvcmREZW55bGlzdCkge1xuICAgICAgLy8gU2NhbiByZXF1ZXN0IGRhdGEgZm9yIGRlbmllZCBrZXl3b3Jkc1xuICAgICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHJlcS5jb25maWcucmVxdWVzdEtleXdvcmREZW55bGlzdCkge1xuICAgICAgICBjb25zdCBtYXRjaCA9XG4gICAgICAgICAgVXRpbHMub2JqZWN0Q29udGFpbnNLZXlWYWx1ZShtZXRhZGF0YSwga2V5d29yZC5rZXksIGtleXdvcmQudmFsdWUpIHx8XG4gICAgICAgICAgVXRpbHMub2JqZWN0Q29udGFpbnNLZXlWYWx1ZSh0YWdzLCBrZXl3b3JkLmtleSwga2V5d29yZC52YWx1ZSk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIG5leHQoXG4gICAgICAgICAgICBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsXG4gICAgICAgICAgICAgIGBQcm9oaWJpdGVkIGtleXdvcmQgaW4gcmVxdWVzdCBkYXRhOiAke0pTT04uc3RyaW5naWZ5KGtleXdvcmQpfS5gXG4gICAgICAgICAgICApXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZmlsZS5zZXRUYWdzKHRhZ3MpO1xuICAgIGZpbGUuc2V0TWV0YWRhdGEobWV0YWRhdGEpO1xuICAgIGNvbnN0IGZpbGVTaXplID0gQnVmZmVyLmJ5dGVMZW5ndGgocmVxLmJvZHkpO1xuICAgIGNvbnN0IGZpbGVPYmplY3QgPSB7IGZpbGUsIGZpbGVTaXplIH07XG4gICAgdHJ5IHtcbiAgICAgIC8vIHJ1biBiZWZvcmVTYXZlRmlsZSB0cmlnZ2VyXG4gICAgICBjb25zdCB0cmlnZ2VyUmVzdWx0ID0gYXdhaXQgdHJpZ2dlcnMubWF5YmVSdW5GaWxlVHJpZ2dlcihcbiAgICAgICAgdHJpZ2dlcnMuVHlwZXMuYmVmb3JlU2F2ZSxcbiAgICAgICAgZmlsZU9iamVjdCxcbiAgICAgICAgY29uZmlnLFxuICAgICAgICByZXEuYXV0aFxuICAgICAgKTtcbiAgICAgIGxldCBzYXZlUmVzdWx0O1xuICAgICAgLy8gaWYgYSBuZXcgUGFyc2VGaWxlIGlzIHJldHVybmVkIGNoZWNrIGlmIGl0J3MgYW4gYWxyZWFkeSBzYXZlZCBmaWxlXG4gICAgICBpZiAodHJpZ2dlclJlc3VsdCBpbnN0YW5jZW9mIFBhcnNlLkZpbGUpIHtcbiAgICAgICAgZmlsZU9iamVjdC5maWxlID0gdHJpZ2dlclJlc3VsdDtcbiAgICAgICAgaWYgKHRyaWdnZXJSZXN1bHQudXJsKCkpIHtcbiAgICAgICAgICAvLyBzZXQgZmlsZVNpemUgdG8gbnVsbCBiZWNhdXNlIHdlIHdvbnQga25vdyBob3cgYmlnIGl0IGlzIGhlcmVcbiAgICAgICAgICBmaWxlT2JqZWN0LmZpbGVTaXplID0gbnVsbDtcbiAgICAgICAgICBzYXZlUmVzdWx0ID0ge1xuICAgICAgICAgICAgdXJsOiB0cmlnZ2VyUmVzdWx0LnVybCgpLFxuICAgICAgICAgICAgbmFtZTogdHJpZ2dlclJlc3VsdC5fbmFtZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBpZiB0aGUgZmlsZSByZXR1cm5lZCBieSB0aGUgdHJpZ2dlciBoYXMgYWxyZWFkeSBiZWVuIHNhdmVkIHNraXAgc2F2aW5nIGFueXRoaW5nXG4gICAgICBpZiAoIXNhdmVSZXN1bHQpIHtcbiAgICAgICAgLy8gaWYgdGhlIFBhcnNlRmlsZSByZXR1cm5lZCBpcyB0eXBlIHVyaSwgZG93bmxvYWQgdGhlIGZpbGUgYmVmb3JlIHNhdmluZyBpdFxuICAgICAgICBhd2FpdCBhZGRGaWxlRGF0YUlmTmVlZGVkKGZpbGVPYmplY3QuZmlsZSk7XG4gICAgICAgIC8vIHVwZGF0ZSBmaWxlU2l6ZVxuICAgICAgICBjb25zdCBidWZmZXJEYXRhID0gQnVmZmVyLmZyb20oZmlsZU9iamVjdC5maWxlLl9kYXRhLCAnYmFzZTY0Jyk7XG4gICAgICAgIGZpbGVPYmplY3QuZmlsZVNpemUgPSBCdWZmZXIuYnl0ZUxlbmd0aChidWZmZXJEYXRhKTtcbiAgICAgICAgLy8gcHJlcGFyZSBmaWxlIG9wdGlvbnNcbiAgICAgICAgY29uc3QgZmlsZU9wdGlvbnMgPSB7XG4gICAgICAgICAgbWV0YWRhdGE6IGZpbGVPYmplY3QuZmlsZS5fbWV0YWRhdGEsXG4gICAgICAgIH07XG4gICAgICAgIC8vIHNvbWUgczMtY29tcGF0aWJsZSBwcm92aWRlcnMgKERpZ2l0YWxPY2VhbiwgTGlub2RlKSBkbyBub3QgYWNjZXB0IHRhZ3NcbiAgICAgICAgLy8gc28gd2UgZG8gbm90IGluY2x1ZGUgdGhlIHRhZ3Mgb3B0aW9uIGlmIGl0IGlzIGVtcHR5LlxuICAgICAgICBjb25zdCBmaWxlVGFncyA9XG4gICAgICAgICAgT2JqZWN0LmtleXMoZmlsZU9iamVjdC5maWxlLl90YWdzKS5sZW5ndGggPiAwID8geyB0YWdzOiBmaWxlT2JqZWN0LmZpbGUuX3RhZ3MgfSA6IHt9O1xuICAgICAgICBPYmplY3QuYXNzaWduKGZpbGVPcHRpb25zLCBmaWxlVGFncyk7XG4gICAgICAgIC8vIHNhdmUgZmlsZVxuICAgICAgICBjb25zdCBjcmVhdGVGaWxlUmVzdWx0ID0gYXdhaXQgZmlsZXNDb250cm9sbGVyLmNyZWF0ZUZpbGUoXG4gICAgICAgICAgY29uZmlnLFxuICAgICAgICAgIGZpbGVPYmplY3QuZmlsZS5fbmFtZSxcbiAgICAgICAgICBidWZmZXJEYXRhLFxuICAgICAgICAgIGZpbGVPYmplY3QuZmlsZS5fc291cmNlLnR5cGUsXG4gICAgICAgICAgZmlsZU9wdGlvbnNcbiAgICAgICAgKTtcbiAgICAgICAgLy8gdXBkYXRlIGZpbGUgd2l0aCBuZXcgZGF0YVxuICAgICAgICBmaWxlT2JqZWN0LmZpbGUuX25hbWUgPSBjcmVhdGVGaWxlUmVzdWx0Lm5hbWU7XG4gICAgICAgIGZpbGVPYmplY3QuZmlsZS5fdXJsID0gY3JlYXRlRmlsZVJlc3VsdC51cmw7XG4gICAgICAgIGZpbGVPYmplY3QuZmlsZS5fcmVxdWVzdFRhc2sgPSBudWxsO1xuICAgICAgICBmaWxlT2JqZWN0LmZpbGUuX3ByZXZpb3VzU2F2ZSA9IFByb21pc2UucmVzb2x2ZShmaWxlT2JqZWN0LmZpbGUpO1xuICAgICAgICBzYXZlUmVzdWx0ID0ge1xuICAgICAgICAgIHVybDogY3JlYXRlRmlsZVJlc3VsdC51cmwsXG4gICAgICAgICAgbmFtZTogY3JlYXRlRmlsZVJlc3VsdC5uYW1lLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgLy8gcnVuIGFmdGVyU2F2ZUZpbGUgdHJpZ2dlclxuICAgICAgYXdhaXQgdHJpZ2dlcnMubWF5YmVSdW5GaWxlVHJpZ2dlcih0cmlnZ2Vycy5UeXBlcy5hZnRlclNhdmUsIGZpbGVPYmplY3QsIGNvbmZpZywgcmVxLmF1dGgpO1xuICAgICAgcmVzLnN0YXR1cygyMDEpO1xuICAgICAgcmVzLnNldCgnTG9jYXRpb24nLCBzYXZlUmVzdWx0LnVybCk7XG4gICAgICByZXMuanNvbihzYXZlUmVzdWx0KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIGEgZmlsZTogJywgZSk7XG4gICAgICBjb25zdCBlcnJvciA9IHRyaWdnZXJzLnJlc29sdmVFcnJvcihlLCB7XG4gICAgICAgIGNvZGU6IFBhcnNlLkVycm9yLkZJTEVfU0FWRV9FUlJPUixcbiAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBzdG9yZSBmaWxlOiAke2ZpbGVPYmplY3QuZmlsZS5fbmFtZX0uYCxcbiAgICAgIH0pO1xuICAgICAgbmV4dChlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZGVsZXRlSGFuZGxlcihyZXEsIHJlcywgbmV4dCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGZpbGVzQ29udHJvbGxlciB9ID0gcmVxLmNvbmZpZztcbiAgICAgIGNvbnN0IHsgZmlsZW5hbWUgfSA9IHJlcS5wYXJhbXM7XG4gICAgICAvLyBydW4gYmVmb3JlRGVsZXRlRmlsZSB0cmlnZ2VyXG4gICAgICBjb25zdCBmaWxlID0gbmV3IFBhcnNlLkZpbGUoZmlsZW5hbWUpO1xuICAgICAgZmlsZS5fdXJsID0gZmlsZXNDb250cm9sbGVyLmFkYXB0ZXIuZ2V0RmlsZUxvY2F0aW9uKHJlcS5jb25maWcsIGZpbGVuYW1lKTtcbiAgICAgIGNvbnN0IGZpbGVPYmplY3QgPSB7IGZpbGUsIGZpbGVTaXplOiBudWxsIH07XG4gICAgICBhd2FpdCB0cmlnZ2Vycy5tYXliZVJ1bkZpbGVUcmlnZ2VyKFxuICAgICAgICB0cmlnZ2Vycy5UeXBlcy5iZWZvcmVEZWxldGUsXG4gICAgICAgIGZpbGVPYmplY3QsXG4gICAgICAgIHJlcS5jb25maWcsXG4gICAgICAgIHJlcS5hdXRoXG4gICAgICApO1xuICAgICAgLy8gZGVsZXRlIGZpbGVcbiAgICAgIGF3YWl0IGZpbGVzQ29udHJvbGxlci5kZWxldGVGaWxlKHJlcS5jb25maWcsIGZpbGVuYW1lKTtcbiAgICAgIC8vIHJ1biBhZnRlckRlbGV0ZUZpbGUgdHJpZ2dlclxuICAgICAgYXdhaXQgdHJpZ2dlcnMubWF5YmVSdW5GaWxlVHJpZ2dlcihcbiAgICAgICAgdHJpZ2dlcnMuVHlwZXMuYWZ0ZXJEZWxldGUsXG4gICAgICAgIGZpbGVPYmplY3QsXG4gICAgICAgIHJlcS5jb25maWcsXG4gICAgICAgIHJlcS5hdXRoXG4gICAgICApO1xuICAgICAgcmVzLnN0YXR1cygyMDApO1xuICAgICAgLy8gVE9ETzogcmV0dXJuIHVzZWZ1bCBKU09OIGhlcmU/XG4gICAgICByZXMuZW5kKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbG9nZ2VyLmVycm9yKCdFcnJvciBkZWxldGluZyBhIGZpbGU6ICcsIGUpO1xuICAgICAgY29uc3QgZXJyb3IgPSB0cmlnZ2Vycy5yZXNvbHZlRXJyb3IoZSwge1xuICAgICAgICBjb2RlOiBQYXJzZS5FcnJvci5GSUxFX0RFTEVURV9FUlJPUixcbiAgICAgICAgbWVzc2FnZTogJ0NvdWxkIG5vdCBkZWxldGUgZmlsZS4nLFxuICAgICAgfSk7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBtZXRhZGF0YUhhbmRsZXIocmVxLCByZXMpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29uZmlnID0gQ29uZmlnLmdldChyZXEucGFyYW1zLmFwcElkKTtcbiAgICAgIGNvbnN0IHsgZmlsZXNDb250cm9sbGVyIH0gPSBjb25maWc7XG4gICAgICBjb25zdCB7IGZpbGVuYW1lIH0gPSByZXEucGFyYW1zO1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGZpbGVzQ29udHJvbGxlci5nZXRNZXRhZGF0YShmaWxlbmFtZSk7XG4gICAgICByZXMuc3RhdHVzKDIwMCk7XG4gICAgICByZXMuanNvbihkYXRhKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXMuc3RhdHVzKDIwMCk7XG4gICAgICByZXMuanNvbih7fSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzRmlsZVN0cmVhbWFibGUocmVxLCBmaWxlc0NvbnRyb2xsZXIpIHtcbiAgY29uc3QgcmFuZ2UgPSAocmVxLmdldCgnUmFuZ2UnKSB8fCAnLy0vJykuc3BsaXQoJy0nKTtcbiAgY29uc3Qgc3RhcnQgPSBOdW1iZXIocmFuZ2VbMF0pO1xuICBjb25zdCBlbmQgPSBOdW1iZXIocmFuZ2VbMV0pO1xuICByZXR1cm4gKFxuICAgICghaXNOYU4oc3RhcnQpIHx8ICFpc05hTihlbmQpKSAmJiB0eXBlb2YgZmlsZXNDb250cm9sbGVyLmFkYXB0ZXIuaGFuZGxlRmlsZVN0cmVhbSA9PT0gJ2Z1bmN0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