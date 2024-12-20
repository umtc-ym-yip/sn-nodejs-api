const express = require('express');
const soap = require('soap');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { configFunc } = require('../config.js');
const { mysqlConnection, queryFunc } = require('../mysql.js');
const getDbConfig = require('../config/database');
const { timestampToYMDHIS } = require('../time.js');

const router = express.Router();

// CORS 設置
router.use((req, res, next) => {
    // 允許特定來源或使用 * 允許所有來源
    res.header('Access-Control-Allow-Origin', '*');
    
    // 允許的 HTTP 方法
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // 允許的請求頭
    res.header('Access-Control-Allow-Headers', 
        'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // 允許發送認證信息
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // 處理 OPTIONS 請求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

const key = 'YMYIP';
// const whiteList = ['00776', '05866', '09068', 'A0274'];
const SOAP_TIMEOUT = 30000; // 30秒超時

router.use(bodyParser.json());

// 登入路由
router.post('/login', async (req, res) => {
    const url = 'http://10.13.66.33/WCF_MyumtAuth/Service1.svc?singleWsdl';
    const args = req.body;
    console.log(args);
    // args.EMPID = 'A4378';
    // args.PWD = '16736';
    try {
        // 建立 SOAP 客戶端
        const client = await new Promise((resolve, reject) => {
            const options = {
                timeout: SOAP_TIMEOUT,
                forceSoap12Headers: false,
                wsdl_headers: {
                    Connection: 'keep-alive'
                }
            };

            soap.createClient(url, options, (err, client) => {
                if (err) {
                    console.error('SOAP 客戶端創建失敗:', err);
                    reject(err);
                } else {
                    resolve(client);
                }
            });
        });
        //給我一個現在時間的函式
        const now = new Date();
        console.log('現在時間',now);
        const time=now.getTime()
        console.log('時間戳',time);
        

        // 調用 SOAP 服務
        const result = await new Promise((resolve, reject) => {
            client.Myumt_Auth(args, (err, result) => {
                if (err) {
                    console.error('SOAP 服務調用失敗:', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
        console.log('結果',result);
        // 處理認證結果
        if (!result || !result.Myumt_AuthResult) {
            return res.status(500).json({ status: 'error', message: '認證服務返回無效結果' ,time});
        }
        // if (result.Myumt_AuthResult.DeptName.includes('YM') === false && 
        //     whiteList.includes(result.Myumt_AuthResult.id) === false) {
        //     return res.status(403).json({ status: 'error', message: '非YM或白名單用戶' });
        // }
        if (result.Myumt_AuthResult.Status === false) {
            return res.status(401).json({ status: 'error', message: '用戶不存在或帳號密碼錯誤，請重新輸入' ,time});
        }

        // 生成 JWT token
        const { id, name, DeptName,email,d1name } = result.Myumt_AuthResult;
        const whitelist = await queryFunc(connection, sqlStr);
        const authority = whitelist.map(item => item.authority).push(d1name);

        const token = jwt.sign({ id, name, DeptName,email,authority }, key);
        // 獲取白名單
        const connection = await mysqlConnection(getDbConfig('user'));

        // 先將現有權限標記為刪除
        const sqlStr = `SELECT * FROM Whitelist WHERE isdelete = 'false' AND uid = '${id}'`;
        // console.log(sqlStrrevise);
        
        result.Myumt_AuthResult.authority = authority;

        res.json({
            status: 'success',
            message: '成功',
            token,
            data: result.Myumt_AuthResult,
            time,
        });

    } catch (error) {
        console.error('登入處理失敗:', error);
        res.status(500).json({
            status: 'error',
            message: '服務暫時無法使用，請稍後再試',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            time, 
        });
    }
});

// 獲取白名單
router.get('/getwhitelist', async (req, res) => {
    const time=new Date().getTime()
    const connection = await mysqlConnection(getDbConfig('user'));
    const sqlStr = `SELECT * FROM Whitelist WHERE isdelete = 'false'`;
    const result = await queryFunc(connection, sqlStr);
    res.json({status:'success',message:'成功',data:result,time});
});

// Token 驗證中間件
const verifyToken = (req, res, next) => {
    const time=new Date().getTime()
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ status: 'error', message: '未登入' ,time});
    }

    jwt.verify(token, key, (err, user) => {
        if (err) {
            return res.status(403).json({ status: 'error', message: '驗證錯誤' ,time});
        }
        req.user = user;
        next();
    });
};

// 驗證路由
router.get('/verify', verifyToken, (req, res) => {
    const time=new Date().getTime()
    res.json({ status: 'success', message: '成功', user: req.user,time });
});

// 記錄路由
router.post('/record', verifyToken, async (req, res) => {
    const time=new Date().getTime()
    try {
        const { ID, Name, DeptName, Time, Path } = req.body;
        const connection = await mysqlConnection(getDbConfig('user'));
        
        const sqlStr = `INSERT INTO user_record(ID, Name, DeptName, Time, Path) 
                       VALUES (?, ?, ?, ?, ?)`;
        const result = await queryFunc(connection, sqlStr, [ID, Name, DeptName, Time, Path]);
        
        res.json({status:'success',message:'成功',data:result,time});
    } catch (error) {
        console.error('記錄創建失敗:', error);
        res.status(500).json({ status: 'error', message: '記錄創建失敗' ,time});
    }
});

// 獲取記錄數量
router.get('/record/:st', verifyToken, async (req, res) => {
    const time=new Date().getTime()
    try {
        const { st } = req.params;
        const connection = await mysqlConnection(getDbConfig('user'));
        const transSt = timestampToYMDHIS(new Date(Number(st)));
        
        const sqlStr = `SELECT Count(*) as Count FROM user_record 
                       WHERE Path = '/login' AND Time >= ?`;
        const result = await queryFunc(connection, sqlStr, [transSt]);
        
        res.json({status:'success',message:'成功',data:result,time});
    } catch (error) {
        console.error('記錄查詢失敗:', error);
        res.status(500).json({ status: 'error', message: '記錄查詢失敗' ,time});
    }
});


router.post('/revisewhitelist', async (req, res) => {
    const time = new Date().getTime();
    console.log(time);
    // 將時間戳轉換為日期 格式為2024-12-20 00:00:00
    const date = new Date(time);
    const dateStr = date.toISOString().slice(0, 19).replace('T', ' ');
    console.log(dateStr);
    try {
        const { uid, authority, creater } = req.body;
        console.log(req.body);
        // 驗證必要參數
        if (!uid || !authority || !creater) {
            return res.status(400).json({
                status: 'error',
                message: '缺少必要參數',
                time
            });
        }

        const connection = await mysqlConnection(getDbConfig('user'));
    
        // 使用事務確保數據一致性
        // await connection.beginTransaction();
        
        try {
            // 先將現有權限標記為刪除
            const sqlStrrevise = `UPDATE Whitelist SET isdelete = 'true' WHERE uid = '${uid}'`;
            // console.log(sqlStrrevise);
            await queryFunc(connection, sqlStrrevise);
            
            // 插入新的權限
            for (const auth of authority) {
                //可以抓出id這個資料表的資料數量
                const sqlStrid = `SELECT COUNT(*) as Count FROM Whitelist`;
                const resultid = await queryFunc(connection, sqlStrid);
                const id = resultid[0].Count + 1;
                const sqlStrinsert = `
                    INSERT INTO Whitelist (id,uid, authority, creater, isdelete,time) 
                    VALUES ('${id}','${uid}', '${auth}', '${creater}', 'false','${dateStr}')`;
                    // console.log(sqlStrinsert);
                await queryFunc(connection, sqlStrinsert);
            }
            
            // 提交事務
            // await connection.commit();
            
            res.status(200).json({
                status: 'success',
                message: '成功',
                data: {
                    uid,
                    authority,
                    creater
                },
                time
            });
            
        } catch (error) {
            // 如果出錯，回滾事務
            await connection.rollback();
            throw error;
        }
        
    } catch (error) {
        console.error('記錄創建失敗:', error);
        res.status(500).json({
            status: 'error',
            message: '記錄創建失敗',
            time
        });
    }
});

module.exports = router;
