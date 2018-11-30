const Hapi = require('hapi');
const Nes = require('nes');
const { RedisStore, RedisClientFactory } = require('redistore');

class WebSocketServer {
  constructor(conf) {
    this.host = conf && conf.host || 'localhost';
    this.password = conf && conf.password;
    this.port = conf && conf.port || '8088';
    this.logger = conf && conf.logger;
    this.server = new Hapi.Server({ port: 8088 });

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
    const _server = new WebSocketServer(conf);
    await _server.start(routes, subscriptions);
    return _server;
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

  publish(path, data) {
    this.server.publish(path, data);
  }

  async start(routes, subscriptions) {
    await this.server.register(Nes);
    if (routes) {
      if (routes.map) {
        routes.map(route => this.server.route(route));
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
  }
}


module.exports = WebSocketServer;
