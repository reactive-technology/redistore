const Hapi = require('hapi');
const Nes = require('nes');
const RedisStore = require('./redistore');
const RedisClientFactory = require('./redisClientFactory');
const Auth = require('./auth');
const Jwt = require('./auth/jwt');
const USE_AUTH = false;

class WebSocketServer {
  constructor(conf) {
    this.host = conf && conf.host || 'localhost';
    this.password = conf && conf.password;
    this.port = conf && conf.port || '8088';
    this.logger = conf && conf.logger;
    this.server = new Hapi.Server({
      port: 8088,
    });
    this.users = {
      john: {
        username: 'anonymous',
        password: '',
      },
    };
    const logger = console;
    this.store = new RedisStore({
      config: {
        projectId: 'aaa',
        logger,
        factory: new RedisClientFactory({ logger })
      },
    });
  }

  static async createInstance(conf, routes, subscriptions) {
    let _server = new WebSocketServer(conf);
    await _server.start(routes, subscriptions);
    return _server;
  }

  onDisconnection(func) {
    this.onDisconnection = func;
  }

  onConnection(func) {
    this.onConnection = func;
  }

  info(msg) {
    if (this.logger) {
      this.logger.info(msg);
    }
  }

  error(msg) {
    if (this.logger) {
      this.logger.error(msg);
    }
  }

  credentials(request) {
    return request.auth.credentials;
  }

  publish(path, data) {
    this.server.publish(path, data);
  }

  async start(routes, subscriptions) {
    const onDisconnection = s => this.onDisconnection && this.onDisconnection(s);
    const onConnection = s => this.onConnection && this.onConnection(s);
    const options = {
      onDisconnection,
      onConnection,
    };

    if (USE_AUTH) {
      await this.server.register([Nes, opts, Jwt, Auth]);
    } else {
      await this.server.register({
        plugin: Nes,
        options,
      });
    }
    if (routes) {
      if (routes.map) {
        routes.map(route => this.server.route(Object.assign({}, route)));
      } else {
        this.server.route(routes);
      }
    }


    if (subscriptions) {
      if (subscriptions.map) {
        subscriptions.map(subscription => this.server.subscription(subscription));
      } else {
        this.server.subscription(subscriptions);
      }
    }
    await this.server.start();
    console.log('server started');
    this.server.table()
      .forEach((route) => console.log(`${route.method}\t${route.path}`));
  }
}


module.exports = WebSocketServer;
