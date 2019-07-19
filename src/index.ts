import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(__dirname, "/.env") });

export {RedisStore, RankingField} from './redistore';
export {RedisClientFactory} from './redisClientFactory';
export {WebSocketServer} from './webSocketServer';
export { IObject, IServerConfig } from "./interface";
export { schema} from "./validators";
//export * from "zafiro-validators";

