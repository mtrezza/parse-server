"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParseWebSocket = exports.ParseWebSocketServer = void 0;

var _AdapterLoader = require("../Adapters/AdapterLoader");

var _WSAdapter = require("../Adapters/WebSocketServer/WSAdapter");

var _logger = _interopRequireDefault(require("../logger"));

var _events = _interopRequireDefault(require("events"));

var _util = require("util");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ParseWebSocketServer {
  constructor(server, onConnect, config) {
    config.server = server;
    const wss = (0, _AdapterLoader.loadAdapter)(config.wssAdapter, _WSAdapter.WSAdapter, config);

    wss.onListen = () => {
      _logger.default.info('Parse LiveQuery Server started running');
    };

    wss.onConnection = ws => {
      ws.waitingForPong = false;
      ws.on('pong', () => {
        this.waitingForPong = false;
      });
      ws.on('error', error => {
        _logger.default.error(error.message);

        _logger.default.error((0, _util.inspect)(ws, false));
      });
      onConnect(new ParseWebSocket(ws)); // Send ping to client periodically

      const pingIntervalId = setInterval(() => {
        if (!ws.waitingForPong) {
          ws.ping();
          ws.waitingForPong = true;
        } else {
          clearInterval(pingIntervalId);
          ws.terminate();
        }
      }, config.websocketTimeout || 10 * 1000);
    };

    wss.onError = error => {
      _logger.default.error(error);
    };

    wss.start();
    this.server = wss;
  }

  close() {
    if (this.server && this.server.close) {
      this.server.close();
    }
  }

}

exports.ParseWebSocketServer = ParseWebSocketServer;

class ParseWebSocket extends _events.default.EventEmitter {
  constructor(ws) {
    super();

    ws.onmessage = request => this.emit('message', request && request.data ? request.data : request);

    ws.onclose = () => this.emit('disconnect');

    this.ws = ws;
  }

  send(message) {
    this.ws.send(message);
  }

}

