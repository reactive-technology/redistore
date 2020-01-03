import { IObject, IServerConfig } from "./interface";
export * from "./interface";
import { Request, Server, ServerRoute } from "@hapi/hapi";
export declare type IHookFunc = (request: Request, h: any) => void;
export declare class WebSocketServer {
    private host;
    private password?;
    private port;
    private logger;
    private hooks;
    hapi: Server;
    private users;
    private store;
    get conf(): {
        port: string | number;
        host: string;
    };
    private constructor();
    onRequest(func: IHookFunc): void;
    static createInstance(conf?: IServerConfig, routes?: ServerRoute[], subscriptions?: IObject[], hapiOptions?: IObject): Promise<WebSocketServer>;
    onDisconnection(func: IHookFunc): void;
    onConnection(func: IHookFunc): void;
    info(msg: any): void;
    error(msg: any): void;
    getCredentials(request: Request): import("@hapi/hapi").AuthCredentials;
    publish(path: string, data: any): any;
    stop(path: string, data: any): Promise<void>;
    publishRef(ref: IObject): void;
    publishRefs(refs: any[]): void;
    _start(routes?: ServerRoute[], _subscriptions?: any[], hapiOptions?: IObject): Promise<void>;
}
export default WebSocketServer;
