const Hapi = require('hapi');
const Inert = require('inert');
const Vision = require('vision');
const Joi = require('joi');
const os = require('os');
const Jwt = require('hapi-auth-jwt2');
const HapiSwagger = require('hapi-swagger');
const Boom = require('boom');
const hapiBoomDecorators = require('hapi-boom-decorators');
const Logger = require('./logger');
const Hoek = require('hoek');

const path = require('path');

const Pack = require('../package0');
const socketService = require('./ioSockService');

const NODE_PORT = parseInt(process.env.NODE_PORT) || 6002;
const CLEAN_MATCHES = process.env.CLEAN_MATCHES || 'no';
Logger.info('process.env.PROJECT : ' + process.env.PROJECT);
Logger.info('process.env.NODE_TYPE : ' + process.env.NODE_TYPE);

const CACHE_API = false;
const options = { port: NODE_PORT };
if (CACHE_API) {
  options.cache = {
    engine: require('catbox-memory'),
    // segment: 'countries', expiresIn: 5 * 1000
  };
}
const client_protocol = process.env.HTTP_PROTOCOL || 'http';
const schemes = [client_protocol];
const host = `${process.env.HTTP_HOST ||
os.hostname}:${process.env.HTTP_PORT || NODE_PORT}`;

let server;
try {
  server = Hapi.Server(options);
} catch (e) {
  Logger.error('Error : ' + e.message);
  Logger.error(e.stack);
}

const headers = Joi.object({
  authorization: Joi.string()
    .required()
    .description('from firebase.auth.currentUser.getIdToken()'),
}).unknown();

function capitalize(string) {
  return (
    string && string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
  );
}

const normalise = str => {
  Logger.info('+++++++==================   normalise');
  Logger.info(str);
  Logger.info(str.toLowerCase());

  const a =
    str &&
    str.split &&
    str
      .split('_')
      .map(w => capitalize(w))
      .join('');
  return a;
};

const playingActionReqs = [
  //{req:'REQ_VS_MATCH'},
  { req: 'REQ_VS_ASYNC_MATCH' },
  { req: 'REQ_PART_COMPLETED', query: { matchId: Joi.string() } },
  { req: 'REQ_MATCH_COMPLETED', query: { matchId: Joi.string() } },
  { req: 'REQ_SEND_REMINDER', query: { matchId: Joi.string() } },
  { req: 'REQ_VS_ASYNC_MATCH_CANCEL', query: { matchId: Joi.string() } },
  { req: 'REQ_ASYNC_USER_HISTORY' },
  { req: 'REQ_VS_ASYNC_FRIEND', query: { opponentId: Joi.string() } },
];

const initialDataMigrationReqs = [
  //{req:'REQ_VS_MATCH'},
  {
    req: 'REQ_SET_PUSH_TOKEN',
    query: {
      deviceId: Joi.string(),
      pushToken: Joi.string(),
      os: Joi.string(),
    },
  },
  {
    req: 'REQ_USER_MIGRATION',
    query: {
      xp: Joi.string(),
      coins: Joi.string(),
      totalInApp: Joi.string(),
      totalCoinsSpent: Joi.string(),
      email: Joi.string(),
    },
  },
  {
    req: 'REQ_SET_USER_INFO',
    query: {
      nickname: Joi.string(),
      avatar: Joi.string(),
      pictureUrl: Joi.string(),
      category: Joi.string(),
      languageIso: Joi.string(),
      accessToken: Joi.string(),
    },
  },
];

const facebookMigrationReqs = [
  //{req:'REQ_VS_MATCH'},
  {
    req: 'REQ_UPDATE_FB_FRIENDS',
    query: {
      accessToken: Joi.string().optional().description('add token if has been refreshed since last time'),
    },
  },
];

const responseModel = Joi.object({
  equals: Joi.string(),
}).label('result');

const cors = {
  origin: ['*'],
  additionalHeaders: ['cache-control', 'x-requested-with'],
};
/*
host: process.env.HOST || `localhost:${SERVER_PORT}`,
        schemes: [client_protocol],
 */
