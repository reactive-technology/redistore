const Hapi = require('hapi');
const Nes = require('nes');
const RedisStore = require('./redistore');
const RedisClientFactory = require('./redisClientFactory');
const Basic = require('hapi-auth-basic');
const Auth = require('./auth');
const Jwt = require('./auth/jwt');
const Inert = require('inert');
const Vision = require('vision');
const HapiSwagger = require('hapi-swagger');
const Pack = require('../package');
const os = require('os');
const Joi = require('joi');

const USE_AUTH = true;
const clientProtocol = process.env.HTTP_PROTOCOL || 'http';
const schemes = [clientProtocol];
const NODE_PORT = parseInt(process.env.NODE_PORT, 10) || 80;
const host = `${process.env.HTTP_HOST || os.hostname}:${process.env.HTTP_PORT || NODE_PORT}`;

const cors = {
  origin: ['*'],
  additionalHeaders: ['cache-control', 'x-requested-with'],
};

class WebSocketServer {
  constructor(conf) {
    this.host = conf && conf.host || 'localhost';
    this.password = conf && conf.password;
    this.port = conf && conf.port || NODE_PORT;
    this.logger = conf && conf.logger;
    this.hooks = {};
    const hapiConf = conf.hapi || {
      port: this.port,
    };
    this.hapi = new Hapi.Server(hapiConf);
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
    const self = this;
    this.hapi.ext('onRequest', function (request, h) {
      // Change all requests to '/test'
      //request.setUrl('/test');
      //this.logger.log('RECEIVED REQUEST');
      try {
        if (self.hooks.onRequest && typeof(self.hooks.onRequest) === 'function') {
          self.hooks.onRequest(request, h);
        }
      } catch (e) {
        self.logger.error('onRequest err', e);
      }
      return h.continue;
    });

    this.hapi.events.on({
      name: 'request',
      channels: 'internal'
    }, (request, event, tags) => {
      self.logger && self.logger.log('--internal=', JSON.stringify(tags), event.data && event.data.url, request.method, request.path, request.response && request.response.statusCode);

      if (tags.received) {
        try {

        } catch (e) {

        }
      }
      //this.logger.log('--\ntags: ',tags);
      //this.logger.log('\n--\nevent: ',event);
      if (tags.error || tags.unauthenticated) {
        //server.log(['internal', '__\ndata : '], JSON.stringify(event.data));
      }
    });
  }

  onRequest(func) {
    this.hooks.onRequest = func;
  }

  static async createInstance(conf, routes, subscriptions, hapiOptions) {
    let _server = new WebSocketServer(conf);
    await _server._start(routes, subscriptions, hapiOptions);
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
    return this.hapi.publish(path, data);
  }

  publishRef(ref) {
    const self = this;
    const path = `/${ref.pathName.split('/')
      .slice(2)
      .join('/')}`;
    //ref.logger.info('Will publish ', ref.pathName, 'to', path, 'to clients!');
    //self.hapi.subscription(path);
    ref.onSnapshot(async (data) => {
      //self.logger.log(`-------> onSnapshot received gameRef data change publishing to'${path}' data=`,data);
      await self.hapi.publish(path, data);
    });
  }

  publishRefs(refs) {
    refs && refs.map && refs.map(ref = this.publishRef(ref));
  }

