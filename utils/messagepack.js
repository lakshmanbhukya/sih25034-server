const msgpack = require('msgpack5')();

/**
 * MessagePack utility for fast binary serialization
 * Used for backend-to-backend communication with external APIs
 */
class MessagePackUtil {
  /**
   * Serialize data to MessagePack binary format
   * @param {Object} data - Data to serialize
   * @returns {Buffer} - MessagePack encoded buffer
   */
  static encode(data) {
    try {
      return msgpack.encode(data);
    } catch (error) {
      console.error('MessagePack encode error:', error);
      throw new Error('Failed to encode data to MessagePack');
    }
  }

  /**
   * Deserialize MessagePack binary data
   * @param {Buffer} buffer - MessagePack encoded buffer
   * @returns {Object} - Decoded data
   */
  static decode(buffer) {
    try {
      return msgpack.decode(buffer);
    } catch (error) {
      console.error('MessagePack decode error:', error);
      throw new Error('Failed to decode MessagePack data');
    }
  }

  /**
   * Get appropriate headers for MessagePack requests
   * @returns {Object} - Headers object
   */
  static getHeaders() {
    return {
      'Content-Type': 'application/msgpack',
      'Accept': 'application/msgpack'
    };
  }

  /**
   * Check if external API supports MessagePack
   * @param {string} url - API endpoint URL
   * @returns {Promise<boolean>} - Whether API supports MessagePack
   */
  static async supportsMessagePack(url) {
    try {
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'Accept': 'application/msgpack'
        }
      });
      
      const acceptHeader = response.headers.get('Accept') || '';
      return acceptHeader.includes('application/msgpack');
    } catch (error) {
      console.log('MessagePack support check failed, falling back to JSON');
      return false;
    }
  }
}

module.exports = MessagePackUtil;