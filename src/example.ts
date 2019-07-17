
import "reflect-metadata";

import WebServer from './webSocketServer';

import {IServerConfig, schema } from './webSocketServer';
import { NullableValidationMetadata, ValidationMetadata, PropertyValidationSchema } from '@/interface';
import { mustBe,  a } from "./validators";
import * as Joi from "joi";
//export declare function createSchemaFromMetadata<T>(metadata: ValidationMetadata<T>): PropertyValidationSchema;



console.log('start');

const cors = {
    origin: ['*'],
    additionalHeaders: ['cache-control', 'x-requested-with'],
};
const headers = undefined;
//createSchemaFromMetadata<T>(metadata);

class ChatParams {
    @mustBe(a.string().alphanum().min(3).max(30).required())
    // @ts-ignore
    public chatId?:string;
}

const routes = [
    // quizzes routes
    {
        method: 'GET',
        path: '/chat/{chatId}',
        config: {
            cors,
            id: 'getChat',
            handler: ()=>{

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
    const server = await WebServer.createInstance(conf);
    server.onConnection(async (req) => {
        console.log('on connection received')
    });

})().then();

