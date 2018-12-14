const Hapi = require('hapi');
const Nes = require('nes');
const RedisStore = require('./redistore');
const RedisClientFactory = require('./redisClientFactory');
const Basic = require('hapi-auth-basic');
const Auth = require('./auth');
const Jwt = require('./auth/jwt');
const USE_AUTH = true;

class WebSocketServer {
  constructor(conf) {
    this.host = conf && conf.host || 'localhost';
    this.password = conf && conf.password;
    this.port = conf && conf.port || '8088';
    this.logger = conf && conf.logger;
    this.hooks = {}
    this.hapi = new Hapi.Server({
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
    const that = this;
    this.hapi.ext('onRequest', function (request, h) {
      // Change all requests to '/test'
      //request.setUrl('/test');
      console.log('RECEIVED REQUEST');
      try {
        if (that.hooks.onRequest && typeof(that.hooks.onRequest) === 'function') {
          that.hooks.onRequest(request, h);
        }
      } catch (e) {
        console.error('onRequest err', e);
      }
      return h.continue;
    });

    this.hapi.events.on({
      name: 'request',
      channels: 'internal'
    }, (request, event, tags) => {
      console.log('--internal=', JSON.stringify(tags), event.data && event.data.url, request.method, request.path, request.response && request.response.statusCode);

      if (tags.received) {
        try {

        } catch (e) {

        }
      }
      //console.log('--\ntags: ',tags);
      //console.log('\n--\nevent: ',event);
      if (tags.error || tags.unauthenticated) {
        //server.log(['internal', '__\ndata : '], JSON.stringify(event.data));
      }
    });
  }

  onRequest(func) {
    this.hooks.onRequest = func;
  }

  static async createInstance(conf, routes, subscriptions) {
    let _server = new WebSocketServer(conf);
    await _server._start(routes, subscriptions);
    return _server;
  }

  onDisconnection(func) {
    this.hooks.onDisconnection = func;
  }

  onConnection(func) {
    this.hooks.onConnection = func;
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
    this.hapi.publish(path, data);
  }

  async _start(routes, subscriptions) {
    const onDisconnection = (a, b, c) => this.hooks.onDisconnection && this.hooks.onDisconnection(a, b, c);
    const onConnection = (a, b, c) => this.hooks.onConnection && this.hooks.onConnection(a, b, c);
    const options = {
      onDisconnection,
      onConnection,
    };

    if (USE_AUTH) {
      await this.hapi.register([
        Basic,      //  Jwt, Auth
        {
          plugin: Nes,
          options,
        },
      ]);
    } else {
      await this.hapi.register({
        plugin: Nes,
        options,
      });
    }

    //await this.hapi.register([Basic, Nes]);
    const validate = async (request, username, password) => {
      //const isValid = await Bcrypt.compare(password, user.password);
      const isValid = true;
      const credentials = { id: username, name: username };
      return { isValid, credentials , strategy: 'simple'};
    };
    this.hapi.auth.strategy('simple', 'basic', { validate });
    this.hapi.auth.default('simple');
    if (routes) {
      if (routes.map) {
        routes.map(route => this.hapi.route(Object.assign({}, route)));
      } else {
        this.hapi.route(routes);
      }
    }

    if (subscriptions) {
      if (subscriptions.map) {
        subscriptions.map(subscription => this.hapi.subscription(subscription));
      } else {
        this.hapi.subscription(subscriptions);
      }
    }

    await this.hapi.start();
    console.log('server started');
    this.hapi.table()
      .forEach((route) => console.log(`${route.method}\t${route.path}`));
  }
}

module.exports = WebSocketServer;
