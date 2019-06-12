export interface IObjectIndexer<T> {
    [id: string]: T;
}

export interface IObject extends IObjectIndexer<any> {}
export interface IServerConfig extends IObjectIndexer<any> {
    host:string;
    password:string;
    port:string;
    logger:IObject;
    hooks:IObject;
}