server.route({
  method: 'GET',
  path: '/',
  handler: (request, h) => {
    return 'Hello, world!';
  },
});

const healthCheck = reqHandler => ({
  method: 'GET',
  path: '/health',
  config: {
    auth: false,
    cors,
    handler: async (request, h) => {
      let resp = {};
      try {
        resp = await reqHandler.healthCheck();
      } catch (e) {
        resp = { success: false, healthCheck: 'KO', message: e.message };
      }
      if (resp.success) {
        return resp;
      } else {
        return h.response(resp).code(500);
      }
    },
    description: 'health check',
    notes: 'Returns health check status',
    tags: ['api', 'admin'] // ADD THIS TAG
  },
});

const cleanMatches = reqHandler => ({
  method: 'GET',
  path: '/cleanMatches',
  config: {
    auth: false,
    cors,
    handler: async (request, h) => {
      let resp = {};
      try {
        const { force } = request.query;
        resp = await reqHandler.cleanMatchesIfNeeded(force);
      } catch (e) {
        resp = { success: false, clean: 'KO', message: e.message };
      }
      if (resp.success) {
        return resp;
      } else {
        return h.response(resp).code(500);
      }
    },
    description: 'match cleanning and reminding',
    validate: {
      query: { force: Joi.boolean().optional().description('force clean right now') },
    },
    notes: 'Returns 200 if ok',
    tags: ['api', 'admin'] // ADD THIS TAG
  },
});

const httpUserState = reqHandler => ({
  method: 'GET',
  path: '/userStates/{userId}',
  config: {
    cors,
    handler: async (request, h) => {
      const httpReqHandler = reqHandler.withHttpRequest(request);
      Logger.info(request, 'request', JSON.stringify(request.params, null, 2));

      let result = '';
      let success = false;
      let error = '';

      try {
        const { userId } = request.params;
        result = await httpReqHandler.asyncGames.getUserState(userId);
        if (result && Object.keys(result).length) {
          success = true;
        } else {
          Logger.error(request, request.path + ' : ', 'record not found for ', userId);
          error = 'record not found';
        }
      } catch (e) {
        Logger.error(request, request.path + ' : ' + e.message);
        Logger.error(request, e.stack);
        error = e.message;
      }
      return {
        result,
        success,
        error,
      };
    },
    description: 'http userStates',
    notes:
      'Returns userStates using given userId, userId must be the one authenticated',
    tags: ['api', 'user state'], // ADD THIS TAG
    validate: {
      params: {
        userId: Joi.string(),
      },
      headers,
    },
  },
});
const httpFiltredUserState = reqHandler => ({
  method: 'GET',
  path: '/userStates/{userId}/{stateGroup}/{item}',
  config: {
    cors,
    handler: async (request, h) => {
      const httpReqHandler = reqHandler.withHttpRequest(request);
      Logger.info(request, 'request', JSON.stringify(request.params, null, 2));

      let result = '';
      let success = false;
      let error = '';

      try {
        const { userId, stateGroup, item } = request.params;
        result = await httpReqHandler.asyncGames.getFiltredUserState(userId, stateGroup, item);
        if (result && Object.keys(result).length) {
          success = true;
        } else {
          error = 'record not found';
        }
      } catch (e) {
        Logger.error(request, request.path + ' : ' + e.message);
        Logger.error(request, e.stack);
        error = e.message;
      }
      return {
        result,
        success,
        error,
      };
    },
    description: 'http userStates',
    notes:
      'Returns userStates using given userId, userId must be the one authenticated',
    tags: ['api', 'user state'], // ADD THIS TAG
    validate: {
      params: {
        userId: Joi.string().description('user Id'),
        stateGroup: Joi.string().optional().default('awaitingMatchRequests').description('sub group in userState'),
        item: Joi.string().optional().default('*').description('sub item in group'),
      },
      headers,
    },
  },
});

