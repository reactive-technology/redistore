const winston = require('winston');
require('winston-daily-rotate-file');
// Imports the Google Cloud client library
const { Logging } = require('@google-cloud/logging');
const systemlogger = console
const REDIRECT_STD = false;
const path = require('path');
const fs = require('fs');
const Util = require('util');
const os = require('os');

const moment = require('moment-tokens');
const ENV = process.env.ENV;
const CLEAN_MATCHES = process.env.CLEAN_MATCHES || 'no';
const COLORED_CONSOLE = process.env.COLORED_CONSOLE || 'no';
const CONSOLE_DEBUG_LEVEL = process.env.CONSOLE_DEBUG_LEVEL || 'no';
const PRJ_ROOT = `${path.resolve(__dirname)}/..`;
const USE_WINSTON = process.env.USE_WINSTON || 'yes';
const ADD_WINSTON_CONSOLE_STREAM = process.env.ADD_WINSTON_CONSOLE_STREAM || 'no';

const logPath = path.resolve(PRJ_ROOT, 'logs');
try {
  fs.mkdirSync(logPath);
} catch (err) {
  if (err.code !== 'EEXIST') {
    systemlogger.error(err);
  }
}

function isString(s) {
  return typeof(s) === 'string' || s instanceof String;
}

function toString(arg) {
  let f = '';
  if (typeof arg === 'undefined') {
    return '';
  }
  if (isString(arg)) {
    return arg;
  }
  if (Array.isArray(arg)) {
    f = '[' + arg.map(a => Util.inspect(a, { depth: 1 }))
      .join(' : ') + ']';
  } else {
    f = Util.inspect(arg, { depth: 2 });
  }
  return f;
}

systemlogger.log('check dir access for logging path= ', logPath);
require('chmodr')(logPath, 0o777, function (err) {
  if (err) {
    systemlogger.error(err);
  } else {
    systemlogger.log(['chmod 777', path.resolve(PRJ_ROOT, 'logs'), 'OK']);
  }
});

