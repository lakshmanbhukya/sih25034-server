const MessagePackUtil = require('../utils/messagepack');

/**
 * Middleware to handle MessagePack requests and responses
 */
function messagePackMiddleware(req, res, next) {
  // Handle incoming MessagePack requests
  if (req.headers['content-type'] === 'application/msgpack') {
    let buffer = Buffer.alloc(0);
    
    req.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
    });
    
    req.on('end', () => {
      try {
        req.body = MessagePackUtil.decode(buffer);
        next();
      } catch (error) {
        return res.status(400).json({ error: 'Invalid MessagePack data' });
      }
    });
  } else {
    next();
  }
}

/**
 * Response helper to send MessagePack responses
 */
function addMessagePackResponse(req, res, next) {
  res.msgpack = function(data) {
    try {
      const buffer = MessagePackUtil.encode(data);
      res.set('Content-Type', 'application/msgpack');
      res.send(buffer);
    } catch (error) {
      // Fallback to JSON if MessagePack encoding fails
      res.json(data);
    }
  };
  next();
}

module.exports = {
  messagePackMiddleware,
  addMessagePackResponse
};