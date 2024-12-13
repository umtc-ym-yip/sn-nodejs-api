const mysql = require('mysql2');
const dbConfig = require('../config/database');

// 存儲所有連接池的 Map
const pools = new Map();

// 初始化單個連接池
const initPool = async (name) => {
    if (!dbConfig[name]) {
        throw new Error(`找不到資料庫配置: ${name}`);
    }

    try {
        const pool = mysql.createPool(dbConfig[name]);
        
        // 測試連接
        await new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if (err) {
                    console.error(`資料庫 ${name} 連接池初始化失敗:`, err);
                    reject(err);
                }
                // connection.release();
                pools.set(name, pool);
                console.log(`資料庫 ${name} 連接池已成功初始化`);
                resolve();
            });
        });
    } catch (error) {
        console.error(`建立 ${name} 連接池時發生錯誤:`, error);
        throw error;
    }
};

// 初始化所有連接池
const initAllPools = async () => {
    try {
        await Promise.all(
            Object.keys(dbConfig).map(name => initPool(name))
        );
        console.log('所有資料庫連接池初始化完成');
    } catch (error) {
        console.error('初始化連接池時發生錯誤:', error);
        throw error;
    }
};

// 獲取指定的連接池
const getPool = (name) => {
    const pool = pools.get(name);
    if (!pool) {
        throw new Error(`連接池 ${name} 尚未初始化`);
    }
    return pool;
};

// 執行查詢
const query = async (poolName, sql, params) => {
    const pool = getPool(poolName);
    try {
        const [results] = await pool.promise().query(sql, params);
        return results;
    } catch (error) {
        console.error(`在 ${poolName} 執行查詢時發生錯誤:`, error);
        throw error;
    }
};

// 關閉所有連接池
const closeAllPools = async () => {
    const closePromises = Array.from(pools.entries()).map(([name, pool]) => {
        return new Promise((resolve, reject) => {
            pool.end(err => {
                if (err) {
                    console.error(`關閉 ${name} 連接池時發生錯誤:`, err);
                    reject(err);
                } else {
                    console.log(`${name} 連接池已關閉`);
                    resolve();
                }
            });
        });
    });

    try {
        await Promise.all(closePromises);
        pools.clear();
        console.log('所有資料庫連接池已關閉');
    } catch (error) {
        console.error('關閉連接池時發生錯誤:', error);
        throw error;
    }
};

module.exports = {
    initPool,
    initAllPools,
    getPool,
    query,
    closeAllPools
}; 