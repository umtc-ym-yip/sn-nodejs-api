const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = 3000;

// 設定 MySQL 連接
const pool = mysql.createPool({
  host: 'mysql',
  user: 'root',
  password: 'example',
  database: 'testdb',
});



// 簡單的 API 路由
app.get('/', (req, res) => {
  res.send('000');
});

// 查詢資料庫的 API
app.get('/users', (req, res) => {
  pool.query('SELECT * FROM users', (error, results) => {
    if (error) throw error;
    res.json(results);
  });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
//   console.log(`API running at https://urldefense.com/v3/__http://localhost:$*7Bport*7D__;JSU!!OjObNGN7aA!2Guz15YnXrlI9rzomOvOVyBmjvYcA7A1BZ5GFVUqSbpRKD-X1hAptpByyPaGCTSz8L1joL5Y913bPqhMMzh6DJQ-$ `);
});
