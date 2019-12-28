"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
require("reflect-metadata");
const webSocketServer_1 = tslib_1.__importDefault(require("./webSocketServer"));
const validators_1 = require("./validators");
//import * as Joi from "joi";
//export declare function createSchemaFromMetadata<T>(metadata: ValidationMetadata<T>): PropertyValidationSchema;
//============ REDIS STORE INIT======================
const cuid = require('cuid');
const os = require('os');
const redistore_1 = require("./redistore");
const redisClientFactory_1 = require("./redisClientFactory");
const logger = console;
const projectId = 'defaultPrj';
redistore_1.RedisStore.createInstance({
    config: {
        projectId,
        logger,
        factory: new redisClientFactory_1.RedisClientFactory({ logger, host: 'mock' })
    }
});
const redisStore = redistore_1.RedisStore.getInstance();
const healthCheckTest = redisStore.collection("healthCheckTest");
//=======================================================
console.log('start');
const cors = {
    origin: ['*'],
    additionalHeaders: ['cache-control', 'x-requested-with'],
};
const headers = undefined;
//createSchemaFromMetadata<T>(metadata);
class ChatParams {
}
tslib_1.__decorate([
    validators_1.mustBe(validators_1.a.string().alphanum().min(1).max(30).required())
], ChatParams.prototype, "chatId", void 0);
async function healthCheck(request, h) {
    const uid = cuid();
    let message;
    try {
        await healthCheckTest.doc(os.hostname()).set({ uid });
        const res = await healthCheckTest.doc(os.hostname()).get({ uid });
        if (res.uid === uid) {
            return {
                success: true,
                healthCheck: 'OK',
                message: 'redis checked OK',
            };
        }
        message = `error reading data "${res.uid}" should be "${uid}"`;
    }
    catch (e) {
        message = 'ERROR: ' + e.message;
    }
    return h.response({ success: false, healthCheck: 'KO', message }).code(500);
}
exports.healthCheck = healthCheck;
const routes = [
    {
        path: '/health_check',
        method: 'GET',
        config: {
            cors,
            auth: false,
            cache: false,
            id: 'healthCheck',
            handler: healthCheck,
            description: 'health check ',
            tags: ['api', 'admin'],
        },
    },
    // quizzes routes
    {
        method: 'GET',
        path: '/chat/{chatId}',
        config: {
            cors,
            id: 'getChat',
            auth: false,
            handler: (request, h) => {
                return ({
                    data: 'Yo'
                });
            },
            description: 'get chat',
            notes: 'get chat',
            tags: ['api', 'chat'],
            validate: {
                //params: schema(ChatParams),
                headers,
            },
        },
    }
];
const conf = {};
(async () => {
    console.log('creating instance ..');
    const server = await webSocketServer_1.default.createInstance(conf, routes);
    server.onConnection(async (req) => {
        console.log('on connection received');
    });
    console.log('server running at ', `http://${server.conf.host}:${server.conf.port}/documentation`);
})().then();
//# sourceMappingURL=example.js.map