const routes = (reqHandler, reqs, tag) =>
  reqs.map(({ req, query }) => ({
    method: 'PUT',
    path: `/userAppRequest/{userId}/${tag}/${normalise(req)}`,
    config: {
      cors: {
        origin: ['*'],
        additionalHeaders: ['cache-control', 'x-requested-with'],
      },
      handler: async (request, h) => {
        const httpReqHandler = reqHandler.withHttpRequest(request);
        Logger.info(request, 'h req');
        Logger.info(request, JSON.stringify(request.params, null, 2));

        const params = {};
        if (query) {
          Object.keys(query).map(k => {
            params[k] = request.query[k];
          });
        }
        const { userId } = request.params;
        const job = {
          [tag]: {
            request: req,
            params,
          },
          userId,
        };

        const results = await httpReqHandler.onRequest(userId, job);
        const result = results[0];
        Logger.info(request, 'REQ returned');

        if (false) {
          try {
            result.userState = await httpReqHandler.asyncGames.getUserState(userId,);
          } catch (e) {
            Logger.error(request, request.path + ' - ' + e.message);
            Logger.error(request, e.stack);
          }
        }
        return result;
      },
      description: `for ${req}`,
      notes: 'Returns a todo item by the id passed in the path',
      tags: ['api', tag], // ADD THIS TAG
      validate: {
        params: {
          userId: Joi.string(),
        },
        query,
        headers,
      },
    },
  }));

if (CACHE_API) {
  server.cache
    .provision({
      engine: require('catbox-memory'),
      name: 'pvp',
    })
    .then(() => {
      const cache = server.cache({
        segment: 'pvp',
        expiresIn: 1000 * 60 * 1000,
      });
      cache
        .set('norway', { capital: 'oslo' })
        .then(a => {
          Logger.info('Cache set OK');
          Logger.info(a);
        })
        .catch(e => {
          Logger.error(request.path + ' - CACHE ERROR : ' + e.message);
          Logger.error(e.stack);
        });

      try {
        // Logger.log('cache set ');
        // testCache(cache);
      } catch (e) {
        Logger.error(request.path + ' - StartGame Error : ' + e.message);
        Logger.error(e.stack);
      }
    })
    .catch(e => {
      Logger.error(request.path + ' - Catbox Error : ' + e.message);
      Logger.error(e.stack);
    });
}

const errorFunc = (request, boom) => {
  return boom.unauthorized('invalid password', 'sample');
};

const verify = reqHandler =>
  async function (decoded, request) {
    // do your checks to see if the person is valid
    const SPECIAL_TOKEN =
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjZkZTdlNWFkMDRmZjZiYjczNWFiYWE0YjFiNzg5NGEzMzUwZGU5MTcifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vcHZwLXRlc3QiLCJwcm92aWRlcl9pZCI6ImFub255bW91cyIsImF1ZCI6InB2cC10ZXN0IiwiYXV0aF90aW1lIjoxNTMxODM4MzU3LCJ1c2VyX2lkIjoiY0lsS3lHMG1sTlRjOWdHbVdmVTNaMTBybWo1MyIsInN1YiI6ImNJbEt5RzBtbE5UYzlnR21XZlUzWjEwcm1qNTMiLCJpYXQiOjE1MzE5OTQ4MDcsImV4cCI6MTUzMTk5ODQwNywiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6e30sInNpZ25faW5fcHJvdmlkZXIiOiJhbm9ueW1vdXMifX0.NRVlXfo6AntHqxmdRdMPE30EvRzus9Cy2oEo9HnWzvBwdP0KuiauSXs9dC2gb2gQl-IHjKiiVXMSC_bCTXM9bxy3xjqlOqf6Jx7WSjQslRvthJ95GzqrAbc9rEbG4Wjg1e3t0aTz741_IaOYEri0mhSVWt79ekkrxtxPdererj80xcuiNl8H0f9HTfu3qfA4LkTFV3O79OqAF_dEoNW5JkvK1EV0Bh-icZtk_1IFTBvDNF91Bn1mCdvZJBnkzx6ZS8WY2wb8J5xCtx9trfDD7Pbh58NFgvAeouRLS69ruLKVZAtxpLtubISwfErC-uf_gdo4VT1eXekYqFrwiPSX3A';
    const idToken = request.auth.token;
    const decodedToken = await reqHandler.fireBaseAdmin
      .auth()
      .verifyIdToken(idToken)
      .catch(function (error) {
        if (idToken !== SPECIAL_TOKEN) {
          Logger.error(request.path + ' - Error decoding token : ' + error.message);
          Logger.error(error.stack);
        }
      });

    if (idToken !== SPECIAL_TOKEN) {
      Logger.info(request, '##### DECODED TOKEN #####', decodedToken);
    }

    if (idToken === SPECIAL_TOKEN) {
      Logger.info(request, 'usage of SPECIAL_TOKEN force acces granted');

      return {
        isValid: true,
        credentials: {
          userId: request.params.userId,
          token: request.headers.authorization,
          iat: decoded.iat,
        },
      };
    }

    Logger.info(request, 'Now decoding token...');
    Logger.info(request, 'Request UserID : ' + request.params.userId);
    Logger.info(request, 'Sent token : ' + request.headers.authorization);

    if (
      decodedToken &&
      decodedToken.user_id &&
      decodedToken.user_id === request.params.userId
    ) {

      Logger.info(request, 'Token : ' + idToken);
      Logger.info(request, 'UID : ' + decodedToken.user_id);

      return {
        isValid: true,
        credentials: {
          userId: decodedToken.user_id,
          token: idToken,
          iat: decodedToken.iat,
          exp: decodedToken.exp,
        },
      };
    }
    return { isValid: false, credentials: 'ignored' };
  };
