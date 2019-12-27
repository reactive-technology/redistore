import {IObject, IServerConfig} from "./interface";

export * from "./interface";
export * from "./validators";

import {Request, Server, ServerRoute} from "hapi";

const Hapi = require("hapi");
const Nes = require("nes");
const Basic = require("hapi-auth-basic");
const Inert = require("inert");
const Vision = require("vision");
const HapiSwagger = require("hapi-swagger");
const os = require("os");
const Joi = require("joi");
const Pack = require("../package");
const Jwt = require("./auth/jwt");
const Auth = require("./auth");
import {RedisClientFactory} from "./redisClientFactory";

import {RedisStore} from "./redistore";

const USE_AUTH = true;
const clientProtocol = process.env.HTTP_PROTOCOL || "http";
const schemes = [clientProtocol];
const NODE_PORT = parseInt(process.env.NODE_PORT || "", 10) || 80;
const host = `${process.env.HTTP_HOST || 'localhost'}:${process.env.HTTP_PORT ||
NODE_PORT}`;

let authGuestName: string = process.env.AUTH_GUEST_NAME || 'guest';
let authGuestPasswd: string = process.env.AUTH_GUEST_PASSWD || '';


const cors = {
    origin: ["*"],
    additionalHeaders: ["cache-control", "x-requested-with"]
};
export type IHookFunc = (request: Request, h: any) => void;

export class WebSocketServer {
    private host: string;
    private password?: string;
    private port: string | number;
    private logger: IObject = console;
    private hooks: {
        onSubscribe?(s: any, path: string, params: IObject): void;
        onDisconnection?: IHookFunc;
        onConnection?: IHookFunc;
        onRequest?: IHookFunc;
    } = {};
    public hapi: Server;

    private users: any = {
        guest: {
            username: authGuestName,
            password: authGuestPasswd
        }
    };
    private store: any;

    get conf() {
        const {port, host} = this;
        return {port, host};
    }

    private constructor(conf?: IServerConfig) {
        this.host = (conf && conf.host) || "localhost";
        this.password = conf && conf.password;
        this.port = (conf && conf.port) || NODE_PORT;
        this.logger = (conf && conf.logger) || this.logger;
        this.hooks = {};
        const hapiConf = (conf && conf.hapi) || {
            port: this.port
        };
        this.hapi = new Hapi.Server(hapiConf);
        const logger = console;
        this.store = new RedisStore({
            config: {
                projectId: conf && conf.projectId || "defaultProject",
                logger,
                factory: new RedisClientFactory({logger})
            }
        });
        const self = this;
        this.hapi.ext("onRequest", (request, h) => {
            // Change all requests to '/test'
            // request.setUrl('/test');
            // this.logger.log('RECEIVED REQUEST');
            try {
                if (
                    self.hooks.onRequest &&
                    typeof self.hooks.onRequest === "function"
                ) {
                    self.hooks.onRequest(request, h);
                }
            } catch (e) {
                self.logger.error("onRequest err", e);
            }
            return h.continue;
        });

        this.hapi.events.on(
            {
                name: "request",
                channels: "internal"
            },
            (request, event, tags) => {
                self.logger &&
                self.logger.log(
                    "--internal=",
                    JSON.stringify(tags),
                    // @ts-ignore
                    event.data && event.data.url,
                    request.method,
                    request.path,
                    // @ts-ignore
                    request.response && request.response.statusCode
                );

                if (tags.received) {
                    try {
                    } catch (e) {
                    }
                }
                // this.logger.log('--\ntags: ',tags);
                // this.logger.log('\n--\nevent: ',event);
                if (tags.error || tags.unauthenticated) {
                    // server.log(['internal', '__\ndata : '], JSON.stringify(event.data));
                }
            }
        );
    }

    public onRequest(func: IHookFunc) {
        this.hooks.onRequest = func;
    }

    static async createInstance(conf?: IServerConfig, routes?: ServerRoute[], subscriptions?: IObject[], hapiOptions?: IObject) {
        const _server = new WebSocketServer(conf);
        await _server._start(routes, subscriptions, hapiOptions);
        return _server;
    }

    onDisconnection(func: IHookFunc) {
        this.hooks.onDisconnection = func;
    }

    onConnection(func: IHookFunc) {
        this.hooks.onConnection = func;
    }

    info(msg: any) {
        if (this.logger) {
            this.logger.info(msg);
        }
    }

    error(msg: any) {
        if (this.logger) {
            this.logger.error(msg);
        }
    }

    getCredentials(request: Request) {
        return request.auth.credentials;
    }

    publish(path: string, data: any) {
        // @ts-ignore
        return this.hapi.publish(path, data);
    }

    stop(path: string, data: any) {
        return this.hapi.stop();
    }

    publishRef(ref: IObject) {
        const self = this;
        const path = `/${ref.pathName
            .split("/")
            .slice(2)
            .join("/")}`;
        // ref.logger.info('Will publish ', ref.pathName, 'to', path, 'to clients!');
        // self.hapi.subscription(path);
        ref.onSnapshot(async (data: any) => {
            await self.publish(path, data);
        });
    }

    publishRefs(refs: any[]) {
        refs && refs.map && refs.map(ref => this.publishRef(ref));
    }

