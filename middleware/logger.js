const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Логирование в файл
function logToFile(entry) {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, 'requests.log');
  const logEntry = JSON.stringify(entry) + '\n';
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Ошибка записи лога:', err);
  });
}

// Логирование в БД
function logToDatabase(entry) {
  const dbPath = path.join(__dirname, '..', 'db', 'database.sqlite');
  const database = new sqlite3.Database(dbPath);
  
  database.run(
    `INSERT INTO logs (timestamp, method, url, status, ip, user_agent, user_id, duration, request_body, response_body)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.timestamp,
      entry.method,
      entry.url,
      entry.status,
      entry.ip,
      entry.userAgent,
      entry.userId || null,
      entry.duration || null,
      entry.requestBody || null,
      entry.responseBody || null
    ],
    (err) => {
      if (err) console.error('Ошибка записи лога в БД:', err);
      database.close();
    }
  );
}

module.exports = (req, res, next) => {
  const start = Date.now();
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  // Сохраняем оригинальный метод send
  const originalSend = res.send;
  let responseBody = null;
  
  res.send = function(body) {
    try {
      responseBody = typeof body === 'string' ? body.substring(0, 1000) : JSON.stringify(body).substring(0, 1000);
    } catch (e) {
      responseBody = '[Не удалось сериализовать ответ]';
    }
    originalSend.call(this, body);
  };

  // Логируем после завершения запроса
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ip: ip,
      userAgent: req.headers['user-agent'] || '-',
      userId: req.userId || null,
      duration: duration,
      requestBody: (req.method === 'POST' || req.method === 'PUT') ? JSON.stringify(req.body).substring(0, 500) : null,
      responseBody: responseBody
    };

    // Логируем в файл и БД
    logToFile(logEntry);
    logToDatabase(logEntry);
  });

  next();
};