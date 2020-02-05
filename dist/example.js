"use strict";
//import "reflect-metadata";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const webSocketServer_1 = tslib_1.__importDefault(require("./webSocketServer"));
//import { mustBe,  a } from "./validators";
//import * as Joi from "joi";
//export declare function createSchemaFromMetadata<T>(metadata: ValidationMetadata<T>): PropertyValidationSchema;
//============ REDIS STORE INIT======================
const cuid_1 = tslib_1.__importDefault(require("cuid"));
const os_1 = tslib_1.__importDefault(require("os"));
const redistore_1 = require("./redistore");
const redisClientFactory_1 = require("./redisClientFactory");
const hapi_joi_decorators_1 = require("hapi-joi-decorators");
const logger = console;
const projectId = 'defaultPrj';
const factoryConf = { logger, host: 'mock' };
redistore_1.RedisStore.createInstance({
    config: {
        projectId,
        logger,
        factory: new redisClientFactory_1.RedisClientFactory(factoryConf)
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
class ChatParams extends hapi_joi_decorators_1.ClassValidator {
}
tslib_1.__decorate([
    hapi_joi_decorators_1.Alphanum(),
    hapi_joi_decorators_1.Min(1),
    hapi_joi_decorators_1.Max(30),
    hapi_joi_decorators_1.Required(),
    tslib_1.__metadata("design:type", String)
], ChatParams.prototype, "chatId", void 0);
async function healthCheck(request, h) {
    const uid = cuid_1.default();
    let message;
    try {
        await healthCheckTest.doc(os_1.default.hostname()).set({ uid });
        const res = await healthCheckTest.doc(os_1.default.hostname()).get({ uid });
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
    {
        method: 'GET',
        path: '/job',
        config: {
            cors,
            auth: false,
            cache: false,
            id: 'job',
            description: 'job ',
            tags: ['api', 'chat'],
            handler: async function (request, h) {
                return h.event({ data: 'my data' });
            }
        }
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
                params: ChatParams.toObject(),
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