const secretKey =
  'MIIDHDCCAgSgAwIBAgIIOY6dSWz3XVkwDQYJKoZIhvcNAQEFBQAwMTEvMC0GA1UE\nAxMmc2VjdXJldG9rZW4uc3lzdGVtLmdzZXJ2aWNlYWNjb3VudC5jb20wHhcNMTgw\nNzA0MjEyMDE1WhcNMTgwNzIxMDkzNTE1WjAxMS8wLQYDVQQDEyZzZWN1cmV0b2tl\nbi5zeXN0ZW0uZ3NlcnZpY2VhY2NvdW50LmNvbTCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBAJpI8JYGWg9aEOW4KYznkam+lkwoRiNtl11e84mQfjk7xCsw\nJNL33InMP0J9d8k5deWLLbus8t0BPrv5Nemtxs9ZJmzxqnbgx0u1QBfyVzMNSdht\n0USqiE/6tyiD5H+2gzmWXz7Qy76bsCKpBthIvbi0ppdgVxV20XwHz6iTy07/X83m\nZZSMaqGbge+Jla8X3lPUjmi+EUzA93BOVylNA5wYKdUO+hARC3X2n1/NlsAL0GYC\nfs/B7IjXQQhGncQjM6NQI+uRxLzl/nhmmiReWULHBqfAsXSewZ1wax8g/Yc+CiVd\naEibJ9IuD307F+kxrpQIRjghYJ7iy0Ld0fzeqmkCAwEAAaM4MDYwDAYDVR0TAQH/\nBAIwADAOBgNVHQ8BAf8EBAMCB4AwFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwIwDQYJ\nKoZIhvcNAQEFBQADggEBAC/VdgCckc1iBDi0r5qtp52rSMZuymhpvVYtsty9lp+S\ns8TwLiG3qVE78r/wyFjx92GG6F2lulY+5Yz4rhX+IzlrHzEjnGK69kCszSrzLJBZ\nh0v6UyjvIRsjoLsp19XfNNg7C9GNGEvploZ0551TxuBWSRyMRkpxlX7fFm8r7eD6\n5dvDlbnMnEymcLSWcE+JLTVefzHqRV8kyRsrJS6XcV8d9IYspKw5ksmMuCx5y7+s\ngC0M1v7e0ZM/4yce3yDVma8TYHzh30E5vK18hh9MvJeE3dcpp158OV2tT8CMx+wh\nmnSI2lMyfBvM2qWdGw1WfyHTWqhlti7UBjXs31ke+hA=';