var transportDebug = new (winston.transports.DailyRotateFile)({
  filename: path.resolve(logPath, 'debug-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '100m',
  maxFiles: '2d',
  level: 'info',
});

var transportError = new (winston.transports.DailyRotateFile)({
  filename: path.resolve(logPath, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '100m',
  maxFiles: '2d',
  level: 'error',
});
const format = winston.format.printf(info => {
  return `${info.message}`;
});
const transports = [
  transportDebug,
  transportError,
];
if (ADD_WINSTON_CONSOLE_STREAM === 'yes') {
  transports.push(new winston.transports.Console({
    format,
  }));
}
const wLogger = winston.createLogger({
  level: 'info',
  //format: winston.format.json(),
  format,
  transports,
});

// Your Google Cloud Platform project ID
const { DEFAULT_PROJECT_NAME } = require('../consts/requests');

const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = GOOGLE_APPLICATION_CREDENTIALS && require(GOOGLE_APPLICATION_CREDENTIALS) || { project_id: 'none' };
const projectId = serviceAccount.project_id;
systemlogger.info('projectId', projectId);

// Creates a client
const logging = new Logging({
  projectId: projectId,
});
// The name of the log to write to
let logName = `node-log-${projectId}`;
if (CLEAN_MATCHES === 'yes') {
  logName += '-cron-cleaner';
}
// Selects the log to write to
const stackDriverLogger = logging.log(logName);

const ColorReset = '\x1b[0m';
const colorCodes = {
  Bright: '\x1b[1m',
  Dim: '\x1b[2m',
  Underscore: '\x1b[4m',
  Blink: '\x1b[5m',
  Reverse: '\x1b[7m',
  Hidden: '\x1b[8m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  FgMagenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  BgBlack: '\x1b[40m',
  BgRed: '\x1b[41m',
  BgGreen: '\x1b[42m',
  BgYellow: '\x1b[43m',
  BgBlue: '\x1b[44m',
  BgMagenta: '\x1b[45m',
  BgCyan: '\x1b[46m',
  BgWhite: '\x1b[47m',
};

const colors = () => {
};

Object.keys(colorCodes)
  .map(c => colors[c] = (s) => COLORED_CONSOLE === 'yes' ? colorCodes[c] + s + ColorReset : s);

const getClientIp = (request) => {
  //return requestIp.getClientIp(request);
  const ip = request && request.info && request.info.remoteAddress;
  return ip ? `ip:${ip}` : '';
};

const toCommonLogFormat = (request, logType, caller) => {
  var application = request && request.auth && request.auth.credentials && request.auth.credentials.application || '',
    service = request && request.auth && request.auth.credentials && request.auth.credentials.service || '',
    deviceId = request && request.auth && request.auth.credentials && request.auth.credentials.deviceId || '',
    uuid = request && request.auth && request.auth.credentials && request.auth.credentials.deviceUUId || '',
    method = request && request.method && request.method.toUpperCase() || '',
    hrend = '';

  try {
    if (request && request.plugins && request.plugins.metrics && request.plugins.metrics.bench
      && request.plugins.metrics.bench && request.plugins.metrics.bench.elapsed) {
      hrend = Number(request.plugins.metrics.bench.elapsed())
        .toFixed(1);
      hrend = `[${hrend} ms]`;
    }
  } catch (e) {
  }
  const clientIp = getClientIp(request);
  logType = logType || 'INFO';
  const hostname = os.hostname();
  const api = request && request.path && request.path.replace('/api/1', '').replace('.json', '');
  return [hostname, clientIp, hrend, ENV, logType, caller, method, api];
};

const toCommonLogFormatLite = (request, logType, caller) => {
  const formatted = toCommonLogFormat(request, logType, caller)
    .map(e => `"${toString(e)}"`)
    .join(',') + ' '.replace(/\n/g, ' ')
  ;
  if (logType === 'ERROR') {
    return colors.red(formatted);
  }
  return colors.cyan(formatted);
};

const callerName = (level = 4) => {
  try {
    throw new Error();
  }
  catch (e) {
    try {
      const basePath = __dirname.split('/')
        .reverse()
        .slice(1)
        .reverse()
        .join('/');
      const stackLine = e.stack.split('at ')[level].replace(basePath, '.')
        .replace('\n', '');
      const funcName = e.stack.split('at ')[level].split(' ')[0];
      const parentName = e.stack.split('at ')[level - 1].split(' ')[0];

      return {
        parentName,
        stackLine,
        funcName,
      };
    } catch (e) {
      return '';
    }
  }

};

class Logger {

  toCommonLogFormatLite(request, logType, caller) {
    return toCommonLogFormatLite(request, logType, caller);
  }

  getLogger(request) {
    //const l = Object.create(Logger);
    const l = new Logger();
    l.request = request;
    return l;
  }

  _log() {
    const time = moment().strftime('%d %b %H:%M:%S');
    let args = Array.prototype.slice.call(arguments);
    //systemlogger.log('logging',args);
    const request = this.request;
    const arg0 = args['0'];
    const info = callerName(4);
    let method = info.parentName.toUpperCase()
      .replace('LOGGER.', '')
      .replace('CONSOLE.', '')
      .replace('CONSOLE.', '');
    const formatted = toCommonLogFormat(request || arg0, method, info.stackLine);
    const [hostname, clientIp, duration, ENV, logType, caller, http_method, api] = formatted;
    if (arg0 && arg0.params && arg0.query) {
      args['0'] = time;
    }
    const formattedArgs = [...formatted, ...args].map(arg => toString(arg)).join(',');
    method = method.toLowerCase();
    const method1 = (method === 'log') ? 'info' : method;
    if (USE_WINSTON === 'yes' && wLogger[method]) {
      wLogger[method1].apply(null, [formattedArgs]);

      if (GOOGLE_APPLICATION_CREDENTIALS) {
        const resource = {
          // This example targets the "global" resource for simplicity
          type: 'gce_instance',
        };
        const labels = {
          hostname, clientIp, duration, ENV, logType, caller, http_method, api,
        };
        // A text log entry
        const entry = stackDriverLogger.entry({ labels, resource },
          hostname + ' -> ' + args.map(arg => toString(arg)).join(' '));
        // Save the two log entries. You can write entries one at a time, but it is
        // best to write multiple entires together in a batch.
        const logMethod = method && stackDriverLogger[method] || stackDriverLogger['info'];
        logMethod
          .apply(stackDriverLogger, [entry])
          .then(() => {
            //console.log(`Wrote to ${logName}`);
            //process.stdout.write(`Wrote to ${logName}`);
          })
          .catch(err => {
            //console.error('ERROR:', err);
            process.stderr.write('LOGGER ERROR:' + err.message);
          });
      }
    } else {
      process.stdout.write.apply(process.stdout, args);
    }
  }

  info() {
    this._log.apply(this, arguments);
  }

  warn() {
    this._log.apply(this, arguments);
  }

  error() {
    this._log.apply(this, arguments);
  }

  debug() {
    if (CONSOLE_DEBUG_LEVEL === 'yes') {
      this._log.apply(this, arguments);
    }
  }
}

const formatedLogger = new Logger();
console.warn = function (a) {
  formatedLogger._log.apply(formatedLogger, arguments);
};
console.log = function (a) {
  formatedLogger._log.apply(formatedLogger, arguments);
};
console.error = function (a) {
  formatedLogger._log.apply(formatedLogger, arguments);
};
console.debug = function (a) {
  if (CONSOLE_DEBUG_LEVEL === 'yes') {
    formatedLogger._log.apply(formatedLogger, arguments);
  }
};

if (!GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS not defined for stackdriver!');
}

module.exports = formatedLogger;
