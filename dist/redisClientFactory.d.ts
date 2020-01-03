export declare class RedisClientFactory {
    host: string;
    password: string | undefined;
    logger: undefined | any;
    port: string[];
    constructor(conf?: any);
    info(msg: string): void;
    error(msg: string): void;
    getHosts(): string[];
    getOptions(): {
        usePromise: boolean;
        clusterMode: boolean;
        authPass: string;
    };
    getConf(): {
        host: string;
        port: number;
        password: string;
    }[];
    createClient(userName: string, onFailure: (arg0: any) => void, onConnect: () => void): any;
}
