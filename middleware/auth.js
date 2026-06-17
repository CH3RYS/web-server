const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = (req, res, next) => {
  // Проверяем токен в заголовке Authorization или в cookies
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;

  if (!token) {
    // Если это API запрос, возвращаем ошибку
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    // Для HTML страниц перенаправляем на вход
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Проверяем, что сессия существует и не истекла
    const dbPath = path.join(__dirname, '..', 'db', 'database.sqlite');
    const database = new sqlite3.Database(dbPath);
    
    database.get(
      'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")',
      [token],
      (err, session) => {
        database.close();
        
        if (err || !session) {
          if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Сессия истекла' });
          }
          return res.redirect('/login');
        }

        req.userId = decoded.userId;
        req.user = decoded;
        next();
      }
    );
  } catch (error) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    res.redirect('/login');
  }
};