    async _start(routes?: ServerRoute[], _subscriptions?: any[], hapiOptions?: IObject) {
        const onDisconnection = async (r: Request, h: any) => {
            try {
                if (this.hooks.onDisconnection) {
                    await Promise.resolve(this.hooks.onDisconnection(r, h));
                }
            } catch (e) {
                this.logger.error("onDisconnection", e);
            }
        };
        const onConnection = async (r: Request, h: any) => {
            try {
                if (this.hooks.onConnection) {
                    await Promise.resolve(this.hooks.onConnection(r, h));
                }
            } catch (e) {
                this.logger.error("onConnection", e);
            }
        };
        const onSubscribe = async (s: any, path: string, params: IObject) => {
            try {
                this.logger && this.logger.log("client subscribe to", path);
                if (this.hooks.onSubscribe) {
                    await Promise.resolve(this.hooks.onSubscribe(s, path, params));
                }
            } catch (e) {
                this.logger.error("onSubscribe", e);
            }
        };

        let nesOptions = {
            onDisconnection,
            onConnection
        };

        const subscriptions = [
            "/{collectionId}",
            "/{collectionId}/{docId}",
            "/{collectionId}/{docId}/{subcollectionId}",
            "/{collectionId}/{docId}/{subcollectionId}/{subdocId}"
            // '/{collectionId}/{docId}/{subcollectionId}/{subdocId}/{sub2collectionId}',
            // '/{collectionId}/{docId}/{subcollectionId}/{subdocId}/{sub2collectionId}/{sub2docId}',
        ];
        const keywords = [
            "collectionId",
            "docId",
            "subcollectionId",
            "subdocId",
            "sub2collectionId",
            "sub2docId"
        ];
        const validation = (thePath: string) => {
            const params: IObject = {};
            keywords.forEach(keyword => {
                if (thePath.indexOf(keyword) != -1) {
                    params[keyword] = Joi.string();
                }
            });
            //this.logger.log('params',  params);
            return {params};
        };

        const gettersRoutes = subscriptions.map(path => ({
            method: "GET",
            path,
            config: {
                cors,
                id: path.replace("/", ""),
                // auth:'jwt-admin-users-webedia',
                handler: (request: Request, h: any) => {
                    return this.store.collection()
                },
                description: "cache storage",
                // tags: ['api', 'redis cache storage'],
                validate: validation(path)
            }
        }));
        _subscriptions && subscriptions.push(..._subscriptions);
        // _subscriptions && subscriptions.concat(_subscriptions);
        let swaggerOptions = {
            securityDefinitions: {
                Bearer: {
                    type: "apiKey",
                    name: "Authorization",
                    in: "header"
                },
                simple: {
                    type: "basic",
                    name: "Authorization",
                    in: "header"
                }
            },
            info: {
                title: "Rest API Documentation",
                version: Pack.version
            },
            host,
            schemes,
            grouping: "tags",
            jsonEditor: true,
            security: [
                {
                    jwt: [],
                    simple: []
                }
            ]
        };

        if (hapiOptions && hapiOptions.nesOptions) {
            nesOptions = Object.assign({},hapiOptions.nesOptions,nesOptions)
        }

        if (hapiOptions && hapiOptions.swaggerOptions) {
            swaggerOptions = Object.assign({},swaggerOptions, hapiOptions.swaggerOptions)
        }

        const hapiRegister = [
            Inert,
            Vision,
            {
                plugin: HapiSwagger,
                options: swaggerOptions
            },
            Basic, //  Jwt, Auth

        ];

        if (hapiOptions && hapiOptions.register) {
            if (hapiOptions.register.map) {
                hapiRegister.push(...hapiOptions.register);
            } else {
                hapiRegister.push(hapiOptions.register);
            }
        }

        hapiRegister.push({
            plugin: Nes,
            options: nesOptions
        });

        await this.hapi.register(hapiRegister);
        if (hapiOptions && hapiOptions.routes && hapiOptions.routes.prefix) {
            this.hapi.realm.modifiers.route.prefix = hapiOptions.routes.prefix;
        }
        // await this.hapi.register([Basic, Nes]);
        const basicValidateFunc = async (request: Request, username: string, password: string) => {
            //const isValid = await Bcrypt.compare(password, user.password);
            console.log('internal auto check basic auth', password, password);
            const isValid = authGuestName ? username === authGuestName && password === authGuestPasswd : true ;
            const credentials = {
                id: username,
                name: username
            };
            return {
                isValid,
                credentials,
                strategy: "simple"
            };
        };
        const validate = hapiOptions && hapiOptions.basicValidateFunc || basicValidateFunc;
        this.hapi.auth.strategy("simple", "basic", {validate});
        this.hapi.auth.default("simple");
        if (routes) {
            if (routes.map) {
                routes.map(route => {
                    if (route.method === "SUB") {
                        // this.hapi.publish(route.path, data);
                        // @ts-ignore
                        this.hapi.subscription(route.path, {onSubscribe});
                        const getterRoute: ServerRoute = Object.assign(
                            {},
                            route,
                            {method: "GET"},
                            {
                                config: Object.assign(
                                    {},
                                    {
                                        handler: async () => {
                                            const doc = this.store.collection(route.path);
                                            const resp = await doc.get();
                                            return resp;
                                        }
                                    },
                                    // @ts-ignore
                                    route.config || {}
                                )
                            }
                        );
                        this.hapi.route(getterRoute);
                    } else {
                        this.hapi.route(Object.assign({}, route));
                    }
                });
            } else {
                this.hapi.route(routes);
            }
        }

        gettersRoutes.map(route => this.hapi.route(Object.assign({}, route)));

        subscriptions.map(subscription =>
            // @ts-ignore
            this.hapi.subscription(subscription, {onSubscribe})
        );

        await this.hapi.start();
        this.hapi
            .table()
            .forEach(
                route =>
                    this.logger && this.logger.log(`${route.method}\t${route.path}`)
            );
        // this.logger
        // .log('server enabled subscription API',
        // ' ( server can publish on for clients to subscrible to)');
        subscriptions &&
        subscriptions.forEach &&
        subscriptions.forEach(
            subscription => this.logger && this.logger.log(subscription)
        );
    }
}

export default WebSocketServer;
