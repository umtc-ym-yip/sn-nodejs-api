const express = require('express');
const soap = require('soap');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { configFunc } = require('../config.js');
const { mysqlConnection, queryFunc } = require('../mysql.js');
const { timestampToYMDHIS } = require('../time.js');

const router = express.Router();

// CORS 設置
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-type,Accept,X-Access-Token,X-Key,Authorization');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', true);
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
        const { id, name, DeptName,email } = result.Myumt_AuthResult;
        const token = jwt.sign({ id, name, DeptName,email }, key);

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
        const connection = await mysqlConnection(configFunc('user'));
        
        const sqlStr = `INSERT INTO record(ID, Name, DeptName, Time, Path) 
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
        const connection = await mysqlConnection(configFunc('user'));
        const transSt = timestampToYMDHIS(new Date(Number(st)));
        
        const sqlStr = `SELECT Count(*) as Count FROM record 
                       WHERE Path = '/login' AND Time >= ?`;
        const result = await queryFunc(connection, sqlStr, [transSt]);
        
        res.json({status:'success',message:'成功',data:result,time});
    } catch (error) {
        console.error('記錄查詢失敗:', error);
        res.status(500).json({ status: 'error', message: '記錄查詢失敗' ,time});
    }
});

module.exports = router;