exports.ParseWebSocket = ParseWebSocket;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9MaXZlUXVlcnkvUGFyc2VXZWJTb2NrZXRTZXJ2ZXIuanMiXSwibmFtZXMiOlsiUGFyc2VXZWJTb2NrZXRTZXJ2ZXIiLCJjb25zdHJ1Y3RvciIsInNlcnZlciIsIm9uQ29ubmVjdCIsImNvbmZpZyIsIndzcyIsIndzc0FkYXB0ZXIiLCJXU0FkYXB0ZXIiLCJvbkxpc3RlbiIsImxvZ2dlciIsImluZm8iLCJvbkNvbm5lY3Rpb24iLCJ3cyIsIndhaXRpbmdGb3JQb25nIiwib24iLCJlcnJvciIsIm1lc3NhZ2UiLCJQYXJzZVdlYlNvY2tldCIsInBpbmdJbnRlcnZhbElkIiwic2V0SW50ZXJ2YWwiLCJwaW5nIiwiY2xlYXJJbnRlcnZhbCIsInRlcm1pbmF0ZSIsIndlYnNvY2tldFRpbWVvdXQiLCJvbkVycm9yIiwic3RhcnQiLCJjbG9zZSIsImV2ZW50cyIsIkV2ZW50RW1pdHRlciIsIm9ubWVzc2FnZSIsInJlcXVlc3QiLCJlbWl0IiwiZGF0YSIsIm9uY2xvc2UiLCJzZW5kIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7QUFFTyxNQUFNQSxvQkFBTixDQUEyQjtBQUdoQ0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFELEVBQWNDLFNBQWQsRUFBbUNDLE1BQW5DLEVBQTJDO0FBQ3BEQSxJQUFBQSxNQUFNLENBQUNGLE1BQVAsR0FBZ0JBLE1BQWhCO0FBQ0EsVUFBTUcsR0FBRyxHQUFHLGdDQUFZRCxNQUFNLENBQUNFLFVBQW5CLEVBQStCQyxvQkFBL0IsRUFBMENILE1BQTFDLENBQVo7O0FBQ0FDLElBQUFBLEdBQUcsQ0FBQ0csUUFBSixHQUFlLE1BQU07QUFDbkJDLHNCQUFPQyxJQUFQLENBQVksd0NBQVo7QUFDRCxLQUZEOztBQUdBTCxJQUFBQSxHQUFHLENBQUNNLFlBQUosR0FBbUJDLEVBQUUsSUFBSTtBQUN2QkEsTUFBQUEsRUFBRSxDQUFDQyxjQUFILEdBQW9CLEtBQXBCO0FBQ0FELE1BQUFBLEVBQUUsQ0FBQ0UsRUFBSCxDQUFNLE1BQU4sRUFBYyxNQUFNO0FBQ2xCLGFBQUtELGNBQUwsR0FBc0IsS0FBdEI7QUFDRCxPQUZEO0FBR0FELE1BQUFBLEVBQUUsQ0FBQ0UsRUFBSCxDQUFNLE9BQU4sRUFBZUMsS0FBSyxJQUFJO0FBQ3RCTix3QkFBT00sS0FBUCxDQUFhQSxLQUFLLENBQUNDLE9BQW5COztBQUNBUCx3QkFBT00sS0FBUCxDQUFhLG1CQUFRSCxFQUFSLEVBQVksS0FBWixDQUFiO0FBQ0QsT0FIRDtBQUlBVCxNQUFBQSxTQUFTLENBQUMsSUFBSWMsY0FBSixDQUFtQkwsRUFBbkIsQ0FBRCxDQUFULENBVHVCLENBVXZCOztBQUNBLFlBQU1NLGNBQWMsR0FBR0MsV0FBVyxDQUFDLE1BQU07QUFDdkMsWUFBSSxDQUFDUCxFQUFFLENBQUNDLGNBQVIsRUFBd0I7QUFDdEJELFVBQUFBLEVBQUUsQ0FBQ1EsSUFBSDtBQUNBUixVQUFBQSxFQUFFLENBQUNDLGNBQUgsR0FBb0IsSUFBcEI7QUFDRCxTQUhELE1BR087QUFDTFEsVUFBQUEsYUFBYSxDQUFDSCxjQUFELENBQWI7QUFDQU4sVUFBQUEsRUFBRSxDQUFDVSxTQUFIO0FBQ0Q7QUFDRixPQVJpQyxFQVEvQmxCLE1BQU0sQ0FBQ21CLGdCQUFQLElBQTJCLEtBQUssSUFSRCxDQUFsQztBQVNELEtBcEJEOztBQXFCQWxCLElBQUFBLEdBQUcsQ0FBQ21CLE9BQUosR0FBY1QsS0FBSyxJQUFJO0FBQ3JCTixzQkFBT00sS0FBUCxDQUFhQSxLQUFiO0FBQ0QsS0FGRDs7QUFHQVYsSUFBQUEsR0FBRyxDQUFDb0IsS0FBSjtBQUNBLFNBQUt2QixNQUFMLEdBQWNHLEdBQWQ7QUFDRDs7QUFFRHFCLEVBQUFBLEtBQUssR0FBRztBQUNOLFFBQUksS0FBS3hCLE1BQUwsSUFBZSxLQUFLQSxNQUFMLENBQVl3QixLQUEvQixFQUFzQztBQUNwQyxXQUFLeEIsTUFBTCxDQUFZd0IsS0FBWjtBQUNEO0FBQ0Y7O0FBekMrQjs7OztBQTRDM0IsTUFBTVQsY0FBTixTQUE2QlUsZ0JBQU9DLFlBQXBDLENBQWlEO0FBR3REM0IsRUFBQUEsV0FBVyxDQUFDVyxFQUFELEVBQVU7QUFDbkI7O0FBQ0FBLElBQUFBLEVBQUUsQ0FBQ2lCLFNBQUgsR0FBZUMsT0FBTyxJQUNwQixLQUFLQyxJQUFMLENBQVUsU0FBVixFQUFxQkQsT0FBTyxJQUFJQSxPQUFPLENBQUNFLElBQW5CLEdBQTBCRixPQUFPLENBQUNFLElBQWxDLEdBQXlDRixPQUE5RCxDQURGOztBQUVBbEIsSUFBQUEsRUFBRSxDQUFDcUIsT0FBSCxHQUFhLE1BQU0sS0FBS0YsSUFBTCxDQUFVLFlBQVYsQ0FBbkI7O0FBQ0EsU0FBS25CLEVBQUwsR0FBVUEsRUFBVjtBQUNEOztBQUVEc0IsRUFBQUEsSUFBSSxDQUFDbEIsT0FBRCxFQUFxQjtBQUN2QixTQUFLSixFQUFMLENBQVFzQixJQUFSLENBQWFsQixPQUFiO0FBQ0Q7O0FBYnFEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbG9hZEFkYXB0ZXIgfSBmcm9tICcuLi9BZGFwdGVycy9BZGFwdGVyTG9hZGVyJztcbmltcG9ydCB7IFdTQWRhcHRlciB9IGZyb20gJy4uL0FkYXB0ZXJzL1dlYlNvY2tldFNlcnZlci9XU0FkYXB0ZXInO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9sb2dnZXInO1xuaW1wb3J0IGV2ZW50cyBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgaW5zcGVjdCB9IGZyb20gJ3V0aWwnO1xuXG5leHBvcnQgY2xhc3MgUGFyc2VXZWJTb2NrZXRTZXJ2ZXIge1xuICBzZXJ2ZXI6IE9iamVjdDtcblxuICBjb25zdHJ1Y3RvcihzZXJ2ZXI6IGFueSwgb25Db25uZWN0OiBGdW5jdGlvbiwgY29uZmlnKSB7XG4gICAgY29uZmlnLnNlcnZlciA9IHNlcnZlcjtcbiAgICBjb25zdCB3c3MgPSBsb2FkQWRhcHRlcihjb25maWcud3NzQWRhcHRlciwgV1NBZGFwdGVyLCBjb25maWcpO1xuICAgIHdzcy5vbkxpc3RlbiA9ICgpID0+IHtcbiAgICAgIGxvZ2dlci5pbmZvKCdQYXJzZSBMaXZlUXVlcnkgU2VydmVyIHN0YXJ0ZWQgcnVubmluZycpO1xuICAgIH07XG4gICAgd3NzLm9uQ29ubmVjdGlvbiA9IHdzID0+IHtcbiAgICAgIHdzLndhaXRpbmdGb3JQb25nID0gZmFsc2U7XG4gICAgICB3cy5vbigncG9uZycsICgpID0+IHtcbiAgICAgICAgdGhpcy53YWl0aW5nRm9yUG9uZyA9IGZhbHNlO1xuICAgICAgfSk7XG4gICAgICB3cy5vbignZXJyb3InLCBlcnJvciA9PiB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGluc3BlY3Qod3MsIGZhbHNlKSk7XG4gICAgICB9KTtcbiAgICAgIG9uQ29ubmVjdChuZXcgUGFyc2VXZWJTb2NrZXQod3MpKTtcbiAgICAgIC8vIFNlbmQgcGluZyB0byBjbGllbnQgcGVyaW9kaWNhbGx5XG4gICAgICBjb25zdCBwaW5nSW50ZXJ2YWxJZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgaWYgKCF3cy53YWl0aW5nRm9yUG9uZykge1xuICAgICAgICAgIHdzLnBpbmcoKTtcbiAgICAgICAgICB3cy53YWl0aW5nRm9yUG9uZyA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChwaW5nSW50ZXJ2YWxJZCk7XG4gICAgICAgICAgd3MudGVybWluYXRlKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGNvbmZpZy53ZWJzb2NrZXRUaW1lb3V0IHx8IDEwICogMTAwMCk7XG4gICAgfTtcbiAgICB3c3Mub25FcnJvciA9IGVycm9yID0+IHtcbiAgICAgIGxvZ2dlci5lcnJvcihlcnJvcik7XG4gICAgfTtcbiAgICB3c3Muc3RhcnQoKTtcbiAgICB0aGlzLnNlcnZlciA9IHdzcztcbiAgfVxuXG4gIGNsb3NlKCkge1xuICAgIGlmICh0aGlzLnNlcnZlciAmJiB0aGlzLnNlcnZlci5jbG9zZSkge1xuICAgICAgdGhpcy5zZXJ2ZXIuY2xvc2UoKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlV2ViU29ja2V0IGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlciB7XG4gIHdzOiBhbnk7XG5cbiAgY29uc3RydWN0b3Iod3M6IGFueSkge1xuICAgIHN1cGVyKCk7XG4gICAgd3Mub25tZXNzYWdlID0gcmVxdWVzdCA9PlxuICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgcmVxdWVzdCAmJiByZXF1ZXN0LmRhdGEgPyByZXF1ZXN0LmRhdGEgOiByZXF1ZXN0KTtcbiAgICB3cy5vbmNsb3NlID0gKCkgPT4gdGhpcy5lbWl0KCdkaXNjb25uZWN0Jyk7XG4gICAgdGhpcy53cyA9IHdzO1xuICB9XG5cbiAgc2VuZChtZXNzYWdlOiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLndzLnNlbmQobWVzc2FnZSk7XG4gIH1cbn1cbiJdfQ==