const start = (redisStore, reqHandler) =>
  (async () => {
    try {
      server.route(routes(reqHandler, playingActionReqs, 'playingAction'));
      server.route(
        routes(reqHandler, initialDataMigrationReqs, 'initialDataMigration'),
      );
      server.route(
        routes(reqHandler, facebookMigrationReqs, 'facebookMigration'),
      );
      server.route(httpUserState(reqHandler));
      server.route(httpFiltredUserState(reqHandler));
      server.route(healthCheck(reqHandler));
      if (CLEAN_MATCHES === 'yes') {
        server.route(cleanMatches(reqHandler));
      }

      const swaggerOptions = {
        info: {
          title: 'seconds Rest API Documentation',
          version: Pack.version,
        },
        host,
        schemes,
        grouping: 'tags',
        jsonEditor: true,
        security: [
          {
            jwt: [],
          },
        ],
      };

      await server.register([
        Inert,
        Vision,
        {
          plugin: HapiSwagger,
          options: swaggerOptions,
        },
        hapiBoomDecorators,
        Jwt,
      ]);
      server.auth.strategy('jwt', 'jwt', {
        // key: secretKey, // Never Share your secret key
        verify: verify(reqHandler) // validate function defined above
        //verifyOptions: { algorithms: ["HS256"] } // pick a strong algorithm
        //errorFunc
      });
      server.auth.default('jwt');
      await server.start();
      socketService.start(server, redisStore);
    } catch (error) {
      Logger.error(request.path + ' - Error : ' + error.message);
      Logger.error(error.stack);
      process.exit(1);
    }

    //eventBus.emit('server-started');
    Logger.info('Server is running at : ' + server.info.uri);
  })();

server.ext('onRequest', (request, h) => {
  request.plugins.metrics = {
    bench: new Hoek.Bench(),
  };
  return h.continue;
});

server.events.on('response', (request) => {
  const commonInfo = Logger.toCommonLogFormatLite(request);
  let hrend;
  let cached = false;
  try {
    hrend = Number(request.plugins.metrics.bench.elapsed()).toFixed(1);
    cached = request.plugins.metrics && request.plugins.metrics.cachedl1;
  } catch (e) {
  }
  if (request.path.indexOf('/health') === -1 && request.path.indexOf('/metrics') === -1) {
    Logger.info(request, ['info', 'response'], commonInfo, '¨', request.path);
    const status = request.response && request.response.statusCode || '?';
    Logger.info(commonInfo, `status=${status} [${hrend} ms] ${hrend > 1000 ? 'OPTIM!' : ''} ${hrend > 2000 ? 'SRV SLOW!' : ''} ${cached ? 'CACHED!' : ''}`);
  }
});
/*
server.ext('onPreResponse', (request) => {
  //&& request.response.output.statusCode === 404
  if (request.response.isBoom) {
    Logger.error('isBoom', JSON.stringify(request.response));//err.output.payload
  } else {
    request.response
      .header('x-response-time', Number(request.plugins.metrics.bench.elapsed()).toFixed(1));
  }

  //return reply.continue();
});
*/

server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {
  //Logger.log('--internal=',JSON.stringify(tags),event.data && event.data.url,request.method, request.path,request.response && request.response.statusCode);

  if (tags.received) {
    try {
      if (request.path.indexOf('/healthcheck') === -1 && request.path.indexOf('/metrics') === -1) {
        Logger.log( 'headers', JSON.stringify(request.headers));
        const token = request.auth.token || request.headers.authorization && request.headers.authorization.replace(/bearer /i, '');
        Logger.info(request, `# -H 'Accept:${request.headers.accept}' -H 'Authorization:${token}' @HOST${request.url.href}`);
      }

      const commonInfo = Logger.toCommonLogFormatLite(request);
      if (request.path.indexOf('/healthcheck') === -1 && request.path.indexOf('/metrics') === -1) {
        //Logger.info(commonInfo);
        Logger.info(request, commonInfo);
      }

    } catch (e) {

    }
  }
  //Logger.log('--\ntags: ',tags);
  //Logger.log('\n--\nevent: ',event);
  if (tags.error || tags.unauthenticated) {
    //server.log(['internal', '__\ndata : '], JSON.stringify(event.data));
  }
});

module.exports = { start };
