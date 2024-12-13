const db = require('../utils/db');

const getUserData = async (userId) => {
    try {
        // 從主資料庫查詢
        const userData = await db.query('main', 
            'SELECT * FROM users WHERE id = ?', 
            [userId]
        );

        // 從報表資料庫查詢
        const userStats = await db.query('report', 
            'SELECT * FROM user_statistics WHERE user_id = ?', 
            [userId]
        );

        return {
            ...userData[0],
            statistics: userStats[0]
        };
    } catch (error) {
        console.error('獲取用戶資料失敗:', error);
        throw error;
    }
};

module.exports = {
    getUserData
}; 