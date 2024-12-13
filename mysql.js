const mysql = require('mysql2');

const mysqlConnection = (config) => {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(config);
        connection.connect((err) => {
            if (err) { reject(err) }
            else {
                resolve(connection)
            }
        })
    })
};

const queryFunc=(connection,sql,data)=>{
    return new Promise((resolve, reject) => {
        connection.query(sql,data, (err, results) => {
            if (err) { reject(err) } else {
                resolve(results)
            }
        })
    })
};

// function query(params,callback){
//     ////params 去處理一個查詢




//     let result=....;
//     let error=....;
//     callback(error,result)
// }

// query(params,(err,result)=>{
//     if(err){
//         console.log(err)
//     }else{
//         console.log(result)
//     }
// })

module.exports={
    mysqlConnection,
    queryFunc
};