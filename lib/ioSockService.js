const socketIo = require("socket.io");
const ioReq = require("socket.io-request");
const Logger = require('./logger');

let counter = 0;
const start = (server, redisStore) => {
  const io = socketIo(server.listener);

  const connections = new Map();

  io.on("connection", sio => {
    const unsubscribers = {};
    connections.set(sio, sio);

    sio.once("disconnect", () => {
      Logger.info("disconnections");
      Object.keys(unsubscribers).forEach(id => {
        Logger.info("unsubscribe web client snap for " + id);
        unsubscribers[id]();
      });
      connections.delete(sio);
    });

    sio.on("getCounter", callback => {
      // Increment the counter
      counter++;

      Logger.info(`Returning getCounter with counter ${counter}`);

      // Use a Node style callback (error, value)
      callback(null, counter);
    });

    ioReq(sio).response("get", (id, res) => {
      // method, handler
      redisStore
        .collection(id)
        .get()
        .then(data => {
          Logger.info("get response for : " + id);
          res(data);
        })
        .catch(e => {
          Logger.error("doc.get socket error " + e.message);
          Logger.error(e.stack);
        });
    });

    sio.on("iiiget", id => {
      Logger.info("client requesting doc : " + id);
      // socket.join(id);
      redisStore
        .collection(id)
        .get()
        .then(data => {
          //Logger.warn("emit get for", id);
          sio.emit(id, data);
        })
        .catch(e => {
          Logger.error("doc.get socket error : " + e.message);
          Logger.error(e.stack);
        });
    });

    ioReq(sio).response("set", (doc, res) => {
      // method, handler
      Logger.info("client set doc : " + doc.path);
      const ref = redisStore.collection(doc.path);
      ref
        .set(doc.data)
        .then(data => {
          Logger.info("socket set data OK for path : " + doc.path + " to : " + ref.pathName);
          res(data);
        })
        .catch(e => {
          Logger.error("set socket failed for : " + doc.path);
          Logger.error(e.message);
          Logger.error(e.stack);
        });
    });

    sio.on("iiiset00", doc => {
      Logger.info("client set doc : " + doc.path);

      const ref = redisStore.collection(doc.path);
      ref
        .set(doc.data)
        .then(data => {
          Logger.info("socket set data OK for path : " + doc.path + " to : " + ref.pathName);
        })
        .catch(e => {
          Logger.error("set socket failed for " + doc.path);
          Logger.error(e.message);
          Logger.error(e.stack);
        });
    });

    sio.on("snapshot", path => {
      Logger.info('client requesting snapshot doc : ' + path);

      // socket.emit(id, "connected to " + id)
      const ref = redisStore.collection(path);
      ref
        .get()
        .then(data => {
          Logger.info("emit on snapshot for : " + path);
          sio.emit(path, data);
        })
        .catch(e => {
          Logger.error("doc.get socket error " + e.message);
          Logger.error(e.stack);
        });
      unsubscribers[path] = ref.onSnapshot(data => {
        Logger.info("server socket emit snapshot for : " + path);
        Logger.info(data);
        sio.emit(path, data);
      });
      // .catch(e => Logger.error('doc.get socket error', e))
    });
    sio.on("unsubscribe", id => {
      Logger.info("client requesting snapshot doc : " + id);
      // socket.emit(id, "connected to " + id)
      unsubscribers[id] && unsubscribers[id]();
    });
  });
};

module.exports = { start };