  async _start(routes, _subscriptions, hapiOptions) {
    const onDisconnection = async (a, b, c) => {
      try {
        if (this.hooks.onDisconnection) {
          await Promise.resolve(this.hooks.onDisconnection(a, b, c))
        }
      } catch (e) {
        this.logger.error('onDisconnection', e);
      }
    };
    const onConnection = async (a, b, c) => {

      try {
        if (this.hooks.onConnection) {
          await Promise.resolve(this.hooks.onConnection(a, b, c));
        }
      } catch (e) {
        this.logger.error('onConnection', e);
      }
    };
    const onSubscribe = async (socket, path, params) => {
      try {
        this.logger && this.logger.log('client subscribe to', path);
        if (this.hooks.onSubscribe) {
          await Promise.resolve(this.hooks.onSubscribe(socket, path, params));
        }
      } catch (e) {
        this.logger.error('onSubscribe', e);
      }
    };

    const nesOptions = {
      onDisconnection,
      onConnection,
    };
    const subscriptions = [
      '/{collectionId}',
      '/{collectionId}/{docId}',
      '/{collectionId}/{docId}/{subcollectionId}',
      '/{collectionId}/{docId}/{subcollectionId}/{subdocId}',
      //'/{collectionId}/{docId}/{subcollectionId}/{subdocId}/{sub2collectionId}',
      //'/{collectionId}/{docId}/{subcollectionId}/{subdocId}/{sub2collectionId}/{sub2docId}',
    ];
    const keywords = ['collectionId', 'docId', 'subcollectionId', 'subdocId', 'sub2collectionId', 'sub2docId'];
    const validation = (thepath) => {
      const params = {};
      keywords.forEach(keyword => {
        if (thepath.indexOf(keyword) != -1) {
          params[keyword] = Joi.string();
        }
      });
      //this.logger.log('params', thepath, params);
      return { params };
    };

    const gettersRoutes = subscriptions.map(path => ({
        method: 'GET',
        path,
        config: {
          cors,
          id: path.replace('/', ''),
          //auth:'jwt-admin-users-webedia',
          handler: (request, h) => {
            return this.store.collection();
          },
          description: 'cache storage',
          //tags: ['api', 'redis cache storage'],
          validate: validation(path),
        },
      })
    );
    _subscriptions && subscriptions.push(..._subscriptions);
    //_subscriptions && subscriptions.concat(_subscriptions);
    const swaggerOptions = {
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header'
        },
        simple: {
          type: 'basic',
          name: 'Authorization',
          in: 'header'
        }
      },
      schemes: [
        'http'
      ],
      info: {
        title: 'Rest API Documentation',
        version: Pack.version,
      },
      host,
      schemes,
      grouping: 'tags',
      jsonEditor: true,
      security: [
        {
          jwt: [],
          simple: []
        },
      ],
    };
    let hapiRegister = [
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        options: swaggerOptions,
      },
      Basic,      //  Jwt, Auth
      {
        plugin: Nes,
        options: nesOptions,
      },
    ];

    if (hapiOptions && hapiOptions.register) {
      if (hapiOptions.register.map) {
        hapiRegister.push(...hapiOptions.register);
      } else {
        hapiRegister.push(hapiOptions.register);
      }
    }
    await this.hapi.register(hapiRegister);
    if (hapiOptions && hapiOptions.routes && hapiOptions.routes.prefix) {
      this.hapi.realm.modifiers.route.prefix = hapiOptions.routes.prefix;
    }
    //await this.hapi.register([Basic, Nes]);
    const validate = async (request, username, password) => {
      //const isValid = await Bcrypt.compare(password, user.password);
      const isValid = true;
      const credentials = {
        id: username,
        name: username,
      };
      return {
        isValid,
        credentials,
        strategy: 'simple',
      };
    };
    this.hapi.auth.strategy('simple', 'basic', { validate });
    this.hapi.auth.default('simple');
    if (routes) {
      if (routes.map) {
        routes.map(route => {
          if (route.method === 'SUB') {
            //this.hapi.publish(route.path, data);
            this.hapi.subscription(route.path, { onSubscribe });
            const getterRoute = Object.assign({}, route, { method: 'GET' },
              {
                config: Object.assign({}, {
                  handler: async () => await redisStore.collection(route.path).get()
                }, route.config || {})
              });
            this.hapi.route(getterRoute)
          } else {
            this.hapi.route(Object.assign({}, route))
          }

        });
      } else {
        this.hapi.route(routes);
      }
    }

    gettersRoutes.map(route => this.hapi.route(Object.assign({}, route)));

    subscriptions.map(subscription => this.hapi.subscription(subscription, { onSubscribe }));

    await this.hapi.start();
    this.hapi.table()
      .forEach((route) => this.logger && this.logger.log(`${route.method}\t${route.path}`));
    //this.logger.log('server enabled subscription API ( server can publish on for clients to subscrible to)');
    subscriptions && subscriptions.forEach && subscriptions.forEach(subscription => this.logger && this.logger.log(subscription));
  }
}

module.exports = WebSocketServer;
