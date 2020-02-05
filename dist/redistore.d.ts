export declare class RankingField {
    private type;
    private rankingField;
    private filteringKeys;
    constructor(rankingField: any, filteringKeys: any);
}
export declare class RedisStore {
    private logger;
    private projectId;
    private redisClient;
    private redlock;
    private where_clauses;
    private id;
    private _id;
    private docType;
    private parent;
    private indexes;
    private pathName;
    private pathCollection;
    private pathIndexes;
    private pathMetadata;
    private defaultRankingIndex;
    private rankingField;
    private types;
    private _lock;
    private unsubscribe;
    private timeout;
    get path(): string;
    constructor(parent: any, type?: any, docName?: any, rankingField?: {} | undefined);
    static createInstance(config: any): any;
    static getInstance(): any;
    getRedisClient(): any;
    throw_error(msg: string | undefined, reject?: ((arg0: any) => void) | undefined): void;
    setLogger(logger: any): void;
    doc(docName?: string | undefined): any;
    item(docName: any): RedisStore | undefined;
    collection(collectionName: any, type?: string): any;
    SortedCollection(collectionName: any, rankingField: any): RedisStore | undefined;
    addIndex(indexes: any): Promise<any[] | undefined>;
    getRankingFieldName(rankingField: any, filteringKeys: any): string;
    withRankingField(rankingField: any, filteringKeys?: any | undefined): this;
    getDocumentIndexes(pathIndexes?: string): Promise<any>;
    persist(path?: string | undefined): void;
    expire(path: string, time: number): void;
    expireIn(timeout: number): void;
    formatIndexSubKeys(index: any, data: any): any;
    formatIndexKey(index: {
        type: any;
        rankingField: any;
    }, data?: undefined, path?: string | undefined): string;
    getRankingPoolKey(index: any, indexMap: any, path?: string | undefined): string;
    getRankingPoolId(index: {
        type: any;
        rankingField: any;
    }, path?: string | undefined): string;
    updateIndexValue(indexMap: any, merge: boolean): Promise<"ok" | [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]>;
    getRankingCount0(data: any): Promise<any>;
    getRankingCount(data: any, min?: string, max?: string): Promise<any>;
    getRank(data: any): Promise<any>;
    rankingRange(min: any, max: any, data: any): Promise<any>;
    scoringRange(min: any, max: any, data: any): Promise<any>;
    rankFor(id: any): Promise<unknown>;
    withTypes(types: any): this;
    getAtomicSlot(timeout?: number): Promise<{
        release: () => Promise<any>;
    } | null>;
    setLock(timeout?: number, _locker?: boolean): any;
    unlock(): void;
    semLock(timeout?: number): any;
    clone(): any;
    queueCollection(queueName: any): RedisStore | undefined;
    list(listName: any): RedisStore | undefined;
    pushJob(job: any): Promise<unknown>;
    checkProcessedJobs(sId: any, cb: any): void;
    startWorker(userHandler: any, qRedisClient: any): this;
    push(work: any): Promise<unknown>;
    rangeByScore(scoreMin: any, scoreMax: any, limit: any): Promise<unknown>;
    lrange(rankMin: any, rankMax: any): Promise<unknown>;
    lrank(member: any): Promise<unknown>;
    pop(): Promise<unknown>;
    hasMember(member: any): Promise<unknown>;
    exists(): Promise<unknown>;
    members(): Promise<unknown>;
    where(a: any, eq: any, b: any): any;
    limit(l: (l: any) => RedisStore): any;
    orderBy(a: any, eq: any): any;
    delete(): Promise<unknown>;
    remove(): Promise<unknown>;
    removeToBeDeletedKeys(data: any): Promise<any>;
    addParentIdIfNotExist(): Promise<void>;
    incr(): Promise<void>;
    decr(): Promise<void>;
    get(opt?: {
        withContent: boolean;
    }): Promise<unknown>;
    setDocData(data: string, opt?: any): Promise<string>;
    addItem(data: any): Promise<any>;
    removeItem(data: any): Promise<any>;
    getItems(): Promise<any>;
    delayedRemoveAll(timeout: number, ids: any[]): Promise<void>;
    onSnapshot(options: any, callback: ((arg0: any) => void) | undefined): any;
    emit(): void;
    setCollectionData(_data: any, opt: {
        merge?: boolean;
        isReplicate?: any;
    }): Promise<any>;
    set(_data: any, opt?: {
        merge: boolean;
    }): Promise<any>;
    setMetadata(_data: any): Promise<any>;
    getMetadata(_data: any): Promise<any>;
    publishToAll(server: any): void;
}
