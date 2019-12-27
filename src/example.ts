
import "reflect-metadata";

import WebServer from './webSocketServer';

import {IServerConfig, schema } from './webSocketServer';
import { NullableValidationMetadata, ValidationMetadata, PropertyValidationSchema } from '@/interface';
import { mustBe,  a } from "./validators";
//import * as Joi from "joi";
//export declare function createSchemaFromMetadata<T>(metadata: ValidationMetadata<T>): PropertyValidationSchema;

//============ REDIS STORE INIT======================
const cuid = require('cuid');
const os = require('os');
import {RedisStore, RankingField} from './redistore';
import {RedisClientFactory} from './redisClientFactory';
const logger = console;
const projectId = 'defaultPrj'
RedisStore.createInstance({
    config: {
        projectId,
        logger,
        factory: new RedisClientFactory({logger, host: 'mock'})
    }
});
const redisStore = RedisStore.getInstance();
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
    @mustBe(a.string().alphanum().min(1).max(30).required())
    // @ts-ignore
    public chatId?:string;
}

export async function healthCheck(request: any, h: any) {
    const uid = cuid();
    let message;
    try {
        await healthCheckTest.doc(os.hostname()).set({uid});
        const res = await healthCheckTest.doc(os.hostname()).get({uid});
        if (res.uid === uid) {
            return {
                success: true,
                healthCheck: 'OK',
                message: 'redis checked OK',
            };
        }
        message = `error reading data "${res.uid}" should be "${uid}"`;
    } catch (e) {
        message = 'ERROR: ' + e.message;
    }
    return h.response({success: false, healthCheck: 'KO', message}).code(500);
}


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
            auth:false,
            handler: (request: any, h: any)=>{
                return ({
                   data:'Yo'
                });
            },
            description: 'get chat',
            notes: 'get chat',
            tags: ['api', 'chat'],
            validate: {
                params: schema(ChatParams),
                headers,
            },
        },
    }
    ];


const conf:IServerConfig={};

(async ()=> {
    console.log('creating instance ..')
    const server = await WebServer.createInstance(conf, routes);
    server.onConnection(async (req) => {
        console.log('on connection received')
    });
    console.log('server running at ', `http://${server.conf.host}:${server.conf.port}/documentation`);
})().then();

