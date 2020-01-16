'use strict'

const redis = require('./redis_tool');
const redisConfig = require('./config').REDIS;

function test() {
    redis.init(redisConfig, result => {
        if (!result) {
            console.debug("初始化失败");
            return;
        }
        const value = Math.floor(Math.random() * 100);
        const request = Math.floor(Math.random() * 10);

        redis.changeRedisValue('test', request, value, (ret) => {
            console.debug(ret);
        });

    });

}


function loopTest() {
    // for (let i = 0; i < 10; i++) {
    const requestId = Math.floor(Math.random() * 10);

    redis.init(redisConfig, result => {
        if (!result) {
            console.debug("初始化失败");
            return;
        }
        let count = 0;
        let err = 0;
        const stratTime = Date.now();
        for (let j = 0; j < 100000; j++) {
            const value = Math.floor(Math.random() * 100 + j);
            // console.debug("值", value);

            (function () {
                setTimeout(() => {
                    redis.changeRedisValue('test', requestId, 1, (ret) => {
                        count++;
                        if (!ret) {
                            err++;
                        }
                        console.debug("返回结果", ret, 1, count, err);
                    });
                }, j * 10);
            })(j)


            const end = Date.now();
            if (end - stratTime > 1800 * 1000) {
                break
            }
            // setTimeoutArr.push(aa);

        }
    });

    // }
}

function sleep(delay) {
    const start = (new Date()).getTime();
    while ((new Date()).getTime() - start < delay) {
        continue;
    }
}
loopTest();
// test();