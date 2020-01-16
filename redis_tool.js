'use strict'
const redis = require('redis');

let client = null;
const LOCK_SUCCESS = "OK";
const SET_IF_NOT_EXIST = "NX";
const SET_WITH_EXPIRE_TIME = "PX";
const RELEASE_SUCCESS = 1;
const LOCK_TIMEOUT = 25000;
exports.init = (opt, callback) => {
    callback = (null == callback ? base.nop : callback);

    console.info("To connect redis..");
    let RDS_OPTS = {}; // {auth_pass:opt.RDS_PWD};
    client = redis.createClient(opt.PORT, opt.HOST, RDS_OPTS);
    client.select(opt.DB, () => { console.info('Redis select db :' + opt.DB); });

    client.on('connect', () => { });
    client.on('end', () => { console.info('Redis was end.'); });
    client.on("error", function (error) {
        console.error(error);
    });

    client.on('ready', function () {
        console.info('Redis has ready!');
        callback(true);
    });
};

/**
 * 加锁
 * @param {String} lockKey key
 * @param {String} requestId 客户端ID
 * @param {Number} expireTime 过期事件
 * @param {Function} callback 回调
 */
function lock(lockKey, requestId, expireTime = 3000, callback) {
    const start = Date.now();
    const self = this;
    expireTime = expireTime > 3000 ? expireTime : 3000;
    const intranetLock = () => {
        // console.debug(lockKey, requestId, SET_IF_NOT_EXIST, SET_WITH_EXPIRE_TIME, expireTime);
        // key , value ,过期单位px:毫秒 expireTime 过期时间  setMode "NX"
        client.set(lockKey, requestId, SET_WITH_EXPIRE_TIME, expireTime, SET_IF_NOT_EXIST, (err, result) => {
            if (err) {
                console.error("lock==>", err);
                return;
            }
            if (LOCK_SUCCESS === result) {
                // console.log(`${lockKey} ${requestId} 上锁成功`);
                return callback(true);
            }
            if (Date.now() - start > LOCK_TIMEOUT) {
                // console.log(`${lockKey} ${requestId} 上锁超时结束`);
                return callback(false);
            }
            // console.debug("锁占用")
            setTimeout(intranetLock, 100);
        })
    };
    intranetLock();
}

/**
 * 解锁
 * @param {String} lockKey key
 * @param {String} requestId 客户端ID
 * @param {Function} callback 回调
 */
function unlock(lockKey, requestId, callback) {
    callback = !callback ? function (a, b, c, d, e, f, g) { } : callback;
    const script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    client.eval(script, 1, lockKey, requestId, (err, result) => {
        if (err) {
            console.error("unlock==>", err);
            return;
        }
        if (RELEASE_SUCCESS === result) {
            // console.debug("解锁成功");
            return callback(true);
        }
        // console.debug("解锁失败");
        return callback(false);
    });


}

// // 主要用于 金额加减操作,其他操作不依赖读写一致
exports.changeRedisValue = (key, requestId, value, callback) => {
    callback = !callback ? function (a, b, c, d, e, f, g) { } : callback;
    const lockKey = key + "_lock";
    // 怎么保证各个客户端公平
    lock(lockKey, requestId, 3000, open => {
        if (open) {
            client.get(key, (err, data) => {
                if (err) {
                    console.error("changeRedisValue==>", err);
                    return;
                }
                console.debug(`${key}:${data}`);
                if (!data) {
                    data = 0;
                }
                data = Number.parseInt(data) + value;
                client.set(key, data, result => {
                    unlock(lockKey, requestId);
                    callback(data);
                });
            })
        } else {
            callback(null);
            // console.error("加锁失败");
        }
    })


}